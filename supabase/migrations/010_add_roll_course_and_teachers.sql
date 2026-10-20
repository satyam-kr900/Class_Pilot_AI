-- ============================================================================
-- ClassPilot AI — 010 Add roll_number, course to students; create teachers table
-- Run AFTER 009. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------- roll_number + course for students
alter table public.students
  add column if not exists roll_number text,
  add column if not exists course text;

-- ------------------------------------------------------- teachers table
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  qualifications text,
  subjects text,
  classes text,
  experience text,
  residential_address text,
  pic_url text,
  created_at timestamptz not null default now(),
  unique (institute_id, user_id)
);
alter table public.teachers enable row level security;

-- Helper RLS: teacher views own row
drop policy if exists "Members view own teacher" on public.teachers;
create policy "Members view own teacher"
on public.teachers for select to authenticated
using (user_id = (select auth.uid()));

-- Helper RLS: staff/admins manage teachers
drop policy if exists "Staff manage teachers" on public.teachers;
create policy "Staff manage teachers"
on public.teachers for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

-- Index for fast lookups
create index if not exists teachers_institute_idx on public.teachers(institute_id);
create index if not exists teachers_user_idx on public.teachers(user_id);

NOTIFY pgrst, 'reload schema';