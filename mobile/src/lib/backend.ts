import { supabase } from './supabase';

/**
 * Phase 5 backend client — same FastAPI + same Supabase as web.
 * Writes go via /api/v1 with Bearer (auth + institute checks server-side).
 * Reads fall back to Supabase RLS when backend is down.
 */
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:8000';

const v1 = (p: string) => `/api/v1${p}`;

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error('Session expired — dobara login karo.');
  return t;
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${await token()}` },
  });
  const data = (await res.json().catch(() => ({}))) as { detail?: string };
  if (!res.ok) throw new Error(data.detail || `Backend failed (${res.status})`);
  return data;
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { detail?: string };
  if (!res.ok) throw new Error(data.detail || `Backend failed (${res.status})`);
  return data;
}

export const backend = {
  myInstitutes: () => apiGet(v1('/institutes/me')),
  listBatches: (institute_id: string) => apiGet(`${v1('/batches')}?institute_id=${institute_id}`),
  listStudents: (institute_id: string) => apiGet(`${v1('/students')}?institute_id=${institute_id}`),
  createStudent: (body: { institute_id: string; name: string; monthly_fee: number }) =>
    apiPost(v1('/students'), body),
  collectFee: (body: { institute_id: string; student_id: string; amount: number; payment_method: string; idempotency_key: string }) =>
    apiPost(v1('/fees'), body),
  saveAttendance: (rows: { institute_id: string; student_id: string; attendance_date: string; status: string }[]) =>
    apiPost(v1('/attendance/upsert'), rows),
  myLearning: (institute_id: string) => apiGet(`${v1('/portals/my-learning')}?institute_id=${institute_id}`),
  listNotifications: (institute_id: string) =>
    apiGet(`${v1('/notifications')}?institute_id=${encodeURIComponent(institute_id)}`),
};
