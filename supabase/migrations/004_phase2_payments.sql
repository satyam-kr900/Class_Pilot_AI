-- ============================================================================
-- ClassPilot AI — 004 Phase 2 payments safety (idempotency + receipt uniqueness)
-- Run AFTER 003. Safe to re-run.
-- ============================================================================

-- fee_payments.idempotency_key: double-click / retry safe
alter table public.fee_payments
  add column if not exists idempotency_key text,
  add column if not exists institute_id uuid references public.institutes(id) on delete cascade;

-- Backfill idempotency for old rows so unique index never collides on NULL
do $$
begin
  if to_regclass('public.fee_payments') is not null then
    update public.fee_payments
    set idempotency_key = 'legacy-' || id::text
    where idempotency_key is null;
  end if;
end $$;

-- One payment per key (partial unique not needed now that backfilled)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fee_payments_idempotency_unique') then
    alter table public.fee_payments
      add constraint fee_payments_idempotency_unique unique (idempotency_key);
  end if;
exception when duplicate_object then null;
end $$;

-- One receipt number per institute (prevents duplicate receipts)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fee_payments_institute_receipt_unique') then
    alter table public.fee_payments
      add constraint fee_payments_institute_receipt_unique unique (institute_id, receipt_no);
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists fee_payments_institute_date_idx
  on public.fee_payments(institute_id, payment_date);
create index if not exists fee_payments_institute_student_idx
  on public.fee_payments(institute_id, student_id);

-- attendance.institute_id guard (column exists from 001, ensure index)
create index if not exists attendance_institute_date_idx
  on public.attendance(institute_id, attendance_date);

NOTIFY pgrst, 'reload schema';
