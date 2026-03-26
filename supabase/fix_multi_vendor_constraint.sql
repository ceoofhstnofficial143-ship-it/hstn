-- 🔧 FIX: Remove unique_payment_id constraint from orders table
-- REASON: Multi-vendor marketplace creates multiple orders per payment (one per seller)
-- The payments table already has the unique constraint for idempotency

-- Drop the problematic constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS unique_payment_id;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_id_key;

-- Idempotency is already handled by:
-- 1. payments table unique constraint on payment_id
-- 2. RPC function check at line 61: IF EXISTS (SELECT 1 FROM orders WHERE payment_id = p_payment_id)
-- 3. Advisory lock at line 59: PERFORM pg_advisory_xact_lock(hashtext(p_payment_id))

-- Verify the constraint is removed
SELECT 
    tc.constraint_name,
    tc.table_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'orders' 
AND tc.constraint_type = 'UNIQUE';
