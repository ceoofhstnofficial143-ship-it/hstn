ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tracking_provider TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT;
