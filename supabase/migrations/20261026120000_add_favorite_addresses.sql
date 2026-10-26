create table if not exists public.favorite_addresses (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  label text not null,
  address text not null,
  detail text null,
  memo text null,
  lat double precision null,
  lon double precision null,
  use_count integer not null default 0,
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorite_addresses_owner_address_key unique (owner_phone, address)
);

create index if not exists idx_favorite_addresses_owner_used
  on public.favorite_addresses (owner_phone, use_count desc, last_used_at desc nulls last);

alter table public.favorite_addresses enable row level security;

create policy "favorite_addresses_select_own" on public.favorite_addresses
for select to authenticated
using (owner_phone = auth.jwt() ->> 'phone');

create policy "favorite_addresses_insert_own" on public.favorite_addresses
for insert to authenticated
with check (owner_phone = auth.jwt() ->> 'phone');

create policy "favorite_addresses_update_own" on public.favorite_addresses
for update to authenticated
using (owner_phone = auth.jwt() ->> 'phone')
with check (owner_phone = auth.jwt() ->> 'phone');

create policy "favorite_addresses_delete_own" on public.favorite_addresses
for delete to authenticated
using (owner_phone = auth.jwt() ->> 'phone');
