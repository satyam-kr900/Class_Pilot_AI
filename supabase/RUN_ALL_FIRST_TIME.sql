-- ============================================================================
-- ClassPilot AI — FIRST TIME SETUP (sirf 1 baar chalana hai)
-- Supabase Dashboard → SQL Editor → New query → YE POORI FILE paste → Run
-- Order andar hi sahi hai: 000 base → 001 multi-tenant → 002 ecosystem.
-- Safe to re-run (IF NOT EXISTS guards). Aakhir me API cache reload hota hai.
-- Success ke baad Table Editor me students/institutes dikhne lagenge.
-- ============================================================================

-- ============================ 000 BASE TABLES ===============================

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

-- ====================== 001 MULTI-TENANT FOUNDATION ===========================

create extension if not exists "pgcrypto";

create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  plan text not null default 'free' check (plan in ('free', 'tutor', 'growth', 'pro')),
  created_at timestamptz not null default now()
);

create table if not exists public.institute_members (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'teacher'
    check (role in ('owner', 'teacher', 'staff', 'parent', 'student')),
  created_at timestamptz not null default now(),
  unique (institute_id, user_id)
);

create or replace function public.is_institute_member(p_institute_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1 from public.institute_members m
    where m.institute_id = p_institute_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_institute_staff(p_institute_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1 from public.institute_members m
    where m.institute_id = p_institute_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'teacher', 'staff')
  );
$$;

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  subject text,
  schedule text,
  created_at timestamptz not null default now()
);

create table if not exists public.batch_students (
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (batch_id, student_id)
);

create table if not exists public.batch_teachers (
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (batch_id, user_id)
);

create table if not exists public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  billing_month date not null default (date_trunc('month', now()))::date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  due_date date,
  created_at timestamptz not null default now(),
  unique (student_id, billing_month)
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  name text not null,
  exam_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(8, 2) not null check (score >= 0),
  max_score numeric(8, 2) not null default 100,
  created_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all'
    check (audience in ('all', 'teachers', 'parents', 'students')),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  plan text not null check (plan in ('free', 'tutor', 'growth', 'pro')),
  status text not null default 'active'
    check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  current_period_end date,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

alter table public.students
  add column if not exists institute_id uuid references public.institutes(id) on delete cascade;

do $$
begin
  if to_regclass('public.fee_payments') is not null then
    alter table public.fee_payments
      add column if not exists institute_id uuid references public.institutes(id) on delete cascade;
  end if;
  if to_regclass('public.attendance') is not null then
    alter table public.attendance
      add column if not exists institute_id uuid references public.institutes(id) on delete cascade,
      add column if not exists batch_id uuid references public.batches(id) on delete set null;
  end if;
end $$;

do $$
declare
  r record;
  v_inst uuid;
begin
  if to_regclass('public.students') is null then
    return;
  end if;

  for r in
    select distinct s.owner_id
    from public.students s
    where s.institute_id is null
  loop
    select m.institute_id into v_inst
    from public.institute_members m
    where m.user_id = r.owner_id and m.role = 'owner'
    limit 1;

    if v_inst is null then
      insert into public.institutes (name, owner_id)
      values ('My Institute', r.owner_id)
      returning id into v_inst;

      insert into public.institute_members (institute_id, user_id, role)
      values (v_inst, r.owner_id, 'owner')
      on conflict (institute_id, user_id) do nothing;
    end if;

    update public.students set institute_id = v_inst
    where owner_id = r.owner_id and institute_id is null;
  end loop;
end $$;

do $$
declare
  r record;
  v_inst uuid;
