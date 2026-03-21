-- 💎 HSTNLX INSTITUTIONAL AUDIT & SESSION PROTOCOL
-- Ensuring every administrative action and checkout attempt is trackable and finite.

-- 1. ADMIN AUDIT TRAIL
CREATE TABLE IF NOT EXISTS public.admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- refund_issued | payout_processed | reconcile_run
    target_id TEXT, -- payment_id / payout_id
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CHECKOUT EXPIRY EXTENSION
ALTER TABLE public.checkout_sessions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 minutes');

-- 3. RECONCILIATION OPS VIEW
-- A dynamic high-fidelity view to compare Captures vs Orders in real-time.
CREATE OR REPLACE VIEW public.vw_reconciliation_audit AS 
SELECT 
    p.payment_id,
    p.razorpay_order_id,
    p.amount as captured_amount,
    o.id as order_id,
    o.total_price as order_amount,
    o.status as order_status,
    p.status as payment_status,
    (CASE WHEN o.id IS NULL THEN 'ORPHANED_PAYMENT' 
          WHEN p.amount != o.total_price THEN 'MISMATCH' 
          ELSE 'SYNCHRONIZED' END) as audit_result
FROM public.payments p
LEFT JOIN public.orders o ON p.payment_id = o.payment_id;
