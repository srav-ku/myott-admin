/**
 * GET /api/movies
 *   ?category=popular|top_rated|now_playing|upcoming|trending  (default: popular)
 *   ?page=1
 *   ?genre=28              (TMDB genre id; switches to /discover/movie)
 *   ?year=2024
 *   ?language=en           (TMDB original_language filter)
 *   ?sort_by=popularity.desc   (only with discover)
 *
 * No DB writes here — list endpoints just proxy TMDB (with fetch caching).
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, badRequest, serverError, parseQuery } from '@/lib/http';
import {
  tmdb,
  tmdbImg,
  type TmdbListItem,
  type TmdbPaged,
} from '@/lib/tmdb';
import { getDb } from '@/db/client';
import { movies, links } from '@/db/schema';
import { sql, desc, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
const CATEGORIES = [
  'trending',
] as const;

const QuerySchema = z.object({
  source: z.enum(['local', 'tmdb']).optional().default('tmdb'),
  category: z.enum(CATEGORIES).optional().default('trending'),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  genre: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1888).max(2100).optional(),
  language: z.string().min(2).max(5).optional(),
  sort_by: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = parseQuery(url, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const q = parsed.data;

  try {
    const db = await getDb();

    if (q.source === 'local') {
      const rows = await db
        .select({
          id: movies.id,
          tmdbId: movies.tmdbId,
          title: movies.title,
          overview: movies.overview,
          posterPath: movies.posterPath,
          backdropPath: movies.backdropPath,
          rating: movies.rating,
          releaseDate: movies.releaseDate,
        })
        .from(movies)
        .innerJoin(links, eq(movies.id, links.movieId))
        .groupBy(movies.id)
        .orderBy(desc(movies.updatedAt))
        .limit(q.limit ?? 20)
        .offset(((q.page ?? 1) - 1) * (q.limit ?? 20));

      return ok({
        page: q.page,
        results: rows.map(m => ({
          id: m.tmdbId, // TMDB ID as 'id'
          local_id: m.id,
          media_type: 'movie' as const,
          title: m.title,
          overview: m.overview,
          poster_path: m.posterPath,
          backdrop_path: m.backdropPath,
          vote_average: m.rating,
          release_date: m.releaseDate,
          in_db: true,
        }))
      });
    }

    let path: string;

    const params: Record<string, string | number | undefined> = {
      page: q.page,
    };

    const useDiscover =
      q.genre !== undefined ||
      q.year !== undefined ||
      q.language !== undefined ||
      q.sort_by !== undefined;

    if (useDiscover) {
      path = '/discover/movie';
      if (q.genre) params.with_genres = q.genre;
      if (q.year) params.primary_release_year = q.year;
      if (q.language) params.with_original_language = q.language;
      if (q.sort_by) params.sort_by = q.sort_by;
    } else if (q.category === 'trending') {
      path = '/trending/movie/week';
    } else {
      path = `/movie/${q.category}`;
    }

    // 1. Fetch from TMDB (with built-in caching in tmdb helper)
    const data = await tmdb<TmdbPaged<TmdbListItem>>(path, params);
    
    // 2. Bulk-persist to DB to ensure DB-first availability for subsequent calls
    if (data.results.length > 0) {
      const values = data.results.map((m) => ({
        tmdbId: m.id,
        title: m.title ?? m.original_title ?? 'Untitled',
        overview: m.overview ?? null,
        posterPath: m.poster_path ?? null,
        backdropPath: m.backdrop_path ?? null,
        rating: m.vote_average ?? null,
        releaseDate: m.release_date ?? null,
        releaseYear: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
      }));

      // Use onConflictDoUpdate to keep data fresh but avoid duplicates
      for (const v of values) {
        await db.insert(movies).values(v).onConflictDoUpdate({
          target: movies.tmdbId,
          set: {
            rating: v.rating,
            updatedAt: sql`(unixepoch())`,
          },
        });
      }
    }

    // LOG RAW TMDB DATA
    console.log(`\n--- RAW TMDB DATA FROM ${path} ---`);
    console.log(JSON.stringify(data, null, 2));
    console.log('--- END RAW TMDB DATA ---\n');

    // 3. Return results
    return ok({
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      results: data.results.map((m) => ({
        ...m,
        id: m.id,
        media_type: 'movie' as const,
        in_db: false, // In this list view, we assume false unless filtered otherwise
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return badRequest(err);
    return serverError(err);
  }
}
