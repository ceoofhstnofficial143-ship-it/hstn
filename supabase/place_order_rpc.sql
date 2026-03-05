-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- This creates an RPC that inserts the order AND decrements stock in one transaction.
-- It runs with elevated privileges so stock update is not blocked by RLS.

CREATE OR REPLACE FUNCTION place_order(p_product_id uuid, p_buyer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_order_id uuid;
BEGIN
  -- 1) Get product and lock row (prevents concurrent oversell)
  SELECT * INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Product not found');
  END IF;

  IF (COALESCE(v_product.stock, 0) <= 0) THEN
    RETURN json_build_object('ok', false, 'error', 'Out of stock');
  END IF;

  IF v_product.user_id = p_buyer_id THEN
    RETURN json_build_object('ok', false, 'error', 'You cannot buy your own product');
  END IF;

  -- 2) Insert order
  INSERT INTO orders (buyer_id, product_id, seller_id, status)
  VALUES (p_buyer_id, p_product_id, v_product.user_id, 'pending')
  RETURNING id INTO v_order_id;

  -- 3) Decrement stock (atomic, no RLS block)
  UPDATE products
  SET stock = COALESCE(stock, 0) - 1
  WHERE id = p_product_id;

  RETURN json_build_object('ok', true, 'order_id', v_order_id);
END;
$$;

-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION place_order(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION place_order(uuid, uuid) TO service_role;
