-- HSTN Trust Engine Upgrade: Institutional Backend Architecture v3 (Resilience Update)
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- 1. ADMIN OVERRIDE LOG
-- ==============================================================================
CREATE TABLE IF NOT EXISTS trust_override_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID NOT NULL,
    admin_id UUID NOT NULL,
    old_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE trust_override_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can insert override logs" ON trust_override_logs FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "Admins can read override logs" ON trust_override_logs FOR SELECT USING (true);


-- ==============================================================================
-- 2. LOCK DOWN TRUST SCORES
-- ==============================================================================
ALTER TABLE trust_scores ADD CONSTRAINT trust_scores_user_id_key UNIQUE (user_id);
ALTER TABLE trust_scores ADD COLUMN IF NOT EXISTS visibility_weight NUMERIC(3, 2) DEFAULT 1.0;

REVOKE UPDATE, INSERT ON trust_scores FROM authenticated;
REVOKE UPDATE, INSERT ON trust_scores FROM anon;
GRANT SELECT ON trust_scores TO authenticated;


-- ==============================================================================
-- 3. VISIBILITY WEIGHT TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_visibility_weight()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.score > 85 THEN
        NEW.visibility_weight := 1.2;
    ELSIF NEW.score >= 60 THEN
        NEW.visibility_weight := 1.0;
    ELSE
        NEW.visibility_weight := 0.6;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_visibility_weight ON trust_scores;
CREATE TRIGGER trg_update_visibility_weight
    BEFORE UPDATE OR INSERT ON trust_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_visibility_weight();


-- ==============================================================================
-- 4. ORDER STATUS & VELOCITY CONTROL (The Core Brain)
-- ==============================================================================
CREATE OR REPLACE FUNCTION handle_order_trust_impact()
RETURNS TRIGGER AS $$
DECLARE
    delta INT := 0;
    event_desc TEXT := '';
    gained_24h INT := 0;
    total_deliveries INT := 0;
    current_score INT := 50;
BEGIN
    SELECT score INTO current_score FROM trust_scores WHERE user_id = NEW.seller_id;
    IF current_score IS NULL THEN current_score := 50; END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'DELIVERED' THEN
            -- LAYER 2: Trust Velocity Control (+10 max per 24h)
            SELECT COALESCE(SUM(delta), 0) INTO gained_24h
            FROM trust_history
            WHERE user_id = NEW.seller_id 
              AND delta > 0 
              AND created_at >= NOW() - INTERVAL '24 hours';

            IF gained_24h < 10 THEN
                delta := LEAST(5, 10 - gained_24h);
                event_desc := 'Order delivered successfully';
            ELSE
                delta := 0;
                event_desc := 'Order delivered successfully (Velocity Cap Hit - Zero Yield)';
            END IF;

        ELSIF NEW.status = 'CANCELLED_AFTER_CONFIRM' THEN
            delta := -15;
            event_desc := 'Cancellation after confirmation';
            
            -- LAYER 3: Negative Shock Dampening
            IF current_score > 85 THEN
                SELECT COUNT(*) INTO total_deliveries FROM orders WHERE seller_id = NEW.seller_id AND status = 'DELIVERED';
                IF total_deliveries >= 100 THEN
                    delta := -10; -- Dampened
                    event_desc := 'Cancellation after confirmation (Shock Dampened: Elite History)';
                END IF;
            END IF;
        END IF;

        IF delta <> 0 OR NEW.status = 'DELIVERED' THEN
            INSERT INTO trust_scores (user_id, score, verified)
            VALUES (NEW.seller_id, GREATEST(0, LEAST(100, 50 + delta)), false)
            ON CONFLICT (user_id)
            DO UPDATE SET score = GREATEST(0, LEAST(100, trust_scores.score + EXCLUDED.score - 50));

            INSERT INTO trust_history (user_id, event_type, delta, description)
            VALUES (NEW.seller_id, NEW.status, delta, event_desc);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_order_trust_impact ON orders;
CREATE TRIGGER trg_order_trust_impact
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_trust_impact();


