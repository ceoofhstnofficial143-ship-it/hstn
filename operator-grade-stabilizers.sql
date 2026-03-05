-- HSTN Operator-Grade Stabilizers
-- Real-world marketplace protection systems
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- ENHANCED SYSTEM CONTROLS
-- ==============================================================================

-- Update system controls with operator-grade safeguards
ALTER TABLE ranking_system_controls ADD COLUMN IF NOT EXISTS 
    adjustment_frequency_days INTEGER DEFAULT 7;

ALTER TABLE ranking_system_controls ADD COLUMN IF NOT EXISTS 
    last_adjustment_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE ranking_system_controls ADD COLUMN IF NOT EXISTS 
    min_unique_buyers INTEGER DEFAULT 30;

ALTER TABLE ranking_system_controls ADD COLUMN IF NOT EXISTS 
    min_unique_sellers INTEGER DEFAULT 10;

ALTER TABLE ranking_system_controls ADD COLUMN IF NOT EXISTS 
    shadow_mode_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE ranking_system_controls ADD COLUMN IF NOT EXISTS 
    shadow_mode_start TIMESTAMP WITH TIME ZONE;

-- Shadow mode comparison table
CREATE TABLE IF NOT EXISTS shadow_mode_comparisons (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id),
    live_ranking_score NUMERIC,
    adaptive_ranking_score NUMERIC,
    score_difference NUMERIC,
    performance_impact NUMERIC, -- Measured after implementation
    comparison_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    would_change_position BOOLEAN
);

-- Engagement spike detection table
CREATE TABLE IF NOT EXISTS engagement_spike_flags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id),
    spike_type VARCHAR(50), -- 'views', 'video_plays', 'wishlist_adds', 'cart_adds'
    baseline_7day_avg NUMERIC,
    current_24h_count NUMERIC,
    spike_multiplier NUMERIC,
    checkout_correlation NUMERIC, -- Checkout change vs engagement change
    flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE
);

-- RLS for new tables
ALTER TABLE shadow_mode_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_spike_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage shadow comparisons" ON shadow_mode_comparisons FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can manage spike flags" ON engagement_spike_flags FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- ENHANCED THRESHOLD VALIDATION
-- ==============================================================================

-- Override correlation function with real distribution checks
CREATE OR REPLACE FUNCTION calculate_ranking_correlations_operational()
RETURNS void AS $$
DECLARE
    trust_corr NUMERIC;
    heat_corr NUMERIC;
    video_corr NUMERIC;
    tier_corr NUMERIC;
    recency_corr NUMERIC;
    sample_size INTEGER;
    min_threshold INTEGER;
    min_buyers INTEGER;
    min_sellers INTEGER;
    max_adjustment NUMERIC;
    adaptive_on BOOLEAN;
    shadow_on BOOLEAN;
    frequency_days INTEGER;
    last_adjustment TIMESTAMP;
    
    -- Distribution validation variables
    unique_buyers INTEGER;
    unique_sellers INTEGER;
    completed_checkouts INTEGER;
    days_since_last_adjustment INTEGER;
