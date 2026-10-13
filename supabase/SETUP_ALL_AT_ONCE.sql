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
-- ============================================================================
-- ClassPilot AI — 003 Phase 1 foundation (profiles, invitations, guardians,
-- admission_no, RLS tighten). Run AFTER 002. Safe to re-run.
-- Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================================

-- ------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));
drop policy if exists "Users upsert own profile" on public.profiles;
create policy "Users upsert own profile"
on public.profiles for all to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- ------------------------------------------------------- invitations
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  email text not null,
  role text not null default 'teacher'
    check (role in ('owner', 'teacher', 'staff', 'parent', 'student')),
  token_hash text not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invitations enable row level security;
drop policy if exists "Staff view invitations" on public.invitations;
create policy "Staff view invitations"
on public.invitations for select to authenticated
using (public.is_institute_staff(institute_id));
drop policy if exists "Staff manage invitations" on public.invitations;
create policy "Staff manage invitations"
on public.invitations for insert to authenticated
with check (public.is_institute_staff(institute_id));
create index if not exists invitations_institute_idx on public.invitations(institute_id);

-- ------------------------------------------------------- guardians (Phase 1 proper table)
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  unique (institute_id, phone, name)
);
alter table public.guardians enable row level security;
drop policy if exists "Members view guardians" on public.guardians;
create policy "Members view guardians"
on public.guardians for select to authenticated
using (public.is_institute_member(institute_id));
drop policy if exists "Staff manage guardians" on public.guardians;
create policy "Staff manage guardians"
on public.guardians for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

create table if not exists public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relation text not null default 'parent',
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);
alter table public.student_guardians enable row level security;
drop policy if exists "Members view student_guardians" on public.student_guardians;
create policy "Members view student_guardians"
on public.student_guardians for select to authenticated
using (true);
drop policy if exists "Staff manage student_guardians" on public.student_guardians;
create policy "Staff manage student_guardians"
on public.student_guardians for all to authenticated
using (true)
with check (true);

-- ------------------------------------------------------- students.admission_no + status
alter table public.students
  add column if not exists admission_no text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'archived'));

do $$
begin
  if to_regclass('public.students') is not null then
    update public.students
    set admission_no = 'ADM-' || upper(substring(id::text, 1, 6))
    where admission_no is null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_institute_admission_unique'
  ) then
    alter table public.students
      add constraint students_institute_admission_unique unique (institute_id, admission_no);
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists students_status_idx on public.students(status);

-- ------------------------------------------------------- RLS tighten (were USING(true))
-- batch_students: check via parent batch's institute
drop policy if exists "Members view batch_students" on public.batch_students;
create policy "Members view batch_students"
on public.batch_students for select to authenticated
using (
  exists (
    select 1 from public.batches b
    where b.id = batch_students.batch_id
      and public.is_institute_member(b.institute_id)
  )
);
drop policy if exists "Staff manage batch_students" on public.batch_students;
create policy "Staff manage batch_students"
on public.batch_students for all to authenticated
using (
  exists (
    select 1 from public.batches b
    where b.id = batch_students.batch_id
      and public.is_institute_staff(b.institute_id)
  )
)
with check (
  exists (
    select 1 from public.batches b
    where b.id = batch_students.batch_id
      and public.is_institute_staff(b.institute_id)
  )
);

drop policy if exists "Members view batch_teachers" on public.batch_teachers;
create policy "Members view batch_teachers"
on public.batch_teachers for select to authenticated
using (
  exists (
    select 1 from public.batches b
    where b.id = batch_teachers.batch_id
      and public.is_institute_member(b.institute_id)
  )
);
drop policy if exists "Staff manage batch_teachers" on public.batch_teachers;
create policy "Staff manage batch_teachers"
on public.batch_teachers for all to authenticated
using (
  exists (
    select 1 from public.batches b
    where b.id = batch_teachers.batch_id
      and public.is_institute_staff(b.institute_id)
  )
)
with check (
  exists (
    select 1 from public.batches b
    where b.id = batch_teachers.batch_id
      and public.is_institute_staff(b.institute_id)
  )
);

