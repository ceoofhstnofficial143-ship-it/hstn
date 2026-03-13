-- HSTN Ranking System Stabilizers
-- Prevents over-optimization at small scale
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- DEPENDENCY TABLES (Create if missing)
-- ==============================================================================

-- Product analytics table
CREATE TABLE IF NOT EXISTS product_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) UNIQUE,
    total_views INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_video_plays INTEGER DEFAULT 0,
    heat_score NUMERIC DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace events table
CREATE TABLE IF NOT EXISTS marketplace_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id),
    event_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Ranking performance table
CREATE TABLE IF NOT EXISTS ranking_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date_bucket DATE NOT NULL,
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_ranking_score NUMERIC DEFAULT 0,
    top_performer_click_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ranking correlations table
CREATE TABLE IF NOT EXISTS ranking_correlations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    factor_name VARCHAR(50) NOT NULL UNIQUE,
    correlation_strength NUMERIC DEFAULT 0,
    conversion_correlation NUMERIC DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    weight_multiplier NUMERIC(3,2) DEFAULT 1.0,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- SYSTEM CONTROL TABLE
-- ==============================================================================

-- Adaptive system control panel
CREATE TABLE IF NOT EXISTS ranking_system_controls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    adaptive_enabled BOOLEAN DEFAULT TRUE,
    minimum_sample_size INTEGER DEFAULT 100, -- Minimum transactions before weight changes
    max_weight_adjustment NUMERIC(3,2) DEFAULT 1.1, -- Max 1.1x adjustment
    min_weight_adjustment NUMERIC(3,2) DEFAULT 0.9, -- Min 0.9x adjustment
    trust_anchor_weight NUMERIC(3,2) DEFAULT 0.6, -- Trust always 60% minimum
    max_heat_influence NUMERIC(3,2) DEFAULT 0.3, -- Heat max 30% influence
    last_manual_override TIMESTAMP WITH TIME ZONE,
    override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Single row control table
INSERT INTO ranking_system_controls (adaptive_enabled) VALUES (TRUE)
ON CONFLICT DO NOTHING;

-- Add role column to profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'buyer';
  END IF;
END $$;

-- RLS for system controls
ALTER TABLE ranking_system_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage ranking controls" ON ranking_system_controls FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- STABILIZED CORRELATION ANALYSIS
-- ==============================================================================

-- Override correlation function with data thresholds
CREATE OR REPLACE FUNCTION calculate_ranking_correlations_stable()
RETURNS void AS $$
DECLARE
    trust_corr NUMERIC;
    heat_corr NUMERIC;
    video_corr NUMERIC;
    tier_corr NUMERIC;
    recency_corr NUMERIC;
    sample_size INTEGER;
    min_threshold INTEGER;
    max_adjustment NUMERIC;
    adaptive_on BOOLEAN;
