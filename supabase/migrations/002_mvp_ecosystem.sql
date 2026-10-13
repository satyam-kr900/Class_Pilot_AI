-- ============================================================================
-- ClassPilot AI — 002 MVP ecosystem (guardians, expenses, enquiries, receipts)
-- Run AFTER 001. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------- student guardians
alter table public.students
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists class_name text;

-- ------------------------------------------------------- payment receipts
alter table public.fee_payments
  add column if not exists receipt_no text;

-- Backfill receipt numbers for old rows (R- + first 8 of id, unique-ish).
do $$
begin
  if to_regclass('public.fee_payments') is not null then
    update public.fee_payments
    set receipt_no = 'R-' || upper(substring(id::text, 1, 8))
    where receipt_no is null;
  end if;
end $$;

-- ------------------------------------------------------------- expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(10, 2) not null check (amount > 0),
  category text not null default 'other'
    check (category in ('rent', 'salary', 'utilities', 'marketing', 'material', 'other')),
  expense_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ enquiries
-- Admission leads. status admitted hone par student banao (app se).
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  course text,
  status text not null default 'new'
    check (status in ('new', 'followup', 'admitted', 'dropped')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
alter table public.enquiries enable row level security;

-- Transitional RLS (owner match OR institute membership), jaise 001 me.
drop policy if exists "Members manage institute expenses" on public.expenses;
create policy "Members manage institute expenses"
on public.expenses for all to authenticated
using (
  owner_id = (select auth.uid())
  or (institute_id is not null and public.is_institute_member(institute_id))
)
with check (
  owner_id = (select auth.uid())
  or (institute_id is not null and public.is_institute_member(institute_id))
);

drop policy if exists "Members manage institute enquiries" on public.enquiries;
create policy "Members manage institute enquiries"
on public.enquiries for all to authenticated
using (
  owner_id = (select auth.uid())
  or (institute_id is not null and public.is_institute_member(institute_id))
)
with check (
  owner_id = (select auth.uid())
  or (institute_id is not null and public.is_institute_member(institute_id))
);

create index if not exists expenses_institute_date_idx
  on public.expenses(institute_id, expense_date);
create index if not exists enquiries_institute_status_idx
  on public.enquiries(institute_id, status);
