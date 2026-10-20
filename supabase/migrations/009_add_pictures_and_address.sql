-- ============================================================================
-- ClassPilot AI — 009 Add pictures and full address (institute, student, teacher, admin)
-- Run AFTER 008. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------- institute picture/logo
alter table public.institutes
  add column if not exists pic_url text;

-- ------------------------------------------------------- student picture
alter table public.students
  add column if not exists pic_url text;

-- ------------------------------------------------------- profiles: teacher/admin picture + full address
alter table public.profiles
  add column if not exists pic_url text,
  add column if not exists full_address text;

NOTIFY pgrst, 'reload schema';