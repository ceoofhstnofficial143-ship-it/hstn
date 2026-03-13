-- ENABLE RLS ON PRODUCTS AND REVIEWS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- PRODUCTS POLICIES
CREATE POLICY "Approved products are viewable by everyone" ON products FOR SELECT
USING (admin_status = 'approved');

CREATE POLICY "Sellers can view own products" ON products FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Sellers can update own products" ON products FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Sellers can delete own products" ON products FOR DELETE
USING (user_id = auth.uid());

-- REVIEWS POLICIES
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert reviews" ON reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE
USING (auth.uid() = user_id);
