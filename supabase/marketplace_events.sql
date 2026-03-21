-- 📊 HSTNLX MARKETPLACE EVENTS TRACKING
-- Universal event tracking for analytics and monitoring

CREATE TABLE IF NOT EXISTS public.marketplace_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- product_view, add_to_cart, wishlist_add, wishlist_remove, search
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}', -- { product_id, seller_id, category, size, price, query }
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_marketplace_events_type ON public.marketplace_events(event_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_user ON public.marketplace_events(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_created ON public.marketplace_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts for authenticated users
CREATE POLICY "Allow inserts for all users" ON public.marketplace_events
    FOR INSERT WITH CHECK (true);

-- Policy: Allow reads for all authenticated users (for debug panel)
CREATE POLICY "Allow reads for all users" ON public.marketplace_events
    FOR SELECT USING (true);

-- Policy: Allow reads for admins (for analytics dashboard)
CREATE POLICY "Allow reads for admins" ON public.marketplace_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Grant permissions
GRANT INSERT ON public.marketplace_events TO authenticated;
GRANT SELECT ON public.marketplace_events TO authenticated;
