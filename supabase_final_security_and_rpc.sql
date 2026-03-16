-- ==========================================
-- HSTN REFINED MASTER SECURITY & RPC LAYER
-- v2.1 - Fixes overloaded function ambiguity
-- ==========================================

-- 1. STABILIZE SCHEMA (Create missing order_items table)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER DEFAULT 1,
    price NUMERIC NOT NULL,
    selected_size TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PURGE OLD OVERLOADED FUNCTIONS (Prevents ambiguity errors)
-- Dropping known variations to ensure a clean protocol state
DROP FUNCTION IF EXISTS public.place_order_with_stock(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.place_order_with_stock(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.place_bulk_order(JSONB, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 3. ENABLE RLS ON ALL TABLES
DO $$ 
DECLARE 
    tbl RECORD;
BEGIN 
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'anomaly_flags', 'buyer_fraud_flags', 'buyer_trust_history', 'buyer_trust_scores',
            'cart', 'cart_items', 'categories', 'elite_qualification_pool', 
            'engagement_spike_flags', 'event_rate_tracking', 'funnel_analytics', 
            'marketplace_events', 'marketplace_stage_controls', 'orders', 'order_items',
            'product_analytics', 'product_variants', 'products', 'profiles', 
            'purchase_request_events', 'purchase_requests', 'ranking_correlations', 
            'ranking_performance', 'ranking_system_controls', 'referral_codes', 
            'referral_events', 'request_fraud_patterns', 'reviews', 'seller_analytics', 
            'seller_fit_stats', 'seller_performance_metrics', 'shadow_mode_comparisons', 
            'trust_override_logs', 'trust_scores', 'user_rewards', 'wishlist'
          )
    LOOP 
        EXECUTE 'ALTER TABLE public.' || quote_ident(tbl.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END loop; 
END $$;

-- 4. ADMIN IDENTITY HELPER
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CONSOLIDATED POLICIES

-- PRODUCTS
DROP POLICY IF EXISTS "public_select_approved_products" ON products;
CREATE POLICY "public_select_approved_products" ON products FOR SELECT USING (admin_status = 'approved');

DROP POLICY IF EXISTS "Anyone can view products" ON products;
CREATE POLICY "Anyone can view products" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_full_products" ON products;
CREATE POLICY "admin_full_products" ON products FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Sellers can update own products" ON products;
CREATE POLICY "Sellers can update own products" ON products FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can delete own products" ON products;
CREATE POLICY "Sellers can delete own products" ON products FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- PROFILES
DROP POLICY IF EXISTS "user_select_own_profile" ON profiles;
CREATE POLICY "user_select_own_profile" ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "user_update_own_profile" ON profiles;
CREATE POLICY "user_update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "admin_full_profiles" ON profiles;
CREATE POLICY "admin_full_profiles" ON profiles FOR ALL USING (is_admin());

-- ORDERS
DROP POLICY IF EXISTS "Buyer can view own orders" ON orders;
CREATE POLICY "Buyer can view own orders" ON orders FOR SELECT USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Seller can view their sales" ON orders;
CREATE POLICY "Seller can view their sales" ON orders FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "buyer_update_own_orders" ON orders;
CREATE POLICY "buyer_update_own_orders" ON orders FOR UPDATE USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "seller_update_own_orders" ON orders;
CREATE POLICY "seller_update_own_orders" ON orders FOR UPDATE USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_orders" ON orders;
CREATE POLICY "admin_full_orders" ON orders FOR ALL USING (is_admin());

-- ORDER ITEMS (Inherit visibility from parent order)
DROP POLICY IF EXISTS "View order items" ON order_items;
CREATE POLICY "View order items" ON order_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid() OR is_admin())
    )
);

-- WISHLIST
DROP POLICY IF EXISTS "wishlist_user_crud" ON wishlist;
CREATE POLICY "wishlist_user_crud" ON wishlist FOR ALL USING (user_id = auth.uid());

