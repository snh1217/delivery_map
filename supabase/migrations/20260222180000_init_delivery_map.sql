-- delivery_map schema
create extension if not exists pgcrypto;

create table if not exists public.allowlist (
  phone text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now(),
  user_agent text null
);

create index if not exists idx_login_logs_created_at on public.login_logs(created_at desc);

alter table public.allowlist enable row level security;
alter table public.login_logs enable row level security;

drop policy if exists allowlist_read_self on public.allowlist;
create policy allowlist_read_self on public.allowlist
for select to authenticated
using (phone = (auth.jwt() ->> 'phone'));

drop policy if exists allowlist_no_client_write on public.allowlist;
create policy allowlist_no_client_write on public.allowlist
for all to authenticated
using (false)
with check (false);

drop policy if exists login_logs_no_client_read on public.login_logs;
create policy login_logs_no_client_read on public.login_logs
for select to authenticated
using (false);

drop policy if exists login_logs_no_client_write on public.login_logs;
create policy login_logs_no_client_write on public.login_logs
for insert to authenticated
with check (false);