-- HSTN Critical Gaps System
-- Addresses real-world marketplace vulnerabilities
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- BUYER TRUST SYSTEM
-- ==============================================================================

-- Buyer trust scores (internal, not public)
CREATE TABLE IF NOT EXISTS buyer_trust_scores (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    trust_score INTEGER DEFAULT 50,
    successful_orders INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    return_rate NUMERIC(5,2) DEFAULT 0,
    dispute_rate NUMERIC(5,2) DEFAULT 0,
    payment_success_rate NUMERIC(5,2) DEFAULT 100,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buyer fraud detection flags
CREATE TABLE IF NOT EXISTS buyer_fraud_flags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    flag_type VARCHAR(50) NOT NULL, -- 'high_return_rate', 'dispute_pattern', 'payment_failure'
    severity INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE
);

-- Buyer trust history
CREATE TABLE IF NOT EXISTS buyer_trust_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    delta INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    order_id UUID REFERENCES orders(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for buyer trust tables
ALTER TABLE buyer_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_trust_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own buyer trust" ON buyer_trust_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage buyer trust" ON buyer_trust_scores FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can manage fraud flags" ON buyer_fraud_flags FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view own trust history" ON buyer_trust_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage trust history" ON buyer_trust_history FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- BUYER TRUST FUNCTIONS
-- ==============================================================================

-- Update buyer trust after order completion
CREATE OR REPLACE FUNCTION update_buyer_trust_after_order(
    p_buyer_id UUID,
    p_order_id UUID,
    p_order_status VARCHAR(50)
)
RETURNS void AS $$
DECLARE
    current_score INTEGER := 50;
    current_orders INTEGER := 0;
    current_returns INTEGER := 0;
    current_disputes INTEGER := 0;
    delta INTEGER := 0;
    event_desc TEXT := '';
BEGIN
    -- Get current buyer trust data
    SELECT trust_score, total_orders INTO current_score, current_orders
    FROM buyer_trust_scores WHERE user_id = p_buyer_id;
    
    IF current_score IS NULL THEN
        INSERT INTO buyer_trust_scores (user_id, trust_score) VALUES (p_buyer_id, 50);
        current_score := 50;
        current_orders := 0;
    END IF;
    
    -- Update based on order status
    IF p_order_status = 'delivered' THEN
        delta := +2; -- Small positive for successful delivery
        event_desc := 'Order completed successfully';
        current_orders := current_orders + 1;
        
        UPDATE buyer_trust_scores 
        SET trust_score = LEAST(100, current_score + delta),
            successful_orders = successful_orders + 1,
            total_orders = total_orders + 1,
            last_activity = NOW()
        WHERE user_id = p_buyer_id;
        
    ELSIF p_order_status = 'returned' THEN
        delta := -5; -- Moderate penalty for returns
        event_desc := 'Order returned';
        
        UPDATE buyer_trust_scores 
        SET trust_score = GREATEST(0, current_score + delta),
            total_orders = total_orders + 1,
            last_activity = NOW()
        WHERE user_id = p_buyer_id;
        
        -- Check for high return rate
        PERFORM check_buyer_return_rate(p_buyer_id);
        
    ELSIF p_order_status = 'dispute_filed' THEN
        delta := -8; -- Significant penalty for disputes
        event_desc := 'Dispute filed';
        
        UPDATE buyer_trust_scores 
        SET trust_score = GREATEST(0, current_score + delta),
            total_orders = total_orders + 1,
            last_activity = NOW()
        WHERE user_id = p_buyer_id;
        
        -- Check for dispute patterns
        PERFORM check_buyer_dispute_patterns(p_buyer_id);
    END IF;
    
    -- Record history
    INSERT INTO buyer_trust_history (
        user_id, delta, event_type, order_id
    ) VALUES (
        p_buyer_id, delta, event_desc, p_order_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check for high return rate
CREATE OR REPLACE FUNCTION check_buyer_return_rate(p_buyer_id UUID)
RETURNS void AS $$
DECLARE
    return_rate NUMERIC;
    total_orders INTEGER;
    returned_orders INTEGER;
BEGIN
    -- Calculate return rate over last 30 days
    SELECT COUNT(*) INTO total_orders
    FROM orders 
    WHERE user_id = p_buyer_id 
      AND created_at >= NOW() - INTERVAL '30 days';
    
    SELECT COUNT(*) INTO returned_orders
    FROM orders 
    WHERE user_id = p_buyer_id 
      AND status = 'returned'
      AND created_at >= NOW() - INTERVAL '30 days';
    
    IF total_orders >= 5 THEN -- Minimum orders for rate calculation
        return_rate := (returned_orders::NUMERIC / total_orders::NUMERIC) * 100;
        
        -- Flag high return rates (>30%)
        IF return_rate > 30 THEN
            INSERT INTO buyer_fraud_flags (
                user_id, flag_type, severity, details
            ) VALUES (
                p_buyer_id, 'high_return_rate', 2,
                jsonb_build_object(
                    'return_rate', return_rate,
                    'returned_orders', returned_orders,
                    'total_orders', total_orders
                )
            );
        END IF;
        
        -- Update return rate in trust score
        UPDATE buyer_trust_scores 
        SET return_rate = return_rate
        WHERE user_id = p_buyer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check for dispute patterns
CREATE OR REPLACE FUNCTION check_buyer_dispute_patterns(p_buyer_id UUID)
RETURNS void AS $$
DECLARE
    dispute_rate NUMERIC;
    total_orders INTEGER;
    disputed_orders INTEGER;
BEGIN
    -- Calculate dispute rate over last 60 days
    SELECT COUNT(*) INTO total_orders
    FROM orders 
    WHERE user_id = p_buyer_id 
      AND created_at >= NOW() - INTERVAL '60 days';
    
    SELECT COUNT(*) INTO disputed_orders
    FROM orders 
    WHERE user_id = p_buyer_id 
      AND status LIKE '%dispute%'
      AND created_at >= NOW() - INTERVAL '60 days';
    
    IF total_orders >= 3 THEN -- Minimum orders for pattern detection
        dispute_rate := (disputed_orders::NUMERIC / total_orders::NUMERIC) * 100;
        
        -- Flag high dispute rates (>20%)
        IF dispute_rate > 20 THEN
            INSERT INTO buyer_fraud_flags (
                user_id, flag_type, severity, details
            ) VALUES (
                p_buyer_id, 'dispute_pattern', 3,
                jsonb_build_object(
                    'dispute_rate', dispute_rate,
                    'disputed_orders', disputed_orders,
                    'total_orders', total_orders
                )
            );
        END IF;
        
        -- Update dispute rate in trust score
        UPDATE buyer_trust_scores 
        SET dispute_rate = dispute_rate
        WHERE user_id = p_buyer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- TRUST SCORE DECAY MECHANISM
-- ==============================================================================

-- Add decay tracking to trust scores
ALTER TABLE trust_scores ADD COLUMN IF NOT EXISTS 
    last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE trust_scores ADD COLUMN IF NOT EXISTS 
    activity_streak_days INTEGER DEFAULT 0;

-- Decay function for inactive sellers
CREATE OR REPLACE FUNCTION apply_trust_score_decay()
RETURNS void AS $$
DECLARE
    seller_record RECORD;
    days_inactive INTEGER;
    decay_amount INTEGER;
BEGIN
    -- Apply decay to sellers inactive for 60+ days
    FOR seller_record IN 
        SELECT user_id, score, last_activity_date
        FROM trust_scores
        WHERE last_activity_date < NOW() - INTERVAL '60 days'
    LOOP
        days_inactive := EXTRACT(DAYS FROM (NOW() - seller_record.last_activity_date));
        
        -- Gradual decay: -1 point per 30 days of inactivity (max -20)
        decay_amount := LEAST(20, FLOOR(days_inactive / 30));
        
        -- Only decay if score is above baseline
        IF seller_record.score > 50 THEN
            UPDATE trust_scores 
            SET score = GREATEST(50, seller_record.score - decay_amount),
                last_activity_date = NOW() -- Reset to prevent multiple decays
            WHERE user_id = seller_record.user_id;
            
            -- Record decay in history
            INSERT INTO trust_history (
                user_id, delta, event_type
            ) VALUES (
                seller_record.user_id, -decay_amount, 'activity_decay'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ELITE SCARCITY ENFORCEMENT
-- ==============================================================================

-- Elite qualification tracking
CREATE TABLE IF NOT EXISTS elite_qualification_pool (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    trust_score INTEGER,
    total_deliveries INTEGER,
    active_days INTEGER, -- Days with sales in last 90 days
    qualification_score NUMERIC, -- Composite score for elite ranking
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_elite BOOLEAN DEFAULT FALSE
);

-- Calculate elite qualification pool
CREATE OR REPLACE FUNCTION calculate_elite_qualification()
RETURNS void AS $$
DECLARE
    elite_threshold_percent NUMERIC := 0.08; -- Top 8%
    min_deliveries INTEGER := 50;
    active_sellers INTEGER;
    elite_cutoff INTEGER;
BEGIN
    -- Clear old pool
    DELETE FROM elite_qualification_pool;
    
    -- Calculate active sellers (min 50 deliveries, activity in last 90 days)
    INSERT INTO elite_qualification_pool (
        user_id, trust_score, total_deliveries, active_days
    )
    SELECT 
        ts.user_id,
        ts.score,
        COALESCE(delivery_counts.total_deliveries, 0),
        COALESCE(active_days.active_days, 0)
    FROM trust_scores ts
    LEFT JOIN (
        SELECT seller_id, COUNT(*) as total_deliveries
        FROM orders 
        WHERE status = 'delivered'
        GROUP BY seller_id
    ) delivery_counts ON ts.user_id = delivery_counts.seller_id
    LEFT JOIN (
        SELECT seller_id, COUNT(DISTINCT DATE(created_at)) as active_days
        FROM orders 
        WHERE status = 'delivered'
          AND created_at >= NOW() - INTERVAL '90 days'
        GROUP BY seller_id
    ) active_days ON ts.user_id = active_days.seller_id
    WHERE ts.score >= 150
      AND COALESCE(delivery_counts.total_deliveries, 0) >= min_deliveries
      AND COALESCE(active_days.active_days, 0) >= 10; -- Minimum activity
    
    -- Get total active sellers
    SELECT COUNT(*) INTO active_sellers
    FROM elite_qualification_pool;
    
    -- Calculate elite cutoff (top 8%)
    elite_cutoff := CEIL(active_sellers * elite_threshold_percent);
    
    -- Update qualification scores and mark elite sellers
    UPDATE elite_qualification_pool 
    SET qualification_score = (trust_score * 0.6) + 
                           (total_deliveries * 0.3) + 
                           (active_days * 0.2),
        is_elite = (
            SELECT rn <= elite_cutoff
            FROM (
                SELECT user_id, ROW_NUMBER() OVER (ORDER BY qualification_score DESC) as rn
                FROM elite_qualification_pool
            ) ranked 
            WHERE ranked.user_id = elite_qualification_pool.user_id
        );
    
    RAISE NOTICE 'Elite qualification calculated: % sellers, % elite cutoff', 
                active_sellers, elite_cutoff;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- LOGISTICS INTEGRATION LAYER
-- ==============================================================================

-- Shipping integration table
CREATE TABLE IF NOT EXISTS shipping_integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider VARCHAR(50) NOT NULL, -- 'shiprocket', 'delhivery', 'india_post'
    api_key_encrypted TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipping tracking
CREATE TABLE IF NOT EXISTS shipment_tracking (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    tracking_number VARCHAR(100),
    provider VARCHAR(50),
    status VARCHAR(50), -- 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'
    estimated_delivery TIMESTAMP WITH TIME ZONE,
    actual_delivery TIMESTAMP WITH TIME ZONE,
    liability_coverage NUMERIC(10,2), -- Insurance amount
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lost parcel claims
CREATE TABLE IF NOT EXISTS lost_parcel_claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    claim_reason TEXT,
    claim_amount NUMERIC(10,2),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for logistics tables
ALTER TABLE shipping_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_parcel_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage logistics" ON shipping_integrations FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can manage tracking" ON shipment_tracking FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can manage claims" ON lost_parcel_claims FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- GOVERNANCE TRANSPARENCY MODULE
-- ==============================================================================

-- Ranking explanation cache
CREATE TABLE IF NOT EXISTS ranking_explanations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id),
    user_id UUID REFERENCES auth.users(id), -- Seller viewing explanation
    trust_component NUMERIC,
    heat_component NUMERIC,
    video_component NUMERIC,
    tier_component NUMERIC,
    recency_component NUMERIC,
    total_score NUMERIC,
    explanation_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generate ranking explanation for seller
CREATE OR REPLACE FUNCTION generate_ranking_explanation(
    p_product_id UUID,
    p_seller_id UUID
)
RETURNS void AS $$
DECLARE
    trust_score INTEGER;
    heat_score NUMERIC;
    video_plays INTEGER;
    trust_tier INTEGER;
    days_since_upload NUMERIC;
    
    trust_weight NUMERIC := 0.60;
    heat_weight NUMERIC := 0.20;
    video_weight NUMERIC := 0.08;
    tier_weight NUMERIC := 0.07;
    recency_weight NUMERIC := 0.05;
    
    trust_comp NUMERIC;
    heat_comp NUMERIC;
    video_comp NUMERIC;
    tier_comp NUMERIC;
    recency_comp NUMERIC;
    total_score NUMERIC;
    
    explanation TEXT;
BEGIN
    -- Get product data
    SELECT ts.score, pa.heat_score, pa.total_video_plays
    INTO trust_score, heat_score, video_plays
    FROM products p
    LEFT JOIN trust_scores ts ON p.user_id = ts.user_id
    LEFT JOIN product_analytics pa ON p.id = pa.product_id
    WHERE p.id = p_product_id;
    
    -- Calculate components
    trust_comp := COALESCE(trust_score, 50) * trust_weight;
    heat_comp := COALESCE(heat_score, 0) * heat_weight;
    video_comp := COALESCE(video_plays, 0) * video_weight;
    
    trust_tier := CASE 
        WHEN COALESCE(trust_score, 50) >= 150 THEN 4
        WHEN COALESCE(trust_score, 50) >= 100 THEN 3
        WHEN COALESCE(trust_score, 50) >= 50 THEN 2
        ELSE 1
    END;
    tier_comp := trust_tier * 15 * tier_weight;
    
    SELECT EXTRACT(EPOCH FROM (NOW() - created_at))/86400 INTO days_since_upload
    FROM products WHERE id = p_product_id;
    recency_comp := GREATEST(0, 30 - days_since_upload) * recency_weight;
    
    total_score := trust_comp + heat_comp + video_comp + tier_comp + recency_comp;
    
    -- Generate explanation
    explanation := format(
        'Your product ranking is calculated as: %s
        • Trust Score (%s): %s points (60%% weight)
        • Heat Score (%s): %s points (20%% weight) 
        • Video Engagement (%s): %s points (8%% weight)
        • Trust Tier (%s): %s points (7%% weight)
        • Recency (%s days): %s points (5%% weight)',
        ROUND(total_score, 1),
        COALESCE(trust_score, 50), ROUND(trust_comp, 1),
        ROUND(heat_score, 0), ROUND(heat_comp, 1),
        video_plays, ROUND(video_comp, 1),
        trust_tier, ROUND(tier_comp, 1),
        ROUND(days_since_upload, 0), ROUND(recency_comp, 1)
    );
    
    -- Store explanation
    INSERT INTO ranking_explanations (
        product_id, user_id, trust_component, heat_component,
        video_component, tier_component, recency_component,
        total_score, explanation_text
    ) VALUES (
        p_product_id, p_seller_id, trust_comp, heat_comp,
        video_comp, tier_comp, recency_comp,
        total_score, explanation
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- RANKING FIXES (Remove Double Counting)
-- ==============================================================================

-- Fixed ranking function without double counting
CREATE OR REPLACE FUNCTION calculate_fixed_ranking_score(
    p_product_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    final_score NUMERIC := 0;
    
    -- Fixed weights (no double counting)
    trust_weight NUMERIC := 0.60;
    heat_weight NUMERIC := 0.20;
    video_weight NUMERIC := 0.08;
    tier_weight NUMERIC := 0.07;
    recency_weight NUMERIC := 0.05;
    
    -- Get actual values
    actual_trust_score INTEGER;
    actual_heat_score NUMERIC;
    video_plays INTEGER;
    trust_tier INTEGER;
    days_since_upload NUMERIC;
BEGIN
    -- Get product data
    SELECT ts.score, pa.heat_score, pa.total_video_plays
    INTO actual_trust_score, actual_heat_score, video_plays
    FROM products p
    LEFT JOIN trust_scores ts ON p.user_id = ts.user_id
    LEFT JOIN product_analytics pa ON p.id = pa.product_id
    WHERE p.id = p_product_id;
    
    -- Use defaults if missing
    actual_trust_score := COALESCE(actual_trust_score, 50);
    actual_heat_score := COALESCE(actual_heat_score, 0);
    video_plays := COALESCE(video_plays, 0);
    
    -- Calculate trust tier
    trust_tier := CASE 
        WHEN actual_trust_score >= 150 THEN 4
        WHEN actual_trust_score >= 100 THEN 3
        WHEN actual_trust_score >= 50 THEN 2
        ELSE 1
    END;
    
    -- Get recency
    SELECT EXTRACT(EPOCH FROM (NOW() - created_at))/86400 INTO days_since_upload
    FROM products WHERE id = p_product_id;
    
    -- Calculate fixed ranking score (no double counting)
    final_score := 
        (actual_trust_score * trust_weight) +                    -- Trust anchor (60%)
        (LEAST(actual_heat_score, 500) * heat_weight) +        -- Heat momentum (20%)
        (LEAST(video_plays, 50) * video_weight) +             -- Video engagement (8%)
        (trust_tier * 15 * tier_weight) +                      -- Tier bonus (7%)
        (GREATEST(0, 30 - days_since_upload) * recency_weight); -- Recency bonus (5%)
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
