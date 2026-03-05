-- HSTN Anomaly Detection System
-- Protects Heat Score integrity from manipulation
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- ANOMALY DETECTION INFRASTRUCTURE
-- ==============================================================================

-- Suspicious activity tracking
CREATE TABLE IF NOT EXISTS anomaly_flags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    product_id UUID REFERENCES products(id),
    anomaly_type VARCHAR(50) NOT NULL,
    severity INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Event pattern analysis table
CREATE TABLE IF NOT EXISTS event_patterns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    event_type VARCHAR(50) NOT NULL,
    time_window TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_count INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    pattern_score NUMERIC(5,2) DEFAULT 0,
    is_suspicious BOOLEAN DEFAULT FALSE
);

-- RLS for anomaly detection
ALTER TABLE anomaly_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage anomaly flags" ON anomaly_flags FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can manage event patterns" ON event_patterns FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- ANOMALY DETECTION FUNCTIONS
-- ==============================================================================

-- Detect rapid repeat views from same IP
CREATE OR REPLACE FUNCTION detect_rapid_views()
RETURNS TRIGGER AS $$
DECLARE
    recent_views INTEGER;
    time_window_minutes INTEGER := 5;
BEGIN
    -- Count views from same user/IP in last 5 minutes
    SELECT COUNT(*) INTO recent_views
    FROM marketplace_events
    WHERE user_id = NEW.user_id
      AND product_id = NEW.product_id
      AND event_type = 'product_view'
      AND timestamp >= NOW() - INTERVAL '1 minute'
      AND ip_address = NEW.ip_address;

    -- Flag if more than 3 views per minute
    IF recent_views > 3 THEN
        INSERT INTO anomaly_flags (
            user_id, product_id, anomaly_type, severity, details
        ) VALUES (
            NEW.user_id, NEW.product_id, 'rapid_views', 2,
            jsonb_build_object(
                'views_per_minute', recent_views,
                'ip_address', NEW.ip_address::text,
                'time_window', '1 minute'
            )
        );
        
        -- Don't count the suspicious view toward heat score
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Detect event bursts (abnormal activity spikes)
CREATE OR REPLACE FUNCTION detect_event_bursts()
RETURNS TRIGGER AS $$
DECLARE
    hourly_count INTEGER;
    daily_average NUMERIC;
    burst_threshold NUMERIC := 5.0; -- 5x normal activity
BEGIN
    -- Get hourly count for this user/product
    SELECT COUNT(*) INTO hourly_count
    FROM marketplace_events
    WHERE (user_id = NEW.user_id OR seller_id = NEW.user_id)
      AND timestamp >= NOW() - INTERVAL '1 hour';

    -- Calculate daily average (excluding last hour)
    SELECT COALESCE(AVG(event_count), 0) INTO daily_average
    FROM event_patterns
    WHERE user_id = NEW.user_id
      AND time_window >= NOW() - INTERVAL '23 hours'
      AND time_window < NOW() - INTERVAL '1 hour';

    -- Flag if current hour is 5x daily average
    IF daily_average > 0 AND hourly_count > (daily_average * burst_threshold) THEN
        INSERT INTO anomaly_flags (
            user_id, product_id, anomaly_type, severity, details
        ) VALUES (
            NEW.user_id, NEW.product_id, 'event_burst', 3,
            jsonb_build_object(
                'hourly_count', hourly_count,
                'daily_average', daily_average,
                'burst_ratio', hourly_count / daily_average
            )
        );
    END IF;

    -- Update pattern tracking
    INSERT INTO event_patterns (
        user_id, event_type, time_window, event_count, pattern_score
    ) VALUES (
        NEW.user_id, NEW.event_type, NOW(), 1,
        CASE WHEN daily_average > 0 THEN hourly_count / daily_average ELSE 1 END
    )
    ON CONFLICT (user_id, event_type, time_window) DO UPDATE SET
        event_count = event_patterns.event_count + 1,
        pattern_score = EXCLUDED.pattern_score;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Detect self-engagement patterns
CREATE OR REPLACE FUNCTION detect_self_engagement()
RETURNS TRIGGER AS $$
DECLARE
    seller_products INTEGER;
    self_engagement_count INTEGER;