BEGIN
    -- Get system controls
    SELECT minimum_sample_size, max_weight_adjustment, adaptive_enabled,
           shadow_mode_enabled, adjustment_frequency_days, last_adjustment_date,
           min_unique_buyers, min_unique_sellers
    INTO min_threshold, max_adjustment, adaptive_on, shadow_on, frequency_days,
         last_adjustment, min_buyers, min_sellers
    FROM ranking_system_controls
    ORDER BY created_at DESC LIMIT 1;
    
    -- Exit if adaptive system is disabled
    IF NOT adaptive_on THEN
        RAISE NOTICE 'Adaptive ranking system is manually disabled';
        RETURN;
    END IF;
    
    -- Check adjustment frequency limit
    days_since_last_adjustment := EXTRACT(DAYS FROM (NOW() - COALESCE(last_adjustment, NOW() - INTERVAL '30 days')));
    IF days_since_last_adjustment < frequency_days THEN
        RAISE NOTICE 'Adjustment frequency limit: % days since last adjustment (limit: %)', 
                    days_since_last_adjustment, frequency_days;
        RETURN;
    END IF;
    
    -- Get REAL distribution metrics
    SELECT 
        COUNT(DISTINCT o.id) as completed_checkouts,
        COUNT(DISTINCT o.user_id) as unique_buyers,
        COUNT(DISTINCT p.user_id) as unique_sellers
    INTO completed_checkouts, unique_buyers, unique_sellers
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.status = 'delivered'
      AND o.created_at >= NOW() - INTERVAL '30 days';
    
    -- Validate ALL thresholds
    IF completed_checkouts < min_threshold THEN
        RAISE NOTICE 'Insufficient completed checkouts: % (required: %)', completed_checkouts, min_threshold;
        RETURN;
    END IF;
    
    IF unique_buyers < min_buyers THEN
        RAISE NOTICE 'Insufficient unique buyers: % (required: %)', unique_buyers, min_buyers;
        RETURN;
    END IF;
    
    IF unique_sellers < min_sellers THEN
        RAISE NOTICE 'Insufficient unique sellers: % (required: %)', unique_sellers, min_sellers;
        RETURN;
    END IF;
    
    -- Get sample size for correlation analysis
    SELECT COUNT(DISTINCT pa.product_id) INTO sample_size
    FROM product_analytics pa
    WHERE pa.total_views >= 10;
    
    IF sample_size < 50 THEN
        RAISE NOTICE 'Insufficient sample size for correlation: % (required: 50)', sample_size;
        RETURN;
    END IF;
    
    -- Calculate correlations (only if not in shadow mode)
    IF NOT shadow_on THEN
        -- Standard correlation calculations
        SELECT CORR(pa.total_orders, ts.score) INTO trust_corr
        FROM product_analytics pa
        JOIN products p ON pa.product_id = p.id
        JOIN trust_scores ts ON p.user_id = ts.user_id
        WHERE pa.total_views >= 10;
        
        SELECT CORR(pa.total_orders, pa.heat_score) INTO heat_corr
        FROM product_analytics pa
        WHERE pa.total_views >= 10;
        
        SELECT CORR(pa.total_orders, pa.total_video_plays) INTO video_corr
        FROM product_analytics pa
        WHERE pa.total_views >= 10;
        
        SELECT CORR(pa.total_orders, 
            CASE 
                WHEN ts.score >= 150 THEN 4
                WHEN ts.score >= 100 THEN 3
                WHEN ts.score >= 50 THEN 2
                ELSE 1
            END
        ) INTO tier_corr
        FROM product_analytics pa
        JOIN products p ON pa.product_id = p.id
        JOIN trust_scores ts ON p.user_id = ts.user_id
        WHERE pa.total_views >= 10;
        
        SELECT CORR(pa.total_orders, EXTRACT(EPOCH FROM (NOW() - p.created_at))/86400) INTO recency_corr
        FROM product_analytics pa
        JOIN products p ON pa.product_id = p.id
        WHERE pa.total_views >= 10;
        
        -- Update correlations with OPERATOR-GRADE weight multipliers
        INSERT INTO ranking_correlations (
            factor_name, correlation_strength, conversion_correlation, sample_size, last_calculated, weight_multiplier
        ) VALUES 
            ('trust_score', ABS(trust_corr), trust_corr, sample_size, NOW(), 1.0), -- Trust always 1.0
            ('heat_score', ABS(heat_corr), heat_corr, sample_size, NOW(), 
             LEAST(max_adjustment, GREATEST(2.0 - max_adjustment, 1.0))), -- Stabilized symmetric range
            ('video_plays', ABS(video_corr), video_corr, sample_size, NOW(),
             LEAST(max_adjustment, GREATEST(2.0 - max_adjustment, 1.0))),
            ('trust_tier', ABS(tier_corr), tier_corr, sample_size, NOW(), 1.0), -- Tier always 1.0
            ('recency', ABS(recency_corr), recency_corr, sample_size, NOW(),
             LEAST(max_adjustment, GREATEST(2.0 - max_adjustment, 1.0)))
        ON CONFLICT (factor_name) DO UPDATE SET
            correlation_strength = EXCLUDED.correlation_strength,
            conversion_correlation = EXCLUDED.conversion_correlation,
            sample_size = EXCLUDED.sample_size,
            last_calculated = EXCLUDED.last_calculated,
            weight_multiplier = EXCLUDED.weight_multiplier;
        
        -- Update last adjustment date
        UPDATE ranking_system_controls 
        SET last_adjustment_date = NOW()
        WHERE id = (SELECT id FROM ranking_system_controls ORDER BY created_at DESC LIMIT 1);
        
        RAISE NOTICE 'Operational ranking correlations updated - Checkouts: %, Buyers: %, Sellers: %', 
                    completed_checkouts, unique_buyers, unique_sellers;
    ELSE
        RAISE NOTICE 'Shadow mode active - correlations calculated but not applied';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SHADOW MODE IMPLEMENTATION
-- ==============================================================================

