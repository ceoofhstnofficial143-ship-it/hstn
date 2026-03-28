-- 🏛️ DEFINITIVE REVIEWS PROTOCOL - INSTITUTIONAL FIX
-- Resolves PGRST200 and Silent Insert Failures

-- 1. Table Creation
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT NOT NULL,
    photo_url TEXT,
    user_name TEXT 
);

-- 2. Explicitly Define Foreign Key to Profiles for Supabase Join
-- (Even if both link to auth.users, an explicit link to profiles helps Select)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. RLS Protocol
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to reviews" ON public.reviews;
CREATE POLICY "Allow public read access to reviews" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert reviews" ON public.reviews;
CREATE POLICY "Allow authenticated users to insert reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 4. Audit Log
INSERT INTO public.system_events (event_type, source, status, metadata)
VALUES ('schema_upgrade_reviews', 'definitive_fix', 'success', '{"version": "1.0", "target": "reviews_table"}');
