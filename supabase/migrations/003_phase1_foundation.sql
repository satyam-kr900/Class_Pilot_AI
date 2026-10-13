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
