const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

/**
 * 401/400 = token kharab → login BLOCK.
 * 5xx ya network fail = backend kharab → user ki galti nahi, aage jaane do (warning ke saath).
 */
export class BackendVerifyError extends Error {
  status: number | null;
  isServerFault: boolean;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "BackendVerifyError";
    this.status = status;
    this.isServerFault = status === null || status >= 500;
  }
}

export function isServerFault(e: unknown): boolean {
  return e instanceof BackendVerifyError
    ? e.isServerFault
    : /failed to fetch|network|ECONNREFUSED|Load failed/i.test(e instanceof Error ? e.message : String(e));
}

async function post(path: string, accessToken: string) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    });
  } catch {
    throw new BackendVerifyError(
      "Backend :8000 se baat nahi ho rahi — backend start karo (`uvicorn app.main:app --reload --port 8000`).",
      null
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail || `Backend ${path} failed (${res.status})`;
    throw new BackendVerifyError(detail, res.status);
  }
  return data;
}

/** Mobile account finder — token nahi deta, sirf login email hint (public, rate-limited). */
export async function findAccountViaAPI(body: { institute_name: string; student_name: string; mobile: string; who: string }) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${v1("/auth/find-account")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BackendVerifyError("Backend :8000 se baat nahi ho rahi.", null);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail || `Lookup failed (${res.status})`;
    throw new BackendVerifyError(detail, res.status);
  }
  return data as {
    found: boolean;
    linked: boolean;
    institute: { id: string; name: string };
    student: string;
    role?: string;
    login_email_masked?: string;
    note?: string;
  };
}

/** Signup ke baad: backend token verify + default institute banata hai. */
export function registerWithBackend(accessToken: string) {
  return post("/auth/register", accessToken) as Promise<{
    verified: boolean;
    user_id: string;
    email: string;
    institute: unknown;
  }>;
}

/** Login ke baad: backend token verify karta hai, tabhi dashboard. */
export function verifyWithBackend(accessToken: string) {
  return post("/auth/verify", accessToken) as Promise<{
    verified: boolean;
    user_id: string;
    email: string;
  }>;
}

async function get(path: string, accessToken: string) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new BackendVerifyError(
      "Backend :8000 se baat nahi ho rahi — backend start karo (`uvicorn app.main:app --reload --port 8000`).",
      null
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail || `Backend ${path} failed (${res.status})`;
    throw new BackendVerifyError(detail, res.status);
  }
  return data;
}

export type Membership = {
  institute_id: string;
  role: string;
  institutes: { id: string; name: string; plan: string } | null;
};

/** Caller ke institutes (memberships). Frontend switcher isi se banta hai. */
export function myInstitutes(accessToken: string) {
  // Prefer versioned API, fallback to legacy path for old backend.
  return get("/api/v1/institutes/me", accessToken).catch(() =>
    get("/institutes/me", accessToken)
  ) as Promise<{ user_id: string; memberships: Membership[] }>;
}

/** Onboarding: chosen name se institute banao (owner membership auto). */
export function createInstituteViaAPI(accessToken: string, body: { name: string; city?: string | null; phone?: string | null }) {
  return apiPost(v1("/institutes"), accessToken, body);
}

/** Verify membership + institute ka live data (stats ke saath). */
export function getInstituteViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/institutes")}/${instituteId}`, accessToken) as Promise<{
    verified: boolean;
    institute: { id: string; name: string; plan: string; created_at: string };
    my_role: string;
    stats: { students: number; batches: number };
  }>;
}

async function apiPost(path: string, accessToken: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BackendVerifyError(
      "Backend :8000 se baat nahi ho rahi — backend start karo (`uvicorn app.main:app --reload --port 8000`).",
      null
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail || `Backend ${path} failed (${res.status})`;
    throw new BackendVerifyError(detail, res.status);
  }
  return data;
}

const v1 = (p: string) => `/api/v1${p}`;

/** Phase 2: writes go via FastAPI (auth + institute check server-side). */
export function createStudentViaAPI(
  accessToken: string,
  body: { institute_id: string; name: string; batch?: string | null; monthly_fee: number; guardian_name?: string | null; guardian_phone?: string | null; student_phone?: string | null }
) {
  return apiPost(v1("/students"), accessToken, body);
}

export function collectFeeViaAPI(
  accessToken: string,
  body: {
    institute_id: string;
    student_id: string;
    amount: number;
    payment_method: string;
    idempotency_key: string;
  }
) {
  return apiPost(v1("/fees"), accessToken, body);
}

export function saveAttendanceViaAPI(
  accessToken: string,
  rows: { institute_id: string; student_id: string; attendance_date: string; status: string }[]
) {
  return apiPost(v1("/attendance/upsert"), accessToken, rows);
}

export async function archiveStudentViaAPI(accessToken: string, studentId: string, instituteId: string) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${v1(`/students/${studentId}`)}?institute_id=${instituteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new BackendVerifyError("Backend :8000 se baat nahi ho rahi.", null);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail || `Delete failed (${res.status})`;
    throw new BackendVerifyError(detail, res.status);
  }
  return data;
}

