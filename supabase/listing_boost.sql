-- 🚀 LISTING BOOST SYSTEM
-- Allows specific products to have temporarily higher visibility in the discovery engine

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

-- Ranking algorithm update
-- Already existing in feedRanker.ts but let's ensure the DB can handle sorting

CREATE INDEX IF NOT EXISTS idx_products_boosted ON public.products(is_boosted) WHERE is_boosted = true;
