/**
 * Tiny browser fetch wrapper that auto-injects auth headers from localStorage.
 *
 * The frontend stores `{ email, name }` under key `ott:user`. Two headers are
 * forwarded to the API:
 *   - `x-user-email` — used by `requireUser` (Phase 6 user APIs)
 *   - `x-admin-email` — used by `requireAdmin` (Phase 5 admin APIs)
 *
 * When `ADMIN_EMAILS` is set on the server, only signed-in users whose email
 * matches the allowlist will be allowed to hit admin endpoints.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

const STORAGE_KEY = 'ott:user';

export type StoredUser = {
  uid: string;
  email: string;
  displayName: string;
  token: string;
  stealthMode: boolean;
};

export function readStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(u: StoredUser | null) {
  if (typeof window === 'undefined') return;
  if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  else localStorage.removeItem(STORAGE_KEY);
}

function buildAuthHeaders(): HeadersInit {
  const u = readStoredUser();
  if (!u || !u.token) return {};
  return {
    Authorization: `Bearer ${u.token}`,
  };
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(buildAuthHeaders() as Record<string, string>),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  }

  const j = body as { ok?: boolean; data?: unknown; error?: string };

  // If it's a successful response and has the standard envelope, return the data
  if (res.ok && j && typeof j === 'object' && j.ok === true) {
    return { ok: true, data: (j.data !== undefined ? j.data : j) as T };
  }

  // If it's a successful response but doesn't have the envelope, return the body itself as data
  if (res.ok) {
    return { ok: true, data: body as T };
  }

  // Handle errors
  return {
    ok: false,
    status: res.status,
    error: j?.error || `HTTP ${res.status}`,
  };
}

export const tmdbPoster = (path: string | null | undefined, size = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export const tmdbBackdrop = (path: string | null | undefined, size = 'original') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
