create table if not exists public.call_time_estimates (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now(),
  call_time text not null,
  deadline_label text not null,
  longest_leg_min integer not null default 0,
  adjusted_drive_min integer not null default 0,
  pickup_min integer not null default 20,
  total_required_min integer not null default 0,
  reference_leg text not null,
  route_legs jsonb not null default '[]'::jsonb
);

create index if not exists call_time_estimates_phone_created_idx
  on public.call_time_estimates (phone, created_at desc);

alter table public.call_time_estimates enable row level security;

drop policy if exists call_time_estimates_select_own on public.call_time_estimates;
create policy call_time_estimates_select_own
  on public.call_time_estimates
  for select
  using (false);

drop policy if exists call_time_estimates_insert_own on public.call_time_estimates;
create policy call_time_estimates_insert_own
  on public.call_time_estimates
  for insert
  with check (false);