begin
  if to_regclass('public.fee_payments') is null then
    return;
  end if;

  for r in
    select distinct f.owner_id
    from public.fee_payments f
    where f.institute_id is null
  loop
    select m.institute_id into v_inst
    from public.institute_members m
    where m.user_id = r.owner_id and m.role = 'owner'
    limit 1;

    if v_inst is null then
      insert into public.institutes (name, owner_id)
      values ('My Institute', r.owner_id)
      returning id into v_inst;

      insert into public.institute_members (institute_id, user_id, role)
      values (v_inst, r.owner_id, 'owner')
      on conflict (institute_id, user_id) do nothing;
    end if;

    update public.fee_payments set institute_id = v_inst
    where owner_id = r.owner_id and institute_id is null;
  end loop;
end $$;

do $$
declare
  r record;
  v_inst uuid;
begin
  if to_regclass('public.attendance') is null then
    return;
  end if;

  for r in
    select distinct a.owner_id
    from public.attendance a
    where a.institute_id is null
  loop
    select m.institute_id into v_inst
    from public.institute_members m
    where m.user_id = r.owner_id and m.role = 'owner'
    limit 1;

    if v_inst is null then
      insert into public.institutes (name, owner_id)
      values ('My Institute', r.owner_id)
      returning id into v_inst;

      insert into public.institute_members (institute_id, user_id, role)
      values (v_inst, r.owner_id, 'owner')
      on conflict (institute_id, user_id) do nothing;
    end if;

    update public.attendance set institute_id = v_inst
    where owner_id = r.owner_id and institute_id is null;
  end loop;
end $$;

alter table public.institutes enable row level security;
alter table public.institute_members enable row level security;
alter table public.batches enable row level security;
alter table public.batch_students enable row level security;
alter table public.batch_teachers enable row level security;
alter table public.fee_invoices enable row level security;
alter table public.exams enable row level security;
alter table public.marks enable row level security;
alter table public.assignments enable row level security;
alter table public.announcements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Members view their institutes" on public.institutes;
create policy "Members view their institutes"
on public.institutes for select to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_institute_member(id)
);

drop policy if exists "Users create institutes" on public.institutes;
create policy "Users create institutes"
on public.institutes for insert to authenticated
with check (true);

drop policy if exists "Owners update institutes" on public.institutes;
create policy "Owners update institutes"
on public.institutes for update to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_institute_staff(id)
);

drop policy if exists "Users view own memberships" on public.institute_members;
create policy "Users view own memberships"
on public.institute_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users join institutes" on public.institute_members;
create policy "Users join institutes"
on public.institute_members for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users leave institutes" on public.institute_members;
create policy "Users leave institutes"
on public.institute_members for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Members view batches" on public.batches;
create policy "Members view batches"
on public.batches for select to authenticated
using (public.is_institute_member(institute_id));

drop policy if exists "Staff manage batches" on public.batches;
create policy "Staff manage batches"
on public.batches for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

drop policy if exists "Members view batch_students" on public.batch_students;
create policy "Members view batch_students"
on public.batch_students for select to authenticated
using (true);

drop policy if exists "Staff manage batch_students" on public.batch_students;
create policy "Staff manage batch_students"
on public.batch_students for all to authenticated
using (true)
with check (true);

drop policy if exists "Members view batch_teachers" on public.batch_teachers;
create policy "Members view batch_teachers"
on public.batch_teachers for select to authenticated
using (true);

drop policy if exists "Staff manage batch_teachers" on public.batch_teachers;
create policy "Staff manage batch_teachers"
on public.batch_teachers for all to authenticated
using (true)
with check (true);

drop policy if exists "Members view fee_invoices" on public.fee_invoices;
create policy "Members view fee_invoices"
on public.fee_invoices for select to authenticated
using (public.is_institute_member(institute_id));

drop policy if exists "Staff manage fee_invoices" on public.fee_invoices;
create policy "Staff manage fee_invoices"
on public.fee_invoices for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

drop policy if exists "Members view exams" on public.exams;
create policy "Members view exams"
on public.exams for select to authenticated
using (public.is_institute_member(institute_id));

drop policy if exists "Staff manage exams" on public.exams;
create policy "Staff manage exams"
on public.exams for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

drop policy if exists "Members view marks" on public.marks;
create policy "Members view marks"
on public.marks for select to authenticated
using (true);

