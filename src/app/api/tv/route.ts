/**
 * GET /api/tv
 *   ?category=popular|top_rated|on_the_air|airing_today|trending  (default: popular)
 *   ?page=1
 *   ?genre=18
 *   ?language=en
 *   ?sort_by=popularity.desc   (only with discover)
 *
 * No DB writes here.
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
import { tv, episodes, links } from '@/db/schema';
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
          id: tv.id,
          tmdbId: tv.tmdbId,
          name: tv.name,
          overview: tv.overview,
          posterPath: tv.posterPath,
          backdropPath: tv.backdropPath,
          rating: tv.rating,
          firstAirDate: tv.firstAirDate,
        })
        .from(tv)
        .innerJoin(episodes, eq(tv.id, episodes.tvId))
        .innerJoin(links, eq(episodes.id, links.episodeId))
        .groupBy(tv.id)
        .orderBy(desc(tv.updatedAt))
        .limit(q.limit ?? 20)
        .offset(((q.page ?? 1) - 1) * (q.limit ?? 20));
      
      return ok({
        page: q.page,
        results: rows.map(s => ({
          id: s.tmdbId, // TMDB ID as 'id'
          local_id: s.id,
          media_type: 'tv' as const,
          name: s.name,
          overview: s.overview,
          poster_path: s.posterPath,
          backdrop_path: s.backdropPath,
          vote_average: s.rating,
          first_air_date: s.firstAirDate,
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
      q.language !== undefined ||
      q.sort_by !== undefined;

    if (useDiscover) {
      path = '/discover/tv';
      if (q.genre) params.with_genres = q.genre;
      if (q.language) params.with_original_language = q.language;
      if (q.sort_by) params.sort_by = q.sort_by;
    } else if (q.category === 'trending') {
      path = '/trending/tv/week';
    } else {
      path = `/tv/${q.category}`;
    }

    // 1. Fetch from TMDB
    const data = await tmdb<TmdbPaged<TmdbListItem>>(path, params);
    
    // 2. Bulk-persist
    if (data.results.length > 0) {
      const values = data.results.map((s) => ({
        tmdbId: s.id,
        name: s.name ?? s.original_name ?? 'Untitled',
        overview: s.overview ?? null,
        posterPath: s.poster_path ?? null,
        backdropPath: s.backdrop_path ?? null,
        rating: s.vote_average ?? null,
        firstAirDate: s.first_air_date ?? null,
        releaseYear: s.first_air_date ? Number(s.first_air_date.slice(0, 4)) : null,
      }));

      for (const v of values) {
        await db.insert(tv).values(v).onConflictDoUpdate({
          target: tv.tmdbId,
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
      results: data.results.map((s) => ({
        ...s,
        id: s.id,
        media_type: 'tv' as const,
        in_db: false,
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
