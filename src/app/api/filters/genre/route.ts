import { NextRequest, NextResponse } from 'next/server';
import { eq, like, and, or, SQL } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { movies, tv, episodes, links } from '@/db/schema';

export const runtime = 'nodejs';

/**
 * GET /api/filters/genre?name=...
 * 
 * Logic:
 * 1. MOVIES: Select movies where the `genres` JSON array contains the provided genre name.
 * 2. TV: Select TV shows where the `genres` JSON array contains the provided genre name.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genreName = searchParams.get('name');

  if (!genreName) {
    return NextResponse.json(
      { ok: false, error: 'Missing genre name' },
      { status: 400 }
    );
  }

  // For SQLite, searching within a JSON array stored as TEXT requires string manipulation.
  // We look for the genre name surrounded by quotes and commas, or at the start/end of the array.
  // Example: '["Action", "Comedy"]' -> searching for "Action" needs to match '%"Action"%'
  const genrePattern = `%"${genreName}"%`;

  try {
    const db = await getDb();

    // 1. MOVIES
    // SELECT DISTINCT movies.* FROM movies WHERE movies.genres LIKE '%"genreName"%'
    const filteredMovies = await db
      .selectDistinct()
      .from(movies)
      .where(like(movies.genres, genrePattern));
    
    // 2. TV SERIES
    // SELECT DISTINCT tv.* FROM tv WHERE tv.genres LIKE '%"genreName"%'
    const filteredTv = await db
      .selectDistinct()
      .from(tv)
      .where(like(tv.genres, genrePattern));

    return NextResponse.json({
      movies: filteredMovies,
      tv: filteredTv,
    });
  } catch (error) {
    console.error('[genre-filter] failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
