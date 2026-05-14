import { NextRequest } from 'next/server';
import { z } from 'zod';
import { like, eq, and, sql } from 'drizzle-orm';
import { ok, badRequest, serverError, parseQuery } from '@/lib/http';
import { getDb } from '@/db/client';
import { movies, tv, links, episodes } from '@/db/schema';
import {
  tmdb,
  tmdbSafe,
  tmdbImg,
  type TmdbListItem,
  type TmdbPaged,
} from '@/lib/tmdb';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  q: z.string().optional().default(''),
  type: z.enum(['multi', 'movie', 'tv']).optional().default('multi'),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  lang: z.string().optional(),
  genre: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = parseQuery(url, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const { q: rawQ, type, page, lang, genre } = parsed.data;

  const q = rawQ?.trim() || '';
  if (!q && !lang && !genre) return badRequest('Empty query and no filters');
  
  const likeExpr = q ? `%${q}%` : undefined;
  const langFilterExpr = lang ? `%"${lang}"%` : undefined;
  const genreFilterExpr = genre ? `%"${genre}"%` : undefined;

  try {
    const db = await getDb();

    // Smart year extraction: "Title 2024" or "Title (2024)"
    let searchQuery = q;
    let searchYear: string | null = null;
    const yearMatch = q.match(/^(.+?)\s+\(?(\d{4})\)?$/);
    if (yearMatch) {
      searchQuery = yearMatch[1].trim();
      searchYear = yearMatch[2];
    }
    const searchLikeExpr = searchQuery ? `%${searchQuery}%` : undefined;

    // 1) DB lookup
    let dbMovies: any[] = [];
    if (type !== 'tv') {
      let query = (db as any).select().from(movies);
      const conds: any[] = [];
      if (searchYear) {
        conds.push(and(like(movies.title, searchLikeExpr || ''), eq(movies.releaseYear, parseInt(searchYear, 10))));
      } else if (likeExpr) {
        conds.push(like(movies.title, likeExpr));
      }
      
      if (genreFilterExpr) conds.push(like(movies.genres, genreFilterExpr));
      
      if (langFilterExpr) {
        query = query.innerJoin(links, eq(links.movieId, movies.id));
        conds.push(like(links.languages, langFilterExpr));
      }

      if (conds.length > 0) query = query.where(and(...conds));
      dbMovies = await query.limit(40);
    }

    let dbShows: any[] = [];
    if (type !== 'movie') {
      let query = (db as any).select().from(tv);
      const conds: any[] = [];

      if (searchYear) {
        conds.push(and(like(tv.name, searchLikeExpr || ''), eq(tv.releaseYear, parseInt(searchYear, 10))));
      } else if (likeExpr) {
        conds.push(like(tv.name, likeExpr));
      }

      if (genreFilterExpr) conds.push(like(tv.genres, genreFilterExpr));

      if (langFilterExpr) {
        query = query.innerJoin(episodes, eq(episodes.tvId, tv.id)).innerJoin(links, eq(links.episodeId, episodes.id));
        conds.push(like(links.languages, langFilterExpr));
      }

      if (conds.length > 0) query = query.where(and(...conds));
      dbShows = await query.limit(40);
    }

    // 2) TMDB lookup
    let tmdbResults: TmdbListItem[] = [];
    let tmdbTotal = { total_pages: 0, total_results: 0, page };
    
    if (q) { 
      try {
        // Check for TMDB URL or direct ID
        const tvUrlMatch = q.match(/themoviedb\.org\/tv\/(\d+)/i);
        const movieUrlMatch = q.match(/themoviedb\.org\/movie\/(\d+)/i);
        const idMatch = /^\d+$/.test(q);

        if (tvUrlMatch || movieUrlMatch || idMatch) {
          const id = tvUrlMatch ? tvUrlMatch[1] : (movieUrlMatch ? movieUrlMatch[1] : q);
          const forcedType = tvUrlMatch ? 'tv' : (movieUrlMatch ? 'movie' : null);

          if (forcedType === 'movie') {
            const m = await tmdbSafe<any>(`/movie/${id}`);
            if (m) tmdbResults.push({ ...m, media_type: 'movie' });
          } else if (forcedType === 'tv') {
            const t = await tmdbSafe<any>(`/tv/${id}`);
            if (t) tmdbResults.push({ ...t, media_type: 'tv' });
          } else {
            const [m, t] = await Promise.all([
              tmdbSafe<any>(`/movie/${id}`),
              tmdbSafe<any>(`/tv/${id}`)
            ]);
            if (m) tmdbResults.push({ ...m, media_type: 'movie' });
            if (t) tmdbResults.push({ ...t, media_type: 'tv' });
          }
        }

        if (tmdbResults.length === 0) {
          const tmdbPath = type === 'movie' ? '/search/movie' : type === 'tv' ? '/search/tv' : '/search/multi';
          const yearParams: Record<string, string> = {};
          if (searchYear) {
            if (type === 'movie') yearParams['primary_release_year'] = searchYear;
            else if (type === 'multi') yearParams['year'] = searchYear;
            if (type === 'tv' || type === 'multi') yearParams['first_air_date_year'] = searchYear;
          }

          let data = await tmdb<TmdbPaged<TmdbListItem>>(tmdbPath, {
            query: searchQuery,
            page,
            include_adult: false,
            ...yearParams,
          });

          if (data.results.length === 0 && searchYear) {
            data = await tmdb<TmdbPaged<TmdbListItem>>(tmdbPath, {
              query: searchQuery,
              page,
              include_adult: false,
            });
          }

          // LOG THE RAW TMDB RESPONSE
          console.log('\n--- RAW TMDB SEARCH RESPONSE ---');
          console.log(JSON.stringify(data, null, 2));
          console.log('--- END RAW TMDB SEARCH RESPONSE ---\n');

          const inferredType = type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : undefined;
          tmdbResults = data.results
            .filter((r) => !r.media_type || r.media_type !== 'person')
            .map((r) => inferredType ? { ...r, media_type: inferredType } : r);
          tmdbTotal = { total_pages: data.total_pages, total_results: data.total_results, page: data.page };
        }
      } catch (err) {
        console.error('[search] TMDB failed:', err);
      }
    }

    console.log(`[search] Query: "${q}", SearchQuery: "${searchQuery}", Year: "${searchYear}"`);

    // Build list of TMDB IDs already in DB
    const dbTmdbIds = new Set<number>([
      ...dbMovies.map((m) => (m.movies ? m.movies.tmdbId : m.tmdbId)).filter(Boolean),
      ...dbShows.map((s) => (s.tv ? s.tv.tmdbId : s.tmdbId)).filter(Boolean),
    ]);

    console.log(`[search] DB IDs found: ${Array.from(dbTmdbIds).join(', ')}`);

    // 3) UNIFIED TMDB-FORMATTED RESULTS
    const results: any[] = [
      ...dbMovies.map((m) => {
        const row = m.movies || m;
        return {
          id: row.tmdbId,
          local_id: row.id,
          media_type: 'movie',
          title: row.title,
          overview: row.overview,
          poster_path: row.posterPath,
          backdrop_path: row.backdropPath,
          vote_average: row.rating,
          release_date: row.releaseDate,
          in_db: true,
        };
      }),
      ...dbShows.map((s) => {
        const row = s.tv || s;
        return {
          id: row.tmdbId,
          local_id: row.id,
          media_type: 'tv',
          name: row.name,
          overview: row.overview,
          poster_path: row.posterPath,
          backdrop_path: row.backdropPath,
          vote_average: row.rating,
          first_air_date: row.firstAirDate,
          in_db: true,
        };
      }),
    ];

    // Add TMDB results that aren't in the DB
    tmdbResults.forEach((r) => {
      const rid = r.id;
      if (rid && !dbTmdbIds.has(rid)) {
        const isMovie = r.media_type === 'movie' || (!r.media_type && type === 'movie') || (!!r.title && !r.name);
        results.push({
          ...r,
          id: rid,
          media_type: isMovie ? 'movie' : 'tv',
          in_db: false,
        });
      }
    });

    console.log(`[search] Final results count: ${results.length}`);

    // Final sort or limit if needed, but we'll return the merged list
    const finalResponse = { 
      query: q, 
      page: tmdbTotal.page,
      total_pages: tmdbTotal.total_pages, 
      total_results: tmdbTotal.total_results,
      results 
    };

    return ok(finalResponse);
  } catch (err) {
    console.error('[search] server error:', err);
    return serverError(err);
  }
}



