create table if not exists public.earning_targets (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  target_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_phone, target_name)
);

create table if not exists public.daily_earnings (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  target_id uuid null references public.earning_targets(id) on delete set null,
  target_name text not null,
  ymd text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_phone, ymd, target_name)
);

create index if not exists idx_earning_targets_owner_active on public.earning_targets(owner_phone, is_active);
create index if not exists idx_daily_earnings_owner_ymd on public.daily_earnings(owner_phone, ymd);

alter table public.earning_targets enable row level security;
alter table public.daily_earnings enable row level security;

drop policy if exists earning_targets_owner_select on public.earning_targets;
create policy earning_targets_owner_select on public.earning_targets
for select to authenticated
using (owner_phone = (auth.jwt() ->> 'phone'));

drop policy if exists earning_targets_owner_insert on public.earning_targets;
create policy earning_targets_owner_insert on public.earning_targets
for insert to authenticated
with check (owner_phone = (auth.jwt() ->> 'phone'));

drop policy if exists earning_targets_owner_update on public.earning_targets;
create policy earning_targets_owner_update on public.earning_targets
for update to authenticated
using (owner_phone = (auth.jwt() ->> 'phone'))
with check (owner_phone = (auth.jwt() ->> 'phone'));

drop policy if exists daily_earnings_owner_select on public.daily_earnings;
create policy daily_earnings_owner_select on public.daily_earnings
for select to authenticated
using (owner_phone = (auth.jwt() ->> 'phone'));

drop policy if exists daily_earnings_owner_insert on public.daily_earnings;
create policy daily_earnings_owner_insert on public.daily_earnings
for insert to authenticated
with check (owner_phone = (auth.jwt() ->> 'phone'));

drop policy if exists daily_earnings_owner_update on public.daily_earnings;
create policy daily_earnings_owner_update on public.daily_earnings
for update to authenticated
using (owner_phone = (auth.jwt() ->> 'phone'))
with check (owner_phone = (auth.jwt() ->> 'phone'));

