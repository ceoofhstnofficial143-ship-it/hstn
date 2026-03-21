-- ⚔️ HSTNLX REPAIR: PAYOUT RELATIONSHIP SYNCHRONIZATION
-- Links the financial ledger (seller_payouts) directly to identity records (profiles).

ALTER TABLE public.seller_payouts 
DROP CONSTRAINT IF EXISTS seller_payouts_seller_id_fkey;

ALTER TABLE public.seller_payouts 
ADD CONSTRAINT seller_payouts_seller_id_fkey 
FOREIGN KEY (seller_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 🛡️ AUDIT: Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
