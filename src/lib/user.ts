import 'server-only';
import { eq, or } from 'drizzle-orm';
import type { NextResponse } from 'next/server';
import { fail } from './http';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { verifyIdToken } from './firebase-admin';
import { getAdminEmails } from './admin';

export type UserRow = typeof users.$inferSelect;

export type UserGuard =
  | { ok: true; user: UserRow }
  | { ok: false; response: NextResponse };

export async function requireUser(req: Request): Promise<UserGuard> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: fail('Sign in required (missing Authorization header)', 401),
    };
  }

  const token = authHeader.substring(7);
  const decodedToken = await verifyIdToken(token);

  if (!decodedToken) {
    return {
      ok: false,
      response: fail('Invalid or expired session', 401),
    };
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email?.toLowerCase() || null;
  const name = decodedToken.name || null;

  const db = await getDb();
  
  // 1. Check if user already exists (by UID or by Email)
  const existing = await db
    .select()
    .from(users)
    .where(
      email 
        ? or(eq(users.id, uid), eq(users.email, email))
        : eq(users.id, uid)
    )
    .limit(1);

  const allowed = getAdminEmails();
  const isAdmin = email ? allowed.has(email) : false;

  if (existing.length > 0) {
    const user = existing[0];
    
    // If user exists but details (UID, Name, Email, Admin status) changed, update them.
    // This also handles migrating a row if the same email is found under a different ID.
    if (
      user.id !== uid || 
      user.email !== email || 
      user.displayName !== name ||
      user.isAdmin !== isAdmin
    ) {
      const updated = await db
        .update(users)
        .set({ 
          id: uid, // Update ID if we found them by email but ID was different
          email, 
          displayName: name,
          isAdmin,
          authProvider: 'google' 
        })
        .where(eq(users.id, user.id))
        .returning();
      return { ok: true, user: updated[0] };
    }
    return { ok: true, user };
  }

  // 2. New user — Insert
  const inserted = await db
    .insert(users)
    .values({
      id: uid,
      email: email,
      displayName: name,
      authProvider: 'google',
      isAdmin,
    })
    .returning();
    
  return { ok: true, user: inserted[0] };
}
