/**
 * GET /api/movies/by-id/[id] — public lookup by internal DB id.
 * Returns the same shape as /api/movies/[tmdbId] (sans `links`/`_meta`),
 * so the watch page can use either.
 */
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { ok, fail, notFound, serverError } from '@/lib/http';
import { getDb } from '@/db/client';
import { movies } from '@/db/schema';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return fail('Invalid id', 400);
  try {
    const db = await getDb();
    const r = await db.select().from(movies).where(eq(movies.id, id)).limit(1);
    if (r.length === 0) return notFound('Movie not found');
    const m = r[0];
    return ok({
      id: m.id,
      tmdb_id: m.tmdbId,
      title: m.title,
      overview: m.overview,
      poster_url: m.posterPath
        ? `https://image.tmdb.org/t/p/w500${m.posterPath}`
        : null,
      backdrop_url: m.backdropPath
        ? `https://image.tmdb.org/t/p/w780${m.backdropPath}`
        : null,
      rating: m.rating,
      release_date: m.releaseDate,
      release_year: m.releaseYear,
      runtime: m.runtime,
      genres: m.genres,
    });
  } catch (err) {
    return serverError(err);
  }
}
