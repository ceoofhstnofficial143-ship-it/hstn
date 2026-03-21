-- 💎 HSTNLX CHECKOUT SESSION PROTOCOL
-- Stores full transaction intent for recovery by the Webhook Authority.

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    razorpay_order_id TEXT UNIQUE,
    cart JSONB NOT NULL,
    shipping JSONB NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed, failed
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 hour')
);

-- Index for fast recovery by Webhook
CREATE INDEX IF NOT EXISTS idx_checkout_rzp_order ON public.checkout_sessions(razorpay_order_id);
