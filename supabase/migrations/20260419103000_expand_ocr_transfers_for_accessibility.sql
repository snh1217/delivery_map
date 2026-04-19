alter table public.ocr_transfers
  add column if not exists normalized_address text null,
  add column if not exists transfer_type text not null default 'ocr',
  add column if not exists provider_hint text null,
  add column if not exists source_device text null,
  add column if not exists target_device text null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'ocr_transfers_transfer_type_check'
  ) then
    alter table public.ocr_transfers drop constraint ocr_transfers_transfer_type_check;
  end if;
end $$;

alter table public.ocr_transfers
  add constraint ocr_transfers_transfer_type_check
  check (transfer_type in ('ocr', 'accessibility', 'clipboard'));

update public.ocr_transfers
set normalized_address = coalesce(nullif(normalized_address, ''), extracted_text)
where normalized_address is null;