-- REVIEWS
DROP POLICY IF EXISTS "public_read_reviews" ON reviews;
CREATE POLICY "public_read_reviews" ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "buyer_can_review_delivered" ON reviews;
CREATE POLICY "buyer_can_review_delivered" ON reviews FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.buyer_id = auth.uid() 
        AND orders.product_id = reviews.product_id 
        AND orders.status = 'delivered'
    )
);

-- GOVERNANCE (Admin Only)
DO $$ 
DECLARE 
    tbl NAME;
BEGIN 
    FOR tbl IN VALUES 
        ('anomaly_flags'), ('buyer_fraud_flags'), ('engagement_spike_flags'), 
        ('marketplace_stage_controls'), ('ranking_correlations'), ('ranking_performance'), 
        ('ranking_system_controls'), ('seller_performance_metrics'), ('shadow_mode_comparisons')
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS "Admin management" ON %I', tbl);
        EXECUTE format('CREATE POLICY "Admin management" ON %I FOR ALL USING (is_admin())', tbl);
    END loop; 
END $$;

-- 6. HARDENED TRANSACTION: place_bulk_order
CREATE OR REPLACE FUNCTION place_bulk_order(
    p_items JSONB, 
    p_full_name TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_city TEXT,
    p_pincode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_total_price NUMERIC := 0;
    v_item RECORD;
    v_p_id UUID;
    v_p_qty INTEGER;
    v_p_expected NUMERIC;
    v_db_price NUMERIC;
    v_db_stock INTEGER;
    v_seller_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Unauthorized access');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_p_id := (v_item.value->>'product_id')::UUID;
        v_p_qty := (v_item.value->>'quantity')::INTEGER;
        v_p_expected := (v_item.value->>'expected_price')::NUMERIC;

        SELECT price, stock, user_id INTO v_db_price, v_db_stock, v_seller_id
        FROM products WHERE id = v_p_id FOR UPDATE;

        IF v_db_price IS NULL OR v_db_price <> v_p_expected THEN
            RAISE EXCEPTION 'Valuation mismatch for asset %', v_p_id;
        END IF;

        IF v_db_stock < v_p_qty THEN
            RAISE EXCEPTION 'Insufficient inventory for asset %', v_p_id;
        END IF;

        v_total_price := v_total_price + (v_db_price * v_p_qty);
    END LOOP;

    INSERT INTO orders (
        buyer_id, seller_id, status, total_price,
        shipping_name, shipping_phone, shipping_address, shipping_city, shipping_pincode
    ) VALUES (
        auth.uid(), v_seller_id, 'pending', v_total_price,
        p_full_name, p_phone, p_address, p_city, p_pincode
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_p_id := (v_item.value->>'product_id')::UUID;
        v_p_qty := (v_item.value->>'quantity')::INTEGER;
        v_p_expected := (v_item.value->>'expected_price')::NUMERIC;

        INSERT INTO order_items (order_id, product_id, quantity, price, selected_size)
        VALUES (v_order_id, v_p_id, v_p_qty, v_p_expected, COALESCE(v_item.value->>'selected_size', 'N/A'));

        UPDATE products SET stock = stock - v_p_qty WHERE id = v_p_id;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END;
$$;

-- 7. SINGLE TRANSACTION HELPER
CREATE OR REPLACE FUNCTION place_order_with_stock(
    p_product_id UUID,
    p_expected_price NUMERIC,
    p_full_name TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_city TEXT,
    p_pincode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN place_bulk_order(
        jsonb_build_array(
            jsonb_build_object(
                'product_id', p_product_id,
                'quantity', 1,
                'expected_price', p_expected_price
            )
        ),
        p_full_name, p_phone, p_address, p_city, p_pincode
    );
END;
$$;

-- 8. GRANT PERMISSIONS (Specific signatures to avoid ambiguity)
-- Use specific signatures for GRANT to avoid "function not unique" errors
GRANT EXECUTE ON FUNCTION public.place_bulk_order(JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_with_stock(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
