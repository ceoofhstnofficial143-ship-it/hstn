-- 💎 HSTNLX FINANCIAL SETTLEMENT & REVERSAL PROTOCOL
-- Governing the lifecycle of multi-vendor capital movement.

-- 1. EXTEND PAYMENTS FOR REVERSALS
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS refund_id TEXT,
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none', -- none | pending | processed | failed
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;

-- 2. REFINE SELLER PAYOUTS
-- Payouts transition from 'pending' (at order) -> 'eligible' (at delivery) -> 'processed' (at bank transfer)
ALTER TABLE public.seller_payouts 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settlement_ref TEXT; -- Razorpay X / Bank Reference

-- 3. UPGRADE ORDER STATE MACHINE
-- Ensure 'cancelled' and 'refunded' are valid institutional states
DO $$ 
BEGIN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 4. ELIGIBILITY TRIGGER (Automatic Liability Elevation)
-- Logic: A seller becomes eligible for payout ONLY AFTER the buyer confirms delivery.
CREATE OR REPLACE FUNCTION public.mark_payout_eligible_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE public.seller_payouts
        SET status = 'eligible'
        WHERE order_id = NEW.id AND status = 'pending';
    END IF;
    
    -- Safety: If order is cancelled/refunded, block payout
    IF NEW.status IN ('cancelled', 'refunded') THEN
        UPDATE public.seller_payouts
        SET status = 'cancelled'
        WHERE order_id = NEW.id AND status != 'processed';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_order_delivery_payout ON public.orders;
CREATE TRIGGER tr_order_delivery_payout
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_payout_eligible_on_delivery();
