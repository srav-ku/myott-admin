/**
 * PATCH /api/admin/reports/[id]
 *   Body: { status: 'open' | 'resolved' }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { ok, fail, notFound, serverError, parseJson } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { reports, REPORT_STATUS } from '@/db/schema';

export const runtime = 'nodejs';

const Schema = z.object({ status: z.enum(REPORT_STATUS) });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return fail('Invalid id', 400);
  const parsed = await parseJson(req, Schema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = await getDb();
    const updated = await db
      .update(reports)
      .set({
        status: parsed.data.status,
        resolvedAt: parsed.data.status === 'resolved' ? new Date() : null,
      })
      .where(eq(reports.id, id))
      .returning();
    if (updated.length === 0) return notFound('Report not found');
    return ok({ report: updated[0] });
  } catch (err) {
    return serverError(err);
  }
}
