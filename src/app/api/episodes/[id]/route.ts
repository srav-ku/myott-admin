/**
 * GET /api/episodes/[id] — public lookup of an episode (with parent show info).
 */
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { ok, fail, notFound, serverError } from '@/lib/http';
import { getDb } from '@/db/client';
import { episodes, tv } from '@/db/schema';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return fail('Invalid id', 400);
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(episodes)
      .innerJoin(tv, eq(episodes.tvId, tv.id))
      .where(eq(episodes.id, id))
      .limit(1);
    if (rows.length === 0) return notFound('Episode not found');
    const ep = rows[0].episodes;
    const show = rows[0].tv;
    return ok({
      id: ep.id,
      tv_id: ep.tvId,
      tv_tmdb_id: show.tmdbId,
      tv_title: show.name,
      tv_backdrop_url: show.backdropPath
        ? `https://image.tmdb.org/t/p/w780${show.backdropPath}`
        : null,
      season_number: ep.seasonNumber,
      episode_number: ep.episodeNumber,
      title: ep.title,
      overview: ep.overview,
      still_path: ep.stillPath,
    });
  } catch (err) {
    return serverError(err);
  }
}
