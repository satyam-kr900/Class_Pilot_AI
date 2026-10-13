-- ClassPilot AI — demo seed (FAKE data only, never real customer data).
-- Run AFTER 003 in a DEV project. Creates 2 institutes to test isolation.
-- Replace the UUIDs with real auth.users ids from your dev project.

-- Institute A
-- insert into public.institutes (id, name, owner_id) values
--   ('11111111-1111-1111-1111-111111111111', 'Sunrise Coaching (Demo A)', null)
-- on conflict (id) do nothing;

-- Institute B
-- insert into public.institutes (id, name, owner_id) values
--   ('22222222-2222-2222-2222-222222222222', 'City Classes (Demo B)', null)
-- on conflict (id) do nothing;

-- Manual cross-tenant test (no seed needed):
-- 1. Login as User-A in browser 1, create student "Aarav".
-- 2. Login as User-B in browser 2 (incognito), list students.
-- 3. PASS if B never sees "Aarav" via UI, via Supabase query, or via
--    GET /api/v1/students with B's token (expect 403/empty, never A's rows).
select 1;
