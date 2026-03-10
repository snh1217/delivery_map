create table if not exists public.development_requests (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  title text not null,
  body text not null,
  status text not null default 'pending',
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by text null
);

create index if not exists development_requests_owner_phone_idx
  on public.development_requests (owner_phone, created_at desc);

alter table public.development_requests enable row level security;

drop policy if exists development_requests_select_own on public.development_requests;
create policy development_requests_select_own
  on public.development_requests
  for select
  using (false);

drop policy if exists development_requests_insert_own on public.development_requests;
create policy development_requests_insert_own
  on public.development_requests
  for insert
  with check (false);

drop policy if exists development_requests_update_admin on public.development_requests;
create policy development_requests_update_admin
  on public.development_requests
  for update
  using (false)
  with check (false);
