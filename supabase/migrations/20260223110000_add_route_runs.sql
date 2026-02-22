create table if not exists public.route_runs (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now(),
  provider text not null check (provider in ('naver', 'kakao')),
  batch_label text null,
  destination_count integer not null default 0,
  final_short_list text[] null,
  final_short_list_text text null,
  route_stops jsonb not null default '[]'::jsonb
);

create index if not exists idx_route_runs_phone_created_at
  on public.route_runs(phone, created_at desc);

create index if not exists idx_route_runs_created_at
  on public.route_runs(created_at desc);

alter table public.route_runs enable row level security;

drop policy if exists route_runs_no_client_read on public.route_runs;
create policy route_runs_no_client_read on public.route_runs
for select to authenticated
using (false);

drop policy if exists route_runs_no_client_write on public.route_runs;
create policy route_runs_no_client_write on public.route_runs
for all to authenticated
using (false)
with check (false);

