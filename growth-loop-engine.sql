-- HSTN Growth Loop Engine
-- Referral system and viral sharing incentives
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- REFERRAL SYSTEM TABLES
-- ==============================================================================

-- Referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral events table
CREATE TABLE IF NOT EXISTS referral_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    referral_code VARCHAR(10) NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- 'click', 'signup', 'purchase', 'share'
    referrer_user_id UUID REFERENCES auth.users(id),
    referred_user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}', -- Store additional data like platform, source
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User rewards table
CREATE TABLE IF NOT EXISTS user_rewards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reward_type VARCHAR(20) NOT NULL, -- 'referral_signup', 'referral_purchase', 'share_bonus'
    amount NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'granted', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- Referral codes: Users can read/write their own
CREATE POLICY "Users can manage their referral codes" ON referral_codes FOR ALL USING (
    auth.uid() = user_id
);

-- Referral events: Users can read events related to them
CREATE POLICY "Users can read referral events" ON referral_events FOR SELECT USING (
    auth.uid() = referrer_user_id OR auth.uid() = referred_user_id
);

-- Rewards: Users can read their own rewards
CREATE POLICY "Users can read their rewards" ON user_rewards FOR SELECT USING (
    auth.uid() = user_id
);

-- Admin policies for management
CREATE POLICY "Admins can manage all referral data" ON referral_codes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can manage all events" ON referral_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can manage all rewards" ON user_rewards FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- FUNCTIONS
-- ==============================================================================

-- Generate unique referral code for user
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    new_code VARCHAR(10);
    attempts INTEGER := 0;
BEGIN
    LOOP
        -- Generate random 6-character code (letters and numbers)
        new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

        -- Check if code exists
        IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = new_code) THEN
            -- Insert new code
            INSERT INTO referral_codes (user_id, code) VALUES (p_user_id, new_code);
            RETURN new_code;
        END IF;

        attempts := attempts + 1;
        IF attempts > 10 THEN
            RAISE EXCEPTION 'Could not generate unique referral code after 10 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Track referral event
CREATE OR REPLACE FUNCTION track_referral_event(
    p_code VARCHAR(10),
    p_event_type VARCHAR(20),
    p_referrer_id UUID DEFAULT NULL,
    p_referred_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
DECLARE
    referrer_id UUID;
BEGIN
    -- Get referrer from code if not provided
    IF p_referrer_id IS NULL THEN
        SELECT user_id INTO referrer_id FROM referral_codes WHERE code = p_code;
        IF referrer_id IS NULL THEN
            RAISE EXCEPTION 'Invalid referral code';
        END IF;
    ELSE
        referrer_id := p_referrer_id;
    END IF;

    -- Insert event
    INSERT INTO referral_events (
        referral_code, event_type, referrer_user_id, referred_user_id, metadata
    ) VALUES (
        p_code, p_event_type, referrer_id, p_referred_id, p_metadata
    );

    -- Auto-grant rewards based on event type
    IF p_event_type = 'signup' AND p_referred_id IS NOT NULL THEN
        -- Grant $5 credit to referrer for successful signup
        INSERT INTO user_rewards (user_id, reward_type, amount, reason)
        VALUES (referrer_id, 'referral_signup', 5.00, 'Referred user signed up');

    ELSIF p_event_type = 'purchase' AND p_referred_id IS NOT NULL THEN
        -- Grant 10% of purchase value (metadata should contain purchase_amount)
        DECLARE
            purchase_amount NUMERIC := (p_metadata->>'purchase_amount')::NUMERIC;
            reward_amount NUMERIC;
        BEGIN
            IF purchase_amount > 0 THEN
                reward_amount := purchase_amount * 0.10;
                INSERT INTO user_rewards (user_id, reward_type, amount, reason)
                VALUES (referrer_id, 'referral_purchase', reward_amount,
                       'Commission from referred user purchase: $' || purchase_amount);
            END IF;
        END;
    END IF;

    RAISE NOTICE 'Tracked referral event: % for code %', p_event_type, p_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's referral stats
CREATE OR REPLACE FUNCTION get_user_referral_stats(p_user_id UUID)
RETURNS TABLE (
    total_clicks BIGINT,
    total_signups BIGINT,
    total_purchases BIGINT,
    total_rewards NUMERIC,
    referral_code VARCHAR(10)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE re.event_type = 'click') as total_clicks,
        COUNT(*) FILTER (WHERE re.event_type = 'signup') as total_signups,
        COUNT(*) FILTER (WHERE re.event_type = 'purchase') as total_purchases,
        COALESCE(SUM(ur.amount), 0) as total_rewards,
        rc.code as referral_code
    FROM referral_codes rc
    LEFT JOIN referral_events re ON rc.code = re.referral_code
    LEFT JOIN user_rewards ur ON rc.user_id = ur.user_id AND ur.reward_type LIKE 'referral%'
    WHERE rc.user_id = p_user_id
    GROUP BY rc.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant share bonus (for viral sharing)
CREATE OR REPLACE FUNCTION grant_share_bonus(p_user_id UUID, p_platform VARCHAR, p_amount NUMERIC DEFAULT 1.00)
RETURNS void AS $$
BEGIN
    INSERT INTO user_rewards (user_id, reward_type, amount, reason)
    VALUES (p_user_id, 'share_bonus', p_amount,
           'Bonus for sharing on ' || p_platform);

    RAISE NOTICE 'Granted share bonus of $% to user % for % share', p_amount, p_user_id, p_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- TRIGGERS FOR AUTOMATION
-- ==============================================================================

-- Auto-generate referral code when user profile is created
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate code for new user
    PERFORM generate_referral_code(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table (assuming profiles table exists)
-- Note: Adjust table name if different
-- DROP TRIGGER IF EXISTS trigger_auto_referral_code ON profiles;
-- CREATE TRIGGER trigger_auto_referral_code
--     AFTER INSERT ON profiles
--     FOR EACH ROW EXECUTE FUNCTION auto_generate_referral_code();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
