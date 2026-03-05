-- HSTN Pre-Payment "Request Purchase" Mode
-- Facilitates buyer-seller connections without payment processing
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- PURCHASE REQUESTS SYSTEM
-- ==============================================================================

-- Purchase requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed', 'cancelled')),
    buyer_message TEXT,
    seller_notes TEXT,
    buyer_contact_info JSONB DEFAULT '{}', -- Email, phone for seller
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contacted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Request status tracking for analytics
CREATE TABLE IF NOT EXISTS purchase_request_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_id UUID REFERENCES purchase_requests(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'created', 'contacted', 'completed', 'cancelled'
    triggered_by UUID REFERENCES auth.users(id), -- Who performed the action
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_requests_seller ON purchase_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_buyer ON purchase_requests(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_product ON purchase_requests(product_id, status);
CREATE INDEX IF NOT EXISTS idx_request_events_request ON purchase_request_events(request_id, created_at);

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_events ENABLE ROW LEVEL SECURITY;

-- Buyers can see their own requests
CREATE POLICY "Buyers can view own requests" ON purchase_requests FOR SELECT USING (auth.uid() = buyer_id);

-- Buyers can create requests
CREATE POLICY "Buyers can insert requests" ON purchase_requests FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Sellers can view requests for their products
CREATE POLICY "Sellers can view product requests" ON purchase_requests FOR SELECT USING (
    auth.uid() = seller_id
);

-- Sellers can update request status
CREATE POLICY "Sellers can update requests" ON purchase_requests FOR UPDATE USING (
    auth.uid() = seller_id
);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON purchase_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Events RLS
CREATE POLICY "Users can view own request events" ON purchase_request_events FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM purchase_requests pr 
        WHERE pr.id = request_id 
        AND (pr.buyer_id = auth.uid() OR pr.seller_id = auth.uid())
    )
);

CREATE POLICY "Admins can manage request events" ON purchase_request_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- PURCHASE REQUEST FUNCTIONS
-- ==============================================================================