-- marks: check via parent exam's institute
drop policy if exists "Members view marks" on public.marks;
create policy "Members view marks"
on public.marks for select to authenticated
using (
  exists (
    select 1 from public.exams e
    where e.id = marks.exam_id
      and public.is_institute_member(e.institute_id)
  )
);
drop policy if exists "Staff manage marks" on public.marks;
create policy "Staff manage marks"
on public.marks for all to authenticated
using (
  exists (
    select 1 from public.exams e
    where e.id = marks.exam_id
      and public.is_institute_staff(e.institute_id)
  )
)
with check (
  exists (
    select 1 from public.exams e
    where e.id = marks.exam_id
      and public.is_institute_staff(e.institute_id)
  )
);

-- student_guardians: check via student institute
drop policy if exists "Members view student_guardians" on public.student_guardians;
create policy "Members view student_guardians"
on public.student_guardians for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_guardians.student_id
      and s.institute_id is not null
      and public.is_institute_member(s.institute_id)
  )
);
drop policy if exists "Staff manage student_guardians" on public.student_guardians;
create policy "Staff manage student_guardians"
on public.student_guardians for all to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_guardians.student_id
      and s.institute_id is not null
      and public.is_institute_staff(s.institute_id)
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = student_guardians.student_id
      and s.institute_id is not null
      and public.is_institute_staff(s.institute_id)
  )
);

NOTIFY pgrst, 'reload schema';
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
-- ============================================================================
-- ClassPilot AI — 005 Phase 3 academic (sessions, submissions, publish status)
-- Run AFTER 004. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------- class sessions (timetable)
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  subject text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room text,
  teacher_id uuid references auth.users(id) on delete set null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.class_sessions enable row level security;
drop policy if exists "Members view sessions" on public.class_sessions;
create policy "Members view sessions"
on public.class_sessions for select to authenticated
using (public.is_institute_member(institute_id));
drop policy if exists "Staff manage sessions" on public.class_sessions;
create policy "Staff manage sessions"
on public.class_sessions for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));
create index if not exists sessions_institute_start_idx
  on public.class_sessions(institute_id, starts_at);
create index if not exists sessions_batch_start_idx
  on public.class_sessions(batch_id, starts_at);

-- ------------------------------------------------------- assignment submissions
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  body text,
  score numeric(8, 2),
  feedback text,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
alter table public.assignment_submissions enable row level security;
drop policy if exists "Members view submissions" on public.assignment_submissions;
create policy "Members view submissions"
on public.assignment_submissions for select to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_submissions.assignment_id
      and public.is_institute_member(a.institute_id)
  )
);
drop policy if exists "Staff manage submissions" on public.assignment_submissions;
create policy "Staff manage submissions"
on public.assignment_submissions for all to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_submissions.assignment_id
      and public.is_institute_staff(a.institute_id)
  )
)
with check (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_submissions.assignment_id
      and public.is_institute_staff(a.institute_id)
  )
);
create index if not exists submissions_assignment_idx
  on public.assignment_submissions(assignment_id);

-- ------------------------------------------------------- exams publish status
alter table public.exams
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'published'));

-- batches: capacity + active flag for enrol guards
alter table public.batches
  add column if not exists capacity int,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'closed'));

NOTIFY pgrst, 'reload schema';
-- ============================================================================
-- ClassPilot AI — 006 Phase 4 portals + materials + AI usage (storage, links)
-- Run AFTER 005. Safe to re-run.
-- ============================================================================

-- Link auth users to student / guardian records (portals)
alter table public.students
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.guardians
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists students_user_idx on public.students(user_id);
create index if not exists guardians_user_idx on public.guardians(user_id);

