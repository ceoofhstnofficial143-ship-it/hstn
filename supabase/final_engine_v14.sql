-- ⚔️ HSTNLX ENGINE V14.1 — DEFINITIVE MULTI-VENDOR FULFILLMENT & RECONCILIATION
-- CONSOLIDATED DUAL-CHANNEL (BROWSER & ADMIN) SIGNATURE
-- Syncs with V13.6 Schema (full_name, phone, address, etc.)

-- 1. CLEAR ALL UNIQUE CONSTRAINT VIOLATIONS (covers all naming variants)
-- 🛡️ orders table: payment_id must allow MULTIPLE rows per payment (multi-vendor)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS unique_payment_id;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_id_key;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_id_unique;

-- 🛡️ seller_payouts table: payment_id must also allow MULTIPLE rows per payment (one per vendor)
ALTER TABLE public.seller_payouts DROP CONSTRAINT IF EXISTS unique_payment_id;
ALTER TABLE public.seller_payouts DROP CONSTRAINT IF EXISTS seller_payouts_payment_id_key;
ALTER TABLE public.seller_payouts DROP CONSTRAINT IF EXISTS seller_payouts_payment_id_unique;

DROP FUNCTION IF EXISTS public.place_order_after_payment(jsonb,text,text,boolean,jsonb,uuid);
DROP FUNCTION IF EXISTS public.place_order_after_payment(jsonb,text,text,boolean,jsonb);

-- 2. HARDENED ATOMIC ENGINE
CREATE OR REPLACE FUNCTION public.place_order_after_payment(
  p_cart JSONB,
  p_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_is_verified BOOLEAN,
  p_shipping JSONB,
  p_user_id_override UUID DEFAULT NULL -- 🔐 DUAL-CHANNEL IDENTITY OVERRIDE
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
  v_user_id UUID;
  v_commission_rate NUMERIC := 0.10; -- 10% Platform Protocol Fee
BEGIN
  -- 🛡️ IDENTITY RESOLUTION (DUAL-CHANNEL)
  v_user_id := COALESCE(auth.uid(), p_user_id_override);

  IF v_user_id IS NULL THEN
     RAISE EXCEPTION 'Protocol Violation: Identity Context Required.';
  END IF;

  -- 🕵️ SECURITY: Unauthorized Override Protection
  IF auth.uid() IS NULL AND p_user_id_override IS NOT NULL AND current_setting('role') != 'service_role' THEN
      RAISE EXCEPTION 'Institutional Protocol Breach: Unauthorized Identity Override.';
  END IF;

  -- 🔒 IDEMPOTENCY LOCK
  PERFORM pg_advisory_xact_lock(hashtext(p_payment_id));

  IF EXISTS (SELECT 1 FROM public.orders WHERE payment_id = p_payment_id) THEN
    SELECT id INTO v_return_id FROM public.orders WHERE payment_id = p_payment_id LIMIT 1;
    RETURN v_return_id;
  END IF;

  IF p_is_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Protocol Violation: Verification Status Protocol Breach.';
  END IF;

  -- 📝 RECONCILE PAYMENT RECORD
  INSERT INTO public.payments (user_id, payment_id, razorpay_order_id, amount, status)
  VALUES (v_user_id, p_payment_id, p_razorpay_order_id, 0, 'captured')
  ON CONFLICT (payment_id) DO UPDATE SET status = 'captured', user_id = EXCLUDED.user_id;

  -- 🔄 MULTI-VENDOR VESTING LOOP
  FOR v_seller IN (
    SELECT DISTINCT (item->>'seller_id')::UUID AS seller_id FROM jsonb_array_elements(p_cart) AS item
  )
  LOOP
    v_order_total := 0;

    -- CREATE VENDOR-SPECIFIC ORDER
    INSERT INTO public.orders (
      buyer_id, seller_id, status, payment_status, payment_id, razorpay_order_id,
      full_name, phone, address, city, pincode, total_price
    )
    VALUES (
      v_user_id, v_seller.seller_id, 'confirmed', 'paid', p_payment_id, p_razorpay_order_id,
      p_shipping->>'fullName', p_shipping->>'phone', p_shipping->>'address', p_shipping->>'city', p_shipping->>'pincode', 0 
    )
    RETURNING id INTO v_order_id;

    IF v_return_id IS NULL THEN v_return_id := v_order_id; END IF;

    -- VENDOR-SPECIFIC ORDER ITEMS
    FOR v_item IN (
      SELECT * FROM jsonb_array_elements(p_cart) AS item WHERE (item->>'seller_id')::UUID = v_seller.seller_id
    )
    LOOP
      v_p_id := (v_item.value->>'productId')::UUID;
      v_p_qty := COALESCE((v_item.value->>'qty')::INTEGER, 1);
      v_p_size := v_item.value->>'size';

      -- 🛡️ SECURITY: Fetch price from source. Priority: Variant Price > Base Price
      -- First, check if there's a specific size-based price
      SELECT price INTO v_db_price 
      FROM public.product_variants 
      WHERE product_id = v_p_id AND size = v_p_size;

      -- Fallback to base product price if no variant price is defined
      IF v_db_price IS NULL THEN
        SELECT price INTO v_db_price FROM public.products WHERE id = v_p_id FOR SHARE;
      END IF;

      IF v_db_price IS NULL THEN RAISE EXCEPTION 'Asset % not found in archive.', v_p_id; END IF;

      v_order_total := v_order_total + (v_db_price * v_p_qty);

      INSERT INTO public.order_items (order_id, product_id, quantity, price, selected_size)
      VALUES (v_order_id, v_p_id, v_p_qty, v_db_price, COALESCE(v_p_size, 'N/A'));

      UPDATE public.products SET stock = GREATEST(0, stock - v_p_qty) WHERE id = v_p_id;
    END LOOP;

    -- 💰 1. SYNC ORDER TOTAL
    UPDATE public.orders SET total_price = v_order_total WHERE id = v_order_id;
    
    -- 💰 2. AUTOMATIC PAYOUT INITIALIZATION
    INSERT INTO public.seller_payouts (
        seller_id, order_id, payment_id, amount, commission, status
    )
    VALUES (
        v_seller.seller_id, v_order_id, p_payment_id, 
        v_order_total * (1 - v_commission_rate), -- Net 
        v_order_total * v_commission_rate,       -- Platform Fee
        'pending'
    );

    v_master_total := v_master_total + v_order_total;
  END LOOP;
  
  -- 🛠️ UPDATE FINAL PAYMENT RECORD WITH MASTER TOTAL
  UPDATE public.payments SET amount = v_master_total WHERE payment_id = p_payment_id;

  -- 📝 RECOVERY LOGGING
  INSERT INTO public.system_events (event_type, source, status, user_id, reference_id, metadata)
  VALUES ('engine_fulfillment_complete', 'place_order_v14', 'success', v_user_id, p_payment_id, jsonb_build_object('master_total', v_master_total));

  RETURN v_return_id;
END;
$$;
