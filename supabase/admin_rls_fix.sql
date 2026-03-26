-- 🛡️ HSTNLX DISPUTE HUB VISIBILITY ALIGNMENT
-- Unlocks RLS blindspots for admins so conflicts render properly

ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all disputes" ON public.order_disputes;
CREATE POLICY "Admins can view all disputes" ON public.order_disputes 
FOR ALL USING (
  is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view their own disputes" ON public.order_disputes;
CREATE POLICY "Users can view their own disputes" ON public.order_disputes 
FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all payouts" ON public.seller_payouts;
CREATE POLICY "Admins can view all payouts" ON public.seller_payouts 
FOR ALL USING (
  is_admin(auth.uid())
);
