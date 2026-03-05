-- HSTN Adaptive Ranking System
-- Moves from rule-based to data-driven marketplace ranking
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- RANKING CORRELATION ANALYSIS
-- ==============================================================================

-- Table to store ranking factor correlations
CREATE TABLE IF NOT EXISTS ranking_correlations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    factor_name VARCHAR(50) NOT NULL,
    correlation_strength NUMERIC(5,4), -- Pearson correlation coefficient
    conversion_correlation NUMERIC(5,4), -- Correlation with actual conversions
    sample_size INTEGER DEFAULT 0,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    weight_multiplier NUMERIC(3,2) DEFAULT 1.0 -- Dynamic weight adjustment
);

-- Table to store ranking performance metrics
CREATE TABLE IF NOT EXISTS ranking_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date_bucket DATE NOT NULL,
    ranking_version VARCHAR(20) DEFAULT 'static',
    total_impressions INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    conversion_rate NUMERIC(5,2) DEFAULT 0,
    avg_trust_score NUMERIC(5,2) DEFAULT 0,
    avg_heat_score NUMERIC(8,2) DEFAULT 0,
    revenue_per_impression NUMERIC(10,2) DEFAULT 0
);

-- RLS for ranking analytics
ALTER TABLE ranking_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ranking correlations" ON ranking_correlations FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can manage ranking performance" ON ranking_performance FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- CORRELATION ANALYSIS FUNCTIONS
-- ==============================================================================

-- Calculate correlation between ranking factors and conversions
CREATE OR REPLACE FUNCTION calculate_ranking_correlations()
RETURNS void AS $$
DECLARE
    trust_corr NUMERIC;
    heat_corr NUMERIC;
    video_corr NUMERIC;
    tier_corr NUMERIC;
    recency_corr NUMERIC;
    sample_size INTEGER;
BEGIN
    -- Get sample size (products with enough data)
    SELECT COUNT(DISTINCT pa.product_id) INTO sample_size
    FROM product_analytics pa
    JOIN marketplace_events me ON pa.product_id = me.product_id
    WHERE pa.total_views >= 10; -- Minimum data threshold
    
    IF sample_size < 50 THEN
        RAISE NOTICE 'Insufficient sample size for correlation analysis';
        RETURN;
    END IF;
    
    -- Calculate Trust Score correlation with conversions
    SELECT CORR(pa.total_orders, ts.score) INTO trust_corr
    FROM product_analytics pa
    JOIN products p ON pa.product_id = p.id
    JOIN trust_scores ts ON p.user_id = ts.user_id
    WHERE pa.total_views >= 10;
    
    -- Calculate Heat Score correlation with conversions
    SELECT CORR(pa.total_orders, pa.heat_score) INTO heat_corr
    FROM product_analytics pa
    WHERE pa.total_views >= 10;
    
    -- Calculate Video Plays correlation with conversions
    SELECT CORR(pa.total_orders, pa.total_video_plays) INTO video_corr
    FROM product_analytics pa
    WHERE pa.total_views >= 10;
    
    -- Calculate Trust Tier correlation (simplified)
    SELECT CORR(pa.total_orders, 
        CASE 
            WHEN ts.score >= 150 THEN 4  -- Elite
            WHEN ts.score >= 100 THEN 3  -- Gold
            WHEN ts.score >= 50 THEN 2   -- Verified
            ELSE 1                       -- Unverified
        END
    ) INTO tier_corr
    FROM product_analytics pa
    JOIN products p ON pa.product_id = p.id
    JOIN trust_scores ts ON p.user_id = ts.user_id
    WHERE pa.total_views >= 10;
    
    -- Calculate Recency correlation (days since upload)
    SELECT CORR(pa.total_orders, EXTRACT(EPOCH FROM (NOW() - p.created_at))/86400) INTO recency_corr
    FROM product_analytics pa
    JOIN products p ON pa.product_id = p.id
    WHERE pa.total_views >= 10;
    
    -- Update correlations table
    INSERT INTO ranking_correlations (
        factor_name, correlation_strength, conversion_correlation, sample_size, last_calculated
    ) VALUES 
        ('trust_score', ABS(trust_corr), trust_corr, sample_size, NOW()),
        ('heat_score', ABS(heat_corr), heat_corr, sample_size, NOW()),
        ('video_plays', ABS(video_corr), video_corr, sample_size, NOW()),
        ('trust_tier', ABS(tier_corr), tier_corr, sample_size, NOW()),
        ('recency', ABS(recency_corr), recency_corr, sample_size, NOW())
    ON CONFLICT (factor_name) DO UPDATE SET
        correlation_strength = EXCLUDED.correlation_strength,
        conversion_correlation = EXCLUDED.conversion_correlation,
        sample_size = EXCLUDED.sample_size,
        last_calculated = EXCLUDED.last_calculated;
    
    -- Update weight multipliers based on correlation strength
    UPDATE ranking_correlations SET weight_multiplier = 
        CASE 
            WHEN ABS(conversion_correlation) >= 0.7 THEN 1.5  -- Strong correlation
            WHEN ABS(conversion_correlation) >= 0.4 THEN 1.2  -- Moderate correlation
            WHEN ABS(conversion_correlation) >= 0.2 THEN 1.0  -- Weak correlation
            ELSE 0.8  -- Very weak or negative correlation
        END
    WHERE last_calculated = NOW();
    
    RAISE NOTICE 'Ranking correlations updated with sample size: %', sample_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ADAPTIVE RANKING FUNCTION
