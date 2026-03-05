-- Enable RLS on core tables
alter table products            enable row level security;
alter table orders              enable row level security;
alter table trust_scores        enable row level security;
alter table profiles            enable row level security;
alter table wishlist            enable row level security;
alter table seller_fit_stats    enable row level security;

-- Helper: safe admin check without RLS recursion ----------------------------
-- Uses SECURITY DEFINER so it can read `profiles` without triggering policies.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- PRODUCTS ------------------------------------------------------------------

-- Public can only read approved products
create policy "public_select_approved_products"
on products
for select
using (admin_status = 'approved');

-- Sellers can insert products only for themselves
create policy "seller_insert_own_products"
on products
for insert
with check (auth.uid() = user_id);

-- Sellers can update their own products
create policy "seller_update_own_products"
on products
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Admins have full access to products
create policy "admin_full_products"
on products
for all
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- TRUST SCORES --------------------------------------------------------------

alter table trust_scores enable row level security;

-- Anyone can read trust scores (you can tighten later)
create policy "public_read_trust_scores"
on trust_scores
for select
using (true);

-- Do NOT define insert/update/delete policies for normal users:
-- writes must go through the RPC below running as security definer.

-- PROFILES ------------------------------------------------------------------

create policy "user_select_own_profile"
on profiles
for select
using (id = auth.uid());

create policy "user_update_own_profile"
on profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "admin_full_profiles"
on profiles
for all
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- ORDERS --------------------------------------------------------------------

create policy "buyer_select_own_orders"
on orders
for select
using (buyer_id = auth.uid());

create policy "seller_select_own_orders"
on orders
for select
using (seller_id = auth.uid());

create policy "buyer_update_own_orders"
on orders
for update
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

create policy "seller_update_own_orders"
on orders
for update
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

create policy "admin_full_orders"
on orders
for all
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- WISHLIST ------------------------------------------------------------------

create policy "wishlist_user_crud"
on wishlist
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- SELLER FIT STATS ----------------------------------------------------------

create policy "seller_fit_stats_owner"
on seller_fit_stats
for all
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

-- TRUST ENGINE RPC ----------------------------------------------------------

create or replace function update_trust_score(p_user_id uuid, p_event text)
returns void
language plpgsql
security definer
as $$
declare
  v_delta int;
  v_existing int;
  v_new int;
begin
  -- Map events to deltas
  select case p_event
           when 'DELIVERY_SUCCESS' then 5
           when 'CANCELLATION'     then -15
           when 'WRONG_PRODUCT'    then -25
           when 'LATE_SHIPMENT'    then -10
           when 'POOR_VIDEO'       then -5
           when 'ACCURATE_SIZE'    then 2
           when 'SIZE_ANOMALY'     then -3
           else 0
         end
  into v_delta;

  if v_delta = 0 then
    return;
  end if;

  select score into v_existing
  from trust_scores
  where user_id = p_user_id;

  if not found then
    v_existing := 50;
  end if;

  v_new := greatest(0, least(200, v_existing + v_delta));

  insert into trust_scores (user_id, score, verified)
  values (p_user_id, v_new, v_new >= 50)
  on conflict (user_id)
  do update set
    score = excluded.score,
    verified = excluded.verified;
end;
$$;

