-- 🔒 HSTNLX CONCURRENCY & TRANSACTION LOCK ENGINE
-- Prevents double-order initialization and race conditions at the platform level.

CREATE TABLE IF NOT EXISTS public.checkout_locks (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    lock_id TEXT NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT now()
);

-- Function to acquire a checkout lock
CREATE OR REPLACE FUNCTION public.acquire_checkout_lock(p_user_id UUID, p_lock_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_existing_lock_at TIMESTAMPTZ;
BEGIN
  -- Check if a lock exists and is less than 2 minutes old
  SELECT locked_at INTO v_existing_lock_at FROM public.checkout_locks WHERE user_id = p_user_id;
  
  IF v_existing_lock_at IS NOT NULL AND v_existing_lock_at > now() - interval '2 minutes' THEN
    RETURN FALSE; -- Lock is active, deny request
  END IF;

  -- Create or update the lock
  INSERT INTO public.checkout_locks (user_id, lock_id, locked_at)
  VALUES (p_user_id, p_lock_id, now())
  ON CONFLICT (user_id) DO UPDATE 
  SET lock_id = p_lock_id, locked_at = now();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release a checkout lock (after success/failure)
CREATE OR REPLACE FUNCTION public.release_checkout_lock(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.checkout_locks WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
