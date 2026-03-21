-- ⚔️ OPERATIONS ENGINE — POST-PAYMENT & RECONCILIATION LAYER
-- Protocol version: 7.0 (Seller Payouts, Lifecycle Management, Refund Readiness)

-- 1. ORDER LIFECYCLE STATE REFINEMENT
-- Ensures strict state transitions for logistics and payouts
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_order_status;
ALTER TABLE public.orders ADD CONSTRAINT check_order_status 
  CHECK (status IN ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- 2. SELLER PAYOUT LEDGER (MANDATORY)
-- Tracks the marketplace's liability to individual sellers
CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES auth.users(id),
  order_id UUID REFERENCES public.orders(id),
  payment_id TEXT, -- Link to the master Razorpay payment
  amount NUMERIC NOT NULL, -- Net amount after commission
  commission NUMERIC DEFAULT 0, -- Platform fee (e.g. 10%)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'reversed')),
  payout_reference TEXT, -- Bank transfer ID or Razorpay Payout ID
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. REFUND & DISPUTE TRACKING
-- Extends the payments ledger for reverse financial flows
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none' 
  CHECK (refund_status IN ('none', 'requested', 'processed', 'failed'));

-- 4. ATOMIC FULFILLMENT: place_order_after_payment (V7.0)
-- Upgraded to initialize seller payout records automatically
CREATE OR REPLACE FUNCTION place_order_after_payment(
  p_cart JSONB,
  p_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_is_verified BOOLEAN,
  p_shipping JSONB,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_master_total NUMERIC := 0;
  v_seller RECORD;
  v_item RECORD;
  v_order_id UUID;
  v_return_id UUID;
  v_p_id UUID;
  v_p_qty INTEGER;
  v_db_price NUMERIC;
  v_p_size TEXT;
  v_order_total NUMERIC;
  v_commission_rate NUMERIC := 0.10; -- Example 10% Platform Commission
BEGIN

  PERFORM pg_advisory_xact_lock(hashtext(p_payment_id));

  IF EXISTS (SELECT 1 FROM public.orders WHERE payment_id = p_payment_id) THEN
    SELECT id INTO v_return_id FROM public.orders WHERE payment_id = p_payment_id LIMIT 1;
    RETURN v_return_id;
  END IF;

  IF p_is_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Protocol violation: Verification Required.';
  END IF;

  INSERT INTO public.payments (user_id, payment_id, razorpay_order_id, amount, status)
  VALUES (p_user_id, p_payment_id, p_razorpay_order_id, 0, 'captured')
  ON CONFLICT (payment_id) DO UPDATE SET status = 'captured';

  FOR v_seller IN (
    SELECT DISTINCT (item->>'user_id')::UUID AS seller_id FROM jsonb_array_elements(p_cart) AS item
  )
  LOOP
    v_order_total := 0;

    INSERT INTO public.orders (
      buyer_id, seller_id, status, payment_status, payment_id, razorpay_order_id,
      shipping_name, shipping_phone, shipping_address, shipping_city, shipping_pincode, total_price
    )
    VALUES (
      p_user_id, v_seller.seller_id, 'confirmed', 'paid', p_payment_id, p_razorpay_order_id,
      p_shipping->>'fullName', p_shipping->>'phone', p_shipping->>'address', p_shipping->>'city', p_shipping->>'pincode', 0 
    )
    RETURNING id INTO v_order_id;

    IF v_return_id IS NULL THEN v_return_id := v_order_id; END IF;

    FOR v_item IN (
      SELECT * FROM jsonb_array_elements(p_cart) AS item WHERE (item->>'user_id')::UUID = v_seller.seller_id
    )
    LOOP
      v_p_id := (v_item.value->>'productId')::UUID;
      v_p_qty := COALESCE((v_item.value->>'qty')::INTEGER, 1);
      v_p_size := v_item.value->>'size';

      SELECT price INTO v_db_price FROM public.products WHERE id = v_p_id FOR SHARE;
      IF v_db_price IS NULL THEN RAISE EXCEPTION 'Asset % not found.', v_p_id; END IF;

      v_order_total := v_order_total + (v_db_price * v_p_qty);

      INSERT INTO public.order_items (order_id, product_id, quantity, price, selected_size)
      VALUES (v_order_id, v_p_id, v_p_qty, v_db_price, COALESCE(v_p_size, 'N/A'));

      UPDATE public.products SET stock = GREATEST(0, stock - v_p_qty) WHERE id = v_p_id;
    END LOOP;

    -- 💰 1. SYNC ORDER TOTAL
    UPDATE public.orders SET total_price = v_order_total WHERE id = v_order_id;
    
    -- 💰 2. AUTOMATIC PAYOUT INITIALIZATION
    -- This calculates the net amount the seller is owed.
    INSERT INTO public.seller_payouts (
        seller_id, order_id, payment_id, amount, commission
    )
    VALUES (
        v_seller.seller_id, v_order_id, p_payment_id, 
        v_order_total * (1 - v_commission_rate), -- Net 
        v_order_total * v_commission_rate       -- Commission
    );

    v_master_total := v_master_total + v_order_total;
  END LOOP;
  
  UPDATE public.payments SET amount = v_master_total WHERE payment_id = p_payment_id;

  RETURN v_return_id;
END;
$$;
