-- Create addresses table
create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  full_name text not null,
  phone_number text not null,

  address_line1 text not null,
  address_line2 text,
  landmark text,

  city text not null,
  state text not null,
  country text default 'India',
  pincode text not null,

  label text default 'home', -- 'home', 'work', 'other'

  latitude float,
  longitude float,

  is_default boolean default false,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table addresses enable row level security;

-- Policies
create policy "Users can view their own addresses"
  on addresses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own addresses"
  on addresses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own addresses"
  on addresses for update
  using (auth.uid() = user_id);

create policy "Users can delete their own addresses"
  on addresses for delete
  using (auth.uid() = user_id);

-- Index for performance
create index if not exists addresses_user_id_idx on addresses(user_id);
create index if not exists addresses_is_default_idx on addresses(is_default);

-- Trigger to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_addresses_updated_at
    before update on addresses
    for each row
    execute procedure update_updated_at_column();
