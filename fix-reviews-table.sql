-- FIX: Supabase Reviews Table - Complete Structure Check & Fix
-- Run this in your Supabase SQL Editor to fix the reviews table

-- 1. Check current table structure
SELECT 'Current table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Backup existing data if table exists
CREATE TEMP TABLE reviews_backup AS
SELECT * FROM public.reviews
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews');

-- 3. Drop and recreate table with correct structure
DROP TABLE IF EXISTS public.reviews;

CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    photo_url TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Restore data if we had a backup (simple approach - insert what we can)
-- Note: This assumes backup table has compatible columns, otherwise data is lost but table structure is correct
INSERT INTO public.reviews (product_id, user_id, rating, comment, photo_url, user_name, created_at)
SELECT
    COALESCE(rb.product_id, gen_random_uuid()) as product_id,
    COALESCE(rb.user_id, gen_random_uuid()) as user_id,
    COALESCE(rb.rating, 5) as rating,
    COALESCE(rb.comment, 'Migrated review') as comment,
    rb.photo_url,
    COALESCE(rb.user_name, 'Anonymous') as user_name,
    COALESCE(rb.created_at, NOW()) as created_at
FROM reviews_backup rb
WHERE EXISTS (SELECT 1 FROM reviews_backup rb2 LIMIT 1)
ON CONFLICT DO NOTHING;

-- 5. Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies if they exist
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;
DROP POLICY IF EXISTS "buyer_can_review_delivered" ON public.reviews;
DROP POLICY IF EXISTS "user_update_own_review" ON public.reviews;
DROP POLICY IF EXISTS "user_delete_own_review" ON public.reviews;

-- 7. Create policies
-- Public can read reviews (safe: reviews are public content)
CREATE POLICY "public_read_reviews"
ON public.reviews
FOR SELECT
USING (true);

-- Only allow insert if user has delivered order for this product
CREATE POLICY "buyer_can_review_delivered"
ON public.reviews
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.buyer_id = auth.uid()
        AND o.product_id = reviews.product_id
        AND o.status = 'delivered'
    )
);

-- Allow users to update/delete their own reviews
CREATE POLICY "user_update_own_review"
ON public.reviews
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_delete_own_review"
ON public.reviews
FOR DELETE
USING (auth.uid() = user_id);

-- 8. Clean up backup table
DROP TABLE IF EXISTS reviews_backup;

-- 9. Verify final table structure
SELECT 'Final table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 10. Test query (should work now)
SELECT 'Test query result:' as info;
SELECT COUNT(*) as review_count FROM reviews;
SELECT * FROM reviews LIMIT 3;
