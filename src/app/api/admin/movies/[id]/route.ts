/**
 * DELETE /api/admin/movies/[id]
 *   Removes a movie + cascades links/history/watchlist references.
 *   Note: there's no admin "create movie" — content comes from TMDB on demand.
 */
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { ok, fail, notFound, serverError } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { movies } from '@/db/schema';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return fail('Invalid id', 400);
  try {
    const db = await getDb();
    const deleted = await db
      .delete(movies)
      .where(eq(movies.id, id))
      .returning();
    if (deleted.length === 0) return notFound('Movie not found');
    return ok({ deleted: deleted[0].id });
  } catch (err) {
    return serverError(err);
  }
}
