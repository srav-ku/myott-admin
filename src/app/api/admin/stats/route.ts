import { NextRequest } from 'next/server';
import { eq, isNull, sql, desc, count } from 'drizzle-orm';
import { ok, serverError } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { movies, tv, episodes, links, reports, contentRequests } from '@/db/schema';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const db = await getDb();

    // 1. moviesWithoutLinks
    const moviesWithoutLinksRes = await (db as any)
      .select({ count: sql<number>`count(*)` })
      .from(movies)
      .leftJoin(links, eq(movies.id, links.movieId))
      .where(isNull(links.id));
    const moviesWithoutLinks = Number((moviesWithoutLinksRes[0] as any).count || 0);

    // 2. tvMissingEpisodes (meaning TV shows with missing links in episodes)
    const tvMissingEpisodesRes = await (db as any)
      .select({ count: sql<number>`count(distinct ${tv.id})` })
      .from(tv)
      .innerJoin(episodes, eq(tv.id, episodes.tvId))
      .leftJoin(links, eq(episodes.id, links.episodeId))
      .where(isNull(links.id));
    const tvMissingEpisodes = Number((tvMissingEpisodesRes[0] as any).count || 0);

    return ok({
      stats: {
        moviesWithoutLinks,
        tvMissingEpisodes,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
