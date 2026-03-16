-- ==========================================
-- HSTN SOCIAL DISCOVERY & ENGAGEMENT LAYER
-- v1.0 - Building the Addictive Fashion Social Matrix
-- ==========================================

-- 1. SOCIAL FOUNDATION: FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, seller_id)
);

-- 2. CURATION EVOLUTION: WISHLIST COLLECTIONS
CREATE TABLE IF NOT EXISTS public.wishlist_collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ALTER WISHLIST TO SUPPORT COLLECTIONS
ALTER TABLE public.wishlist ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.wishlist_collections(id) ON DELETE SET NULL;

-- 3. PRODUCT EVOLUTION: STYLE TAGS & BUNDLES
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS style_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT false;

-- OUTFIT BUNDLE ITEMS (For point 2)
CREATE TABLE IF NOT EXISTS public.bundle_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bundle_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. RLS POLICIES FOR SOCIAL LAYER

-- FOLLOWS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON follows;
CREATE POLICY "Users can manage own follows" ON follows FOR ALL USING (follower_id = auth.uid());

-- WISHLIST COLLECTIONS
ALTER TABLE public.wishlist_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public collections are viewable by everyone" ON wishlist_collections;
CREATE POLICY "Public collections are viewable by everyone" ON wishlist_collections FOR SELECT USING (is_public = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own collections" ON wishlist_collections;
CREATE POLICY "Users can manage own collections" ON wishlist_collections FOR ALL USING (user_id = auth.uid());

-- 5. ANALYTICS & RANKING HELPERS

-- GET PERSONALIZED FEED (Point 1/3)
-- Prioritizes products from followed sellers
CREATE OR REPLACE FUNCTION get_personalized_feed(
    p_viewer_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS SETOF products AS $$
BEGIN
    RETURN QUERY
    SELECT p.*
    FROM products p
    LEFT JOIN follows f ON p.user_id = f.seller_id AND f.follower_id = p_viewer_id
    WHERE p.admin_status = 'approved'
    ORDER BY 
        (f.id IS NOT NULL) DESC, -- Followed sellers first
        p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PERMISSIONS
GRANT SELECT ON public.follows TO authenticated, anon;
GRANT INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.wishlist_collections TO authenticated;
GRANT SELECT ON public.bundle_items TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_personalized_feed TO authenticated, anon;
