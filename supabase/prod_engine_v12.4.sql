-- ⚔️ HSTNLX FINAL PRODUCTION TRANSACTION ENGINE (V12.4)
-- Standardizing Audit Logs and Multi-Vendor Synchronization.

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
  v_seller_record RECORD;
  v_item_record RECORD;
  v_p_id UUID;
  v_p_qty INT;
  v_p_size TEXT;
  v_db_price NUMERIC;
  v_order_total NUMERIC;
  v_master_total NUMERIC := 0;
BEGIN
  -- 🔒 1. IDEMPOTENCY CHECK
  SELECT id INTO v_existing_order FROM public.orders WHERE payment_id = p_payment_id LIMIT 1;
  IF v_existing_order IS NOT NULL THEN
    RETURN v_existing_order;
  END IF;

  -- 🔒 2. INITIALIZE PAYMENT LEDGER
  INSERT INTO public.payments (payment_id, razorpay_order_id, user_id, status)
  VALUES (p_payment_id, p_razorpay_order_id, p_user_id, 'processing')
  ON CONFLICT (payment_id) DO NOTHING;

  -- 🛡️ 3. SELLERS LOOP (Multi-Vendor Splitting)
  FOR v_seller_record IN 
    SELECT DISTINCT (value->>'seller_id')::UUID as seller_id 
    FROM jsonb_array_elements(p_cart)
  LOOP
    -- 🟢 RESET TOTAL FOR THIS SELLER'S ORDER
    v_order_total := 0;

    -- 🟢 CREATE SELLER ORDER
    INSERT INTO public.orders (user_id, seller_id, status, payment_id, shipping_address, payment_status, total_price)
    VALUES (p_user_id, v_seller_record.seller_id, 'confirmed', p_payment_id, p_shipping, 'paid', 0)
    RETURNING id INTO v_order_id;

    -- 🛡️ 4. ITEMS LOOP (Products for this Seller)
    FOR v_item_record IN 
      SELECT value FROM jsonb_array_elements(p_cart) WHERE (value->>'seller_id')::UUID = v_seller_record.seller_id
    LOOP
       v_p_id := (v_item_record.value->>'productId')::UUID;
       v_p_qty := (v_item_record.value->>'qty')::INT;
       v_p_size := (v_item_record.value->>'size')::TEXT;

       -- Fetch Hard Truth Price
       SELECT price INTO v_db_price FROM public.products WHERE id = v_p_id FOR SHARE;
       
       -- Insert Line Item
       INSERT INTO public.order_items (order_id, product_id, quantity, price, selected_size)
       VALUES (v_order_id, v_p_id, v_p_qty, v_db_price, COALESCE(v_p_size, 'N/A'));

       -- Update Inventory
       UPDATE public.products SET stock = GREATEST(0, stock - v_p_qty) WHERE id = v_p_id;
       
       -- Accrue Total
       v_order_total := v_order_total + (v_db_price * v_p_qty);
    END LOOP;

    -- 🟢 UPDATE ORDER FINAL TOTAL
    UPDATE public.orders SET total_price = v_order_total WHERE id = v_order_id;
    
    -- 🟢 CREATE SELLER PAYOUT ENTITLEMENT
    INSERT INTO public.seller_payouts (seller_id, order_id, payment_id, amount, commission, status)
    VALUES (v_seller_record.seller_id, v_order_id, p_payment_id, v_order_total * 0.9, v_order_total * 0.1, 'pending');

    -- 🕵️ 5. CLEAN PRODUCTION LOGGING
    INSERT INTO public.system_events (
      event_type,
      source,
      status,
      user_id,
      reference_id,
      metadata
    )
    VALUES (
      'order_created',
      'prod_engine_v12.4',
      'success',
      p_user_id,
      v_order_id::text,
      jsonb_build_object(
        'payment_id', p_payment_id,
        'amount', v_order_total,
        'item_count', (SELECT count(*) FROM public.order_items WHERE order_id = v_order_id)
      )
    );

    v_master_total := v_master_total + v_order_total;
  END LOOP;
  
  -- 🔒 6. CAPTURE TOTAL LEDGER
  UPDATE public.payments SET amount = v_master_total, status = 'captured' WHERE payment_id = p_payment_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
