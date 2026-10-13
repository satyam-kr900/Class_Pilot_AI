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
