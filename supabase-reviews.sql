-- Reviews: schema + RLS so only real buyers can review.

begin;

create extension if not exists pgcrypto;

-- Create table if missing (or keep existing)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  user_id uuid not null,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text not null,
  photo_url text,
  user_name text,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- Public can read reviews (safe: reviews are public content)
drop policy if exists "public_read_reviews" on public.reviews;
create policy "public_read_reviews"
on public.reviews
for select
using (true);

-- Only allow insert if:
-- - user is inserting as themselves
-- - they have a delivered order for this product
drop policy if exists "buyer_can_review_delivered" on public.reviews;
create policy "buyer_can_review_delivered"
on public.reviews
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.orders o
    where o.buyer_id = auth.uid()
      and o.product_id = product_id
      and o.status = 'delivered'
  )
);

-- Allow users to edit/delete their own reviews (optional but useful)
drop policy if exists "user_update_own_review" on public.reviews;
create policy "user_update_own_review"
on public.reviews
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_delete_own_review" on public.reviews;
create policy "user_delete_own_review"
on public.reviews
for delete
using (auth.uid() = user_id);

commit;