-- ==============================================================================
-- 5. DISPUTES ARCHITECTURE & SHOCK DAMPENING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS disputes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    status TEXT DEFAULT 'PENDING',
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_dispute_trust_impact()
RETURNS TRIGGER AS $$
DECLARE
    delta INT := -25;
    total_deliveries INT := 0;
    current_score INT := 50;
    event_desc TEXT := 'Dispute marked valid by buyer/admin. Reason: ';
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'VALID' THEN
        SELECT score INTO current_score FROM trust_scores WHERE user_id = NEW.seller_id;
        IF current_score IS NULL THEN current_score := 50; END IF;

        -- LAYER 3: Negative Shock Dampening
        IF current_score > 85 THEN
            SELECT COUNT(*) INTO total_deliveries FROM orders WHERE seller_id = NEW.seller_id AND status = 'DELIVERED';
            IF total_deliveries >= 100 THEN
                delta := -15; -- Dampened penalty
                event_desc := 'Dispute marked valid (Shock Dampened: Elite History). Reason: ';
            END IF;
        END IF;

        INSERT INTO trust_scores (user_id, score, verified)
        VALUES (NEW.seller_id, GREATEST(0, LEAST(100, 50 + delta)), false)
        ON CONFLICT (user_id)
        DO UPDATE SET score = GREATEST(0, LEAST(100, trust_scores.score + EXCLUDED.score - 50));

        INSERT INTO trust_history (user_id, event_type, delta, description)
        VALUES (NEW.seller_id, 'DISPUTE_VALID', delta, event_desc || NEW.reason);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_dispute_trust_impact ON disputes;
CREATE TRIGGER trg_dispute_trust_impact
    AFTER UPDATE ON disputes
    FOR EACH ROW
    EXECUTE FUNCTION handle_dispute_trust_impact();


-- ==============================================================================
-- 6. SIZE ANOMALY TRIGGER
-- ==============================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_flagged BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS seller_fit_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID NOT NULL, 
    seller_id UUID NOT NULL,
    fit_feedback TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_size_anomaly()
RETURNS TRIGGER AS $$
DECLARE
    total_feedbacks INT;
    anomaly_count INT;
    anomaly_rate NUMERIC;
    is_flagged BOOLEAN;
BEGIN
    SELECT size_flagged INTO is_flagged FROM products WHERE id = NEW.product_id;
    
    IF COALESCE(is_flagged, FALSE) = FALSE THEN
        SELECT COUNT(*) INTO total_feedbacks FROM seller_fit_stats WHERE product_id = NEW.product_id;
        SELECT COUNT(*) INTO anomaly_count FROM seller_fit_stats WHERE product_id = NEW.product_id AND fit_feedback IN ('Tight', 'Loose');
        
        IF total_feedbacks >= 5 THEN
            anomaly_rate := anomaly_count::NUMERIC / total_feedbacks::NUMERIC;
            
            IF anomaly_rate > 0.40 THEN
                UPDATE products SET size_flagged = TRUE WHERE id = NEW.product_id;
                
                INSERT INTO trust_scores (user_id, score, verified)
                VALUES (NEW.seller_id, GREATEST(0, LEAST(100, 50 - 10)), false)
                ON CONFLICT (user_id)
                DO UPDATE SET score = GREATEST(0, LEAST(100, trust_scores.score - 10));
                
                INSERT INTO trust_history (user_id, event_type, delta, description)
                VALUES (NEW.seller_id, 'SIZE_ANOMALY', -10, 'Automated penalty due to >40% sizing inaccuracy');
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_size_anomaly ON seller_fit_stats;
CREATE TRIGGER trg_size_anomaly
    AFTER INSERT ON seller_fit_stats
    FOR EACH ROW
    EXECUTE FUNCTION handle_size_anomaly();


-- ==============================================================================
-- 7. LAYER 1: SELF-BUY DETECTION (Fraud Flags)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS seller_monitoring_flags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID NOT NULL,
    flag_type TEXT NOT NULL,
    description TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION detect_self_buy_fraud()
RETURNS TRIGGER AS $$
DECLARE
    recent_orders INT;
    new_buyer_orders INT;
    fraud_ratio NUMERIC;
