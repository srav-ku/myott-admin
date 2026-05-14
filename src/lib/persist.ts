/**
 * Helpers for persisting TMDB results into our DB on first lookup.
 * Used by the detail routes (DB-first; on miss → TMDB → save → return).
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { movies, tv, episodes } from '@/db/schema';
import {
  tmdb,
  tmdbSafe,
  type TmdbMovieDetail,
  type TmdbTvDetail,
  type TmdbSeasonDetail,
} from '@/lib/tmdb';

function yearFromDate(date?: string | null): number | null {
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
}

/** Find by tmdb_id, else fetch from TMDB, save, return the saved row. */
export async function getOrCreateMovieByTmdbId(tmdbId: number) {
  const db = await getDb();
  
  // 1. Check DB first
  const existing = await db
    .select()
    .from(movies)
    .where(eq(movies.tmdbId, tmdbId))
    .limit(1);
  if (existing.length > 0) return { row: existing[0], created: false };

  // 2. Fetch from TMDB
  const detail = await tmdb<TmdbMovieDetail>(`/movie/${tmdbId}`).catch((err) => {
    console.error(`[getOrCreateMovie] TMDB fail for #${tmdbId}:`, err);
    return null;
  });

  if (!detail) {
    // Final fallback: maybe it was inserted by another request while we were fetching?
    const again = await db
      .select()
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1);
    if (again.length > 0) return { row: again[0], created: false };
    throw new Error('Movie not found locally and TMDB request failed');
  }

  // 3. Persist
  const inserted = await db
    .insert(movies)
    .values({
      tmdbId: detail.id,
      imdbId: detail.imdb_id ?? null,
      title: detail.title,
      overview: detail.overview ?? null,
      posterPath: detail.poster_path ?? null,
      backdropPath: detail.backdrop_path ?? null,
      rating: detail.vote_average ?? null,
      releaseDate: detail.release_date ?? null,
      releaseYear: yearFromDate(detail.release_date),
      runtime: detail.runtime ?? null,
      genres: (detail.genres ?? []).map((g) => g.name),
    })
    .onConflictDoNothing({ target: movies.tmdbId })
    .returning();

  if (inserted.length === 0) {
    const again = await db
      .select()
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1);
    return { row: again[0]!, created: false };
  }
  return { row: inserted[0]!, created: true };
}

export async function getOrCreateTvByTmdbId(tmdbId: number) {
  const db = await getDb();
  
  // 1. Check DB first
  const existing = await db
    .select()
    .from(tv)
    .where(eq(tv.tmdbId, tmdbId))
    .limit(1);
  if (existing.length > 0) return { row: existing[0], created: false };

  // 2. Fetch from TMDB
  const detail = await tmdb<TmdbTvDetail>(`/tv/${tmdbId}`, {
    append_to_response: 'external_ids',
  }).catch((err) => {
    console.error(`[getOrCreateTv] TMDB fail for #${tmdbId}:`, err);
    return null;
  });

  if (!detail) {
    const again = await db
      .select()
      .from(tv)
      .where(eq(tv.tmdbId, tmdbId))
      .limit(1);
    if (again.length > 0) return { row: again[0], created: false };
    throw new Error('TV show not found locally and TMDB request failed');
  }

  // 3. Persist
  const inserted = await db
    .insert(tv)
    .values({
      tmdbId: detail.id,
      imdbId: detail.external_ids?.imdb_id ?? null,
      name: detail.name,
      overview: detail.overview ?? null,
      posterPath: detail.poster_path ?? null,
      backdropPath: detail.backdrop_path ?? null,
      rating: detail.vote_average ?? null,
      firstAirDate: detail.first_air_date ?? null,
      releaseYear: yearFromDate(detail.first_air_date),
      numberOfSeasons: detail.number_of_seasons ?? null,
      numberOfEpisodes: detail.number_of_episodes ?? null,
      genres: (detail.genres ?? []).map((g) => g.name),
    })
    .onConflictDoNothing({ target: tv.tmdbId })
    .returning();

  if (inserted.length === 0) {
    const again = await db
      .select()
      .from(tv)
      .where(eq(tv.tmdbId, tmdbId))
      .limit(1);
    return { row: again[0]!, created: false };
  }

  const row = inserted[0]!;
  // Auto-sync episodes on first creation
  void syncEpisodesForTv(row.id, row.tmdbId).catch(console.error);

  return { row, created: true };
}

/**
 * Fetches all seasons and episodes from TMDB and upserts them into our DB.
 * Is idempotent.
 */
export async function syncEpisodesForTv(tvId: number, tmdbId: number) {
  const db = await getDb();

  // 1. Get seasons count from TMDB
  const detail = await tmdbSafe<TmdbTvDetail>(`/tv/${tmdbId}`);
  if (!detail) return; // Silent fail for background sync
  
  const seasons = (detail.seasons ?? []).filter((s) => s.season_number > 0);

  for (const s of seasons) {
    try {
      // 2. Fetch episodes for each season
      const seasonDetail = await tmdb<TmdbSeasonDetail>(
        `/tv/${tmdbId}/season/${s.season_number}`,
      );
      if (!seasonDetail.episodes) continue;

      // 3. Upsert episodes
      for (const ep of seasonDetail.episodes) {
        await db
          .insert(episodes)
          .values({
            tvId,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            title: ep.name ?? null,
            overview: ep.overview ?? null,
            stillPath: ep.still_path ?? null,
            runtime: ep.runtime ?? null,
          })
          .onConflictDoUpdate({
            target: [
              episodes.tvId,
              episodes.seasonNumber,
              episodes.episodeNumber,
            ],
            set: {
              title: ep.name ?? null,
              overview: ep.overview ?? null,
              stillPath: ep.still_path ?? null,
              runtime: ep.runtime ?? null,
              updatedAt: sql`(unixepoch())`,
            },
          });
      }
    } catch (err) {
      console.error(
        `[syncEpisodes] Failed S${s.season_number} for TMDB #${tmdbId}:`,
        err,
      );
    }
  }
}
