# ClassPilot AI — Setup Guide

## Prereqs
- Node 18+, Python 3.11+, Supabase project, Expo Go (mobile)

## 1. Supabase SQL (order matters, each once)
Run in Dashboard → SQL Editor:
1. `supabase/migrations/000_base_tables.sql`
2. `supabase/migrations/001_multi_tenant_foundation.sql`
3. `supabase/migrations/002_mvp_ecosystem.sql`
4. `supabase/migrations/003_phase1_foundation.sql`
5. `supabase/migrations/004_phase2_payments.sql`
6. `supabase/migrations/005_phase3_academic.sql`
7. `supabase/migrations/006_phase4_portals_ai.sql`
8. `supabase/migrations/007_phase5_launch.sql`

Or first-time only: `supabase/RUN_ALL_FIRST_TIME.sql` (000–002), then 003–007.

## 2. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill SUPABASE_URL + SUPABASE_SERVICE_KEY
uvicorn app.main:app --reload --port 8000
# docs: http://localhost:8000/docs
```

## 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # fill URL + publishable key + API base
npm run dev  # http://localhost:3000
```

## 4. Mobile
```bash
cd mobile
npm install
npx expo start --clear
# Phone on same Wi-Fi: set EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:8000
```

## 5. Link student/parent accounts
```sql
update students set user_id='<auth-uuid>' where admission_no='ADM-XXXXXX';
update guardians set user_id='<auth-uuid>' where phone='<phone>';
```
Membership role must be `student`/`parent` in `institute_members`.

## 6. Optional integrations
- AI: `AI_API_KEY` (+ `AI_MODEL`, `AI_BASE_URL`). Insights/admin work without.
- Razorpay: `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`. Without → manual mode.
- WhatsApp: `WHATSAPP_PROVIDER/TOKEN/PHONE_ID` + approved template + opt-in.
