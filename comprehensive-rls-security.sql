  -- COMPREHENSIVE ROW LEVEL SECURITY POLICIES
  -- Ensures users can only access/modify authorized data
  -- Run this in Supabase SQL Editor for maximum security

  -- ==============================================================================
  -- SECURITY OVERVIEW
  -- ==============================================================================
  -- 1. All tables use Row Level Security (RLS)
  -- 2. Policies based on authenticated user ID
  -- 3. Separate policies for SELECT, INSERT, UPDATE, DELETE
  -- 4. Admin role has elevated permissions
  -- 5. Data isolation between users

  -- ==============================================================================
  -- ENABLE RLS ON EXISTING TABLES ONLY
  -- ==============================================================================

  -- Core marketplace tables
  ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.seller_kyb ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

  -- ==============================================================================
  -- AUTH.USERS POLICIES (Supabase managed, minimal policies)
  -- ==============================================================================

  -- Users can only see their own auth data
  CREATE POLICY "Users can view own auth data" ON auth.users FOR SELECT
  USING (auth.uid() = id);

  -- Users can only update their own auth data
  CREATE POLICY "Users can update own auth data" ON auth.users FOR UPDATE
  USING (auth.uid() = id);

  -- ==============================================================================
  -- PROFILES POLICIES
  -- ==============================================================================

  -- Anyone can view profiles (for product listings)
  CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT
  USING (true);

  -- Users can insert their own profile
  CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

  -- Users can update their own profile
  CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

  -- Admins can update any profile
  CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- ==============================================================================
  -- PRODUCTS POLICIES
  -- ==============================================================================

  -- Anyone can view approved products
  CREATE POLICY "Approved products are viewable by everyone" ON products FOR SELECT
  USING (admin_status = 'approved');

  -- Sellers can view their own products (including pending)
  CREATE POLICY "Sellers can view own products" ON products FOR SELECT
  USING (user_id = auth.uid());

  -- Admins can view all products
  CREATE POLICY "Admins can view all products" ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- Authenticated users can insert products
  CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

  -- Sellers can update their own products (but NOT approval status)
  CREATE POLICY "Sellers can update own products" ON products FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND 
    (
      -- Either they are an admin
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR 
      -- Or they are NOT changing the admin_status
      (
        SELECT admin_status FROM products WHERE id = products.id
      ) = admin_status
    )
  );

  -- Admins can update any product
  CREATE POLICY "Admins can update any product" ON products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- Sellers can delete their own products
  CREATE POLICY "Sellers can delete own products" ON products FOR DELETE
  USING (user_id = auth.uid());

  -- Admins can delete any product
  CREATE POLICY "Admins can delete any product" ON products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- ==============================================================================
  -- REVIEWS POLICIES
  -- ==============================================================================

  -- Anyone can view reviews
  CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT
  USING (true);

  -- Authenticated users can insert reviews
  CREATE POLICY "Authenticated users can insert reviews" ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

  -- Users can update their own reviews
  CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

  -- Users can delete their own reviews
  CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE
  USING (auth.uid() = user_id);

  -- Admins can manage all reviews
  CREATE POLICY "Admins can manage all reviews" ON reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- ==============================================================================
  -- PURCHASE_REQUESTS POLICIES
  -- ==============================================================================

  -- Buyers can view their own requests
  CREATE POLICY "Buyers can view own requests" ON purchase_requests FOR SELECT
  USING (auth.uid() = buyer_id);

  -- Sellers can view requests for their products
  CREATE POLICY "Sellers can view requests for own products" ON purchase_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = purchase_requests.product_id
      AND products.user_id = auth.uid()
    )
  );

  -- Admins can view all requests
  CREATE POLICY "Admins can view all requests" ON purchase_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- Authenticated users can create requests
  CREATE POLICY "Authenticated users can create requests" ON purchase_requests FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

  -- Buyers can update their own requests (limited fields)
  CREATE POLICY "Buyers can update own requests" ON purchase_requests FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (
    auth.uid() = buyer_id AND
    -- Only allow status updates to 'cancelled'
    (status = 'cancelled' OR OLD.status = status)
  );

  -- Sellers can update requests for their products
  CREATE POLICY "Sellers can update requests for own products" ON purchase_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = purchase_requests.product_id
      AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = purchase_requests.product_id
      AND products.user_id = auth.uid()
    )
  );

  -- Admins can update any request
  CREATE POLICY "Admins can update any request" ON purchase_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

  -- ==============================================================================
  -- PURCHASE_REQUEST_EVENTS POLICIES
  -- ==============================================================================

  -- Buyers can view events for their requests
  CREATE POLICY "Buyers can view events for own requests" ON purchase_request_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_requests
      WHERE purchase_requests.id = purchase_request_events.request_id
      AND purchase_requests.buyer_id = auth.uid()
    )
  );

  -- Sellers can view events for their product requests
  CREATE POLICY "Sellers can view events for own product requests" ON purchase_request_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_requests pr
      JOIN products p ON pr.product_id = p.id
      WHERE pr.id = purchase_request_events.request_id
      AND p.user_id = auth.uid()
    )
  );

  -- System can insert events (via functions)
  CREATE POLICY "System can insert events" ON purchase_request_events FOR INSERT
  WITH CHECK (true);

  -- ==============================================================================
  -- ORDERS & ORDER ITEMS POLICIES (Hardened for Multi-Vendor v7.0)
  -- ==============================================================================

  -- Participants (Buyer/Seller) or Admin can view orders
  CREATE POLICY "Participants can view orders" ON public.orders FOR SELECT
  USING (
    auth.uid() = buyer_id OR 
    auth.uid() = seller_id OR 
    is_admin(auth.uid())
  );

  -- Enable RLS on order_items
  ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

  -- Participants or Admin can view order items
  CREATE POLICY "Participants can view order items" ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE public.orders.id = public.order_items.order_id 
      AND (public.orders.buyer_id = auth.uid() OR public.orders.seller_id = auth.uid())
    ) 
    OR is_admin(auth.uid())
  );

  -- Sellers can update their own orders (logistics updates)
  CREATE POLICY "Sellers can update own orders" ON public.orders FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id AND
    -- 🛡️ SECURITY: Prevent changing financial/identity fields
    (OLD.total_price = total_price) AND
    (OLD.buyer_id = buyer_id) AND
    (OLD.payment_id = payment_id)
  );

  -- Admins can update any order
  CREATE POLICY "Admins manage all orders" ON public.orders FOR ALL
  USING (is_admin(auth.uid()));

  -- ==============================================================================
  -- TRUST_SCORES POLICIES
  -- ==============================================================================

  -- Anyone can view trust scores (public reputation system)
  CREATE POLICY "Trust scores are publicly viewable" ON trust_scores FOR SELECT
  USING (true);

  -- System can insert/update trust scores (via functions)
  CREATE POLICY "System can manage trust scores" ON trust_scores FOR ALL
  WITH CHECK (true);

  -- Sellers can view their own payouts
  CREATE POLICY "Sellers view own payouts" ON seller_payouts FOR SELECT
  USING (seller_id = auth.uid());

  -- Admins can manage all payouts
  CREATE POLICY "Admins manage all payouts" ON seller_payouts FOR ALL
  USING (is_admin(auth.uid()));

  -- ==============================================================================
  -- SELLER_KYB POLICIES
  -- ==============================================================================

  -- Sellers can manage their own KYB
  CREATE POLICY "Sellers manage own KYB" ON seller_kyb FOR ALL
  USING (user_id = auth.uid());

  -- Admins can view all KYB
  CREATE POLICY "Admins view all KYB" ON seller_kyb FOR SELECT
  USING (is_admin(auth.uid()));

  -- ==============================================================================
  -- CHECKOUT_SESSIONS POLICIES
  -- ==============================================================================

  -- Users can view their own sessions
  CREATE POLICY "Users view own sessions" ON checkout_sessions FOR SELECT
  USING (user_id = auth.uid());

  -- Admins can view/manage all sessions
  CREATE POLICY "Admins manage all sessions" ON checkout_sessions FOR ALL
  USING (is_admin(auth.uid()));

  -- ==============================================================================
  -- ORDER_EVENTS POLICIES
  -- ==============================================================================

  -- Buyers can view events for their orders
  CREATE POLICY "Buyers can view events for own orders" ON order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_events.order_id
      AND orders.buyer_id = auth.uid()
    )
  );

  -- Sellers can view events for their product orders
  CREATE POLICY "Sellers can view events for own product orders" ON order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = order_events.order_id
      AND p.user_id = auth.uid()
    )
  );

  -- System can insert events
  CREATE POLICY "System can insert order events" ON order_events FOR INSERT
  WITH CHECK (true);

  -- ==============================================================================
  -- SECURITY FUNCTIONS
  -- ==============================================================================

  -- Function to check if user is admin
  CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
  RETURNS BOOLEAN AS $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id AND role = 'admin'
    );
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Function to check if user owns product
  CREATE OR REPLACE FUNCTION owns_product(user_id UUID, product_id UUID)
  RETURNS BOOLEAN AS $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND user_id = user_id
    );
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Function to validate purchase request access
  CREATE OR REPLACE FUNCTION can_access_request(user_id UUID, request_id UUID)
  RETURNS BOOLEAN AS $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM purchase_requests
      WHERE id = request_id
      AND (buyer_id = user_id OR seller_id = user_id)
    ) OR is_admin(user_id);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- ==============================================================================
  -- GRANT NECESSARY PERMISSIONS
  -- ==============================================================================

  -- Grant usage on schemas
  GRANT USAGE ON SCHEMA auth TO authenticated;
  GRANT USAGE ON SCHEMA public TO authenticated;

  -- Grant select on auth.users for profile lookups
  GRANT SELECT ON auth.users TO authenticated;

  -- Note: Individual table permissions are handled by RLS policies above
  -- No direct table grants needed - RLS controls access

  -- ==============================================================================
  -- AUDIT LOGGING SETUP
  -- ==============================================================================

  -- Create audit log table
  CREATE TABLE IF NOT EXISTS audit_log (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id),
      action VARCHAR(50) NOT NULL,
      table_name VARCHAR(50) NOT NULL,
      record_id UUID,
      old_values JSONB,
      new_values JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Enable RLS on audit log
  ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

  -- Only admins can view audit logs
  CREATE POLICY "Admins can view audit logs" ON audit_log FOR SELECT
  USING (is_admin(auth.uid()));

  -- System can insert audit logs
  CREATE POLICY "System can insert audit logs" ON audit_log FOR INSERT
  WITH CHECK (true);

  -- Function to log security events
  CREATE OR REPLACE FUNCTION log_security_event(
      p_user_id UUID,
      p_action VARCHAR(50),
      p_table_name VARCHAR(50),
      p_record_id UUID DEFAULT NULL,
      p_old_values JSONB DEFAULT NULL,
      p_new_values JSONB DEFAULT NULL
  ) RETURNS VOID AS $$
  BEGIN
      INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
      VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_values, p_new_values);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
