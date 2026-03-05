-- HSTN Behavioral Recommendation AI
-- User behavior tracking and personalized recommendations
-- Run this in your Supabase SQL Editor

-- ==============================================================================
-- BEHAVIOR TRACKING TABLES
-- ==============================================================================

-- User behavior tracking
CREATE TABLE IF NOT EXISTS user_behavior (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL, -- 'view', 'like', 'wishlist', 'purchase', 'share'
    category VARCHAR(50),
    style_tags TEXT[], -- Array of style tags like 'streetwear', 'bohemian', etc.
    price_range VARCHAR(20), -- 'budget', 'mid', 'premium'
    brand TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences (computed)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    preferred_categories JSONB DEFAULT '{}', -- {category: weight}
    preferred_styles JSONB DEFAULT '{}', -- {style: weight}
    preferred_price_ranges JSONB DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product recommendations cache
CREATE TABLE IF NOT EXISTS product_recommendations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL,
    reason TEXT, -- Why recommended
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

ALTER TABLE user_behavior ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;

-- User behavior: Users can insert their own, read admin
CREATE POLICY "Users can insert their behavior" ON user_behavior FOR INSERT WITH CHECK (
    auth.uid() = user_id
);
CREATE POLICY "Users can read their behavior" ON user_behavior FOR SELECT USING (
    auth.uid() = user_id
);
CREATE POLICY "Admins can manage behavior data" ON user_behavior FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Preferences: Users can read their own
CREATE POLICY "Users can read their preferences" ON user_preferences FOR SELECT USING (
    auth.uid() = user_id
);
CREATE POLICY "Admins can manage preferences" ON user_preferences FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Recommendations: Users can read their own
CREATE POLICY "Users can read their recommendations" ON product_recommendations FOR SELECT USING (
    auth.uid() = user_id
);
CREATE POLICY "Admins can manage recommendations" ON product_recommendations FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- FUNCTIONS
-- ==============================================================================

-- Track user behavior event
CREATE OR REPLACE FUNCTION track_user_behavior(
    p_user_id UUID,
    p_product_id UUID,
    p_event_type VARCHAR(20),
    p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
DECLARE
    product_category TEXT;
    product_data RECORD;
BEGIN
    -- Get product data
    SELECT category, price INTO product_data
    FROM products WHERE id = p_product_id;

    -- Insert behavior
    INSERT INTO user_behavior (
        user_id, product_id, event_type, category,
        style_tags, price_range, metadata
    ) VALUES (
        p_user_id, p_product_id, p_event_type, product_data.category,
        ARRAY[]::TEXT[], -- TODO: Add style tags from product metadata
        CASE
            WHEN product_data.price < 50 THEN 'budget'
            WHEN product_data.price < 150 THEN 'mid'
            ELSE 'premium'
        END,
        p_metadata
    );

    -- Update user preferences
    PERFORM update_user_preferences(p_user_id);

    RAISE NOTICE 'Tracked behavior: % for user % on product %', p_event_type, p_user_id, p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user preferences based on behavior
CREATE OR REPLACE FUNCTION update_user_preferences(p_user_id UUID)
RETURNS void AS $$
DECLARE
    category_weights JSONB := '{}';
    style_weights JSONB := '{}';
    price_weights JSONB := '{}';
    total_events INTEGER;
BEGIN
    -- Count total events for weighting
    SELECT COUNT(*) INTO total_events
    FROM user_behavior
    WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '30 days';

    IF total_events = 0 THEN RETURN; END IF;

    -- Calculate category preferences
    SELECT jsonb_object_agg(category, (count::NUMERIC / total_events))
    INTO category_weights
    FROM (
        SELECT category, COUNT(*) as count
        FROM user_behavior
        WHERE user_id = p_user_id AND category IS NOT NULL
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY category
    ) cat_counts;

    -- Calculate price range preferences
    SELECT jsonb_object_agg(price_range, (count::NUMERIC / total_events))
    INTO price_weights
    FROM (
        SELECT price_range, COUNT(*) as count
        FROM user_behavior
        WHERE user_id = p_user_id AND price_range IS NOT NULL
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY price_range
    ) price_counts;

    -- Update preferences
    INSERT INTO user_preferences (
        user_id, preferred_categories, preferred_price_ranges, last_updated
    ) VALUES (
        p_user_id, category_weights, price_weights, NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
        preferred_categories = EXCLUDED.preferred_categories,
        preferred_price_ranges = EXCLUDED.preferred_price_ranges,
        last_updated = NOW();

    RAISE NOTICE 'Updated preferences for user %', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate personalized recommendations for user
CREATE OR REPLACE FUNCTION generate_user_recommendations(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS void AS $$
DECLARE
    user_prefs RECORD;
    rec_product RECORD;
    score NUMERIC;
    reason TEXT;
BEGIN
    -- Get user preferences
    SELECT * INTO user_prefs FROM user_preferences WHERE user_id = p_user_id;

    -- Clear old recommendations
    DELETE FROM product_recommendations
    WHERE user_id = p_user_id AND expires_at < NOW();

    -- Generate recommendations
    FOR rec_product IN
        SELECT p.id, p.category, p.price, p.title
        FROM products p
        WHERE p.admin_status = 'approved'
          AND p.id NOT IN (
              SELECT product_id FROM user_behavior
              WHERE user_id = p_user_id AND event_type IN ('purchase', 'wishlist')
          )
        ORDER BY p.created_at DESC
        LIMIT 100 -- Consider recent products
    LOOP
        score := 0;
        reason := '';

        -- Category match
        IF user_prefs.preferred_categories ? rec_product.category THEN
            score := score + (user_prefs.preferred_categories->>rec_product.category)::NUMERIC * 0.4;
            reason := reason || 'Category match ';
        END IF;

        -- Price range match
        DECLARE
            price_range TEXT := CASE
                WHEN rec_product.price < 50 THEN 'budget'
                WHEN rec_product.price < 150 THEN 'mid'
                ELSE 'premium'
            END;
        BEGIN
            IF user_prefs.preferred_price_ranges ? price_range THEN
                score := score + (user_prefs.preferred_price_ranges->>price_range)::NUMERIC * 0.3;
                reason := reason || 'Price match ';
            END IF;
        END;

        -- Recency boost
        score := score + GREATEST(0, (30 - EXTRACT(DAYS FROM (NOW() - rec_product.created_at))) / 30) * 0.2;

        -- Popularity boost (simulated)
        score := score + 0.1; -- Base score

        -- Insert if score > 0
        IF score > 0 THEN
            INSERT INTO product_recommendations (
                user_id, product_id, score, reason
            ) VALUES (
                p_user_id, rec_product.id, score, trim(reason)
            );
        END IF;
    END LOOP;

    -- Keep only top recommendations
    DELETE FROM product_recommendations
    WHERE user_id = p_user_id
      AND id NOT IN (
          SELECT id FROM product_recommendations
          WHERE user_id = p_user_id
          ORDER BY score DESC
          LIMIT p_limit
      );

    RAISE NOTICE 'Generated % recommendations for user %', p_limit, p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get personalized feed for user (80% recommendations, 15% category, 5% random)
CREATE OR REPLACE FUNCTION get_personalized_feed(
    p_user_id UUID,
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    product_id UUID,
    score NUMERIC,
    reason TEXT,
    feed_type TEXT -- 'recommended', 'category', 'discovery'
) AS $$
DECLARE
    rec_count INTEGER;
    cat_count INTEGER;
    disc_count INTEGER;
BEGIN
    -- Generate fresh recommendations if needed
    IF NOT EXISTS (
        SELECT 1 FROM product_recommendations
        WHERE user_id = p_user_id AND expires_at > NOW()
        LIMIT 1
    ) THEN
        PERFORM generate_user_recommendations(p_user_id);
    END IF;

    -- Calculate distribution
    rec_count := (p_limit * 0.8)::INTEGER;
    cat_count := (p_limit * 0.15)::INTEGER;
    disc_count := p_limit - rec_count - cat_count;

    RETURN QUERY
    -- 80% Personalized recommendations
    SELECT pr.product_id, pr.score, pr.reason, 'recommended'::TEXT
    FROM product_recommendations pr
    WHERE pr.user_id = p_user_id AND pr.expires_at > NOW()
    ORDER BY pr.score DESC
    LIMIT rec_count

    UNION ALL

    -- 15% Category products (or all if no category)
    SELECT p.id, 0.5::NUMERIC, 'Category exploration'::TEXT, 'category'::TEXT
    FROM products p
    WHERE p.admin_status = 'approved'
      AND (p_category IS NULL OR p.category = p_category)
      AND p.id NOT IN (
          SELECT product_id FROM product_recommendations
          WHERE user_id = p_user_id AND expires_at > NOW()
      )
    ORDER BY p.created_at DESC
    LIMIT cat_count

    UNION ALL

    -- 5% Discovery (random trending)
    SELECT p.id, 0.1::NUMERIC, 'Discovery'::TEXT, 'discovery'::TEXT
    FROM products p
    LEFT JOIN product_analytics pa ON p.id = pa.product_id
    WHERE p.admin_status = 'approved'
      AND p.id NOT IN (
          SELECT product_id FROM product_recommendations
          WHERE user_id = p_user_id AND expires_at > NOW()
      )
    ORDER BY COALESCE(pa.heat_score, 0) DESC, RANDOM()
    LIMIT disc_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- TRIGGERS
-- ==============================================================================

-- Auto-track behavior from marketplace events
CREATE OR REPLACE FUNCTION sync_marketplace_behavior()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'product_view' AND NEW.user_id IS NOT NULL THEN
        PERFORM track_user_behavior(NEW.user_id, NEW.product_id, 'view');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on marketplace_events
-- DROP TRIGGER IF EXISTS trigger_sync_behavior ON marketplace_events;
-- CREATE TRIGGER trigger_sync_behavior
--     AFTER INSERT ON marketplace_events
--     FOR EACH ROW EXECUTE FUNCTION sync_marketplace_behavior();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