/** Phase 3 academic APIs — all writes verified server-side with teacher scoping. */
export function listBatchesViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/batches")}?institute_id=${instituteId}`, accessToken);
}
export function createBatchViaAPI(accessToken: string, body: { institute_id: string; name: string; subject?: string | null; capacity?: number | null }) {
  return apiPost(v1("/batches"), accessToken, body);
}
export function enrolViaAPI(accessToken: string, batchId: string, instituteId: string, studentId: string) {
  return apiPost(`${v1(`/batches/${batchId}/enrol`)}?institute_id=${instituteId}&student_id=${studentId}`, accessToken, {});
}
export function listSessionsViaAPI(accessToken: string, instituteId: string, from?: string, to?: string) {
  let p = `${v1("/sessions")}?institute_id=${instituteId}`;
  if (from) p += `&from_date=${from}`;
  if (to) p += `&to_date=${to}`;
  return get(p, accessToken);
}
export function createSessionViaAPI(accessToken: string, body: { institute_id: string; batch_id: string; title: string; subject?: string | null; starts_at: string; ends_at: string; room?: string | null }) {
  return apiPost(v1("/sessions"), accessToken, body);
}
export function listAssignmentsViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/assignments")}?institute_id=${instituteId}`, accessToken);
}
export function createAssignmentViaAPI(accessToken: string, body: { institute_id: string; batch_id?: string | null; title: string; description?: string | null; due_date?: string | null }) {
  return apiPost(v1("/assignments"), accessToken, body);
}
export function listExamsViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/exams")}?institute_id=${instituteId}`, accessToken);
}
export function createExamViaAPI(accessToken: string, body: { institute_id: string; batch_id?: string | null; name: string; exam_date?: string | null }) {
  return apiPost(v1("/exams"), accessToken, body);
}
export function enterMarksViaAPI(accessToken: string, examId: string, instituteId: string, marks: { student_id: string; score: number; max_score: number }[]) {
  return apiPost(`${v1(`/exams/${examId}/marks`)}?institute_id=${instituteId}`, accessToken, marks);
}
export function publishExamViaAPI(accessToken: string, examId: string, instituteId: string, status: string) {
  return apiPost(`${v1(`/exams/${examId}/publish`)}?institute_id=${instituteId}&status=${status}`, accessToken, {});
}

/** Phase 4 — portals, materials, enquiries, AI, subscriptions. */
export function myLearningViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/portals/my-learning")}?institute_id=${instituteId}`, accessToken);
}
export function listMaterialsViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/materials")}?institute_id=${instituteId}`, accessToken);
}
export function listEnquiriesViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/enquiries")}?institute_id=${instituteId}`, accessToken);
}
export function createEnquiryViaAPI(accessToken: string, body: { institute_id: string; name: string; phone?: string | null; course?: string | null }) {
  return apiPost(v1("/enquiries"), accessToken, body);
}
export function convertEnquiryViaAPI(accessToken: string, enquiryId: string, instituteId: string) {
  return apiPost(`${v1(`/enquiries/${enquiryId}/convert`)}?institute_id=${instituteId}`, accessToken, {});
}
export function aiExplainViaAPI(accessToken: string, body: { institute_id: string; subject: string; topic: string; level: string }) {
  return apiPost(v1("/ai/explain"), accessToken, body);
}
export function aiQuizViaAPI(accessToken: string, body: { institute_id: string; subject: string; topic: string; level: string; count: number; qtype: string }) {
  return apiPost(v1("/ai/quiz"), accessToken, body);
}
export function aiInsightsViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/ai/insights")}?institute_id=${instituteId}`, accessToken);
}
export function aiAdminViaAPI(accessToken: string, body: { institute_id: string; question: string }) {
  return apiPost(v1("/ai/admin"), accessToken, body);
}
export function subscriptionStatusViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/subscriptions/status")}?institute_id=${instituteId}`, accessToken);
}
export function listNotificationsViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/notifications")}?institute_id=${instituteId}`, accessToken);
}
export function createNotificationViaAPI(accessToken: string, body: { institute_id: string; title: string; body: string; audience: string }) {
  return apiPost(v1("/notifications"), accessToken, body);
}
export function createBillingOrderViaAPI(accessToken: string, body: { institute_id: string; plan: string }) {
  return apiPost(v1("/billing/order"), accessToken, body);
}
export function requestMaterialUploadViaAPI(accessToken: string, body: { institute_id: string; batch_id?: string | null; filename: string; mime?: string | null }) {
  return apiPost(v1("/materials/upload-url"), accessToken, body);
}export function confirmMaterialViaAPI(accessToken: string, body: { institute_id: string; batch_id?: string | null; title: string; file_path: string; mime?: string | null; size_bytes?: number | null }) {
  return apiPost(v1("/materials"), accessToken, body);
}

/** Admin panel — owner/staff only. Temp passwords ek baar return hote hain. */
export function adminCreateTeacherViaAPI(accessToken: string, body: { institute_id: string; name: string; email: string; password?: string | null; batch_ids?: string[] }) {
  return apiPost(v1("/admin/teacher"), accessToken, body);
}
export function adminCreateStudentFullViaAPI(accessToken: string, body: { institute_id: string; name: string; batch?: string | null; monthly_fee: number; guardian_name?: string | null; guardian_phone?: string | null; student_phone?: string | null }) {
  return apiPost(v1("/admin/student-full"), accessToken, body);
}
export function adminCreateLearnerAccountViaAPI(accessToken: string, body: { institute_id: string; kind: string; email: string; password?: string | null; student_id: string; guardian_id?: string | null }) {
  return apiPost(v1("/admin/learner-account"), accessToken, body);
}
export function adminMembersViaAPI(accessToken: string, instituteId: string) {
  return get(`${v1("/admin/members")}?institute_id=${instituteId}`, accessToken);
}
