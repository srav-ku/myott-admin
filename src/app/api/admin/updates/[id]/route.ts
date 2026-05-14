import { getDb } from '@/db/client';
import { updates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    const { id } = await params;
    const updateId = parseInt(id);

    if (isNaN(updateId)) {
      return fail('Invalid ID', 400);
    }

    const db = await getDb();
    await db.delete(updates).where(eq(updates.id, updateId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete update:', error);
    return fail('Failed to delete update', 500);
  }
}

