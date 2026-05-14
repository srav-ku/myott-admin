/**
 * GET /api/movies/[tmdbId]
 *   - DB-first lookup by tmdb_id.
 *   - On miss: fetch from TMDB, persist once, return.
 *   - Always returns the DB row so downstream features (links, watchlist,
 *     reports) can reference our internal `id`.
 */
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { ok, fail, notFound, serverError } from '@/lib/http';
import { getDb } from '@/db/client';
import { links } from '@/db/schema';
import { getOrCreateMovieByTmdbId } from '@/lib/persist';
import { tmdbImg } from '@/lib/tmdb';
import { requireUser } from '@/lib/user';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tmdbId: string }> },
) {
  const { tmdbId: tmdbIdRaw } = await ctx.params;
  const tmdbId = Number(tmdbIdRaw);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return fail('Invalid tmdbId', 400);
  }

  try {
    const { row: movie, created } = await getOrCreateMovieByTmdbId(tmdbId);
    if (!movie) return notFound('Movie not found');

    const db = await getDb();
    
    // Stealth Mode Check
    const guard = await requireUser(_req);
    const isStealthOn = guard.ok && guard.user.stealthMode;

    let movieLinks: any[] = [];
    if (isStealthOn) {
      const allLinks = await db
        .select()
        .from(links)
        .where(eq(links.movieId, movie.id));
      movieLinks = allLinks.map((l) => ({
        id: l.id,
        quality: l.quality,
        type: l.type,
        languages: l.languages,
      }));
    }

    return ok({
      id: movie.id,
      tmdb_id: movie.tmdbId,
      imdb_id: movie.imdbId,
      title: movie.title,
      overview: movie.overview,
      poster_url: tmdbImg(movie.posterPath, 'w500'),
      backdrop_url: tmdbImg(movie.backdropPath, 'original'),
      rating: movie.rating,
      release_date: movie.releaseDate,
      release_year: movie.releaseYear,
      runtime: movie.runtime,
      genres: movie.genres ?? [],
      links: movieLinks,
      _meta: { source: created ? 'tmdb' : 'cache' },
    });
  } catch (err) {
    return serverError(err);
  }
}

