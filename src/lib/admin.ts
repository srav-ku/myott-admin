import 'server-only';
import type { NextResponse } from 'next/server';
import { fail } from './http';
import { verifyIdToken } from './firebase-admin';

export function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export type AdminGuard =
  | { ok: true; email: string; openMode: boolean }
  | { ok: false; response: NextResponse };

export async function requireAdmin(req: Request): Promise<AdminGuard> {
  const allowed = getAdminEmails();
  
  // Open mode if no admin emails configured
  if (allowed.size === 0) {
    return { ok: true, email: 'dev', openMode: true };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: fail('Forbidden — admin only (missing token)', 403) };
  }

  const token = authHeader.substring(7);
  const decodedToken = await verifyIdToken(token);

  if (!decodedToken || !decodedToken.email) {
    return { ok: false, response: fail('Forbidden — invalid session', 403) };
  }

  const email = decodedToken.email.toLowerCase();
  if (!allowed.has(email)) {
    return { ok: false, response: fail('Forbidden — admin only', 403) };
  }

  return { ok: true, email, openMode: false };
}
