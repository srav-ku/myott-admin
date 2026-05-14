/**
 * GET /api/admin/needs-attention
 *
 * Returns content that requires admin action:
 *  1. Movies with NO links.
 *  2. TV shows where at least one episode has NO links.
 */
import { NextRequest } from 'next/server';
import { eq, isNull, sql } from 'drizzle-orm';
import { ok, serverError } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { movies, tv, episodes, links } from '@/db/schema';
import { tmdbImg } from '@/lib/tmdb';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const db = await getDb();

    // 1. Movies with NO links
    // LEFT JOIN movies -> links WHERE links.id IS NULL
    const moviesNeedingLinks = await db
      .select({
        id: movies.id,
        tmdbId: movies.tmdbId,
        title: movies.title,
        posterPath: movies.posterPath,
        releaseDate: movies.releaseDate,
      })
      .from(movies)
      .leftJoin(links, eq(movies.id, links.movieId))
      .where(isNull(links.id))
      .orderBy(movies.createdAt)
      .limit(100);

    // 2. TV shows with missing episode links
    // Find episodes without links, then get their unique TV shows
    const tvNeedingLinks = await db
      .select({
        id: tv.id,
        tmdbId: tv.tmdbId,
        name: tv.name,
        posterPath: tv.posterPath,
        numberOfSeasons: tv.numberOfSeasons,
        oldestEpisode: sql`min(${episodes.createdAt})`,
      })
      .from(tv)
      .innerJoin(episodes, eq(tv.id, episodes.tvId))
      .leftJoin(links, eq(episodes.id, links.episodeId))
      .where(isNull(links.id))
      .groupBy(tv.id)
      .orderBy(sql`min(${episodes.createdAt})`)
      .limit(100);

    return ok({
      movies: moviesNeedingLinks.map((m) => ({
        ...m,
        poster_url: tmdbImg(m.posterPath, 'w500'),
      })),
      tv: tvNeedingLinks.map((s) => ({
        ...s,
        poster_url: tmdbImg(s.posterPath, 'w500'),
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}
