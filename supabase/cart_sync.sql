-- 🛒 HSTNLX CART SYNC PROTOCOL
-- Enables device-agnostic shopping by persisting cart state in the cloud.

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    size TEXT,
    color TEXT,
    seller_id UUID REFERENCES auth.users(id), -- Distributed fulfillment key
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Prevents duplicate entries for the same product configuration
    UNIQUE (user_id, product_id, size, color) 
);

-- Row Level Security
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own carts" 
ON public.carts FOR ALL 
USING (auth.uid() = user_id);

-- 🏹 SYNC FUNCTION (Idempotent Merge)
CREATE OR REPLACE FUNCTION public.sync_cart_items(
    p_items JSONB,
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.carts (user_id, product_id, quantity, size, color, seller_id)
        VALUES (
            p_user_id,
            (v_item->>'productId')::UUID,
            COALESCE((v_item->>'qty')::INTEGER, 1),
            v_item->>'size',
            v_item->>'color',
            (v_item->>'seller_id')::UUID
        )
        ON CONFLICT (user_id, product_id, size, color) 
        DO UPDATE SET 
            quantity = public.carts.quantity + EXCLUDED.quantity,
            updated_at = now();
    END LOOP;
END;
$$;
