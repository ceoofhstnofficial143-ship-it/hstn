-- 📊 SELLER PERFORMANCE METRIC ENGINE
-- Aggregates real-time marketplace events for merchant feedback loops

CREATE OR REPLACE FUNCTION get_seller_stats(p_seller_id UUID)
RETURNS TABLE (
    total_views BIGINT,
    total_cart_adds BIGINT,
    total_wishlist_adds BIGINT,
    total_sales BIGINT,
    recent_growth_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH event_counts AS (
        SELECT 
            COUNT(*) FILTER (WHERE event_type = 'product_view') as views,
            COUNT(*) FILTER (WHERE event_type = 'add_to_cart') as cart_adds,
            COUNT(*) FILTER (WHERE event_type = 'wishlist_add') as wishlist_adds
        FROM public.marketplace_events
        WHERE metadata->>'seller_id' = p_seller_id::TEXT
    ),
    sale_counts AS (
        SELECT COUNT(*) as sales
        FROM public.order_items oi
        JOIN public.products p ON oi.product_id = p.id
        WHERE p.user_id = p_seller_id
    )
    SELECT 
        ec.views,
        ec.cart_adds,
        ec.wishlist_adds,
        sc.sales,
        CASE WHEN ec.views > 0 THEN (sc.sales::NUMERIC / ec.views::NUMERIC) * 100 ELSE 0 END as growth_rate
    FROM event_counts ec, sale_counts sc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
