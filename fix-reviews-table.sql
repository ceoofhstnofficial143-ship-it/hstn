-- FIX: Supabase Reviews 400 Error
-- Run this in your Supabase SQL Editor to fix the reviews table

-- 1. Check current table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. If table exists with buyer_id instead of user_id, rename the column
DO $$
BEGIN
    -- Check if buyer_id exists and user_id doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reviews' AND column_name = 'buyer_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reviews' AND column_name = 'user_id'
    ) THEN
        -- Rename buyer_id to user_id
        ALTER TABLE public.reviews RENAME COLUMN buyer_id TO user_id;
        RAISE NOTICE 'Renamed buyer_id to user_id in reviews table';
    END IF;
END $$;

-- 3. If table doesn't exist at all, create it
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

-- 4. Ensure Row Level Security is enabled
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;
DROP POLICY IF EXISTS "buyer_can_review_delivered" ON public.reviews;
DROP POLICY IF EXISTS "user_update_own_review" ON public.reviews;
DROP POLICY IF EXISTS "user_delete_own_review" ON public.reviews;

-- 6. Create policies
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

-- 7. Verify final table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Test query (should work now)
SELECT * FROM reviews LIMIT 5;
