# ClassPilot AI — Deployment (exact steps)

## 0. Pre-deploy checklist (local pe green hona chahiye)
```bash
cd backend && python3 -m pytest tests/ -q        # 39+ pass, koi fail nahi
cd ../frontend && npm run build                    # 21/21 pages, koi error nahi
cd ../mobile && npx tsc --noEmit                   # clean
```
- [ ] Supabase me migrations 000→008 run (prod project me — `SETUP_ALL_AT_ONCE.sql` + `008_student_phones.sql`)
- [ ] `.env` files commit nahi hui (`.gitignore` covers backend/.env, frontend/.env.local, mobile/.env)
- [ ] `requirements.txt` pinned versions = tested versions

## 1. Backend → Render (Blueprint, `render.yaml` ready hai)
1. Render Dashboard → New → **Blueprint** → repo select karo (`render.yaml` auto-detect hoga).
2. Env vars set karo (dashboard, `sync: false` wali):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service_role — **required**)
   - `APP_ENV=prod`
   - `ALLOWED_ORIGINS=https://<tumhara-frontend-domain>` (koi trailing slash nahi; prod CORS sirf yahi allow karta hai — galat hone par browser preflight **400** dega; startup pe warning bhi log hogi)
   - Optional: `AI_*`, `RAZORPAY_*`, `WHATSAPP_*` (absent = degraded mode: manual billing, in-app only, AI insights still work)
3. Deploy → `https://<api>.onrender.com/api/v1/health` → `{"status":"ok"}` aana chahiye.
4. **Cold starts:** free tier pehla request slow hota hai — frontend me 1 retry ya warmup ping rakho.

## 2. Frontend → Vercel
1. Vercel → New Project → repo → **Root Directory: `frontend/`** (framework auto: Next.js).
2. Env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon/publishable — **kabhi service key nahi**)
   - `NEXT_PUBLIC_API_BASE_URL=https://<api>.onrender.com`
   - `NEXT_PUBLIC_ALLOW_DEMO=0` (**prod me demo login band** — junk accounts nahi banenge)
3. Deploy → `https://<app>.vercel.app/login` kholo.
4. Is domain ko wapas backend `ALLOWED_ORIGINS` me dalo (step 1) + backend redeploy.

## 3. Supabase (prod project)
- SQL Editor me `SETUP_ALL_AT_ONCE.sql` + `008_student_phones.sql` run (order me).
- Auth → Providers → Email: **Confirm email ON** (prod), rate limits default.
- Backups: Pro plan daily, else weekly `pg_dump` cron.
- Storage bucket `materials` private rahe — koi public policy mat banao.

## 4. Mobile (EAS, jab chahiye)
```bash
cd mobile && npx eas-cli login && eas build:configure
```
- `eas.json` me `EXPO_PUBLIC_API_BASE_URL=https://<api>.onrender.com` + Supabase publishable key.
- Prod build se pehle `EXPO_PUBLIC_ALLOW_DEMO=0` (demo/guest buttons gayab).
- `app.json` me `android.package` / `ios.bundleIdentifier` apne Acte par set karo, phir `eas build -p android --profile production`.

## 5. Post-deploy smoke test (prod pe, 5 min)
1. Signup (naya email) → email confirm → Login
2. Onboarding → institute banao → Verified card
3. Students → add (mobile numbers ke saath) → Batches → enrol
4. Attendance → save → Fees → collect (receipt `R-...`, double-click = 1 payment)
5. Exams → draft → marks → publish
6. Admin → teacher banao → teacher login (incognito) → assigned-only dikhe
7. `/find-account` → mobile se lookup → masked email hint

## 6. Rollback
- Vercel: Deployments → pichhla → Promote. Render: deploys → Rollback. DB migrations backward-compatible hain (sirf ADD COLUMN / IF NOT EXISTS) — rollback safe.
