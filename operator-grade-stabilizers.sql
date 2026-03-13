-- HSTN Protection Layer
-- Real-world marketplace manipulation prevention
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- ENHANCED PURCHASE REQUEST PROTECTION
-- ==============================================================================

-- Add protection columns to purchase_requests
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS 
    buyer_ip_address INET;

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS 
    buyer_device_fingerprint TEXT;

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS 
    auto_expired BOOLEAN DEFAULT FALSE;

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS 
    buyer_confirmed_completion BOOLEAN DEFAULT FALSE;

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS 
    seller_response_time_hours INTEGER;

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS 
    expires_at TIMESTAMP WITH TIME ZONE;

-- Seller performance tracking
CREATE TABLE IF NOT EXISTS seller_performance_metrics (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    total_requests INTEGER DEFAULT 0,
    responded_requests INTEGER DEFAULT 0,
    completed_requests INTEGER DEFAULT 0,
    response_rate NUMERIC(5,2) DEFAULT 0,
    avg_response_time_hours NUMERIC(8,2) DEFAULT 0,
    completion_rate NUMERIC(5,2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fraud detection patterns
CREATE TABLE IF NOT EXISTS request_fraud_patterns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pattern_type VARCHAR(50) NOT NULL, -- 'ip_clustering', 'device_farming', 'fake_accounts'
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    device_fingerprint TEXT,
    request_count_24h INTEGER DEFAULT 0,
    request_count_7d INTEGER DEFAULT 0,
    severity INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE
);

-- RLS for protection tables
ALTER TABLE seller_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_fraud_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seller metrics" ON seller_performance_metrics FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can manage fraud patterns" ON request_fraud_patterns FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- PROTECTION FUNCTIONS
-- ==============================================================================

-- Enhanced request creation with fraud detection
CREATE OR REPLACE FUNCTION create_protected_purchase_request(
    p_product_id UUID,
    p_buyer_id UUID,
    p_buyer_message TEXT DEFAULT NULL,
    p_buyer_ip INET DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
    seller_id UUID;
    ip_requests_24h INTEGER := 0;
    device_requests_24h INTEGER := 0;
    fraud_flagged BOOLEAN := FALSE;
BEGIN
    -- Get seller ID
    SELECT user_id INTO seller_id
    FROM products 
    WHERE id = p_product_id AND status = 'approved';
    
    IF seller_id IS NULL THEN
        RAISE EXCEPTION 'Product not found or not approved';
    END IF;
    
    -- Check IP clustering (more than 5 requests from same IP in 24h)
    SELECT COUNT(*) INTO ip_requests_24h
    FROM purchase_requests
    WHERE buyer_ip_address = p_buyer_ip
      AND created_at >= NOW() - INTERVAL '24 hours';
    
    -- Check device farming (more than 3 requests from same device in 24h)
    SELECT COUNT(*) INTO device_requests_24h
    FROM purchase_requests
    WHERE buyer_device_fingerprint = p_device_fingerprint
      AND created_at >= NOW() - INTERVAL '24 hours';
    
    -- Flag fraud patterns
    IF ip_requests_24h >= 5 THEN
        INSERT INTO request_fraud_patterns (
            pattern_type, user_id, ip_address, request_count_24h, severity
        ) VALUES (
            'ip_clustering', p_buyer_id, p_buyer_ip, ip_requests_24h, 2
        );
        fraud_flagged := TRUE;
    END IF;
    
    IF device_requests_24h >= 3 THEN
        INSERT INTO request_fraud_patterns (
            pattern_type, user_id, device_fingerprint, request_count_24h, severity
        ) VALUES (
            'device_farming', p_buyer_id, p_device_fingerprint, device_requests_24h, 2
        );
        fraud_flagged := TRUE;
    END IF;
    
    -- Prevent request if fraud flagged
    IF fraud_flagged THEN
        RAISE EXCEPTION 'Request flagged for suspicious activity';
    END IF;
    
    -- Create request with 48-hour expiration
    INSERT INTO purchase_requests (
        product_id, buyer_id, seller_id, buyer_message,
        buyer_ip_address, buyer_device_fingerprint,
        expires_at
    ) VALUES (
        p_product_id, p_buyer_id, seller_id, p_buyer_message,
        p_buyer_ip, p_device_fingerprint,
        NOW() + INTERVAL '48 hours'
    ) RETURNING id INTO request_id;
    
    -- Update seller performance metrics
    INSERT INTO seller_performance_metrics (user_id, total_requests)
    VALUES (seller_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        total_requests = seller_performance_metrics.total_requests + 1,
        last_updated = NOW();
    
    RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-expire old requests
CREATE OR REPLACE FUNCTION auto_expire_requests()
RETURNS void AS $$
BEGIN
    UPDATE purchase_requests 
    SET auto_expired = TRUE,
        status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW()
      AND auto_expired = FALSE;
    
    -- Log expirations
    INSERT INTO purchase_request_events (
        request_id, event_type, triggered_by
    )
    SELECT 
        id, 'auto_expired', NULL
    FROM purchase_requests 
    WHERE status = 'expired'
      AND auto_expired = TRUE;
    
    RAISE NOTICE 'Auto-expired % pending requests', 
        (SELECT COUNT(*) FROM purchase_requests WHERE status = 'expired' AND auto_expired = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced status update with buyer confirmation
CREATE OR REPLACE FUNCTION update_protected_request_status(
    p_request_id UUID,
    p_new_status VARCHAR(20),
    p_seller_notes TEXT DEFAULT NULL,
    p_buyer_confirmation BOOLEAN DEFAULT FALSE -- New parameter
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status VARCHAR(20);
    request_seller_id UUID;
    current_user_id UUID := auth.uid();
    response_time_hours INTEGER;
BEGIN
    -- Get current status and verify seller
    SELECT status, seller_id, created_at INTO current_status, request_seller_id
    FROM purchase_requests 
    WHERE id = p_request_id;
    
    -- Verify permissions
    IF request_seller_id != current_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only seller can update request status';
    END IF;
    
    -- Calculate response time if first response
    IF p_new_status = 'contacted' AND current_status = 'pending' THEN
        response_time_hours := EXTRACT(HOURS FROM (NOW() - created_at));
        
        UPDATE purchase_requests 
        SET status = p_new_status,
            seller_notes = p_seller_notes,
            updated_at = NOW(),
            contacted_at = NOW(),
            seller_response_time_hours = response_time_hours
        WHERE id = p_request_id;
        
        -- Update seller performance
        UPDATE seller_performance_metrics 
        SET responded_requests = responded_requests + 1,
            avg_response_time_hours = (
                (avg_response_time_hours * responded_requests + response_time_hours) / 
                (responded_requests + 1)
            ),
            last_updated = NOW()
        WHERE user_id = request_seller_id;
        
    ELSIF p_new_status = 'completed' THEN
        -- REQUIRE buyer confirmation for trust score impact
        IF NOT p_buyer_confirmation THEN
            RAISE EXCEPTION 'Buyer confirmation required for completion';
        END IF;
        
        UPDATE purchase_requests 
        SET status = p_new_status,
            seller_notes = p_seller_notes,
            updated_at = NOW(),
            completed_at = NOW(),
            buyer_confirmed_completion = TRUE
        WHERE id = p_request_id;
        
        -- Update seller performance
        UPDATE seller_performance_metrics 
        SET completed_requests = completed_requests + 1,
            completion_rate = (completed_requests::NUMERIC / total_requests) * 100,
            last_updated = NOW()
        WHERE user_id = request_seller_id;
        
        -- Only then trigger trust score update
        PERFORM handle_order_trust_impact();
        
    ELSIF p_new_status = 'cancelled' THEN
        UPDATE purchase_requests 
        SET status = p_new_status,
            updated_at = NOW()
        WHERE id = p_request_id;
    END IF;
    
    -- Log event
    INSERT INTO purchase_request_events (
        request_id, event_type, triggered_by, event_data
    ) VALUES (
        p_request_id, p_new_status, current_user_id,
        jsonb_build_object(
            'seller_notes', p_seller_notes,
            'buyer_confirmation', p_buyer_confirmation
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buyer confirmation function
CREATE OR REPLACE FUNCTION confirm_request_completion(
    p_request_id UUID,
    p_buyer_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    request_buyer_id UUID;
    request_status VARCHAR(20);
BEGIN
    -- Verify buyer owns this request
    SELECT buyer_id, status INTO request_buyer_id, request_status
    FROM purchase_requests 
    WHERE id = p_request_id;
    
    IF request_buyer_id != p_buyer_id THEN
        RAISE EXCEPTION 'Unauthorized: Only buyer can confirm completion';
    END IF;
    
    IF request_status != 'completed' THEN
        RAISE EXCEPTION 'Request must be marked completed by seller first';
    END IF;
    
    -- Update buyer confirmation
    UPDATE purchase_requests 
    SET buyer_confirmed_completion = TRUE
    WHERE id = p_request_id;
    
    -- Log confirmation
    INSERT INTO purchase_request_events (
        request_id, event_type, triggered_by
    ) VALUES (
        p_request_id, 'buyer_confirmed', p_buyer_id
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SELLER PERFORMANCE ANALYTICS
-- ==============================================================================

-- Get seller performance metrics
CREATE OR REPLACE FUNCTION get_seller_performance_metrics(
    p_seller_id UUID
)
RETURNS TABLE (
    total_requests INTEGER,
    responded_requests INTEGER,
    completed_requests INTEGER,
    response_rate NUMERIC(5,2),
    avg_response_time_hours NUMERIC(8,2),
    completion_rate NUMERIC(5,2),
    requests_last_7_days INTEGER,
    performance_grade VARCHAR(1) -- A, B, C, D, F
) AS $$
DECLARE
    requests_7d INTEGER;
    response_rate_num NUMERIC;
    completion_rate_num NUMERIC;
    grade VARCHAR(1);
BEGIN
    -- Get requests in last 7 days
    SELECT COUNT(*) INTO requests_7d
    FROM purchase_requests
    WHERE seller_id = p_seller_id
      AND created_at >= NOW() - INTERVAL '7 days';
    
    -- Get current metrics
    SELECT * INTO response_rate_num, completion_rate_num
    FROM seller_performance_metrics
    WHERE user_id = p_seller_id;
    
    -- Calculate performance grade
    grade := CASE
        WHEN response_rate_num >= 90 AND completion_rate_num >= 80 THEN 'A'
        WHEN response_rate_num >= 75 AND completion_rate_num >= 60 THEN 'B'
        WHEN response_rate_num >= 50 AND completion_rate_num >= 40 THEN 'C'
        WHEN response_rate_num >= 25 THEN 'D'
        ELSE 'F'
    END;
    
    RETURN QUERY
    SELECT 
        COALESCE(total_requests, 0),
        COALESCE(responded_requests, 0),
        COALESCE(completed_requests, 0),
        COALESCE(response_rate, 0),
        COALESCE(avg_response_time_hours, 0),
        COALESCE(completion_rate, 0),
        requests_7d,
        grade
    FROM seller_performance_metrics
    WHERE user_id = p_seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Flag low-performing sellers
CREATE OR REPLACE FUNCTION flag_low_performing_sellers()
RETURNS void AS $$
DECLARE
    seller_record RECORD;
BEGIN
    -- Flag sellers with poor metrics
    FOR seller_record IN 
        SELECT user_id, response_rate, completion_rate
        FROM seller_performance_metrics
        WHERE (response_rate < 50 OR completion_rate < 40)
          AND total_requests >= 10 -- Minimum requests to evaluate
    LOOP
        INSERT INTO request_fraud_patterns (
            pattern_type, user_id, severity, request_count_24h
        ) VALUES (
            'low_performance', seller_record.user_id, 2, seller_record.total_requests
        );
    END LOOP;
    
    RAISE NOTICE 'Flagged % low-performing sellers', 
        (SELECT COUNT(*) FROM seller_performance_metrics 
         WHERE (response_rate < 50 OR completion_rate < 40) 
         AND total_requests >= 10);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- AUTOMATED PROTECTION JOBS
-- ==============================================================================

-- Run protection checks daily
CREATE OR REPLACE FUNCTION run_daily_protection_checks()
RETURNS void AS $$
BEGIN
    -- Auto-expire old requests
    PERFORM auto_expire_requests();
    
    -- Flag low-performing sellers
    PERFORM flag_low_performing_sellers();
    
    -- Clean old fraud patterns (keep 30 days)
    DELETE FROM request_fraud_patterns 
    WHERE created_at < NOW() - INTERVAL '30 days' 
      AND resolved = TRUE;
    
    RAISE NOTICE 'Daily protection checks completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;


