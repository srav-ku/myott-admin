import { NextRequest, NextResponse } from 'next/server';
import { eq, like, and, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { movies, tv, episodes, links } from '@/db/schema';

export const runtime = 'nodejs';

/**
 * GET /api/filters/language?code=English
 * 
 * Logic:
 * 1. MOVIES: Join movies with links on movie_id where links.languages contains the full language name.
 * 2. TV: Join tv -> episodes -> links where links.languages contains the full language name.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code'); // 'code' param here represents the full language name

  if (!code) {
    return NextResponse.json(
      { ok: false, error: 'Missing language name' },
      { status: 400 }
    );
  }

  // To search inside a JSON array string like '["English","Hindi"]'
  // using LIKE for '%"English"%' is the requested approach.
  const langPattern = `%"${code}"%`;

  try {
    const db = await getDb();

    // 1. MOVIES
    // SELECT DISTINCT movies.* FROM movies 
    // JOIN links ON links.movie_id = movies.id 
    // WHERE links.languages LIKE '%"code"%'
    const filteredMovies = await db
      .selectDistinct({
        id: movies.id,
        tmdbId: movies.tmdbId,
        imdbId: movies.imdbId,
        title: movies.title,
        overview: movies.overview,
        posterPath: movies.posterPath,
        backdropPath: movies.backdropPath,
        rating: movies.rating,
        releaseDate: movies.releaseDate,
        releaseYear: movies.releaseYear,
        runtime: movies.runtime,
        genres: movies.genres,
        createdAt: movies.createdAt,
        updatedAt: movies.updatedAt,
      })
      .from(movies)
      .innerJoin(links, eq(links.movieId, movies.id))
      .where(like(links.languages, langPattern));

    // 2. TV SERIES
    // SELECT DISTINCT tv.* FROM tv
    // JOIN episodes ON episodes.tv_id = tv.id
    // JOIN links ON links.episode_id = episodes.id
    // WHERE links.languages LIKE '%"code"%'
    const filteredTv = await db
      .selectDistinct({
        id: tv.id,
        tmdbId: tv.tmdbId,
        imdbId: tv.imdbId,
        name: tv.name,
        overview: tv.overview,
        posterPath: tv.posterPath,
        backdropPath: tv.backdropPath,
        rating: tv.rating,
        firstAirDate: tv.firstAirDate,
        releaseYear: tv.releaseYear,
        numberOfSeasons: tv.numberOfSeasons,
        numberOfEpisodes: tv.numberOfEpisodes,
        genres: tv.genres,
        createdAt: tv.createdAt,
        updatedAt: tv.updatedAt,
      })
      .from(tv)
      .innerJoin(episodes, eq(episodes.tvId, tv.id))
      .innerJoin(links, eq(links.episodeId, episodes.id))
      .where(like(links.languages, langPattern));

    return NextResponse.json({
      movies: filteredMovies,
      tv: filteredTv,
    });
  } catch (error) {
    console.error('[language-filter] failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