BEGIN
    SELECT COUNT(*) INTO recent_orders FROM orders WHERE seller_id = NEW.seller_id;
    
    IF recent_orders >= 5 THEN
        -- Safely count how many of recent orders are from buyers created in the last 7 days.
        -- We query public.profiles if auth.users is obfuscated, 
        -- assuming you'll sync auth.users to public.profiles.
        SELECT COUNT(*) INTO new_buyer_orders 
        FROM orders o
        JOIN public.profiles p ON o.buyer_id = p.id
        WHERE o.seller_id = NEW.seller_id 
          AND p.created_at >= NOW() - INTERVAL '7 days';

        fraud_ratio := new_buyer_orders::NUMERIC / NULLIF(recent_orders, 0)::NUMERIC;

        IF fraud_ratio > 0.60 THEN
            -- Flag seller for manual review, don't penalize score yet
            IF NOT EXISTS (
                SELECT 1 FROM seller_monitoring_flags 
                WHERE seller_id = NEW.seller_id 
                  AND flag_type = 'HIGH_NEW_BUYER_RATIO' 
                  AND is_resolved = FALSE
            ) THEN
                INSERT INTO seller_monitoring_flags (seller_id, flag_type, description)
                VALUES (NEW.seller_id, 'HIGH_NEW_BUYER_RATIO', 'Over 60% of recent orders come from accounts created under 7 days ago. Potential self-buy inflation.');
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_detect_self_buy_fraud ON orders;
CREATE TRIGGER trg_detect_self_buy_fraud
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION detect_self_buy_fraud();


-- ==============================================================================
-- 8. LAYER 4: REPUTATION AUDIT LOG (Nightly Cron)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS seller_reputation_snapshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID NOT NULL,
    trust_score INTEGER NOT NULL,
    total_orders INTEGER DEFAULT 0,
    disputes_count INTEGER DEFAULT 0,
    anomaly_flags INTEGER DEFAULT 0,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    UNIQUE (seller_id, snapshot_date)
);

CREATE OR REPLACE FUNCTION take_reputation_snapshots()
RETURNS void AS $$
BEGIN
    INSERT INTO seller_reputation_snapshots (seller_id, trust_score, total_orders, disputes_count, anomaly_flags, snapshot_date)
    SELECT 
        ts.user_id,
        ts.score,
        (SELECT COUNT(*) FROM orders o WHERE o.seller_id = ts.user_id),
        (SELECT COUNT(*) FROM disputes d WHERE d.seller_id = ts.user_id AND d.status = 'VALID'),
        (SELECT COUNT(*) FROM products p WHERE p.seller_id = ts.user_id AND p.size_flagged = TRUE),
        CURRENT_DATE
    FROM trust_scores ts
    ON CONFLICT (seller_id, snapshot_date) 
    DO UPDATE SET 
        trust_score = EXCLUDED.trust_score,
        total_orders = EXCLUDED.total_orders,
        disputes_count = EXCLUDED.disputes_count,
        anomaly_flags = EXCLUDED.anomaly_flags;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Cron schedule for snapshot (uncomment to enable with pg_cron)
-- SELECT cron.schedule('take_reputation_snapshots_cron', '0 0 * * *', 'SELECT take_reputation_snapshots()');


-- ==============================================================================
-- 9. DISCIPLINE CRON JOB (48-Hour Shipment SLA)
-- ==============================================================================
CREATE OR REPLACE FUNCTION check_late_shipments()
RETURNS void AS $$
DECLARE
    late_order RECORD;
BEGIN
    FOR late_order IN 
        SELECT id, seller_id 
        FROM orders 
        WHERE status = 'SELLER_CONFIRMED' 
          AND shipped_at IS NULL 
          AND created_at < NOW() - INTERVAL '48 hours'
    LOOP
        UPDATE orders SET status = 'LATE_FLAGGED' WHERE id = late_order.id;

        INSERT INTO trust_scores (user_id, score, verified)
        VALUES (late_order.seller_id, GREATEST(0, LEAST(100, 50 - 10)), false)
        ON CONFLICT (user_id)
        DO UPDATE SET score = GREATEST(0, LEAST(100, trust_scores.score - 10));

        INSERT INTO trust_history (user_id, event_type, delta, description)
        VALUES (late_order.seller_id, 'SLA_BREACH', -10, 'Failure to ship within 48-hour SLA deadline for order ' || late_order.id);
        
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SELECT cron.schedule('check_late_shipments_cron', '0 2 * * *', 'SELECT check_late_shipments()');