BEGIN
    -- Get system controls
    SELECT minimum_sample_size, max_weight_adjustment, adaptive_enabled
    INTO min_threshold, max_adjustment, adaptive_on
    FROM ranking_system_controls
    ORDER BY created_at DESC LIMIT 1;
    
    -- Exit if adaptive system is disabled
    IF NOT adaptive_on THEN
        RAISE NOTICE 'Adaptive ranking system is manually disabled';
        RETURN;
    END IF;
    
    -- Get sample size (products with enough data)
    SELECT COUNT(DISTINCT pa.product_id) INTO sample_size
    FROM product_analytics pa
    JOIN marketplace_events me ON pa.product_id = me.product_id
    WHERE pa.total_views >= 10;
    
    -- Exit if insufficient sample size
    IF sample_size < min_threshold THEN
        RAISE NOTICE 'Insufficient sample size: % (required: %)', sample_size, min_threshold;
        RETURN;
    END IF;
    
    -- Calculate correlations (same as before)
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
    
    -- Update correlations with STABILIZED weight multipliers
    INSERT INTO ranking_correlations (
        factor_name, correlation_strength, conversion_correlation, sample_size, last_calculated, weight_multiplier
    ) VALUES 
        ('trust_score', ABS(trust_corr), trust_corr, sample_size, NOW(), 1.0), -- Trust always 1.0 (anchor)
        ('heat_score', ABS(heat_corr), heat_corr, sample_size, NOW(), 
         LEAST(max_adjustment, GREATEST(1.0 - (max_adjustment - 1.0), 1.0))), -- Stabilized range
        ('video_plays', ABS(video_corr), video_corr, sample_size, NOW(),
         LEAST(max_adjustment, GREATEST(1.0 - (max_adjustment - 1.0), 1.0))),
        ('trust_tier', ABS(tier_corr), tier_corr, sample_size, NOW(), 1.0), -- Tier always 1.0
        ('recency', ABS(recency_corr), recency_corr, sample_size, NOW(),
         LEAST(max_adjustment, GREATEST(1.0 - (max_adjustment - 1.0), 1.0)))
    ON CONFLICT (factor_name) DO UPDATE SET
        correlation_strength = EXCLUDED.correlation_strength,
        conversion_correlation = EXCLUDED.conversion_correlation,
        sample_size = EXCLUDED.sample_size,
        last_calculated = EXCLUDED.last_calculated,
        weight_multiplier = EXCLUDED.weight_multiplier;
    
    RAISE NOTICE 'Stabilized ranking correlations updated with sample size: %', sample_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- STABILIZED ADAPTIVE RANKING
-- ==============================================================================

