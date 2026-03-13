-- CHECK EXISTING POLICIES FIRST
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('products', 'reviews')
ORDER BY tablename, policyname;

-- IF POLICIES EXIST, DROP THEM FIRST (UNCOMMENT IF NEEDED)
-- DROP POLICY IF EXISTS "Approved products are viewable by everyone" ON products;
-- DROP POLICY IF EXISTS "Sellers can view own products" ON products;
-- DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
-- DROP POLICY IF EXISTS "Sellers can update own products" ON products;
-- DROP POLICY IF EXISTS "Sellers can delete own products" ON products;
-- DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
-- DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON reviews;
-- DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
-- DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;

-- THEN ENABLE RLS (only if not already enabled)
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
