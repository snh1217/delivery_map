create table if not exists public.ocr_transfers (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  sender_phone text null,
  extracted_text text not null,
  raw_text text null,
  source text not null default 'extractor' check (source in ('extractor', 'admin-panel', 'destination-row')),
  status text not null default 'pending' check (status in ('pending', 'consumed', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consumed_at timestamptz null
);

create index if not exists idx_ocr_transfers_owner_created on public.ocr_transfers (owner_phone, created_at desc);
create index if not exists idx_ocr_transfers_owner_status on public.ocr_transfers (owner_phone, status, created_at desc);

alter table public.ocr_transfers enable row level security;

create policy "ocr_transfers_select_own" on public.ocr_transfers
for select to authenticated
using (owner_phone = auth.jwt() ->> 'phone');

create policy "ocr_transfers_insert_own" on public.ocr_transfers
for insert to authenticated
with check (owner_phone = auth.jwt() ->> 'phone');

create policy "ocr_transfers_update_own" on public.ocr_transfers
for update to authenticated
using (owner_phone = auth.jwt() ->> 'phone')
with check (owner_phone = auth.jwt() ->> 'phone');