-- Premium curation biased ranking function
CREATE OR REPLACE FUNCTION calculate_premium_ranking_score(
    p_product_id UUID,
    p_trust_score INTEGER DEFAULT NULL,
    p_heat_score NUMERIC DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    final_score NUMERIC := 0;
    trust_anchor_weight NUMERIC := 0.6; -- Trust always 60% minimum
    max_heat_influence NUMERIC := 0.3; -- Heat max 30% influence
    
    -- Get system controls
    adaptive_enabled BOOLEAN;
    trust_anchor NUMERIC;
    heat_limit NUMERIC;
    
    -- Get actual values
    actual_trust_score INTEGER;
    actual_heat_score NUMERIC;
    video_plays INTEGER;
    trust_tier INTEGER;
    days_since_upload NUMERIC;
    
    -- Dynamic weights (capped)
    trust_weight NUMERIC := 0.6;
    heat_weight NUMERIC := 0.2;
    video_weight NUMERIC := 0.1;
    tier_weight NUMERIC := 0.05;
    recency_weight NUMERIC := 0.05;
BEGIN
    -- Get system controls
    SELECT adaptive_enabled, trust_anchor_weight, max_heat_influence
    INTO adaptive_enabled, trust_anchor, heat_limit
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
    
    -- Apply premium curation bias
    IF adaptive_enabled THEN
        -- Get stabilized dynamic weights
        SELECT COALESCE(weight_multiplier, 1.0) INTO trust_weight
        FROM ranking_correlations 
        WHERE factor_name = 'trust_score' 
        ORDER BY last_calculated DESC LIMIT 1;
        
        SELECT COALESCE(weight_multiplier, 1.0) INTO heat_weight
        FROM ranking_correlations 
        WHERE factor_name = 'heat_score' 
        ORDER BY last_calculated DESC LIMIT 1;
        
        -- Apply stabilizer caps
        trust_weight := GREATEST(trust_anchor, trust_weight); -- Trust never below anchor
        heat_weight := LEAST(heat_limit, heat_weight); -- Heat never above limit
    END IF;
    
    -- Normalize weights to ensure trust anchor
    DECLARE
        total_dynamic_weight NUMERIC := heat_weight + video_weight + tier_weight + recency_weight;
    BEGIN
        -- Scale dynamic weights to fit within remaining percentage
        IF total_dynamic_weight > 0 THEN
            heat_weight := (heat_weight / total_dynamic_weight) * (1.0 - trust_anchor);
            video_weight := (video_weight / total_dynamic_weight) * (1.0 - trust_anchor);
            tier_weight := (tier_weight / total_dynamic_weight) * (1.0 - trust_anchor);
            recency_weight := (recency_weight / total_dynamic_weight) * (1.0 - trust_anchor);
        END IF;
        
        -- Ensure trust anchor
        trust_weight := trust_anchor;
    END;
    
    -- Calculate premium curation ranking score
    final_score := 
        (actual_trust_score * trust_weight) +                    -- Trust anchor (60%+)
        (LEAST(actual_heat_score, 500) * heat_weight) +        -- Heat momentum (max 30%)
        (LEAST(video_plays, 50) * video_weight) +             -- Video engagement
        (trust_tier * 20 * tier_weight) +                      -- Tier bonus (smaller)
        (GREATEST(0, 30 - days_since_upload) * recency_weight); -- Recency bonus (smaller)
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- MANUAL OVERRIDE FUNCTIONS
-- ==============================================================================

-- Emergency disable adaptive system
CREATE OR REPLACE FUNCTION emergency_disable_adaptive_ranking(p_reason TEXT DEFAULT 'Manual override')
RETURNS void AS $$
BEGIN
    UPDATE ranking_system_controls 
    SET adaptive_enabled = FALSE,
        last_manual_override = NOW(),
        override_reason = p_reason,
        updated_at = NOW()
    WHERE id = (SELECT id FROM ranking_system_controls ORDER BY created_at DESC LIMIT 1);
    
    RAISE NOTICE 'Adaptive ranking system disabled: %', p_reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-enable adaptive system
CREATE OR REPLACE FUNCTION enable_adaptive_ranking()
RETURNS void AS $$
BEGIN
    UPDATE ranking_system_controls 
    SET adaptive_enabled = TRUE,
        last_manual_override = NOW(),
        override_reason = 'System re-enabled',
        updated_at = NOW()
    WHERE id = (SELECT id FROM ranking_system_controls ORDER BY created_at DESC LIMIT 1);
    
    RAISE NOTICE 'Adaptive ranking system re-enabled';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset to baseline weights
CREATE OR REPLACE FUNCTION reset_ranking_weights()
RETURNS void AS $$
BEGIN
    UPDATE ranking_correlations 
    SET weight_multiplier = 1.0,
        last_calculated = NOW()
    WHERE factor_name IN ('trust_score', 'trust_tier'); -- Keep trust/tier at baseline
    
    UPDATE ranking_correlations 
    SET weight_multiplier = 1.0
    WHERE factor_name NOT IN ('trust_score', 'trust_tier'); -- Reset others
    
    RAISE NOTICE 'Ranking weights reset to baseline';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ADMIN CONTROL FUNCTIONS
-- ==============================================================================

-- Get current system status
CREATE OR REPLACE FUNCTION get_ranking_system_status()
RETURNS TABLE (
    adaptive_enabled BOOLEAN,
    minimum_sample_size INTEGER,
    max_weight_adjustment NUMERIC,
    trust_anchor_weight NUMERIC,
    max_heat_influence NUMERIC,
    last_manual_override TIMESTAMP WITH TIME ZONE,
    override_reason TEXT,
    current_sample_size BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rsc.adaptive_enabled,
        rsc.minimum_sample_size,
        rsc.max_weight_adjustment,
        rsc.trust_anchor_weight,
        rsc.max_heat_influence,
        rsc.last_manual_override,
        rsc.override_reason,
        (SELECT COUNT(DISTINCT pa.product_id) 
         FROM product_analytics pa 
         WHERE pa.total_views >= 10) as current_sample_size
    FROM ranking_system_controls rsc
    ORDER BY rsc.created_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update optimized function to use stabilized version
CREATE OR REPLACE FUNCTION optimize_ranking_system()
RETURNS void AS $$
BEGIN
    -- Use stabilized correlation analysis
    PERFORM calculate_ranking_correlations_stable();
    
    -- Track current performance
    PERFORM track_ranking_performance();
    
    -- Clean old data
    DELETE FROM ranking_correlations 
    WHERE last_calculated < NOW() - INTERVAL '90 days';
    
    DELETE FROM ranking_performance 
    WHERE date_bucket < NOW() - INTERVAL '180 days';
    
    RAISE NOTICE 'Stabilized ranking system optimization completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