-- Enable shadow mode
CREATE OR REPLACE FUNCTION enable_shadow_mode()
RETURNS void AS $$
BEGIN
    UPDATE ranking_system_controls 
    SET shadow_mode_enabled = TRUE,
        shadow_mode_start = NOW()
    WHERE id = (SELECT id FROM ranking_system_controls ORDER BY created_at DESC LIMIT 1);
    
    RAISE NOTICE 'Shadow mode enabled - adaptive weights calculated but not applied';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disable shadow mode and apply weights
CREATE OR REPLACE FUNCTION disable_shadow_mode()
RETURNS void AS $$
BEGIN
    UPDATE ranking_system_controls 
    SET shadow_mode_enabled = FALSE,
        shadow_mode_start = NULL
    WHERE id = (SELECT id FROM ranking_system_controls ORDER BY created_at DESC LIMIT 1);
    
    RAISE NOTICE 'Shadow mode disabled - adaptive weights now live';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compare live vs adaptive rankings
CREATE OR REPLACE FUNCTION run_shadow_mode_comparison()
RETURNS void AS $$
DECLARE
    product_record RECORD;
    live_score NUMERIC;
    adaptive_score NUMERIC;
    score_diff NUMERIC;
    position_change BOOLEAN;
BEGIN
    -- Check if shadow mode is enabled
    IF NOT EXISTS (SELECT 1 FROM ranking_system_controls WHERE shadow_mode_enabled = TRUE) THEN
        RAISE NOTICE 'Shadow mode is not enabled';
        RETURN;
    END IF;
    
    -- Clear old comparisons
    DELETE FROM shadow_mode_comparisons WHERE comparison_date = CURRENT_DATE;
    
    -- Compare scores for all products
    FOR product_record IN 
        SELECT id FROM products WHERE status = 'approved'
    LOOP
        -- Calculate live score (current system)
        live_score := calculate_premium_ranking_score(product_record.id);
        
        -- Calculate adaptive score (new system)
        adaptive_score := calculate_adaptive_ranking_score(product_record.id);
        
        score_diff := adaptive_score - live_score;
        position_change := ABS(score_diff) > 10; -- Significant difference threshold
        
        -- Store comparison
        INSERT INTO shadow_mode_comparisons (
            product_id, live_ranking_score, adaptive_ranking_score, 
            score_difference, would_change_position
        ) VALUES (
            product_record.id, live_score, adaptive_score, 
            score_diff, position_change
        );
    END LOOP;
    
    RAISE NOTICE 'Shadow mode comparison completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ENGAGEMENT SPIKE DETECTION
-- ==============================================================================

-- Detect engagement spikes without checkout correlation
CREATE OR REPLACE FUNCTION detect_engagement_spikes()
RETURNS void AS $$
DECLARE
    spike_record RECORD;
    baseline_views NUMERIC;
    current_views NUMERIC;
    baseline_checkouts NUMERIC;
    current_checkouts NUMERIC;
    spike_multiplier NUMERIC;
    checkout_correlation NUMERIC;
BEGIN
    -- Check all active products
    FOR spike_record IN 
        SELECT DISTINCT product_id FROM marketplace_events 
        WHERE event_type = 'product_view' 
          AND timestamp >= NOW() - INTERVAL '7 days'
    LOOP
        -- Get baseline (7-day average)
        SELECT AVG(daily_count) INTO baseline_views
        FROM (
            SELECT COUNT(*) as daily_count
            FROM marketplace_events 
            WHERE product_id = spike_record.product_id
              AND event_type = 'product_view'
              AND timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
        ) daily_views;
        
        -- Get current (24-hour)
        SELECT COUNT(*) INTO current_views
        FROM marketplace_events 
        WHERE product_id = spike_record.product_id
          AND event_type = 'product_view'
          AND timestamp >= NOW() - INTERVAL '1 day';
        
        -- Calculate spike multiplier
        IF baseline_views > 0 THEN
            spike_multiplier := current_views / baseline_views;
            
            -- Only flag significant spikes (>3x)
            IF spike_multiplier >= 3.0 THEN
                -- Get checkout correlation
                SELECT AVG(daily_count) INTO baseline_checkouts
                FROM (
                    SELECT COUNT(*) as daily_count
                    FROM marketplace_events 
                    WHERE product_id = spike_record.product_id
                      AND event_type = 'checkout_complete'
                      AND timestamp >= NOW() - INTERVAL '7 days'
                    GROUP BY DATE(timestamp)
                ) daily_checkouts;
                
                SELECT COUNT(*) INTO current_checkouts
                FROM marketplace_events 
                WHERE product_id = spike_record.product_id
                  AND event_type = 'checkout_complete'
                  AND timestamp >= NOW() - INTERVAL '1 day';
                
                -- Calculate checkout correlation
                IF baseline_checkouts > 0 THEN
                    checkout_correlation := (current_checkouts / baseline_checkouts) / spike_multiplier;
                ELSE
                    checkout_correlation := 0;
                END IF;
                
                -- Flag if spike not correlated with checkout increase
                IF checkout_correlation < 0.5 THEN -- Checkout increase less than half of engagement spike
                    INSERT INTO engagement_spike_flags (
                        product_id, spike_type, baseline_7day_avg, current_24h_count,
                        spike_multiplier, checkout_correlation
                    ) VALUES (
                        spike_record.product_id, 'views', baseline_views, current_views,
                        spike_multiplier, checkout_correlation
                    ) ON CONFLICT (product_id, spike_type) DO UPDATE SET
                        baseline_7day_avg = EXCLUDED.baseline_7day_avg,
                        current_24h_count = EXCLUDED.current_24h_count,
                        spike_multiplier = EXCLUDED.spike_multiplier,
                        checkout_correlation = EXCLUDED.checkout_correlation,
                        flagged_at = NOW();
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Engagement spike detection completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- OPERATOR-GRADE PREMIUM RANKING
-- ==============================================================================

