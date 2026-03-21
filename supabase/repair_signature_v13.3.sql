-- ⚔️ HSTNLX REPAIR: SIGNATURE SYNCHRONIZATION (V13.3)
-- Overcoming the PostgreSQL 42P13 Signature Barrier.

-- 1. DROP THE OLD SIGNATURE (To allow parameter renaming)
DROP FUNCTION IF EXISTS public.place_order_after_payment(jsonb,text,text,boolean,jsonb,uuid);
DROP FUNCTION IF EXISTS public.place_order_after_payment(jsonb,text,text,boolean,jsonb);

-- 2. DEPLOY DUAL-CHANNEL HARDENED ENGINE (Revised)
CREATE OR REPLACE FUNCTION public.place_order_after_payment(
  p_cart JSONB,
  p_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_is_verified BOOLEAN,
  p_shipping JSONB,
  p_user_id_override UUID DEFAULT NULL -- 🔐 Renamed to Override for Webhook Authorities
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
  v_existing_order UUID;
  v_seller_record RECORD;
  v_item_record RECORD;
  v_p_id UUID;
  v_p_qty INT;
  v_p_size TEXT;
  v_db_price NUMERIC;
  v_db_stock INT;
  v_order_total NUMERIC;
  v_master_total NUMERIC := 0;
BEGIN
  -- 🔐 1. IDENTITY RESOLUTION (DUAL-CHANNEL)
  -- If called from browser: auth.uid() is used.
  -- If called from Webhook/Admin: p_user_id_override is used (Service Role Only).
  v_user_id := COALESCE(auth.uid(), p_user_id_override);

  -- 🛡️ 2. SECURITY POLICY: Reject anonymous or spoofing attempts
  -- Only allow override if the caller is a service_role (internal authority)
  IF auth.uid() IS NULL AND p_user_id_override IS NOT NULL AND current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Institutional Protocol Breach: Unauthorized Identity Override.';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Institutional Protocol Breach: Unauthenticated Acquisition Terminated.';
  END IF;

  -- 🔒 3. IDEMPOTENCY LOCK
  SELECT id INTO v_existing_order FROM public.orders WHERE payment_id = p_payment_id LIMIT 1;
  IF v_existing_order IS NOT NULL THEN
    RETURN v_existing_order;
  END IF;

  -- 🔒 4. INITIALIZE PAYMENT LEDGER
  INSERT INTO public.payments (payment_id, razorpay_order_id, user_id, status)
  VALUES (p_payment_id, p_razorpay_order_id, v_user_id, 'processing')
  ON CONFLICT (payment_id) DO NOTHING;

  -- 🛡️ 5. MULTI-VENDOR SPLITTING LOOP
  FOR v_seller_record IN 
    SELECT DISTINCT (value->>'seller_id')::UUID as seller_id 
    FROM jsonb_array_elements(p_cart)
  LOOP
    v_order_total := 0;

    -- CREATE SELLER SPECIFIC ORDER
    INSERT INTO public.orders (user_id, seller_id, status, payment_id, shipping_address, payment_status, total_price)
    VALUES (v_user_id, v_seller_record.seller_id, 'confirmed', p_payment_id, p_shipping, 'paid', 0)
    RETURNING id INTO v_order_id;

    -- 🛡️ 6. LINE ITEM FULFILLMENT & STOCK GUARD
    FOR v_item_record IN 
      SELECT value FROM jsonb_array_elements(p_cart) WHERE (value->>'seller_id')::UUID = v_seller_record.seller_id
    LOOP
       v_p_id := (v_item_record.value->>'productId')::UUID;
       v_p_qty := (v_item_record.value->>'qty')::INT;
       v_p_size := (v_item_record.value->>'size')::TEXT;

       -- ACQUIRE STOCK LOCK (Force-Share)
       SELECT price, stock INTO v_db_price, v_db_stock FROM public.products WHERE id = v_p_id FOR UPDATE;
       
       -- STOCK SHORTAGE REJECTION
       IF v_db_stock < v_p_qty THEN
         RAISE EXCEPTION 'Inventory Breach: Product % is out of protocol stock.', v_p_id;
       END IF;

       -- INSERT LINE ITEM
       INSERT INTO public.order_items (order_id, product_id, quantity, price, selected_size)
       VALUES (v_order_id, v_p_id, v_p_qty, v_db_price, COALESCE(v_p_size, 'N/A'));

       -- DECREMENT STOCK
       UPDATE public.products SET stock = stock - v_p_qty WHERE id = v_p_id;
       
       v_order_total := v_order_total + (v_db_price * v_p_qty);
    END LOOP;

    -- UPDATE ORDER SUMMARY
    UPDATE public.orders SET total_price = v_order_total WHERE id = v_order_id;
    
    -- INITIALIZE PAYOUT
    INSERT INTO public.seller_payouts (seller_id, order_id, payment_id, amount, commission, status)
    VALUES (v_seller_record.seller_id, v_order_id, p_payment_id, v_order_total * 0.9, v_order_total * 0.1, 'pending');

    -- LOG MISSION SUCCESS
    INSERT INTO public.system_events (event_type, source, status, user_id, reference_id, metadata)
    VALUES ('order_created', 'dual_channel_v13.3', 'success', v_user_id, v_order_id::text, jsonb_build_object('payment_id', p_payment_id, 'amount', v_order_total, 'channel', CASE WHEN auth.uid() IS NULL THEN 'webhook' ELSE 'browser' END));

    v_master_total := v_master_total + v_order_total;
  END LOOP;
  
  -- CAPTURE FINAL LEDGER
  UPDATE public.payments SET amount = v_master_total, status = 'captured' WHERE payment_id = p_payment_id;

  RETURN v_order_id;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
