-- HSTN Stage Zero Simplification
-- Disables advanced protection until marketplace traction exists
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- DEPENDENCY TABLES (Create if missing)
-- ==============================================================================

-- Purchase requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id),
    buyer_id UUID NOT NULL REFERENCES auth.users(id),
    seller_id UUID NOT NULL REFERENCES auth.users(id),
    buyer_message TEXT,
    seller_notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contacted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Purchase request events
CREATE TABLE IF NOT EXISTS purchase_request_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES purchase_requests(id),
    event_type VARCHAR(50) NOT NULL,
    triggered_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seller performance metrics
CREATE TABLE IF NOT EXISTS seller_performance_metrics (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    total_requests INTEGER DEFAULT 0,
    completed_requests INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trust scores table
CREATE TABLE IF NOT EXISTS trust_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    score INTEGER DEFAULT 50 CHECK (score >= 0 AND score <= 100),
    total_reviews INTEGER DEFAULT 0,
    positive_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- STAGE ZERO CONFIGURATION
-- ==============================================================================

-- Marketplace stage control
CREATE TABLE IF NOT EXISTS marketplace_stage_controls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stage VARCHAR(20) DEFAULT 'zero' CHECK (stage IN ('zero', 'growth', 'mature')),
    enable_advanced_protection BOOLEAN DEFAULT FALSE,
    enable_seller_grading BOOLEAN DEFAULT FALSE,
    enable_fraud_detection BOOLEAN DEFAULT FALSE,
    min_sellers_for_protection INTEGER DEFAULT 25,
    min_requests_for_protection INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize stage zero
INSERT INTO marketplace_stage_controls (stage) VALUES ('zero')
ON CONFLICT DO NOTHING;

-- Add role column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'buyer';
  END IF;
END $$;

-- RLS for stage controls
ALTER TABLE marketplace_stage_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage stage controls" ON marketplace_stage_controls FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- SIMPLIFIED FUNCTIONS (Stage Zero Only)
-- ==============================================================================

-- Simple request creation (no fraud detection)
CREATE OR REPLACE FUNCTION create_simple_purchase_request(
    p_product_id UUID,
    p_buyer_id UUID,
    p_buyer_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
    seller_id UUID;
    protection_enabled BOOLEAN;
BEGIN
    -- Check if advanced protection is enabled
    SELECT enable_fraud_detection INTO protection_enabled
    FROM marketplace_stage_controls
    ORDER BY created_at DESC LIMIT 1;

    -- Get seller ID
    SELECT user_id INTO seller_id
    FROM products
    WHERE id = p_product_id AND admin_status = 'approved';

    IF seller_id IS NULL THEN
        RAISE EXCEPTION 'Product not found or not approved';
    END IF;

    -- Create simple request (no IP/device tracking)
    INSERT INTO purchase_requests (
        product_id, buyer_id, seller_id, buyer_message,
        expires_at
    ) VALUES (
        p_product_id, p_buyer_id, seller_id, p_buyer_message,
        NOW() + INTERVAL '48 hours'
    ) RETURNING id INTO request_id;

    -- Only run fraud detection if enabled
    IF protection_enabled THEN
        -- Log basic event
        INSERT INTO purchase_request_events (
            request_id, event_type, triggered_by
        ) VALUES (
            request_id, 'created', p_buyer_id
        );
    END IF;

    RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple status update (no performance tracking)
CREATE OR REPLACE FUNCTION update_simple_request_status(
    p_request_id UUID,
    p_new_status VARCHAR(20),
    p_seller_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status VARCHAR(20);
    request_seller_id UUID;
    current_user_id UUID := auth.uid();
    grading_enabled BOOLEAN;
BEGIN
    -- Check if seller grading is enabled
    SELECT enable_seller_grading INTO grading_enabled
    FROM marketplace_stage_controls
    ORDER BY created_at DESC LIMIT 1;

    -- Get current status and verify seller
    SELECT status, seller_id INTO current_status, request_seller_id
    FROM purchase_requests
    WHERE id = p_request_id;

    -- Verify permissions
    IF request_seller_id != current_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only seller can update request status';
    END IF;

    -- Update request
    UPDATE purchase_requests
    SET status = p_new_status,
        seller_notes = p_seller_notes,
        updated_at = NOW(),
        contacted_at = CASE WHEN p_new_status = 'contacted' THEN NOW() ELSE contacted_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END
    WHERE id = p_request_id;

    -- Only track performance if grading enabled
    IF grading_enabled THEN
        -- Update seller performance metrics
        INSERT INTO seller_performance_metrics (user_id, total_requests)
        VALUES (request_seller_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            total_requests = seller_performance_metrics.total_requests + 1,
            last_updated = NOW();
    END IF;

    -- Only trigger trust score if completed
    IF p_new_status = 'completed' THEN
        -- Placeholder for trust impact function
        UPDATE trust_scores SET updated_at = NOW()
        WHERE user_id = request_seller_id;
    END IF;

    -- Log event only if grading enabled
    IF grading_enabled THEN
        INSERT INTO purchase_request_events (
            request_id, event_type, triggered_by
        ) VALUES (
            p_request_id, p_new_status, current_user_id
        );
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- STAGE CONTROL FUNCTIONS
-- ==============================================================================

-- Enable advanced protection when ready
CREATE OR REPLACE FUNCTION enable_advanced_protection()
RETURNS void AS $$
BEGIN
    UPDATE marketplace_stage_controls
    SET enable_advanced_protection = TRUE,
        enable_fraud_detection = TRUE,
        enable_seller_grading = TRUE,
        stage = 'growth',
        updated_at = NOW()
    WHERE id = (SELECT id FROM marketplace_stage_controls ORDER BY created_at DESC LIMIT 1);

    RAISE NOTICE 'Advanced protection enabled - marketplace entering growth stage';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check current stage
CREATE OR REPLACE FUNCTION get_marketplace_stage()
RETURNS TABLE (
    stage VARCHAR(20),
    enable_advanced_protection BOOLEAN,
    enable_seller_grading BOOLEAN,
    enable_fraud_detection BOOLEAN,
    min_sellers_for_protection INTEGER,
    min_requests_for_protection INTEGER,
    current_sellers INTEGER,
    current_requests INTEGER,
    ready_for_growth BOOLEAN
) AS $$
DECLARE
    seller_count INTEGER;
    request_count INTEGER;
BEGIN
    -- Get current counts
    SELECT COUNT(*) INTO seller_count
    FROM profiles WHERE role = 'seller';

    SELECT COUNT(*) INTO request_count
    FROM purchase_requests;

    RETURN QUERY
    SELECT
        msc.stage,
        msc.enable_advanced_protection,
        msc.enable_seller_grading,
        msc.enable_fraud_detection,
        msc.min_sellers_for_protection,
        msc.min_requests_for_protection,
        seller_count as current_sellers,
        request_count as current_requests,
        (seller_count >= msc.min_sellers_for_protection AND
         request_count >= msc.min_requests_for_protection) as ready_for_growth
    FROM marketplace_stage_controls msc
    ORDER BY msc.created_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