-- Create purchase request
CREATE OR REPLACE FUNCTION create_purchase_request(
    p_product_id UUID,
    p_buyer_id UUID,
    p_buyer_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
    seller_id UUID;
    product_exists BOOLEAN;
BEGIN
    -- Get seller ID from product
    SELECT user_id INTO seller_id
    FROM products 
    WHERE id = p_product_id AND status = 'approved';
    
    IF seller_id IS NULL THEN
        RAISE EXCEPTION 'Product not found or not approved';
    END IF;
    
    -- Create the request
    INSERT INTO purchase_requests (
        product_id, buyer_id, seller_id, buyer_message
    ) VALUES (
        p_product_id, p_buyer_id, seller_id, p_buyer_message
    ) RETURNING id INTO request_id;
    
    -- Log the event
    INSERT INTO purchase_request_events (
        request_id, event_type, triggered_by, event_data
    ) VALUES (
        request_id, 'created', p_buyer_id,
        jsonb_build_object('buyer_message', p_buyer_message)
    );
    
    -- Log analytics event
    PERFORM log_marketplace_event('purchase_request', p_buyer_id, seller_id, p_product_id);
    
    RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update request status (for sellers)
CREATE OR REPLACE FUNCTION update_purchase_request_status(
    p_request_id UUID,
    p_new_status VARCHAR(20),
    p_seller_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status VARCHAR(20);
    request_seller_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    -- Get current status and verify seller
    SELECT status, seller_id INTO current_status, request_seller_id
    FROM purchase_requests 
    WHERE id = p_request_id;
    
    -- Verify permissions
    IF request_seller_id != current_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only seller can update request status';
    END IF;
    
    -- Validate status transition
    IF p_new_status = 'contacted' AND current_status != 'pending' THEN
        RAISE EXCEPTION 'Invalid status transition';
    END IF;
    
    IF p_new_status = 'completed' AND current_status NOT IN ('pending', 'contacted') THEN
        RAISE EXCEPTION 'Invalid status transition';
    END IF;
    
    -- Update the request
    UPDATE purchase_requests 
    SET status = p_new_status,
        seller_notes = p_seller_notes,
        updated_at = NOW(),
        contacted_at = CASE WHEN p_new_status = 'contacted' THEN NOW() ELSE contacted_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END
    WHERE id = p_request_id;
    
    -- Log the event
    INSERT INTO purchase_request_events (
        request_id, event_type, triggered_by, event_data
    ) VALUES (
        p_request_id, p_new_status, current_user_id,
        jsonb_build_object('seller_notes', p_seller_notes)
    );
    
    -- If completed, trigger trust score update
    IF p_new_status = 'completed' THEN
        DECLARE
            product_user_id UUID;
        BEGIN
            SELECT user_id INTO product_user_id
            FROM products WHERE id = (SELECT product_id FROM purchase_requests WHERE id = p_request_id);
            
            -- Trigger HTP gain for successful transaction
            PERFORM handle_order_trust_impact(); -- Reuse existing trust function
        END;
    END IF;
    
    -- Log analytics event
    PERFORM log_marketplace_event('request_' || p_new_status, current_user_id, NULL, NULL);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel request (for buyers)
CREATE OR REPLACE FUNCTION cancel_purchase_request(
    p_request_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    request_buyer_id UUID;
    current_status VARCHAR(20);
    current_user_id UUID := auth.uid();
BEGIN
    -- Get request details and verify buyer
    SELECT buyer_id, status INTO request_buyer_id, current_status
    FROM purchase_requests 
    WHERE id = p_request_id;
    
    -- Verify permissions
    IF request_buyer_id != current_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only buyer can cancel request';
    END IF;
    
    -- Can only cancel pending requests
    IF current_status != 'pending' THEN
        RAISE EXCEPTION 'Can only cancel pending requests';
    END IF;
    
    -- Update the request
    UPDATE purchase_requests 
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Log the event
    INSERT INTO purchase_request_events (
        request_id, event_type, triggered_by
    ) VALUES (
        p_request_id, 'cancelled', current_user_id
    );
    
    -- Log analytics event
    PERFORM log_marketplace_event('request_cancelled', current_user_id, NULL, NULL);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ANALYTICS FUNCTIONS
-- ==============================================================================

-- Get seller's purchase requests
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
    JOIN profiles p ON pr.buyer_id = p.id
    JOIN products prod ON pr.product_id = prod.id
    WHERE pr.seller_id = p_seller_id
      AND (p_status IS NULL OR pr.status = p_status)
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get buyer's purchase requests
CREATE OR REPLACE FUNCTION get_buyer_purchase_requests(
    p_buyer_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    seller_id UUID,
    status VARCHAR(20),
    buyer_message TEXT,
    seller_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    seller_name TEXT,
    product_title TEXT,
    product_price NUMERIC
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
        pr.created_at,
        pr.updated_at,
        p.username as seller_name,
        prod.title as product_title,
        prod.price as product_price
    FROM purchase_requests pr
    JOIN profiles p ON pr.seller_id = p.user_id
    JOIN products prod ON pr.product_id = prod.id
    WHERE pr.buyer_id = p_buyer_id
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Purchase request statistics for admin
CREATE OR REPLACE FUNCTION get_purchase_request_stats()
RETURNS TABLE (
    total_requests BIGINT,
    pending_requests BIGINT,
    contacted_requests BIGINT,
    completed_requests BIGINT,
    cancelled_requests BIGINT,
    completion_rate NUMERIC,
    avg_response_time_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted_requests,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_requests,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_requests,
        CASE 
            WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)) * 100
            ELSE 0
        END as completion_rate,
        AVG(EXTRACT(EPOCH FROM (contacted_at - created_at))/3600) FILTER (WHERE contacted_at IS NOT NULL) as avg_response_time_hours
    FROM purchase_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
