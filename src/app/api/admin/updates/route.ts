import { getDb } from '@/db/client';
import { updates } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    const db = await getDb();
    const results = await db
      .select()
      .from(updates)
      .orderBy(desc(updates.createdAt))
      .limit(100);

    return NextResponse.json({ ok: true, updates: results });
  } catch (error) {
    console.error('Failed to fetch admin updates:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch updates', updates: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    const body = await req.json();
    const { message, type, expiresAt } = body;

    if (!message) {
      return fail('Message is required', 400);
    }

    const db = await getDb();
    
    // Default to 7 days from now if not provided
    const finalExpiresAt = expiresAt 
      ? new Date(expiresAt) 
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await db
      .insert(updates)
      .values({
        message,
        type: type || 'info',
        expiresAt: finalExpiresAt,
      })
      .returning();

    return NextResponse.json({ ok: true, update: result[0] });
  } catch (error) {
    console.error('Failed to create update:', error);
    return fail('Failed to create update', 500);
  }
}
