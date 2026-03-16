-- ==========================================
-- HSTN SEARCH ENGINE INFRASTRUCTURE
-- v1.1 - Powering the Search Matrix
-- ==========================================

-- 1. SEARCH LOGS TABLE
CREATE TABLE IF NOT EXISTS public.search_queries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_queries_query ON public.search_queries(query);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON public.search_queries(created_at);

-- RLS
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can insert search queries" ON public.search_queries;
CREATE POLICY "Public can insert search queries" ON public.search_queries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all search queries" ON public.search_queries;
CREATE POLICY "Admins can view all search queries" ON public.search_queries FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 2. ENSURE PRODUCTS COLUMNS (Safety Net)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS style_tags TEXT[] DEFAULT '{}';

-- 3. PERMISSIONS
GRANT INSERT ON public.search_queries TO authenticated, anon;
GRANT SELECT ON public.search_queries TO authenticated;
