/**
 * GET /api/admin/content-requests?status=pending&limit=100
 *   Returns the deduped "missing content" signals from /api/search.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { ok, serverError, parseQuery } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { contentRequests, REQUEST_STATUS } from '@/db/schema';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  status: z.enum(REQUEST_STATUS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const parsed = parseQuery(url, QuerySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = await getDb();
    const base = db.select().from(contentRequests);
    const filtered = parsed.data.status
      ? base.where(eq(contentRequests.status, parsed.data.status))
      : base;
    const rows = await filtered
      .orderBy(desc(contentRequests.count), desc(contentRequests.lastRequestedAt))
      .limit(parsed.data.limit ?? 100);
    return ok({ requests: rows });
  } catch (err) {
    return serverError(err);
  }
}
