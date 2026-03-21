-- 💎 HSTNLX FLIGHT DATA RECORDER (v12.0)
-- Standardizing the observability of high-value marketplace maneuvers.

-- 1. HARDEN SYSTEM EVENTS SCHEMA
ALTER TABLE IF EXISTS public.system_events 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reference_id TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Performance indexing for live triage
CREATE INDEX IF NOT EXISTS idx_system_events_type ON public.system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON public.system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_ref ON public.system_events(reference_id);

-- 2. MASTER RPC SYNC (Logging within the Core)
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
  v_commission_rate NUMERIC := 0.10;
  v_seller RECORD;
BEGIN
  -- 🔒 1. Idempotency Gate
  SELECT id INTO v_existing_order FROM public.orders WHERE payment_id = p_payment_id LIMIT 1;
  IF v_existing_order IS NOT NULL THEN
    RETURN v_existing_order;
  END IF;

  -- 🔒 2. Payment Ledger Record
  INSERT INTO public.payments (payment_id, razorpay_order_id, user_id, status)
  VALUES (p_payment_id, p_razorpay_order_id, p_user_id, 'processing')
  ON CONFLICT (payment_id) DO NOTHING;

  -- 🛡️ 3. CORE FULFILLMENT LOGIC
  FOR v_seller IN SELECT DISTINCT (p->>'seller_id')::UUID as seller_id FROM jsonb_array_elements(p_cart) p
  LOOP
    INSERT INTO public.orders (user_id, seller_id, status, payment_id, shipping_address, payment_status)
    VALUES (p_user_id, v_seller.seller_id, 'confirmed', p_payment_id, p_shipping, 'paid')
    RETURNING id INTO v_order_id;
    
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart) p WHERE (p->>'seller_id')::UUID = v_seller.seller_id
    LOOP
       v_p_id := (v_item->>'productId')::UUID;
       v_p_qty := (v_item->>'qty')::INT;
       v_p_size := (v_item->>'size')::TEXT;

       SELECT price INTO v_db_price FROM public.products WHERE id = v_p_id FOR SHARE;
       INSERT INTO public.order_items (order_id, product_id, quantity, price, selected_size)
       VALUES (v_order_id, v_p_id, v_p_qty, v_db_price, COALESCE(v_p_size, 'N/A'));

       UPDATE public.products SET stock = GREATEST(0, stock - v_p_qty) WHERE id = v_p_id;
       v_order_total := v_order_total + (v_db_price * v_p_qty);
    END LOOP;

    INSERT INTO public.seller_payouts (seller_id, order_id, payment_id, amount, commission)
    VALUES (v_seller.seller_id, v_order_id, p_payment_id, v_order_total * 0.9, v_order_total * 0.1);

    UPDATE public.orders SET total_price = v_order_total WHERE id = v_order_id;
    v_master_total := v_master_total + v_order_total;
  END LOOP;
  
  UPDATE public.payments SET amount = v_master_total, status = 'captured' WHERE payment_id = p_payment_id;

  -- 🕵️ 4. LOGMISSION-CRITICAL SUCCESS
  INSERT INTO public.system_events (event_type, source, status, user_id, reference_id, metadata)
  VALUES ('order_created', 'rpc_engine', 'success', p_user_id, p_payment_id, jsonb_build_object('order_id', v_order_id, 'amount', v_master_total));

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
