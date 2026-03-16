-- HSTN SOCIAL ENHANCEMENT PROTOCOL - PHASE 2
-- REVIEWS AND BUNDLES INFRASTRUCTURE

-- 1. Extend Reviews Table for Social Discovery
ALTER TABLE IF EXISTS reviews 
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS helpful_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified_purchase BOOLEAN DEFAULT false;

-- 2. Create Outfit Bundles Mapping
-- (Already created bundle_items in previous step, but ensuring it's robust)
CREATE TABLE IF NOT EXISTS product_bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_name TEXT NOT NULL,
    bundle_description TEXT,
    price_override DECIMAL,
    seller_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS product_bundle_items (
    bundle_id UUID REFERENCES product_bundles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (bundle_id, product_id)
);

-- 3. RLS Policies for Social Reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" 
ON reviews FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can submit reviews" 
ON reviews FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Function to Vote as Helpful
CREATE OR REPLACE FUNCTION vote_review_helpful(p_review_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE reviews 
    SET helpful_votes = helpful_votes + 1
    WHERE id = p_review_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trending Styles Tracking
CREATE TABLE IF NOT EXISTS trending_styles (
    tag TEXT PRIMARY KEY,
    heat_score INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION update_trend_scores()
RETURNS VOID AS $$
BEGIN
    INSERT INTO trending_styles (tag, heat_score)
    SELECT unnest(style_tags), COUNT(*) * 10
    FROM products
    WHERE created_at > now() - interval '7 days'
    GROUP BY 1
    ON CONFLICT (tag) DO UPDATE 
    SET heat_score = trending_styles.heat_score + excluded.heat_score,
        last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
