-- FIX: Supabase Reviews 400 Error
-- Run this in your Supabase SQL Editor to fix the reviews table

-- 1. Check if reviews table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'reviews'
);

-- 2. If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    photo_url TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;
DROP POLICY IF EXISTS "buyer_can_review_delivered" ON public.reviews;
DROP POLICY IF EXISTS "user_update_own_review" ON public.reviews;
DROP POLICY IF EXISTS "user_delete_own_review" ON public.reviews;

-- 5. Create policies
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

-- 6. Verify table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Test query (should work now)
SELECT * FROM reviews LIMIT 5;
