import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/filters/genres
 * Returns a list of all unique genre names from movies and tv tables.
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    
    // Optimized query using json_each to expand the JSON arrays and DISTINCT to get unique values
    // This is much faster than fetching all rows into memory.
    const results = await db.all(sql`
      SELECT DISTINCT value FROM movies, json_each(movies.genres)
      UNION
      SELECT DISTINCT value FROM tv, json_each(tv.genres)
      ORDER BY value ASC
    `) as { value: string }[];
    
    const genres = results.map(r => r.value);
    
    return NextResponse.json(
      { genres },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
        },
      }
    );
  } catch (error) {
    console.error('[api/filters/genres] failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