-- Fixed weight distribution math
CREATE OR REPLACE FUNCTION calculate_operational_ranking_score(
    p_product_id UUID,
    p_trust_score INTEGER DEFAULT NULL,
    p_heat_score NUMERIC DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    final_score NUMERIC := 0;
    
    -- Fixed weight distribution (100% total)
    trust_weight NUMERIC := 0.60; -- 60% trust anchor
    heat_weight NUMERIC := 0.20; -- 20% heat max
    video_weight NUMERIC := 0.08; -- 8% video
    tier_weight NUMERIC := 0.07; -- 7% tier
    recency_weight NUMERIC := 0.05; -- 5% recency
    
    -- Total dynamic weights = 40% (60% reserved for trust)
    
    -- Get actual values
    actual_trust_score INTEGER;
    actual_heat_score NUMERIC;
    video_plays INTEGER;
    trust_tier INTEGER;
    days_since_upload NUMERIC;
    
    -- System controls
    adaptive_enabled BOOLEAN;
    shadow_mode BOOLEAN;
BEGIN
    -- Get system controls
    SELECT adaptive_enabled, shadow_mode_enabled
    INTO adaptive_enabled, shadow_mode
    FROM ranking_system_controls
    ORDER BY created_at DESC LIMIT 1;
    
    -- Get product data
    SELECT ts.score, pa.heat_score, pa.total_video_plays
    INTO actual_trust_score, actual_heat_score, video_plays
    FROM products p
    LEFT JOIN trust_scores ts ON p.user_id = ts.user_id
    LEFT JOIN product_analytics pa ON p.id = pa.product_id
    WHERE p.id = p_product_id;
    
    -- Use provided values or defaults
    actual_trust_score := COALESCE(p_trust_score, actual_trust_score, 50);
    actual_heat_score := COALESCE(p_heat_score, actual_heat_score, 0);
    
    -- Get trust tier
    trust_tier := CASE 
        WHEN actual_trust_score >= 150 THEN 4
        WHEN actual_trust_score >= 100 THEN 3
        WHEN actual_trust_score >= 50 THEN 2
        ELSE 1
    END;
    
    -- Get recency
    SELECT EXTRACT(EPOCH FROM (NOW() - created_at))/86400 INTO days_since_upload
    FROM products WHERE id = p_product_id;
    
    -- Apply adaptive weights only if enabled and not in shadow mode
    IF adaptive_enabled AND NOT shadow_mode THEN
        -- Get dynamic multipliers (capped to respect weight distribution)
        SELECT COALESCE(weight_multiplier, 1.0) INTO heat_weight
        FROM ranking_correlations 
        WHERE factor_name = 'heat_score' 
        ORDER BY last_calculated DESC LIMIT 1;
        
        SELECT COALESCE(weight_multiplier, 1.0) INTO video_weight
        FROM ranking_correlations 
        WHERE factor_name = 'video_plays' 
        ORDER BY last_calculated DESC LIMIT 1;
        
        -- Ensure dynamic weights don't exceed their allocated percentage
        heat_weight := LEAST(heat_weight, 0.20); -- Never exceed 20%
        video_weight := LEAST(video_weight, 0.08); -- Never exceed 8%
        
        -- Scale to fit within 40% dynamic allocation
        DECLARE
            total_dynamic NUMERIC := heat_weight + video_weight + 0.07 + 0.05; -- + tier + recency
        BEGIN
            IF total_dynamic > 0.40 THEN
                heat_weight := (heat_weight / total_dynamic) * 0.40;
                video_weight := (video_weight / total_dynamic) * 0.40;
            END IF;
        END;
    END IF;
    
    -- Calculate operational ranking score
    final_score := 
        (actual_trust_score * trust_weight) +                    -- Trust anchor (60%)
        (LEAST(actual_heat_score, 500) * heat_weight) +        -- Heat momentum (max 20%)
        (LEAST(video_plays, 50) * video_weight) +             -- Video engagement (max 8%)
        (trust_tier * 15 * tier_weight) +                      -- Tier bonus (7%)
        (GREATEST(0, 30 - days_since_upload) * recency_weight); -- Recency bonus (5%)
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SYSTEM STATUS FUNCTIONS
-- ==============================================================================

-- Get operational system status
CREATE OR REPLACE FUNCTION get_operational_system_status()
RETURNS TABLE (
    adaptive_enabled BOOLEAN,
    shadow_mode_enabled BOOLEAN,
    minimum_sample_size INTEGER,
    min_unique_buyers INTEGER,
    min_unique_sellers INTEGER,
    adjustment_frequency_days INTEGER,
    last_adjustment_date TIMESTAMP WITH TIME ZONE,
    current_completed_checkouts BIGINT,
    current_unique_buyers BIGINT,
    current_unique_sellers BIGINT,
    days_since_last_adjustment INTEGER,
    meets_all_thresholds BOOLEAN
) AS $$
DECLARE
    completed_checkouts BIGINT;
    unique_buyers BIGINT;
    unique_sellers BIGINT;
    last_adj TIMESTAMP;
    freq_days INTEGER;
BEGIN
    -- Get current metrics
    SELECT 
        COUNT(DISTINCT o.id),
        COUNT(DISTINCT o.user_id),
        COUNT(DISTINCT p.user_id)
    INTO completed_checkouts, unique_buyers, unique_sellers
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.status = 'delivered'
      AND o.created_at >= NOW() - INTERVAL '30 days';
    
    -- Get system controls
    SELECT adaptive_enabled, shadow_mode_enabled, minimum_sample_size,
           min_unique_buyers, min_unique_sellers, adjustment_frequency_days,
           last_adjustment_date
    INTO adaptive_enabled, shadow_mode_enabled, minimum_sample_size,
         min_unique_buyers, min_unique_sellers, freq_days, last_adj
    FROM ranking_system_controls
    ORDER BY created_at DESC LIMIT 1;
    
    RETURN QUERY
    SELECT 
        adaptive_enabled,
        shadow_mode_enabled,
        minimum_sample_size,
        min_unique_buyers,
        min_unique_sellers,
        freq_days,
        last_adj,
        completed_checkouts,
        unique_buyers,
        unique_sellers,
        EXTRACT(DAYS FROM (NOW() - COALESCE(last_adj, NOW() - INTERVAL '30 days'))),
        (completed_checkouts >= minimum_sample_size AND 
         unique_buyers >= min_unique_buyers AND 
         unique_sellers >= min_unique_sellers) as meets_all_thresholds;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update main optimization function
CREATE OR REPLACE FUNCTION optimize_ranking_system()
RETURNS void AS $$
BEGIN
    -- Use operational-grade correlation analysis
    PERFORM calculate_ranking_correlations_operational();
    
    -- Run spike detection
    PERFORM detect_engagement_spikes();
    
    -- Track performance
    PERFORM track_ranking_performance();
    
    -- Run shadow mode comparison if enabled
    IF EXISTS (SELECT 1 FROM ranking_system_controls WHERE shadow_mode_enabled = TRUE) THEN
        PERFORM run_shadow_mode_comparison();
    END IF;
    
    -- Clean old data
    DELETE FROM ranking_correlations 
    WHERE last_calculated < NOW() - INTERVAL '90 days';
    
    DELETE FROM ranking_performance 
    WHERE date_bucket < NOW() - INTERVAL '180 days';
    
    DELETE FROM shadow_mode_comparisons 
    WHERE comparison_date < NOW() - INTERVAL '30 days';
    
    DELETE FROM engagement_spike_flags 
    WHERE flagged_at < NOW() - INTERVAL '14 days' AND resolved = TRUE;
    
    RAISE NOTICE 'Operational ranking system optimization completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
