-- Growth + Governance completion pack:
-- - Auto-approval thresholds (server-side)
-- - Admin trust overrides with audit logs
-- - Fit feedback stats capture
-- - Admin read policies for governance tables

begin;

create extension if not exists pgcrypto;

-- Ensure key columns exist ---------------------------------------------------

alter table public.products
  add column if not exists admin_status text,
  add column if not exists review_reason text;

alter table public.profiles
  add column if not exists role text,
  add column if not exists is_banned boolean default false;

-- Governance tables ----------------------------------------------------------

create table if not exists public.trust_override_logs (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  admin_id uuid,
  old_score int4,
  new_score int4 not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.trust_override_logs enable row level security;

drop policy if exists "admin_read_trust_override_logs" on public.trust_override_logs;
create policy "admin_read_trust_override_logs"
on public.trust_override_logs
for select
using (public.is_admin());

drop policy if exists "seller_read_own_trust_override_logs" on public.trust_override_logs;
create policy "seller_read_own_trust_override_logs"
on public.trust_override_logs
for select
using (seller_id = auth.uid());

-- Fit stats table (if you already have it, this won't change it)
create table if not exists public.seller_fit_stats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  seller_id uuid not null,
  fit_feedback text,
  created_at timestamptz not null default now()
);

alter table public.seller_fit_stats enable row level security;

-- Allow admin read fit stats
drop policy if exists "admin_read_seller_fit_stats" on public.seller_fit_stats;
create policy "admin_read_seller_fit_stats"
on public.seller_fit_stats
for select
using (public.is_admin());

-- Trust application helper: now writes audit log -----------------------------

create or replace function public.apply_trust_event(p_user_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta int;
  v_existing int;
  v_new int;
begin
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
  from public.trust_scores
  where user_id = p_user_id;

  if not found then
    v_existing := 50;
  end if;

  v_new := greatest(0, least(200, v_existing + v_delta));

  insert into public.trust_scores (user_id, score, verified)
  values (p_user_id, v_new, v_new >= 50)
  on conflict (user_id)
  do update set
    score = excluded.score,
    verified = excluded.verified;

  insert into public.trust_override_logs (seller_id, admin_id, old_score, new_score, reason)
  values (p_user_id, null, v_existing, v_new, p_event);
end;
$$;

revoke all on function public.apply_trust_event(uuid, text) from public;

-- Admin trust override function ---------------------------------------------

create or replace function public.admin_set_trust_score(p_seller_id uuid, p_new_score int, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old int;
  v_new int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  v_new := greatest(0, least(200, p_new_score));

  select score into v_old
  from public.trust_scores
  where user_id = p_seller_id;

  insert into public.trust_scores (user_id, score, verified)
  values (p_seller_id, v_new, v_new >= 50)
  on conflict (user_id)
  do update set
    score = excluded.score,
    verified = excluded.verified;

  insert into public.trust_override_logs (seller_id, admin_id, old_score, new_score, reason)
  values (p_seller_id, auth.uid(), v_old, v_new, coalesce(p_reason, 'ADMIN_OVERRIDE'));
end;
$$;

grant execute on function public.admin_set_trust_score(uuid, int, text) to authenticated;

-- Auto-approval: server decides admin_status at insert time ------------------
-- Threshold: sellers with trust >= 100 AND a video listing get auto-approved.

create or replace function public.trg_products_auto_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score int;
  v_banned boolean;
begin
  -- Default status
  if new.admin_status is null then
    new.admin_status := 'pending';
  end if;

  -- Admins can set any status
  if public.is_admin() then
    return new;
  end if;

  -- Banned sellers can never auto-approve
  select coalesce(is_banned, false) into v_banned
  from public.profiles
  where id = new.user_id;

  if v_banned then
    new.admin_status := 'pending';
    return new;
  end if;

  select coalesce(score, 0) into v_score
  from public.trust_scores
  where user_id = new.user_id;

  if v_score >= 100 and new.video_url is not null then
    new.admin_status := 'approved';
  else
    new.admin_status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists products_auto_approve_trigger on public.products;
create trigger products_auto_approve_trigger
before insert on public.products
for each row
execute function public.trg_products_auto_approve();

-- Fit stats capture ----------------------------------------------------------
create or replace function public.trg_orders_fit_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.fit_feedback is not null and old.fit_feedback is null then
      insert into public.seller_fit_stats (product_id, seller_id, fit_feedback)
      values (new.product_id, new.seller_id, new.fit_feedback);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_fit_stats_trigger on public.orders;
create trigger orders_fit_stats_trigger
after update of fit_feedback on public.orders
for each row
execute function public.trg_orders_fit_stats();

commit;

