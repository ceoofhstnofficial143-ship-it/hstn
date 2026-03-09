-- SIMPLE FIX: Create Reviews Table
-- Run this in Supabase SQL Editor

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.reviews;

-- Create the reviews table with correct structure
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

-- Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "public_read_reviews"
ON public.reviews
FOR SELECT
USING (true);

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

CREATE POLICY "user_update_own_review"
ON public.reviews
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_delete_own_review"
ON public.reviews
FOR DELETE
USING (auth.uid() = user_id);

-- Verify table was created
SELECT 'Reviews table created successfully!' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
AND table_schema = 'public'
ORDER BY ordinal_position;
