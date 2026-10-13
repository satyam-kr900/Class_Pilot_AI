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
