-- ============================================================================
-- ClassPilot AI — 000 base tables (fresh project ke liye)
-- Run FIRST: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Phir 001_multi_tenant_foundation.sql chalao.
-- ============================================================================

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  batch text,
  monthly_fee numeric(10, 2) not null default 0 check (monthly_fee >= 0),
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

drop policy if exists "Owners can view their students" on public.students;
create policy "Owners can view their students"
on public.students for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can add their students" on public.students;
create policy "Owners can add their students"
on public.students for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update their students" on public.students;
create policy "Owners can update their students"
on public.students for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete their students" on public.students;
create policy "Owners can delete their students"
on public.students for delete to authenticated
using ((select auth.uid()) = owner_id);

create index if not exists students_owner_id_idx on public.students(owner_id);

-- ------------------------------------------------------- fees + attendance
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'upi', 'bank', 'other')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late')),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

alter table public.fee_payments enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Owners manage their fee payments" on public.fee_payments;
create policy "Owners manage their fee payments"
on public.fee_payments for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners manage their attendance" on public.attendance;
create policy "Owners manage their attendance"
on public.attendance for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create index if not exists fee_payments_student_idx on public.fee_payments(student_id);
create index if not exists attendance_student_date_idx on public.attendance(student_id, attendance_date);