BEGIN
    -- Check if user is engaging with their own products
    IF NEW.user_id = NEW.seller_id THEN
        -- Count self-engagement events in last hour
        SELECT COUNT(*) INTO self_engagement_count
        FROM marketplace_events
        WHERE user_id = NEW.user_id
          AND seller_id = NEW.user_id
          AND timestamp >= NOW() - INTERVAL '1 hour';

        -- Flag if excessive self-engagement
        IF self_engagement_count > 10 THEN
            INSERT INTO anomaly_flags (
                user_id, product_id, anomaly_type, severity, details
            ) VALUES (
                NEW.user_id, NEW.product_id, 'self_engagement', 2,
                jsonb_build_object(
                    'self_events_per_hour', self_engagement_count,
                    'event_type', NEW.event_type
                )
            );
            
            -- Don't count self-engagement toward heat score
            RETURN NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- TRIGGERS FOR ANOMALY DETECTION
-- ==============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_detect_rapid_views ON marketplace_events;
DROP TRIGGER IF EXISTS trg_detect_event_bursts ON marketplace_events;
DROP TRIGGER IF EXISTS trg_detect_self_engagement ON marketplace_events;

-- Create triggers
CREATE TRIGGER trg_detect_rapid_views
    AFTER INSERT ON marketplace_events
    FOR EACH ROW
    WHEN (NEW.event_type = 'product_view')
    EXECUTE FUNCTION detect_rapid_views();

CREATE TRIGGER trg_detect_event_bursts
    AFTER INSERT ON marketplace_events
    FOR EACH ROW
    EXECUTE FUNCTION detect_event_bursts();

CREATE TRIGGER trg_detect_self_engagement
    AFTER INSERT ON marketplace_events
    FOR EACH ROW
    WHEN (NEW.event_type IN ('product_view', 'video_play', 'wishlist_add', 'add_to_cart'))
    EXECUTE FUNCTION detect_self_engagement();

-- ==============================================================================
-- CLEANUP FUNCTIONS
-- ==============================================================================

-- Clean old anomaly flags (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_anomalies()
RETURNS void AS $$
BEGIN
    DELETE FROM anomaly_flags 
    WHERE created_at < NOW() - INTERVAL '30 days' 
      AND resolved = TRUE;
    
    DELETE FROM event_patterns 
    WHERE time_window < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- ADMIN FUNCTIONS
-- ==============================================================================

-- Get anomaly summary for admin dashboard
CREATE OR REPLACE FUNCTION get_anomaly_summary()
RETURNS TABLE (
    total_anomalies BIGINT,
    unresolved_anomalies BIGINT,
    high_severity_anomalies BIGINT,
    rapid_views_count BIGINT,
    event_bursts_count BIGINT,
    self_engagement_count BIGINT,
    users_flagged BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_anomalies,
        COUNT(*) FILTER (WHERE resolved = FALSE) as unresolved_anomalies,
        COUNT(*) FILTER (WHERE severity = 3) as high_severity_anomalies,
        COUNT(*) FILTER (WHERE anomaly_type = 'rapid_views') as rapid_views_count,
        COUNT(*) FILTER (WHERE anomaly_type = 'event_burst') as event_bursts_count,
        COUNT(*) FILTER (WHERE anomaly_type = 'self_engagement') as self_engagement_count,
        COUNT(DISTINCT user_id) as users_flagged
    FROM anomaly_flags
    WHERE created_at >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Get suspicious users list
CREATE OR REPLACE FUNCTION get_suspicious_users()
RETURNS TABLE (
    user_id UUID,
    anomaly_count BIGINT,
    last_anomaly TIMESTAMP WITH TIME ZONE,
    risk_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        af.user_id,
        COUNT(*) as anomaly_count,
        MAX(af.created_at) as last_anomaly,
        CASE 
            WHEN COUNT(*) FILTER (WHERE severity = 3) > 0 THEN 3 -- High risk
            WHEN COUNT(*) FILTER (WHERE severity = 2) > 2 THEN 2 -- Medium risk
            ELSE 1 -- Low risk
        END as risk_level
    FROM anomaly_flags af
    WHERE af.created_at >= NOW() - INTERVAL '7 days'
      AND af.resolved = FALSE
    GROUP BY af.user_id
    HAVING COUNT(*) >= 2
    ORDER BY anomaly_count DESC, last_anomaly DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
