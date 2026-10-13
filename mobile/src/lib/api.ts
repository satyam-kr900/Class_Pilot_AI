const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class BackendVerifyError extends Error {
  status: number | null;
  isServerFault: boolean;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'BackendVerifyError';
    this.status = status;
    this.isServerFault = status === null || status >= 500;
  }
}

/** Duck-typing check — minified Hermes builds me instanceof se safe. */
export function isServerFault(e: unknown): boolean {
  if (e instanceof BackendVerifyError) return e.isServerFault;
  return /failed to fetch|network request failed|network|ECONNREFUSED|Load failed/i.test(
    e instanceof Error ? e.message : String(e)
  );
}

async function post(path: string, accessToken: string) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
  } catch {
    throw new BackendVerifyError(
      'Backend :8000 se baat nahi ho rahi — backend start karo (phone par LAN IP use karo).',
      null
    );
  }
  const data = (await res.json().catch(() => ({}))) as { detail?: string };
  if (!res.ok) {
    throw new BackendVerifyError(data.detail || `Backend ${path} failed (${res.status})`, res.status);
  }
  return data;
}

/** Signup ke baad: backend token verify + default institute banata hai. */
export function registerWithBackend(accessToken: string) {
  return post('/auth/register', accessToken);
}

/** Login ke baad: backend token verify karta hai, tabhi tabs. */
export function verifyWithBackend(accessToken: string) {
  return post('/auth/verify', accessToken);
}
