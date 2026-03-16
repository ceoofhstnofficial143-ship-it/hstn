-- ==========================================
-- HSTN MARKETPLACE INTELLIGENCE & ANALYTICS
-- v1.0 - Pulsing the Marketplace Matrix
-- ==========================================

-- 1. STABILIZE ANALYTICS TABLES
CREATE TABLE IF NOT EXISTS public.marketplace_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    product_id UUID REFERENCES public.products(id),
    seller_id UUID REFERENCES public.profiles(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_analytics (
    product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    views_count INTEGER DEFAULT 0,
    wishlist_count INTEGER DEFAULT 0,
    cart_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    heat_score NUMERIC DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ANALYTICS RPC FUNCTIONS
-- CLEANUP: Dropping existing variations to prevent return type conflicts
DROP FUNCTION IF EXISTS public.log_product_view(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.log_video_play(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.log_wishlist_add(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.log_add_to_cart(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.log_checkout_complete(UUID, UUID);
DROP FUNCTION IF EXISTS public.calculate_product_heat_score(UUID);
DROP FUNCTION IF EXISTS public.log_marketplace_event(TEXT, UUID);
DROP FUNCTION IF EXISTS public.log_checkout_start(UUID);
DROP FUNCTION IF EXISTS public.log_upload_created(UUID, UUID);
DROP FUNCTION IF EXISTS public.log_upload_approved(UUID, UUID);
DROP FUNCTION IF EXISTS public.log_quest_completed(UUID, TEXT);
DROP FUNCTION IF EXISTS public.refresh_all_analytics();

-- LOG PRODUCT VIEW
CREATE OR REPLACE FUNCTION log_product_view(
    p_user_id UUID,
    p_product_id UUID,
    p_seller_id UUID
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, product_id, seller_id)
    VALUES ('product_view', p_user_id, p_product_id, p_seller_id);
    
    INSERT INTO product_analytics (product_id, views_count)
    VALUES (p_product_id, 1)
    ON CONFLICT (product_id) DO UPDATE 
    SET views_count = product_analytics.views_count + 1, last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG VIDEO PLAY
CREATE OR REPLACE FUNCTION log_video_play(
    p_user_id UUID,
    p_product_id UUID,
    p_seller_id UUID
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, product_id, seller_id)
    VALUES ('video_play', p_user_id, p_product_id, p_seller_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG WISHLIST ADD
CREATE OR REPLACE FUNCTION log_wishlist_add(
    p_user_id UUID,
    p_product_id UUID,
    p_seller_id UUID
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, product_id, seller_id)
    VALUES ('wishlist_add', p_user_id, p_product_id, p_seller_id);
    
    INSERT INTO product_analytics (product_id, wishlist_count)
    VALUES (p_product_id, 1)
    ON CONFLICT (product_id) DO UPDATE 
    SET wishlist_count = product_analytics.wishlist_count + 1, last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG ADD TO CART
CREATE OR REPLACE FUNCTION log_add_to_cart(
    p_user_id UUID,
    p_product_id UUID,
    p_seller_id UUID
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, product_id, seller_id)
    VALUES ('add_to_cart', p_user_id, p_product_id, p_seller_id);
    
    INSERT INTO product_analytics (product_id, cart_count)
    VALUES (p_product_id, 1)
    ON CONFLICT (product_id) DO UPDATE 
    SET cart_count = product_analytics.cart_count + 1, last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG CHECKOUT COMPLETE
CREATE OR REPLACE FUNCTION log_checkout_complete(
    p_user_id UUID,
    p_order_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_item RECORD;
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, metadata)
    VALUES ('checkout_complete', p_user_id, jsonb_build_object('order_id', p_order_id));
    
    FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id
    LOOP
        INSERT INTO product_analytics (product_id, sales_count)
        VALUES (v_item.product_id, v_item.quantity)
        ON CONFLICT (product_id) DO UPDATE 
        SET sales_count = product_analytics.sales_count + v_item.quantity, last_updated = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CALCULATE HEAT SCORE
CREATE OR REPLACE FUNCTION calculate_product_heat_score(p_product_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_views INTEGER;
    v_wish INTEGER;
    v_carts INTEGER;
    v_sales INTEGER;
    v_score NUMERIC;
BEGIN
    SELECT views_count, wishlist_count, cart_count, sales_count 
    INTO v_views, v_wish, v_carts, v_sales
    FROM product_analytics WHERE product_id = p_product_id;
    
    -- Weights: View (1), Wishlist (5), Cart (10), Sale (50)
    v_score := (COALESCE(v_views, 0) * 1) + 
               (COALESCE(v_wish, 0) * 5) + 
               (COALESCE(v_carts, 0) * 10) + 
               (COALESCE(v_sales, 0) * 50);
               
    UPDATE product_analytics SET heat_score = v_score WHERE product_id = p_product_id;
    RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG GENERIC MARKETPLACE EVENT
CREATE OR REPLACE FUNCTION log_marketplace_event(
    p_event_type TEXT,
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id)
    VALUES (p_event_type, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG CHECKOUT START
CREATE OR REPLACE FUNCTION log_checkout_start(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id)
    VALUES ('checkout_start', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG UPLOAD CREATED
CREATE OR REPLACE FUNCTION log_upload_created(p_seller_id UUID, p_product_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, product_id, seller_id)
    VALUES ('upload_created', p_seller_id, p_product_id, p_seller_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG UPLOAD APPROVED
CREATE OR REPLACE FUNCTION log_upload_approved(p_seller_id UUID, p_product_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, product_id, seller_id)
    VALUES ('upload_approved', p_seller_id, p_product_id, p_seller_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOG QUEST COMPLETED
CREATE OR REPLACE FUNCTION log_quest_completed(p_seller_id UUID, p_quest_type TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO marketplace_events (event_type, user_id, metadata)
    VALUES ('quest_completed', p_seller_id, jsonb_build_object('quest_type', p_quest_type));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REFRESH ALL ANALYTICS
CREATE OR REPLACE FUNCTION refresh_all_analytics()
RETURNS VOID AS $$
BEGIN
    -- Logic to recalculate all heat scores or aggregates
    -- For now, a simple placeholder as heat scores are updated per event
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PERMISSIONS
GRANT EXECUTE ON FUNCTION log_product_view(UUID, UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_video_play(UUID, UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_wishlist_add(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_add_to_cart(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_checkout_start(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_checkout_complete(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_upload_created(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_upload_approved(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_quest_completed(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_product_heat_score(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_marketplace_event(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_analytics() TO authenticated;
