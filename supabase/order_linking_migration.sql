-- Update orders table to link with the new addresses system
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES public.addresses(id);

-- Update order_items to include seller_id for granular payouts and splitting
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);

-- Optional: Migrate existing seller_id from orders to order_items for consistency (if data exists)
-- UPDATE public.order_items oi SET seller_id = o.seller_id FROM public.orders o WHERE oi.order_id = o.id AND oi.seller_id IS NULL;

-- Enable RLS for order_items if not already enabled
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Item-level policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own order items') THEN
        CREATE POLICY "Users can view their own order items" ON public.order_items
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.orders 
                WHERE public.orders.id = public.order_items.order_id 
                AND (public.orders.buyer_id = auth.uid() OR public.orders.seller_id = auth.uid())
            )
        );
    END IF;
END $$;
