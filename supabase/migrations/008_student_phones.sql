-- ============================================================================
-- ClassPilot AI — 008 student/parent mobile numbers (account finder login)
-- Run AFTER 007. Safe to re-run.
-- parent mobile  = guardian_phone (002 se hai) — yahan sirf index.
-- personal mobile = student_phone (naya) — student khud ka number.
-- Login ab bhi email+password (Supabase Auth) — mobile sirf account
-- dhoondhne ke liye: /auth/find-account exact match karta hai.
-- ============================================================================

alter table public.students
  add column if not exists student_phone text;

create index if not exists students_guardian_phone_idx
  on public.students(institute_id, guardian_phone);
create index if not exists students_own_phone_idx
  on public.students(institute_id, student_phone);

NOTIFY pgrst, 'reload schema';