-- ==============================================================================

-- Enhanced product ranking with dynamic weights
CREATE OR REPLACE FUNCTION calculate_adaptive_ranking_score(
    p_product_id UUID,
    p_trust_score INTEGER DEFAULT NULL,
    p_heat_score NUMERIC DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    final_score NUMERIC := 0;
    trust_weight NUMERIC := 1.0;
    heat_weight NUMERIC := 0.3;
    video_weight NUMERIC := 0.5;
    tier_weight NUMERIC := 1.0;
    recency_weight NUMERIC := 0.2;
    
    -- Get actual values
    actual_trust_score INTEGER;
    actual_heat_score NUMERIC;
    video_plays INTEGER;
    trust_tier INTEGER;
    days_since_upload NUMERIC;
    
    -- Get dynamic weights
    trust_multiplier NUMERIC := 1.0;
    heat_multiplier NUMERIC := 1.0;
    video_multiplier NUMERIC := 1.0;
    tier_multiplier NUMERIC := 1.0;
    recency_multiplier NUMERIC := 1.0;
BEGIN
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
    
    -- Get dynamic weight multipliers
    SELECT COALESCE(weight_multiplier, 1.0) INTO trust_multiplier
    FROM ranking_correlations 
    WHERE factor_name = 'trust_score' 
    ORDER BY last_calculated DESC LIMIT 1;
    
    SELECT COALESCE(weight_multiplier, 1.0) INTO heat_multiplier
    FROM ranking_correlations 
    WHERE factor_name = 'heat_score' 
    ORDER BY last_calculated DESC LIMIT 1;
    
    SELECT COALESCE(weight_multiplier, 1.0) INTO video_multiplier
    FROM ranking_correlations 
    WHERE factor_name = 'video_plays' 
    ORDER BY last_calculated DESC LIMIT 1;
    
    SELECT COALESCE(weight_multiplier, 1.0) INTO tier_multiplier
    FROM ranking_correlations 
    WHERE factor_name = 'trust_tier' 
    ORDER BY last_calculated DESC LIMIT 1;
    
    SELECT COALESCE(weight_multiplier, 1.0) INTO recency_multiplier
    FROM ranking_correlations 
    WHERE factor_name = 'recency' 
    ORDER BY last_calculated DESC LIMIT 1;
    
    -- Apply dynamic weights
    trust_weight := trust_weight * trust_multiplier;
    heat_weight := heat_weight * heat_multiplier;
    video_weight := video_weight * video_multiplier;
    tier_weight := tier_weight * tier_multiplier;
    recency_weight := recency_weight * recency_multiplier;
    
    -- Calculate adaptive ranking score
    final_score := 
        (actual_trust_score * trust_weight) +                    -- Trust authority
        (LEAST(actual_heat_score, 1000) * heat_weight) +        -- Heat momentum (capped)
        (LEAST(video_plays, 100) * video_weight) +              -- Video engagement (capped)
        (trust_tier * 25 * tier_weight) +                       -- Tier bonus
        (GREATEST(0, 30 - days_since_upload) * recency_weight); -- Recency bonus
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- RANKING PERFORMANCE TRACKING
-- ==============================================================================

-- Track ranking performance daily
CREATE OR REPLACE FUNCTION track_ranking_performance()
RETURNS void AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    total_impressions INTEGER;
    total_conversions INTEGER;
    conversion_rate NUMERIC;
    avg_trust NUMERIC;
    avg_heat NUMERIC;
    total_revenue NUMERIC;
BEGIN
    -- Get daily metrics
    SELECT 
        SUM(feed_views),
        SUM(checkout_completes),
        CASE 
            WHEN SUM(feed_views) > 0 THEN (SUM(checkout_completes)::NUMERIC / SUM(feed_views)) * 100 
            ELSE 0 
        END
    INTO total_impressions, total_conversions, conversion_rate
    FROM funnel_analytics 
    WHERE date_bucket = current_date;
    
    -- Get average scores
    SELECT AVG(ts.score) INTO avg_trust
    FROM trust_scores ts
    JOIN products p ON ts.user_id = p.user_id
    WHERE p.created_at >= NOW() - INTERVAL '30 days';
    
    SELECT AVG(heat_score) INTO avg_heat
    FROM product_analytics
    WHERE last_calculated >= NOW() - INTERVAL '7 days';
    
    -- Calculate revenue (simulated for now)
    SELECT SUM(pa.total_orders * 1000) INTO total_revenue -- Assuming avg ₹1000 per order
    FROM product_analytics pa
    WHERE pa.total_orders > 0;
    
    -- Insert performance tracking
    INSERT INTO ranking_performance (
        date_bucket, ranking_version, total_impressions, total_conversions,
        conversion_rate, avg_trust_score, avg_heat_score, revenue_per_impression
    ) VALUES (
        current_date, 'adaptive', total_impressions, total_conversions,
        conversion_rate, avg_trust, avg_heat,
        CASE WHEN total_impressions > 0 THEN total_revenue / total_impressions ELSE 0 END
    )
    ON CONFLICT (date_bucket) DO UPDATE SET
        ranking_version = EXCLUDED.ranking_version,
        total_impressions = EXCLUDED.total_impressions,
        total_conversions = EXCLUDED.total_conversions,
        conversion_rate = EXCLUDED.conversion_rate,
        avg_trust_score = EXCLUDED.avg_trust_score,
        avg_heat_score = EXCLUDED.avg_heat_score,
        revenue_per_impression = EXCLUDED.revenue_per_impression;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- AUTOMATED OPTIMIZATION
-- ==============================================================================

-- Main optimization function (run weekly)
CREATE OR REPLACE FUNCTION optimize_ranking_system()
RETURNS void AS $$
BEGIN
    -- Step 1: Calculate new correlations
    PERFORM calculate_ranking_correlations();
    
    -- Step 2: Track current performance
    PERFORM track_ranking_performance();
    
    -- Step 3: Clean old data
    DELETE FROM ranking_correlations 
    WHERE last_calculated < NOW() - INTERVAL '90 days';
    
    DELETE FROM ranking_performance 
    WHERE date_bucket < NOW() - INTERVAL '180 days';
    
    RAISE NOTICE 'Ranking system optimization completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ADMIN FUNCTIONS
-- ==============================================================================

-- Get ranking insights for admin dashboard
CREATE OR REPLACE FUNCTION get_ranking_insights()
RETURNS TABLE (
    factor_name VARCHAR(50),
    correlation_strength NUMERIC,
    conversion_correlation NUMERIC,
    current_weight NUMERIC,
    recommended_weight NUMERIC,
    performance_impact VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rc.factor_name,
        rc.correlation_strength,
        rc.conversion_correlation,
        rc.weight_multiplier as current_weight,
        CASE 
            WHEN ABS(rc.conversion_correlation) >= 0.7 THEN 1.5
            WHEN ABS(rc.conversion_correlation) >= 0.4 THEN 1.2
            WHEN ABS(rc.conversion_correlation) >= 0.2 THEN 1.0
            ELSE 0.8
        END as recommended_weight,
        CASE 
            WHEN ABS(rc.conversion_correlation) >= 0.7 THEN 'HIGH'
            WHEN ABS(rc.conversion_correlation) >= 0.4 THEN 'MEDIUM'
            WHEN ABS(rc.conversion_correlation) >= 0.2 THEN 'LOW'
            ELSE 'MINIMAL'
        END as performance_impact
    FROM ranking_correlations rc
    ORDER BY ABS(rc.conversion_correlation) DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