-- ------------------------------------------------------- learning materials (metadata; files in Storage)
create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  file_path text not null,
  mime text,
  size_bytes bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.learning_materials enable row level security;
drop policy if exists "Members view materials" on public.learning_materials;
create policy "Members view materials"
on public.learning_materials for select to authenticated
using (public.is_institute_member(institute_id));
drop policy if exists "Staff manage materials" on public.learning_materials;
create policy "Staff manage materials"
on public.learning_materials for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));
create index if not exists materials_institute_idx on public.learning_materials(institute_id);

-- ------------------------------------------------------- AI usage logs (quotas + cost tracking)
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);
alter table public.ai_usage_logs enable row level security;
drop policy if exists "Members view own ai usage" on public.ai_usage_logs;
create policy "Members view own ai usage"
on public.ai_usage_logs for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_institute_staff(institute_id)
);
create index if not exists ai_usage_inst_user_day_idx
  on public.ai_usage_logs(institute_id, user_id, created_at);

-- ------------------------------------------------------- Storage bucket (private; backend signs URLs)
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

-- No public read. Service-role backend signs URLs; client never gets service key.
-- If a private-bucket policy is needed for owner reads, add scoped policies here later.

NOTIFY pgrst, 'reload schema';
-- ============================================================================
-- ClassPilot AI — 007 Phase 5 launch (notifications, refunds, SaaS payments)
-- Run AFTER 006. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------- in-app notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  audience text not null default 'all'
    check (audience in ('all', 'teachers', 'parents', 'students', 'user')),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "Members view notifications" on public.notifications;
create policy "Members view notifications"
on public.notifications for select to authenticated
using (
  public.is_institute_member(institute_id)
  and (audience in ('all', 'teachers', 'parents', 'students') or user_id = (select auth.uid()))
);
drop policy if exists "Staff create notifications" on public.notifications;
create policy "Staff create notifications"
on public.notifications for insert to authenticated
with check (public.is_institute_staff(institute_id));
create index if not exists notifications_institute_idx on public.notifications(institute_id, created_at);

-- ------------------------------------------------------- delivery logs (WhatsApp/SMS/email adapter)
create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email', 'inapp')),
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  idempotency_key text,
  error text,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);
alter table public.notification_delivery_logs enable row level security;
drop policy if exists "Staff view delivery" on public.notification_delivery_logs;
create policy "Staff view delivery"
on public.notification_delivery_logs for select to authenticated
using (public.is_institute_staff(institute_id));
create index if not exists delivery_institute_idx on public.notification_delivery_logs(institute_id, status);

-- ------------------------------------------------------- guardian messaging consent / opt-out
create table if not exists public.notification_preferences (
  institute_id uuid not null references public.institutes(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  whatsapp_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (institute_id, guardian_id)
);
alter table public.notification_preferences enable row level security;
drop policy if exists "Members view prefs" on public.notification_preferences;
create policy "Members view prefs"
on public.notification_preferences for select to authenticated
using (public.is_institute_member(institute_id));

-- ------------------------------------------------------- refunds (never delete payments)
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  payment_id uuid not null references public.fee_payments(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (payment_id)
);
alter table public.refunds enable row level security;
drop policy if exists "Staff manage refunds" on public.refunds;
create policy "Staff manage refunds"
on public.refunds for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

-- ------------------------------------------------------- SaaS payment events (Razorpay webhooks, idempotent)
create table if not exists public.saas_payment_events (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  provider text not null default 'razorpay',
  event_id text not null,
  event_type text,
  amount numeric(10, 2),
  status text not null default 'received',
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.saas_payment_events enable row level security;
drop policy if exists "Staff view saas payments" on public.saas_payment_events;
create policy "Staff view saas payments"
on public.saas_payment_events for select to authenticated
using (institute_id is null or public.is_institute_staff(institute_id));

NOTIFY pgrst, 'reload schema';
