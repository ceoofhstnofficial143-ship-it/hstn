-- Trust automation: remove client-writable RPC, apply trust via DB triggers.

begin;

-- 1) Remove the insecure public RPC if it exists
drop function if exists public.update_trust_score(uuid, text);

-- 1.5) Ensure required order columns exist (used by app + triggers)
alter table public.orders
  add column if not exists status text,
  add column if not exists seller_id uuid,
  add column if not exists buyer_id uuid,
  add column if not exists fit_feedback text,
  add column if not exists dispute_status text,
  add column if not exists dispute_reason text;

-- 2) Internal helper to apply a trust event (not granted to clients)
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
end;
$$;

revoke all on function public.apply_trust_event(uuid, text) from public;

-- 3) Orders trigger: trust evolves from real order lifecycle
create or replace function public.trg_orders_trust()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delivery confirmation => positive trust
  if (tg_op = 'UPDATE') then
    if new.status = 'delivered' and (old.status is distinct from 'delivered') then
      perform public.apply_trust_event(new.seller_id, 'DELIVERY_SUCCESS');
    end if;

    -- Fit feedback (only first time)
    if new.fit_feedback is not null and old.fit_feedback is null then
      if new.fit_feedback = 'Perfect' then
        perform public.apply_trust_event(new.seller_id, 'ACCURATE_SIZE');
      else
        perform public.apply_trust_event(new.seller_id, 'SIZE_ANOMALY');
      end if;
    end if;

    -- Dispute submitted (only first time)
    if new.dispute_status = 'review' and (old.dispute_status is distinct from 'review') then
      if new.dispute_reason = 'wrong_item' then
        perform public.apply_trust_event(new.seller_id, 'WRONG_PRODUCT');
      elsif new.dispute_reason = 'size_issue' then
        perform public.apply_trust_event(new.seller_id, 'SIZE_ANOMALY');
      elsif new.dispute_reason = 'color_mismatch' then
        perform public.apply_trust_event(new.seller_id, 'POOR_VIDEO');
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_trust_trigger on public.orders;
create trigger orders_trust_trigger
after update of status, fit_feedback, dispute_status, dispute_reason
on public.orders
for each row
execute function public.trg_orders_trust();

-- 4) Products trigger: admin rejection => trust penalty
create or replace function public.trg_products_trust()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.admin_status = 'rejected' and (old.admin_status is distinct from 'rejected') then
      perform public.apply_trust_event(new.user_id, 'POOR_VIDEO');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_trust_trigger on public.products;
create trigger products_trust_trigger
after update of admin_status
on public.products
for each row
execute function public.trg_products_trust();

commit;

