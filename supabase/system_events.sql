-- 💎 HSTNLX CENTRALIZED OBSERVABILITY PROTOCOL
-- Tracks every mission-critical event across the platform for high-activity troubleshooting.

CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- payment_captured, order_reconstructed, refund_processed, payout_eligible
    source TEXT NOT NULL, -- verify_api, webhook_api, rpc_engine, admin_hub
    payment_id TEXT,
    order_id UUID,
    status TEXT DEFAULT 'success', -- success, warning, failure
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for rapid investigation during live incidents
CREATE INDEX IF NOT EXISTS idx_system_events_payment ON public.system_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON public.system_events(event_type);
