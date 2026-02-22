create table if not exists public.signup_requests (
  phone text primary key,
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by text null
);

create index if not exists idx_signup_requests_status_created_at
  on public.signup_requests(status, created_at desc);

alter table public.signup_requests enable row level security;

drop policy if exists signup_requests_no_client_read on public.signup_requests;
create policy signup_requests_no_client_read on public.signup_requests
for select to authenticated
using (false);

drop policy if exists signup_requests_no_client_write on public.signup_requests;
create policy signup_requests_no_client_write on public.signup_requests
for all to authenticated
using (false)
with check (false);
