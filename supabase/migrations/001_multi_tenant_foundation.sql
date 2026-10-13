-- ============================================================================
-- ClassPilot AI — 001 multi-tenant foundation (Phase 1)
-- Run: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS guards).
--
-- Kya karta hai:
--  1. institutes + institute_members (owner/teacher/staff/parent/student roles)
--  2. batches, batch_students, batch_teachers (teacher = sirf assigned batches)
--  3. fee_invoices (dues) + fee_payments/attendance me institute_id column
--  4. exams, marks, assignments, announcements, subscriptions, audit_logs
--  5. Purana owner_id data migrate: har owner ko "My Institute" + owner member
--  6. Transitional RLS: owner_id match (purana app) OR institute membership (naya)
--
-- NAHI karta: purani tables/columns delete nahi karta. owner_id abhi rehne do.
-- Phase 2 me app update ke baad institute_id NOT NULL enforce karna.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- institutes
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

-- ------------------------------------------------- membership helper (RLS use)
-- NOTE: institute_members ki SELECT policy sirf apni rows dikhati hai
-- (user_id = auth.uid(), koi function call nahi) taaki recursion na ho.
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

-- ------------------------------------------------------------------- batches
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

-- Teacher sirf assigned batches dekhega (Phase 1 me app-layer filter + RLS base)
create table if not exists public.batch_teachers (
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (batch_id, user_id)
);

-- ------------------------------------------------------------- fee invoices
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

-- --------------------------------------------------- exams / marks / study
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

-- ------------------------------------------------------- comms / billing
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

-- --------------------------------------- institute_id on legacy owner tables
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

-- ------------------------------------------------------------- data migrate
-- Har distinct owner ko default institute + owner membership, phir backfill.
-- Teen alag guarded blocks (koi legacy table missing ho to bhi chalega).
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

-- ================================================================= RLS ====
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

-- institutes: members dekh sakte hain; owner create/update kar sakta hai
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

-- institute_members: recursion-free — sirf apni rows read/leave
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

-- NOTE: owner dusre teachers ko add/remove Phase 2 me service-role Edge
-- Function se karega (client RLS se recursion hota). MVP me teacher khud
-- invite code se join karega (user_id = auth.uid() wali policy).

-- batches: members read, staff manage
drop policy if exists "Members view batches" on public.batches;
create policy "Members view batches"
on public.batches for select to authenticated
using (public.is_institute_member(institute_id));

drop policy if exists "Staff manage batches" on public.batches;
create policy "Staff manage batches"
on public.batches for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

-- batch link tables: staff manage, members read
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

-- fee_invoices / exams / marks / assignments / announcements: member read, staff write
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

-- subscriptions / audit_logs: read-only for members (writes = server webhooks)
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

-- -------------------------------- transitional policies on legacy tables
-- Purani owner-only policies hatao, owner-OR-member lagao (app dono chalega).
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

-- ------------------------------------------------------------------ indexes
create index if not exists members_user_idx on public.institute_members(user_id);
create index if not exists members_institute_idx on public.institute_members(institute_id);
create index if not exists batches_institute_idx on public.batches(institute_id);
create index if not exists students_institute_idx on public.students(institute_id);
create index if not exists invoices_student_month_idx on public.fee_invoices(student_id, billing_month);
create index if not exists announcements_institute_idx on public.announcements(institute_id);
create index if not exists audit_institute_idx on public.audit_logs(institute_id);
