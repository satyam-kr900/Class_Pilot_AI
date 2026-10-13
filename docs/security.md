# ClassPilot AI — Security

## Rules (enforced + tested)
1. Service-role / AI / payment / WhatsApp secrets live ONLY in backend env. Never in frontend/mobile bundles (`sb_publishable_` only).
2. Every protected endpoint verifies Supabase JWT (`sb.auth.get_user`) + checks `institute_members` server-side. Client `institute_id/role/balance` never trusted.
3. Teachers see assigned batches only (`batch_teachers`); students see own linked records; parents see linked children; SaaS billing separate from student fees.
4. Money = `NUMERIC`/`Decimal`, never float. Payments idempotent (`idempotency_key`), receipts unique per institute, refunds preserve history (no hard delete).
5. Razorpay: webhook HMAC-SHA256 verified + idempotent by `(provider, event_id)`; plan activates only on `payment.captured`. Client redirect alone never activates.
6. WhatsApp: approved templates + opt-in (`notification_preferences`); statuses pending/sent/failed logged; unconfigured → 503 + failed log, never fake-sent.
7. AI: keys server-side, 30 req/user/institute/day, usage logged, quiz schema-validated + teacher review, insights evidence-based, no raw AI SQL.

## RLS
- All tables RLS on. 003 tightened `batch_students/batch_teachers/marks` (were `USING(true)`). Backend service-role re-checks membership in code; RLS is second layer.
- Cross-tenant tests: `tests/test_phase1.py` → `test_phase5.py` run offline in CI.

## Before production
- [ ] Rotate any leaked keys, set `APP_ENV=prod`, restrict `ALLOWED_ORIGINS`
- [ ] Run 2-institute isolation test on prod data
- [ ] Confirm backups + webhook secret + WhatsApp template approvals
