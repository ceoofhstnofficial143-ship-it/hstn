-- Fix: Create missing RPC function for purchase requests
-- Run this in Supabase SQL Editor to fix the "purchase_requests created_at.desc" error

CREATE OR REPLACE FUNCTION get_buyer_purchase_requests(p_buyer_id UUID)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    seller_id UUID,
    status VARCHAR(20),
    buyer_message TEXT,
    seller_notes TEXT,
    buyer_contact_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    contacted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    products JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id,
        pr.product_id,
        pr.seller_id,
        pr.status,
        pr.buyer_message,
        pr.seller_notes,
        pr.buyer_contact_info,
        pr.created_at,
        pr.updated_at,
        pr.contacted_at,
        pr.completed_at,
        json_build_object(
            'title', p.title,
            'image_url', p.image_url,
            'price', p.price,
            'category', p.category,
            'seller_username', prof.username
        ) as products
    FROM purchase_requests pr
    LEFT JOIN products p ON pr.product_id = p.id
    LEFT JOIN profiles prof ON pr.seller_id = prof.id
    WHERE pr.buyer_id = p_buyer_id
    ORDER BY pr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_buyer_purchase_requests(UUID) TO authenticated;

