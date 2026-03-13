                    -- HSTN Marketplace Intelligence Layer (MIL)
                    -- Event Tracking Infrastructure Foundation
                    -- Run this in your Supabase SQL Editor

                    -- ==============================================================================
                    -- MODULE 1: EVENT TRACKING INFRASTRUCTURE
                    -- ==============================================================================

                    -- Core events table - append-only truth layer
                    CREATE TABLE IF NOT EXISTS marketplace_events (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        event_type VARCHAR(50) NOT NULL,
                        user_id UUID REFERENCES auth.users(id),
                        seller_id UUID REFERENCES auth.users(id),
                        product_id UUID REFERENCES products(id),
                        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        metadata JSONB DEFAULT '{}',
                        session_id VARCHAR(255),
                        ip_address INET,
                        user_agent TEXT
                    );

                    -- Indexes for performance
                    CREATE INDEX IF NOT EXISTS idx_marketplace_events_type ON marketplace_events(event_type);
                    CREATE INDEX IF NOT EXISTS idx_marketplace_events_user ON marketplace_events(user_id);
                    CREATE INDEX IF NOT EXISTS idx_marketplace_events_seller ON marketplace_events(seller_id);
                    CREATE INDEX IF NOT EXISTS idx_marketplace_events_product ON marketplace_events(product_id);
                    CREATE INDEX IF NOT EXISTS idx_marketplace_events_timestamp ON marketplace_events(timestamp);
                    CREATE INDEX IF NOT EXISTS idx_marketplace_events_type_timestamp ON marketplace_events(event_type, timestamp);

                    -- RLS - Users can see their own events, admins can see all
                    ALTER TABLE marketplace_events ENABLE ROW LEVEL SECURITY;
                    CREATE POLICY "Users can view own events" ON marketplace_events FOR SELECT USING (auth.uid() = user_id);
                    CREATE POLICY "Admins can view all events" ON marketplace_events FOR SELECT USING (
                        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
                    );

                    -- ==============================================================================
                    -- EVENT LOGGING FUNCTIONS
                    -- ==============================================================================

                    -- Generic event logger
                    CREATE OR REPLACE FUNCTION log_marketplace_event(
                        p_event_type VARCHAR(50),
                        p_user_id UUID DEFAULT NULL,
                        p_seller_id UUID DEFAULT NULL,
                        p_product_id UUID DEFAULT NULL,
                        p_metadata JSONB DEFAULT '{}',
                        p_session_id VARCHAR(255) DEFAULT NULL
                    )
                    RETURNS UUID AS $$
                    DECLARE
                        event_id UUID;
                    BEGIN
                        INSERT INTO marketplace_events (
                            event_type, user_id, seller_id, product_id, 
                            metadata, session_id, ip_address, user_agent
                        ) VALUES (
                            p_event_type, p_user_id, p_seller_id, p_product_id,
                            p_metadata, p_session_id, inet_client_addr(), current_setting('request.headers')::text
                        ) RETURNING id INTO event_id;
                        
                        RETURN event_id;
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    -- Specific event logging functions
                    CREATE OR REPLACE FUNCTION log_product_view(p_user_id UUID, p_product_id UUID, p_seller_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('product_view', p_user_id, p_seller_id, p_product_id);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    CREATE OR REPLACE FUNCTION log_video_play(p_user_id UUID, p_product_id UUID, p_seller_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('video_play', p_user_id, p_seller_id, p_product_id);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    CREATE OR REPLACE FUNCTION log_wishlist_add(p_user_id UUID, p_product_id UUID, p_seller_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('wishlist_add', p_user_id, p_seller_id, p_product_id);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    CREATE OR REPLACE FUNCTION log_add_to_cart(p_user_id UUID, p_product_id UUID, p_seller_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('add_to_cart', p_user_id, p_seller_id, p_product_id);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    CREATE OR REPLACE FUNCTION log_checkout_start(p_user_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('checkout_start', p_user_id);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    CREATE OR REPLACE FUNCTION log_checkout_complete(p_user_id UUID, p_order_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('checkout_complete', p_user_id, NULL, NULL, 
                                                jsonb_build_object('order_id', p_order_id));
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    -- Seller events
                    CREATE OR REPLACE FUNCTION log_upload_created(p_seller_id UUID, p_product_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('upload_created', NULL, p_seller_id, p_product_id);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    CREATE OR REPLACE FUNCTION log_upload_approved(p_seller_id UUID, p_product_id UUID)
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('upload_approved', NULL, p_seller_id, p_product_id);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    CREATE OR REPLACE FUNCTION log_quest_completed(p_seller_id UUID, p_quest_type VARCHAR(50))
                    RETURNS UUID AS $$
                    BEGIN
                        RETURN log_marketplace_event('quest_completed', NULL, p_seller_id, NULL,
                                                jsonb_build_object('quest_type', p_quest_type));
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    -- ==============================================================================
                    -- MODULE 2: SELLER ANALYTICS AGGREGATES
                    -- ==============================================================================

                    -- Materialized view for seller performance metrics
                    CREATE MATERIALIZED VIEW IF NOT EXISTS seller_analytics AS
                    SELECT 
                        seller_id,
                        COUNT(DISTINCT CASE WHEN event_type = 'product_view' THEN product_id END) as total_impressions,
                        COUNT(DISTINCT CASE WHEN event_type = 'product_view' THEN user_id END) as unique_viewers,
                        COUNT(CASE WHEN event_type = 'video_play' THEN 1 END) as total_video_plays,
                        COUNT(CASE WHEN event_type = 'wishlist_add' THEN 1 END) as total_wishlist_adds,
                        COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) as total_cart_adds,
                        COUNT(CASE WHEN event_type = 'checkout_complete' THEN 1 END) as total_orders,
                        COUNT(CASE WHEN event_type = 'quest_completed' THEN 1 END) as total_quests_completed,
                        MIN(timestamp) as first_activity,
                        MAX(timestamp) as last_activity
                    FROM marketplace_events 
                    WHERE seller_id IS NOT NULL
                    GROUP BY seller_id;

                    -- Create unique index for refresh
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_analytics_seller_id ON seller_analytics(seller_id);

                    -- Function to refresh analytics
                    CREATE OR REPLACE FUNCTION refresh_seller_analytics()
                    RETURNS void AS $$
                    BEGIN
                        REFRESH MATERIALIZED VIEW CONCURRENTLY seller_analytics;
                    END;
                    $$ LANGUAGE plpgsql;

                    -- ==============================================================================
                    -- MODULE 3: PRODUCT HEAT SCORE
                    -- ==============================================================================

                    -- Product heat score calculation
                    CREATE OR REPLACE FUNCTION calculate_product_heat_score(p_product_id UUID)
                    RETURNS NUMERIC AS $$
                    DECLARE
                        heat_score NUMERIC := 0;
                        days_ago TIMESTAMP := NOW() - INTERVAL '7 days';
                    BEGIN
                        SELECT 
                            (COUNT(CASE WHEN event_type = 'product_view' THEN 1 END) * 1) +
                            (COUNT(CASE WHEN event_type = 'video_play' THEN 1 END) * 2) +
                            (COUNT(CASE WHEN event_type = 'wishlist_add' THEN 1 END) * 4) +
                            (COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) * 6)
                        INTO heat_score
                        FROM marketplace_events 
                        WHERE product_id = p_product_id 
                        AND timestamp >= days_ago;
                        
                        RETURN COALESCE(heat_score, 0);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    -- Product analytics table
                    CREATE TABLE IF NOT EXISTS product_analytics (
                        product_id UUID PRIMARY KEY REFERENCES products(id),
                        heat_score NUMERIC DEFAULT 0,
                        total_views INTEGER DEFAULT 0,
                        total_video_plays INTEGER DEFAULT 0,
                        total_wishlist_adds INTEGER DEFAULT 0,
                        total_cart_adds INTEGER DEFAULT 0,
                        total_orders INTEGER DEFAULT 0,
                        conversion_rate NUMERIC(5,2) DEFAULT 0,
                        last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );

                    -- Function to update product analytics
                    CREATE OR REPLACE FUNCTION update_product_analytics(p_product_id UUID)
                    RETURNS void AS $$
                    DECLARE
                        total_views INT := 0;
                        total_cart_adds INT := 0;
                        total_orders INT := 0;
                        conversion_rate NUMERIC := 0;
                    BEGIN
                        -- Get counts
                        SELECT COUNT(*) INTO total_views
                        FROM marketplace_events 
                        WHERE product_id = p_product_id AND event_type = 'product_view';
                        
                        SELECT COUNT(*) INTO total_cart_adds
                        FROM marketplace_events 
                        WHERE product_id = p_product_id AND event_type = 'add_to_cart';
                        
                        SELECT COUNT(*) INTO total_orders
                        FROM marketplace_events 
                        WHERE product_id = p_product_id AND event_type = 'checkout_complete';
                        
                        -- Calculate conversion rate
                        IF total_cart_adds > 0 THEN
                            conversion_rate := (total_orders::NUMERIC / total_cart_adds::NUMERIC) * 100;
                        END IF;
                        
                        -- Update or insert
                        INSERT INTO product_analytics (
                            product_id, heat_score, total_views, total_cart_adds, 
                            total_orders, conversion_rate, last_calculated
                        ) VALUES (
                            p_product_id, 
                            calculate_product_heat_score(p_product_id),
                            total_views, total_cart_adds, total_orders, 
                            conversion_rate, NOW()
                        )
                        ON CONFLICT (product_id) DO UPDATE SET
                            heat_score = EXCLUDED.heat_score,
                            total_views = EXCLUDED.total_views,
                            total_cart_adds = EXCLUDED.total_cart_adds,
                            total_orders = EXCLUDED.total_orders,
                            conversion_rate = EXCLUDED.conversion_rate,
                            last_calculated = EXCLUDED.last_calculated;
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    -- ==============================================================================
                    -- MODULE 4: FUNNEL INTELLIGENCE
                    -- ==============================================================================

                    -- Funnel analytics table
                    CREATE TABLE IF NOT EXISTS funnel_analytics (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        date_bucket DATE NOT NULL,
                        feed_views INTEGER DEFAULT 0,
                        product_clicks INTEGER DEFAULT 0,
                        cart_adds INTEGER DEFAULT 0,
                        checkout_starts INTEGER DEFAULT 0,
                        checkout_completes INTEGER DEFAULT 0,
                        ctr NUMERIC(5,2) DEFAULT 0, -- Click-through rate
                        cart_rate NUMERIC(5,2) DEFAULT 0,
                        checkout_start_rate NUMERIC(5,2) DEFAULT 0,
                        completion_rate NUMERIC(5,2) DEFAULT 0,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );

                    -- Unique constraint on date
                    ALTER TABLE funnel_analytics ADD CONSTRAINT funnel_analytics_date_bucket_unique UNIQUE (date_bucket);

                    -- Function to calculate funnel metrics
                    CREATE OR REPLACE FUNCTION calculate_daily_funnel(p_date DATE DEFAULT CURRENT_DATE)
                    RETURNS void AS $$
                    DECLARE
                        feed_views INT := 0;
                        product_clicks INT := 0;
                        cart_adds INT := 0;
                        checkout_starts INT := 0;
                        checkout_completes INT := 0;
                        ctr NUMERIC := 0;
                        cart_rate NUMERIC := 0;
                        checkout_start_rate NUMERIC := 0;
                        completion_rate NUMERIC := 0;
                    BEGIN
                        -- Get funnel counts for the day
                        SELECT COUNT(*) INTO feed_views
                        FROM marketplace_events 
                        WHERE event_type = 'feed_view' 
                        AND DATE(timestamp) = p_date;
                        
                        SELECT COUNT(*) INTO product_clicks
                        FROM marketplace_events 
                        WHERE event_type = 'product_view' 
                        AND DATE(timestamp) = p_date;
                        
                        SELECT COUNT(*) INTO cart_adds
                        FROM marketplace_events 
                        WHERE event_type = 'add_to_cart' 
                        AND DATE(timestamp) = p_date;
                        
                        SELECT COUNT(*) INTO checkout_starts
                        FROM marketplace_events 
                        WHERE event_type = 'checkout_start' 
                        AND DATE(timestamp) = p_date;
                        
                        SELECT COUNT(*) INTO checkout_completes
                        FROM marketplace_events 
                        WHERE event_type = 'checkout_complete' 
                        AND DATE(timestamp) = p_date;
                        
                        -- Calculate rates
                        IF feed_views > 0 THEN
                            ctr := (product_clicks::NUMERIC / feed_views::NUMERIC) * 100;
                            cart_rate := (cart_adds::NUMERIC / feed_views::NUMERIC) * 100;
                            checkout_start_rate := (checkout_starts::NUMERIC / feed_views::NUMERIC) * 100;
                            completion_rate := (checkout_completes::NUMERIC / feed_views::NUMERIC) * 100;
                        END IF;
                        
                        -- Insert or update
                        INSERT INTO funnel_analytics (
                            date_bucket, feed_views, product_clicks, cart_adds, 
                            checkout_starts, checkout_completes, 
                            ctr, cart_rate, checkout_start_rate, completion_rate
                        ) VALUES (
                            p_date, feed_views, product_clicks, cart_adds, 
                            checkout_starts, checkout_completes,
                            ctr, cart_rate, checkout_start_rate, completion_rate
                        )
                        ON CONFLICT (date_bucket) DO UPDATE SET
                            feed_views = EXCLUDED.feed_views,
                            product_clicks = EXCLUDED.product_clicks,
                            cart_adds = EXCLUDED.cart_adds,
                            checkout_starts = EXCLUDED.checkout_starts,
                            checkout_completes = EXCLUDED.checkout_completes,
                            ctr = EXCLUDED.ctr,
                            cart_rate = EXCLUDED.cart_rate,
                            checkout_start_rate = EXCLUDED.checkout_start_rate,
                            completion_rate = EXCLUDED.completion_rate;
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    -- ==============================================================================
                    -- SCHEDULED JOBS (Manual for now, can be automated later)
                    -- ==============================================================================

                    -- Manual refresh functions
                    CREATE OR REPLACE FUNCTION refresh_all_analytics()
                    RETURNS void AS $$
                    BEGIN
                        -- Refresh seller analytics
                        PERFORM refresh_seller_analytics();
                        
                        -- Update product analytics for all active products
                        UPDATE product_analytics 
                        SET heat_score = calculate_product_heat_score(product_id),
                            last_calculated = NOW()
                        WHERE product_id IN (
                            SELECT DISTINCT product_id FROM marketplace_events 
                            WHERE timestamp >= NOW() - INTERVAL '30 days'
                        );
                        
                        -- Calculate today's funnel
                        PERFORM calculate_daily_funnel(CURRENT_DATE);
                    END;
                    $$ LANGUAGE plpgsql;

                    -- Grant permissions
                    GRANT USAGE ON SCHEMA public TO authenticated;
                    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
                    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
                    GRANT SELECT ON seller_analytics TO authenticated;
                    GRANT SELECT ON product_analytics TO authenticated;
                    GRANT SELECT ON funnel_analytics TO authenticated;
