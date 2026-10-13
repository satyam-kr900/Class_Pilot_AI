# ClassPilot AI — Architecture

```
Next.js 14 (frontend/) + Expo (mobile/)
  -> HTTPS + Supabase JWT
  -> FastAPI (backend/app) /api/v1
     -> api_deps (verify JWT, membership, batch scoping)
     -> routers: auth, institutes, students, batches, sessions, attendance,
        fees (+refunds), assignments, materials, exams, enquiries,
        portals, notifications (+whatsapp), ai, subscriptions, billing, insights
  -> Supabase Postgres (RLS) + Auth + Storage(materials, private)
  -> Integrations: AI (OpenAI-compatible, backend-only),
     Razorpay (orders + HMAC webhook), WhatsApp (Meta-compatible adapter)
```

## Data flow (example: fee)
UI generates `idempotency_key` → `POST /api/v1/fees` (Bearer) → membership +
student-in-institute checks → existing-key? return : insert payment + `R-XXXXXXXX`
receipt → dashboard/summary update. Double-click safe.

## Migrations
`supabase/migrations/000` base → `001` tenancy → `002` ecosystem → `003` profiles/
invites/guardians/admission → `004` idempotency/receipts → `005` sessions/
submissions/publish → `006` portals/materials/AI usage + bucket → `007`
notifications/refunds/SaaS events.

## Roles
owner/staff full (owner-only: billing, teacher assign), teacher assigned-only,
student self, parent linked children, super-admin out of scope (support via audit).
