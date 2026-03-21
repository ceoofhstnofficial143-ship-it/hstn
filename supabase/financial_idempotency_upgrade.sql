-- 🛡️ HSTNLX FINANCIAL-GRADE IDEMPOTENCY LOCKS
-- Separating the project from a real production settlement system.

-- 1. HARD DB CONSTRAINTS
ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_payment_id_key;
ALTER TABLE public.orders ADD CONSTRAINT unique_payment_id UNIQUE (payment_id);

-- Ensure payments table is rigid
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id TEXT UNIQUE NOT NULL, -- razorpay_payment_id
    razorpay_order_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    status TEXT,
    amount NUMERIC,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. UPDATED IDEMPOTENT RPC ENGINE
CREATE OR REPLACE FUNCTION public.place_order_after_payment(
  p_cart JSONB,
  p_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_is_verified BOOLEAN,
  p_shipping JSONB,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_existing_order UUID;
  v_item JSONB;
  v_p_id UUID;
  v_p_qty INT;
  v_p_size TEXT;
  v_db_price NUMERIC;
  v_order_total NUMERIC := 0;
  v_master_total NUMERIC := 0;
  v_commission_rate NUMERIC := 0.10; -- 10% Protocol Fee
  v_seller RECORD;
BEGIN
  -- 🔒 IDEMPOTENCY CHECK (The Nuclear Safety Switch)
  SELECT id INTO v_existing_order FROM public.orders WHERE payment_id = p_payment_id LIMIT 1;
  IF v_existing_order IS NOT NULL THEN
    RETURN v_existing_order; -- Identity already established. Safe exit.
  END IF;

  -- 🔒 ATOMIC TRANSACTION START
  -- Record the payment in the ledger first
  INSERT INTO public.payments (payment_id, razorpay_order_id, user_id, status)
  VALUES (p_payment_id, p_razorpay_order_id, p_user_id, 'processing')
  ON CONFLICT (payment_id) DO NOTHING;

  -- Create Master Order if multiple sellers, or single order
  -- (Current logic: Split by seller for multi-vendor payouts)
  FOR v_seller IN 
    SELECT DISTINCT (p->>'seller_id')::UUID as seller_id FROM jsonb_array_elements(p_cart) p
  LOOP
    INSERT INTO public.orders (
      user_id, seller_id, status, payment_id, shipping_address, payment_status
    )
    VALUES (
      p_user_id, v_seller.seller_id, 'confirmed', p_payment_id, p_shipping, 'paid'
    )
    RETURNING id INTO v_order_id;
    
    v_return_id := v_order_id; -- Return at least one order ID
    v_order_total := 0;

    -- Process items for this seller
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart) p WHERE (p->>'seller_id')::UUID = v_seller.seller_id
    LOOP
       v_p_id := (v_item->>'productId')::UUID;
       v_p_qty := (v_item->>'qty')::INT;
       v_p_size := (v_item->>'size')::TEXT;

       -- Lock product for price/stock consistency
       SELECT price INTO v_db_price FROM public.products WHERE id = v_p_id FOR SHARE;
       IF v_db_price IS NULL THEN RAISE EXCEPTION 'Asset % missing.', v_p_id; END IF;

       v_order_total := v_order_total + (v_db_price * v_p_qty);

       INSERT INTO public.order_items (order_id, product_id, quantity, price, selected_size)
       VALUES (v_order_id, v_p_id, v_p_qty, v_db_price, COALESCE(v_p_size, 'N/A'));

       UPDATE public.products SET stock = GREATEST(0, stock - v_p_qty) WHERE id = v_p_id;
    END LOOP;

    -- Finalize Payout for this seller
    INSERT INTO public.seller_payouts (seller_id, order_id, payment_id, amount, commission)
    VALUES (
        v_seller.seller_id, v_order_id, p_payment_id, 
        v_order_total * (1 - v_commission_rate), 
        v_order_total * v_commission_rate
    );

    UPDATE public.orders SET total_price = v_order_total WHERE id = v_order_id;
    v_master_total := v_master_total + v_order_total;
  END LOOP;
  
  -- Update overall payment ledger
  UPDATE public.payments SET amount = v_master_total, status = 'captured' WHERE payment_id = p_payment_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
