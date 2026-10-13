# ClassPilot AI 🎓

**Complete AI-powered coaching institute management SaaS for Indian coaching centres (50–300 students).**

One shared backend + one Supabase Postgres database, five experiences: **Owner/Admin, Teacher, Student, Parent, Platform billing** — plus web (Next.js), mobile (Expo), and an AI workspace. Built over Phases 0–5: foundation & auth → students/fees/attendance safety → academic workflows → portals/AI/SaaS → launch readiness.

> Target customers: small/medium Indian coaching institutes. Default currency **INR**, default timezone **Asia/Kolkata** (stored UTC, displayed local).

---

## Table of Contents

1. [Features](#1-features)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Prerequisites](#5-prerequisites)
6. [Supabase Setup (migrations 000→007)](#6-supabase-setup-migrations-000007)
7. [Environment Variables](#7-environment-variables)
8. [Run Locally](#8-run-locally)
9. [User Roles & Permissions](#9-user-roles--permissions)
10. [End-to-End Workflows](#10-end-to-end-workflows)
11. [API Reference](#11-api-reference)
12. [AI Workspace](#12-ai-workspace)
13. [Subscriptions & Billing](#13-subscriptions--billing)
14. [Notifications (In-App + WhatsApp)](#14-notifications-in-app--whatsapp)
15. [Testing](#15-testing)
16. [Deployment](#16-deployment)
17. [Security Rules](#17-security-rules)
18. [Troubleshooting](#18-troubleshooting)
19. [Docs & Roadmap](#19-docs--roadmap)

---

## 1. Features

| Module | What works |
|---|---|
| **Dashboard** | Role-aware: owner overview (students, expected/collected/pending, today's attendance, AI insight); student/parent see **My Learning** only |
| **Students** | CRUD + admission_no (`ADM-XXXXXX`, unique per institute), status active/archived (soft delete preserves history), guardian fields, search/sort |
| **Batches** | Real batches table, capacity guard, enrol students, assign teachers, roster view. Teachers see **assigned batches only** |
| **Timetable** | Class sessions with room/teacher/time, batch + teacher **overlap detection (409)**, cancel preserves history |
| **Attendance** | Present/absent/late, unique per student+date, batch-scoped, teacher-scoped |
| **Fees** | Monthly tracking, partial payments (cash/UPI/bank), **idempotency keys** (double-click safe), server-generated receipts (`R-XXXXXXXX`, unique per institute), **Decimal math** (never float), refunds preserve history (hard delete disabled → 410) |
| **Homework** | Assignments by batch + due date, submissions, staff grading with feedback |
| **Materials** | Private Storage bucket + signed upload/download URLs, 25 MB cap, upload progress bar, batch-scoped visibility |
| **Exams** | Draft → marks entry (score ≤ max validated, audit-logged) → publish/unpublish. Students/parents see **published only** |
| **Enquiries** | Pipeline (new/contacted/followup/trial/admitted/dropped), **admit converts to student duplicate-safe** (same phone → link, no duplicate) |
| **Portals** | `GET /portals/my-learning`: student sees own attendance %/pending HW/published results/fee due; parent sees per linked child (read-only) |
| **AI Workspace** | Explain, schema-validated quiz generator (draft + teacher review), evidence-based insights (no key needed), permission-checked admin assistant, 30 req/day quota + usage logs |
| **Subscriptions** | Plans Free ₹0 / Tutor ₹499 / Growth ₹999 / Pro ₹1,499 as server config; real usage vs limits + over-limit flags; Razorpay orders + HMAC-verified webhooks; manual mode without keys |
| **Notifications** | In-app announcements (audience-scoped); WhatsApp via approved template provider + guardian opt-in + pending/sent/failed logs (never fake-sent) |

---

## 2. Tech Stack

- **frontend/** — Next.js 14 App Router + TypeScript (strict) + Tailwind CSS + React Hook Form/Zod (forms) + Recharts (charts) + Lucide icons. Uses `sb_publishable_` key only.
- **backend/** — Python FastAPI + Pydantic v2 + `supabase-py` (service-role **server-only**) + stdlib HTTP for AI/Razorpay/WhatsApp (no extra deps).
- **mobile/** — React Native + Expo 57 + TypeScript + Expo Router. Same FastAPI + same Supabase (no separate DB). `src/lib/backend.ts` Bearer client to `/api/v1`.
- **Database/Auth/Storage** — Supabase Postgres + Supabase Auth + Supabase Storage (`materials` bucket, private) + Row Level Security on every table.
- **AI** — OpenAI-compatible chat API, called **only via backend** (`AI_PROVIDER/MODEL/BASE_URL/API_KEY`).
- **Payments** — Razorpay orders + webhook HMAC verification (manual mode without keys).
- **Messaging** — In-app now; WhatsApp through Meta-compatible template provider (credentials server-side).

---

## 3. Architecture

```
Browser (Next.js) / Phone (Expo)
  → HTTPS + Supabase JWT (Bearer)
  → FastAPI /api/v1  [verify JWT via sb.auth.get_user
  →                   → resolve institute_members (source of truth)
  →                   → teacher batch scoping via batch_teachers
  →                   → service layer + Decimal money math]
  → Supabase Postgres (RLS = second layer) + Auth + Storage
  → Validated JSON (correct status codes, OpenAPI at /docs)
  → Integrations (server-side only): AI, Razorpay, WhatsApp
```

**Golden rules:**
- Browser/mobile **never** receive service-role, DB passwords, AI keys, Razorpay secrets, WhatsApp tokens.
- Client `institute_id / role / balance / payment_status` is **never trusted** — membership resolved server-side on every request.
- Reads may use Supabase RLS directly (fast); **all writes go via FastAPI** (auth + institute + idempotency enforced).
- Money = `NUMERIC`/`Decimal`. Timestamps stored UTC, shown in institute timezone.

---

## 4. Project Structure

```
Class_Pilot_AI/
├── frontend/                  # Next.js 14 app
│   ├── src/app/
│   │   ├── page.tsx           # marketing landing (roles, plans, ecosystem)
│   │   ├── login/             # login + signup + demo login + backend verify
│   │   └── dashboard/         # Overview, Students, Batches, Timetable,
│   │                          # Attendance, Homework, Materials, Exams,
│   │                          # Fees, Enquiries, Notifications, AI, Subscription
│   ├── src/components/        # Sidebar (role-based), Navbar, GlassCard,
│   │                          # InstituteSwitcher, MyLearning
│   ├── src/lib/               # supabase, api (typed /api/v1 client),
│   │                          # useRequireAuth, useInstitute (role + switcher)
│   └── .env.example
├── backend/                   # FastAPI
│   ├── app/
│   │   ├── main.py            # CORS (dev allowlist / prod ALLOWED_ORIGINS),
│   │   │                      # legacy + /api/v1 mounts, /api/v1/health
│   │   ├── core/config.py     # env settings (Supabase, AI, Razorpay, WhatsApp)
│   │   ├── api_deps.py        # verify_bearer_token, require_institute_membership,
│   │   │                      # require_staff/owner_or_staff/batch_access, teacher_batch_ids
│   │   ├── routes/            # auth, institutes, students, batches, sessions,
│   │   │                      # attendance, fees (+refund), assignments, materials,
│   │   │                      # exams, enquiries, portals, notifications,
│   │   │                      # ai, subscriptions, billing, insights, classes (legacy)
│   │   ├── schemas/           # Pydantic (Decimal money, institute_id required)
│   │   ├── integrations/      # whatsapp.py (template adapter)
│   │   └── services/          # supabase_client (insight strings)
│   ├── tests/                 # test_phase1..5.py (27 offline tests)
│   └── .env.example
├── mobile/                    # Expo Router app, same backend/DB
│   └── src/lib/backend.ts     # Bearer /api/v1 client (students, fees,
│                              # attendance, batches, my-learning, notifications)
├── supabase/
│   ├── migrations/
│   │   ├── 000_base_tables.sql            # students, fee_payments, attendance (owner RLS)
│   │   ├── 001_multi_tenant_foundation.sql# institutes, members, batches, exams,
│   │   │                                  # marks, assignments, backfill institute_id
│   │   ├── 002_mvp_ecosystem.sql          # guardians cols, receipt_no, expenses, enquiries
│   │   ├── 003_phase1_foundation.sql      # profiles, invitations, guardians tables,
│   │   │                                  # admission_no, RLS tighten
│   │   ├── 004_phase2_payments.sql        # idempotency_key unique, receipt unique
│   │   ├── 005_phase3_academic.sql        # class_sessions, submissions, exam status, capacity
│   │   ├── 006_phase4_portals_ai.sql      # user links, learning_materials,
│   │   │                                  # ai_usage_logs, materials bucket
│   │   └── 007_phase5_launch.sql          # notifications, delivery logs, prefs,
│   │                                       # refunds, saas_payment_events
│   ├── RUN_ALL_FIRST_TIME.sql # 000–002 combined one-shot (then run 003–007)
│   └── seed_demo.sql          # fake-data isolation test guide (no real data)
└── docs/                      # setup-guide, deployment, security, architecture
```

---

## 5. Prerequisites

- Node.js 18+, Python 3.11+, a Supabase project, Expo Go app (for mobile).
- Supabase Auth: email provider on. For instant local testing turn **Confirm email OFF** (Dashboard → Authentication → Providers → Email), re-enable for production.

---

## 6. Supabase Setup (migrations 000→007)

In Supabase Dashboard → **SQL Editor → New query**, paste & **Run** each file **in order, once**:

| # | File | Creates |
|---|---|---|
| 1 | `supabase/migrations/000_base_tables.sql` | students, fee_payments, attendance + owner RLS |
| 2 | `supabase/migrations/001_multi_tenant_foundation.sql` | institutes, institute_members, batches, batch_students/teachers, fee_invoices, exams, marks, assignments, announcements, subscriptions, audit_logs; backfills `institute_id` |
| 3 | `supabase/migrations/002_mvp_ecosystem.sql` | guardian columns, receipt_no, expenses, enquiries |
| 4 | `supabase/migrations/003_phase1_foundation.sql` | profiles, invitations, guardians, student_guardians, admission_no, tightens open RLS |
| 5 | `supabase/migrations/004_phase2_payments.sql` | idempotency unique, receipt unique per institute |
| 6 | `supabase/migrations/005_phase3_academic.sql` | class_sessions, assignment_submissions, exam draft/published, batch capacity |
| 7 | `supabase/migrations/006_phase4_portals_ai.sql` | students/guardians `user_id` links, learning_materials, ai_usage_logs, private `materials` bucket |
| 8 | `supabase/migrations/007_phase5_launch.sql` | notifications, delivery logs, preferences, refunds, saas_payment_events |

> Shortcut: first-time projects may run `supabase/RUN_ALL_FIRST_TIME.sql` (covers 000–002 incl. `NOTIFY pgrst, reload schema`), **then still run 003–007**.

---

## 7. Environment Variables

**frontend/.env.local** (copy from `.env.example`):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000   # preferred (NEXT_PUBLIC_API_URL = fallback)
```

**backend/.env** (copy from `.env.example` — never commit, never send to frontend):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...              # server only
APP_ENV=dev
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
# AI (optional — insights/admin/tools work without; explain/quiz need it)
AI_PROVIDER=openai-compatible
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
# Razorpay (optional — absent = manual activation mode)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
# WhatsApp approved provider (optional — absent = in-app only)
WHATSAPP_PROVIDER=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
```

**mobile/.env**:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000   # on phone use LAN IP: http://192.168.1.5:8000
```

---

## 8. Run Locally

```bash
# Backend → http://localhost:8000  (docs: /docs, health: /api/v1/health)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill SUPABASE_URL + SUPABASE_SERVICE_KEY
uvicorn app.main:app --reload --port 8000

# Frontend → http://localhost:3000
cd frontend
npm install
cp .env.example .env.local   # fill keys
npm run dev

# Mobile (same backend + DB, no separate database)
cd mobile
npm install
npx expo start --clear
```

**First smoke test (proves the architecture is real):**
1. `/login` → New account → Login (backend verifies token, auto-creates institute + owner membership).
2. Dashboard → pick institute in switcher → Students → Add → refresh (persists) → Batches → create → Enrol.
3. Timetable → schedule class → Attendance → save → Fees → Collect (note `R-...` receipt; double-click = one payment).
4. Exams → draft → marks → Publish → AI Workspace → Insights.

**Two-institute isolation test:** normal browser (User-A) + incognito (User-B). A creates student; B must never see it — via UI, Supabase query, or `GET /api/v1/students` (403/empty).

**Link student/parent logins** (portals need it):
```sql
update students  set user_id='<auth-user-uuid>' where admission_no='ADM-XXXXXX';
update guardians set user_id='<auth-user-uuid>' where phone='<guardian-phone>';
-- institute_members.role must be 'student' / 'parent' for those users
```

---

## 9. User Roles & Permissions

Roles live in **`institute_members`** (a user can be owner in institute-A, teacher in institute-B). Never trust a client-sent role.

| Role | Sees / Can do |
|---|---|
| **owner** | Everything in own institute: staff/students/batches/fees/expenses/reports/billing/teacher-assign |
| **staff** | Operational modules; billing + teacher-assign need owner/staff |
| **teacher** | **Assigned batches only** (via `batch_teachers`): roster, sessions, attendance, homework, marks, materials |
| **student** | Own linked record: My Learning (attendance %, pending HW, published results, fee due), enrolled-batch materials |
| **parent** | Linked children via `student_guardians` (read-only), fee drafts, announcements |

---

## 10. End-to-End Workflows

- **Student joins:** owner adds (name/contact/guardian/batch/fee plan) → backend validates + dedups admission_no → `students` + `enrolments` rows → counts/attendance/fee lists refresh → invite links auth account.
- **Fee collection (transaction-safe):** invoice obligation → outstanding computed server-side (`Σ invoices − Σ payments − concessions`, Decimal) → `POST /fees` with client UUID `idempotency_key` → same key returns first receipt, never duplicates → printable receipt → ledger/reports update → optional guardian reminder (logged pending/sent/failed).
- **Attendance → parent notice:** teacher marks assigned batch → unique(student, date) enforced, corrections audited → % recalculated → absence notice queued only for opted-in verified guardians.
- **Exam publish:** draft → marks (score ≤ max, same-institute check, audit log) → publish → visible to students/parents; unpublished → 403 for learners.
- **Enquiry → admission:** new → contacted/followup/trial → Admit creates student; same phone returns existing (no duplicate).

---

## 11. API Reference

Base: `/api/v1` (legacy unprefixed paths still mounted for old mobile builds). Auth: `Authorization: Bearer <supabase-jwt>`. Full interactive docs at `/docs`.

| Group | Key endpoints |
|---|---|
| auth | `POST /auth/verify`, `POST /auth/register` (verify + auto institute+owner) |
| institutes | `GET /institutes/me`, `POST /institutes`, `GET /institutes/{id}/members` |
| students | `GET/POST /students?institute_id=`, `GET/PUT/DELETE /students/{id}` (delete = archive) |
| batches | `GET/POST /batches`, `POST /batches/{id}/enrol`, `POST /batches/{id}/teachers`, `GET /batches/{id}/roster` |
| sessions | `GET/POST /sessions` (409 on batch/teacher overlap), `POST /sessions/{id}/cancel` |
| attendance | `GET /attendance`, `POST /attendance/upsert` |
| fees | `GET/POST /fees` (idempotent), `DELETE /fees/{id}` → 410, `POST /fees/{id}/refund`, `GET /fees/summary` |
| assignments | `GET/POST /assignments`, `POST /assignments/{id}/submit`, `GET …/submissions`, `POST /submissions/{id}/grade` |
| materials | `POST /materials/upload-url`, `POST /materials` (confirm), `GET /materials`, `GET /materials/{id}/download-url` |
| exams | `GET/POST /exams`, `POST /exams/{id}/marks`, `POST /exams/{id}/publish?status=`, `GET /exams/{id}/results` |
| enquiries | `GET/POST /enquiries`, `PUT /enquiries/{id}`, `POST /enquiries/{id}/convert` |
| portals | `GET /portals/my-learning?institute_id=` (student/parent only) |
| notifications | `GET/POST /notifications`, `POST /notifications/whatsapp`, `POST /notifications/fee-reminder/{student_id}` |
| ai | `POST /ai/explain`, `POST /ai/quiz`, `GET /ai/insights`, `POST /ai/admin` |
| subscriptions/billing | `GET /subscriptions/plans`, `GET /subscriptions/status`, `POST /billing/order`, `POST /billing/webhook` (HMAC), `GET /billing/history` |
| insights | `GET /insights/overview?institute_id=` |

Error contract: 400 validation, 401 bad token, 403 cross-tenant/role, 404 scoped miss, 409 conflict, 410 removed (payment delete), 429 AI quota, 503 unconfigured backend/provider.

---

## 12. AI Workspace

- **Explain** (any member): concept by subject/topic/level; labelled AI (verify against official notes).
- **Quiz** (staff only): subject/topic/level/count/type → **strict-JSON schema-validated** MCQ/short; returned as **draft — teacher review before publish**.
- **Insights** (no key needed): declining attendance (<60%, ≥3 records), missing homework, draft exams needing marks, fee dues — with **real-DB evidence, no invented grades**, no personal labels.
- **Admin assistant** (staff): canned permission-checked tools (dues, attendance, homework, exams). **No raw AI SQL.**
- Guardrails: keys backend-only, 30 req/user/institute/day, `ai_usage_logs` on every call, timeouts, graceful 503 fallback, no chain-of-thought, minimal PII to provider.

---

## 13. Subscriptions & Billing

Plans are **server config** (`subscriptions.py: PLANS`): Free ₹0 (20 students), Tutor ₹499, Growth ₹999, Pro ₹1,499 — limits on students/staff/batches/AI-day enforced by `GET /subscriptions/status` (real counts + over-limit flags). Illustrative MRR at ₹999: 50 institutes ≈ ₹50K, 100 ≈ ₹1L (before fees/tax/churn — target, not promise).

- Without Razorpay keys: **manual mode** — order endpoint returns instructions, support activates.
- With keys: order in paise → Razorpay checkout → **webhook HMAC-SHA256 verified** → `payment.captured` activates plan + idempotent event log. Client redirect alone never activates. SaaS payments are separate from student `fee_payments`.

---

## 14. Notifications (In-App + WhatsApp)

- **In-app now:** staff post audience-scoped announcements; learners filtered; RLS double-enforced.
- **WhatsApp later, correctly:** approved template + `WHATSAPP_*` creds + guardian opt-in (`notification_preferences`) + `notification_delivery_logs` (pending/sent/failed, idempotent). Unconfigured → 503 + `failed` log (never fake-sent). Fee reminders return a **human-reviewed draft** first.

---

## 15. Testing

```bash
cd backend
source .venv/bin/activate
python3 -m pytest tests/ -q        # 27 offline tests (no live creds): auth, RBAC,
                                   # cross-tenant isolation, enrol/capacity, attendance
                                   # uniqueness, fee math/idempotency/receipts/refunds,
                                   # homework/grading, exam publish, AI schema/quota,
                                   # notification idempotency, webhook HMAC, CSV-safe paths
cd ../frontend && npm run build     # 14 dashboard pages typecheck + build
cd ../mobile && npx tsc --noEmit    # mobile types clean
```

Manual gates per phase: 2-institute isolation, double-click payment = 1 receipt, teacher sees assigned-only, unpublished exam 403 for learners, AI without key = clear 503 (not fake text).

---

## 16. Deployment

See `docs/deployment.md`. TL;DR: Vercel (`frontend/`, 3 public envs) + Python host (`backend/`, `uvicorn app.main:app`, `APP_ENV=prod`, `ALLOWED_ORIGINS=https://<frontend>`) + Supabase (migrations 000→007, backups, private bucket) + EAS for mobile. Health: `GET /` (version), `GET /api/v1/health`. Post-deploy: run the smoke test (§8) on production config.

---

## 17. Security Rules

1. Secrets (service-role, AI, Razorpay, WhatsApp) **backend-only**; frontend/mobile get `sb_publishable_` alone.
2. JWT verified + membership + batch scoping on **every** protected request; RLS is the second layer (003 tightened the three `USING(true)` policies).
3. No client-trusted `role/institute_id/balance/status`; Decimal money; idempotent payments; unique receipts; refunds not deletes; HMAC webhooks; template+consent messaging.
4. Never commit `.env` (root `.gitignore` + `frontend/.env.local` + `backend/.env` + `mobile/.env` all ignored — verified via `git check-ignore`).
5. Pre-prod checklist in `docs/security.md` (rotate keys, restrict origins, isolation test on prod, backups, template approvals).

---

## 18. Troubleshooting

| Symptom | Fix |
|---|---|
| `SUPABASE_SERVICE_KEY … backend/.env` (503) | Put service-role key in `backend/.env`, restart backend |
| `Backend :8000 se baat nahi ho rahi` | `uvicorn app.main:app --reload --port 8000`; phone → LAN IP in `EXPO_PUBLIC_API_BASE_URL` |
| Email rate limit / unconfirmed | Wait 30–60 min same email, or turn Confirm-email OFF for dev; resend link |
| `AI not configured` (503) | Set `AI_API_KEY` (insights/admin still work keyless) |
| WhatsApp `provider not configured` | Set `WHATSAPP_*` + approved template; else use in-app |
| Billing `manual mode` | Set `RAZORPAY_*` + webhook secret for auto activation |
| Upload `bucket` error | Run migration 006 (creates private `materials` bucket) |
| `schema cache` error | Re-run migration, ends with `NOTIFY pgrst, 'reload schema'` |

---

## 19. Docs & Roadmap

- `docs/setup-guide.md` · `docs/deployment.md` · `docs/security.md` · `docs/architecture.md`
- **Done (Phases 0–5):** multi-tenant foundation, safe fees, academic workflows + teacher scoping, portals + materials + enquiries + AI + SaaS, launch hardening (27 tests green).
- **Next:** Razorpay live verification on staging, WhatsApp template approvals, EAS builds, platform super-admin console, CSV import/export hardening, backup/restore runbook.
