-- DISPUTE ENGINE PROTOCOL (DEP) V1.1
-- Optimized for DUAL-CHANNEL (Browser & Admin) and synced with V13.6 Engine.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT false;
ALTER TABLE public.seller_payouts ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.order_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) NOT NULL,
    buyer_id UUID REFERENCES auth.users(id) NOT NULL,
    seller_id UUID REFERENCES auth.users(id) NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    evidence_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'refunded', 'released')),
    resolution_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- RLS: Buyers and Sellers can see their own disputes
ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own disputes" ON public.order_disputes;
CREATE POLICY "Users view own disputes" ON public.order_disputes FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
DROP POLICY IF EXISTS "Admins view all disputes" ON public.order_disputes;
CREATE POLICY "Admins view all disputes" ON public.order_disputes FOR ALL USING (true); 

-- 🔫 REPAIR: Clear Signature Overload
DROP FUNCTION IF EXISTS public.initialize_order_dispute(UUID, TEXT, TEXT);

-- RCP: INITIALIZE DISPUTE PROTOCOL (V1.1)
CREATE OR REPLACE FUNCTION public.initialize_order_dispute(
    p_order_id UUID,
    p_reason TEXT,
    p_details TEXT,
    p_user_id_override UUID DEFAULT NULL -- 🔐 Dual-Channel Support
) RETURNS void AS $$
DECLARE
    v_buyer_id UUID;
    v_seller_id UUID;
    v_caller_id UUID;
BEGIN
    -- 1. Identity Resolution
    v_caller_id := COALESCE(auth.uid(), p_user_id_override);

    -- 2. Security Policy (Protect against spoofing)
    IF auth.uid() IS NULL AND p_user_id_override IS NOT NULL AND current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Institutional Protocol Breach: Unauthorized Identity Override.';
    END IF;

    -- 3. Identify participants (V13.6 uses buyer_id)
    SELECT buyer_id, seller_id INTO v_buyer_id, v_seller_id
    FROM public.orders WHERE id = p_order_id;

    -- 4. Verify Authorization
    IF v_caller_id IS NULL OR (v_caller_id != v_buyer_id AND current_setting('role') != 'service_role') THEN
        RAISE EXCEPTION 'Protocol Authorization Failure: Unauthorized Participant.';
    END IF;

    -- 5. Atomically Lock the Transaction
    UPDATE public.orders SET is_disputed = true WHERE id = p_order_id;
    UPDATE public.seller_payouts SET is_disputed = true WHERE order_id = p_order_id;

    -- 6. Registry the Dispute Event
    INSERT INTO public.order_disputes (
        order_id, buyer_id, seller_id, reason, details
    ) VALUES (
        p_order_id, v_buyer_id, v_seller_id, p_reason, p_details
    );

    -- 7. Log System Event
    INSERT INTO public.system_events (event_type, source, status, user_id, reference_id)
    VALUES ('dispute_initialized', 'dispute_engine_v1.1', 'success', v_caller_id, p_order_id::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RCP: RESOLVE DISPUTE PROTOCOL (V1.1)
-- 🔐 ADVISORY: Only callable by Administrative Authority (Service Role).
CREATE OR REPLACE FUNCTION public.resolve_order_dispute(
    p_dispute_id UUID,
    p_action TEXT -- 'release' or 'refund'
) RETURNS void AS $$
DECLARE
    v_order_id UUID;
BEGIN
    -- 1. Authority Check
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Institutional Protocol Breach: Resolution requires Administrative Authority.';
    END IF;

    -- 2. Get the order ID
    SELECT order_id INTO v_order_id FROM public.order_disputes WHERE id = p_dispute_id;

    -- 3. Execute Resolution Protocol
    IF p_action = 'release' THEN
        -- UNLOCK FOR MERCHANT
        UPDATE public.orders SET is_disputed = false WHERE id = v_order_id;
        UPDATE public.seller_payouts SET is_disputed = false WHERE order_id = v_order_id;
        UPDATE public.order_disputes SET status = 'released', resolved_at = now() WHERE id = p_dispute_id;
        
    ELSIF p_action = 'refund' THEN
        -- RETURN TO BUYER
        UPDATE public.orders SET is_disputed = false, status = 'refunded' WHERE id = v_order_id;
        UPDATE public.seller_payouts SET is_disputed = false, status = 'reversed' WHERE order_id = v_order_id;
        UPDATE public.order_disputes SET status = 'refunded', resolved_at = now() WHERE id = p_dispute_id;
    
    ELSE
        RAISE EXCEPTION 'Protocol Failure: Unknown Resolution Action';
    END IF;

    -- 4. Log Resolution
    INSERT INTO public.system_events (event_type, source, status, reference_id, metadata)
    VALUES ('dispute_resolved', 'dispute_engine_v1.1', 'success', p_dispute_id::text, jsonb_build_object('action', p_action));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
