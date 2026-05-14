/**
 * GET /api/tv/[tmdbId]
 *   - DB-first by tmdb_id.
 *   - On miss: fetch from TMDB, persist once, return.
 *   - Includes all episodes and links from DB.
 */
import { NextRequest } from 'next/server';
import { count, eq, inArray, sql } from 'drizzle-orm';
import { ok, fail, notFound, serverError } from '@/lib/http';
import { getDb } from '@/db/client';
import { episodes, links } from '@/db/schema';
import { getOrCreateTvByTmdbId, syncEpisodesForTv } from '@/lib/persist';
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
    const db = await getDb();
    
    // 1. Get or Create Show (wrapped in try/catch for TMDB stability)
    let show;
    let created = false;
    try {
      const result = await getOrCreateTvByTmdbId(tmdbId);
      show = result.row;
      created = result.created;
    } catch (err) {
      console.error('[api/tv] TMDB lookup/persist failed:', err);
      // Fallback to existing DB record if TMDB is down
      const { tv: tvTable } = await import('@/db/schema');
      const existing = await db
        .select()
        .from(tvTable)
        .where(eq(tvTable.tmdbId, tmdbId))
        .limit(1);
      if (existing.length > 0) {
        show = existing[0];
      }
    }

    if (!show) return notFound('TV show not found');

    // 2. Sync episodes if none exist
    const currentEpCountRes = await (db as any)
      .select({ count: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.tvId, show.id));

    if (Number((currentEpCountRes[0] as any).count || 0) === 0) {
      try {
        await syncEpisodesForTv(show.id, show.tmdbId!);
      } catch (err) {
        console.error('[api/tv] Episode sync failed:', err);
      }
    }

    // 3. Fetch episodes and links
    const dbEpisodes = await db
      .select()
      .from(episodes)
      .where(eq(episodes.tvId, show.id))
      .orderBy(episodes.seasonNumber, episodes.episodeNumber);

    const epIds = dbEpisodes.map((e) => e.id);
    let allLinks: any[] = [];
    if (epIds.length > 0) {
      allLinks = await db
        .select()
        .from(links)
        .where(inArray(links.episodeId, epIds));
    }

    // Stealth Mode Check
    const guard = await requireUser(_req);
    const isStealthOn = guard.ok && guard.user.stealthMode;

    // 4. Group by seasons
    const seasonsMap = new Map<number, any>();
    for (const ep of dbEpisodes) {
      if (!seasonsMap.has(ep.seasonNumber)) {
        seasonsMap.set(ep.seasonNumber, {
          season_number: ep.seasonNumber,
          episodes: [],
        });
      }

      let epLinks: any[] = [];
      if (isStealthOn) {
        epLinks = allLinks
          .filter((l) => l.episodeId === ep.id)
          .map((l) => ({
            id: l.id,
            quality: l.quality,
            type: l.type,
            languages: l.languages,
          }));
      }

      seasonsMap.get(ep.seasonNumber).episodes.push({
        id: ep.id,
        episode_number: ep.episodeNumber,
        title: ep.title,
        overview: ep.overview,
        thumbnail_url: tmdbImg(ep.stillPath, 'w500'),
        runtime: ep.runtime,
        links: epLinks,
      });
    }

    const seasons = Array.from(seasonsMap.values()).sort(
      (a, b) => a.season_number - b.season_number,
    );

    return ok({
      id: show.id,
      tmdb_id: show.tmdbId,
      imdb_id: show.imdbId,
      title: show.name,
      overview: show.overview,
      poster_url: tmdbImg(show.posterPath, 'w500'),
      backdrop_url: tmdbImg(show.backdropPath, 'original'),
      rating: show.rating,
      first_air_date: show.firstAirDate,
      release_year: show.releaseYear,
      number_of_seasons: show.numberOfSeasons,
      number_of_episodes: show.numberOfEpisodes,
      genres: show.genres ?? [],
      seasons,
      _meta: { source: created ? 'tmdb' : 'cache' },
    });
  } catch (err) {
    return serverError(err);
  }
}