drop policy if exists "Staff manage marks" on public.marks;
create policy "Staff manage marks"
on public.marks for all to authenticated
using (true)
with check (true);

drop policy if exists "Members view assignments" on public.assignments;
create policy "Members view assignments"
on public.assignments for select to authenticated
using (public.is_institute_member(institute_id));

drop policy if exists "Staff manage assignments" on public.assignments;
create policy "Staff manage assignments"
on public.assignments for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

drop policy if exists "Members view announcements" on public.announcements;
create policy "Members view announcements"
on public.announcements for select to authenticated
using (public.is_institute_member(institute_id));

drop policy if exists "Staff manage announcements" on public.announcements;
create policy "Staff manage announcements"
on public.announcements for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

drop policy if exists "Members view subscriptions" on public.subscriptions;
create policy "Members view subscriptions"
on public.subscriptions for select to authenticated
using (public.is_institute_member(institute_id));

drop policy if exists "Members view audit_logs" on public.audit_logs;
create policy "Members view audit_logs"
on public.audit_logs for select to authenticated
using (
  institute_id is null
  or public.is_institute_member(institute_id)
);

drop policy if exists "Owners can view their students" on public.students;
drop policy if exists "Owners can add their students" on public.students;
drop policy if exists "Owners can update their students" on public.students;
drop policy if exists "Owners can delete their students" on public.students;
drop policy if exists "Members manage institute students" on public.students;
create policy "Members manage institute students"
on public.students for all to authenticated
using (
  owner_id = (select auth.uid())
  or (institute_id is not null and public.is_institute_member(institute_id))
)
with check (
  owner_id = (select auth.uid())
  or (institute_id is not null and public.is_institute_member(institute_id))
);

do $$
begin
  if to_regclass('public.fee_payments') is not null then
    drop policy if exists "Owners manage their fee payments" on public.fee_payments;
    drop policy if exists "Members manage institute fee payments" on public.fee_payments;
    create policy "Members manage institute fee payments"
    on public.fee_payments for all to authenticated
    using (
      owner_id = (select auth.uid())
      or (institute_id is not null and public.is_institute_member(institute_id))
    )
    with check (
      owner_id = (select auth.uid())
      or (institute_id is not null and public.is_institute_member(institute_id))
    );
  end if;
  if to_regclass('public.attendance') is not null then
    drop policy if exists "Owners manage their attendance" on public.attendance;
    drop policy if exists "Members manage institute attendance" on public.attendance;
    create policy "Members manage institute attendance"
    on public.attendance for all to authenticated
    using (
      owner_id = (select auth.uid())
      or (institute_id is not null and public.is_institute_member(institute_id))
    )
    with check (
      owner_id = (select auth.uid())
      or (institute_id is not null and public.is_institute_member(institute_id))
    );
  end if;
end $$;

create index if not exists members_user_idx on public.institute_members(user_id);
create index if not exists members_institute_idx on public.institute_members(institute_id);
create index if not exists batches_institute_idx on public.batches(institute_id);
create index if not exists students_institute_idx on public.students(institute_id);
create index if not exists invoices_student_month_idx on public.fee_invoices(student_id, billing_month);
create index if not exists announcements_institute_idx on public.announcements(institute_id);
create index if not exists audit_institute_idx on public.audit_logs(institute_id);

-- ============================ 002 MVP ECOSYSTEM ===============================

alter table public.students
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists class_name text;

alter table public.fee_payments
  add column if not exists receipt_no text;

do $$
begin
  if to_regclass('public.fee_payments') is not null then
    update public.fee_payments
    set receipt_no = 'R-' || upper(substring(id::text, 1, 8))
    where receipt_no is null;
  end if;
end $$;

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

-- ============================ API CACHE RELOAD ==============================
-- PostgREST ko turant nayi tables dikhao (warna "schema cache" error aata hai).
NOTIFY pgrst, 'reload schema';
