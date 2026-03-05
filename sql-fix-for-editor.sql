-- Fix the get_seller_purchase_requests function
-- Copy and paste this entire block into your Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_seller_purchase_requests(
    p_seller_id UUID,
    p_status VARCHAR(20) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    buyer_id UUID,
    status VARCHAR(20),
    buyer_message TEXT,
    seller_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    buyer_name TEXT,
    product_title TEXT,
    product_price NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id,
        pr.product_id,
        pr.buyer_id,
        pr.status,
        pr.buyer_message,
        pr.seller_notes,
        pr.created_at,
        pr.updated_at,
        p.username as buyer_name,
        prod.title as product_title,
        prod.price as product_price
    FROM purchase_requests pr
    JOIN profiles p ON pr.buyer_id = p.id  -- FIXED: was p.user_id
    JOIN products prod ON pr.product_id = prod.id
    WHERE pr.seller_id = p_seller_id
      AND (p_status IS NULL OR pr.status = p_status)
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
