import { getDb } from '@/db/client';
import { ads } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    const { id } = await params;
    const body = (await req.json()) as any;
    
    const db = await getDb();
    
    const result = await db
      .update(ads)
      .set({
        ...body,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(ads.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return fail('Ad not found', 404);
    }

    return NextResponse.json({ ok: true, ad: result[0] });
  } catch (error) {
    console.error('Failed to update ad:', error);
    return fail('Failed to update ad', 500);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    const { id } = await params;
    const db = await getDb();
    
    const result = await db
      .delete(ads)
      .where(eq(ads.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return fail('Ad not found', 404);
    }

    return NextResponse.json({ ok: true, ad: result[0] });
  } catch (error) {
    console.error('Failed to delete ad:', error);
    return fail('Failed to delete ad', 500);
  }
}
