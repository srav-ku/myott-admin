/**
 * GET /api/admin/reports?status=open&limit=50
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { ok, serverError, parseQuery } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { reports, REPORT_STATUS, movies, tv, episodes } from '@/db/schema';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  status: z.enum(REPORT_STATUS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const parsed = parseQuery(url, QuerySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = await getDb();
    
    // Group reports by content + issue to show "count"
    // and join with metadata tables to get titles
    const rows = await db
      .select({
        id: reports.id,
        contentType: reports.contentType,
        contentId: reports.contentId,
        issueType: reports.issueType,
        message: reports.message,
        status: reports.status,
        createdAt: reports.createdAt,
        // Aggregated count for same (type, id, issue, status)
        reportCount: sql<number>`count(*) OVER (PARTITION BY ${reports.contentType}, ${reports.contentId}, ${reports.issueType}, ${reports.status})`,
        // Joined titles
        movieTitle: movies.title,
        movieTmdbId: movies.tmdbId,
        tvName: tv.name,
        tvTmdbId: tv.tmdbId,
        epTitle: episodes.title,
        epSeason: episodes.seasonNumber,
        epNumber: episodes.episodeNumber,
        epTvName: sql<string>`(SELECT name FROM tv WHERE id = ${episodes.tvId})`,
      })
      .from(reports)
      .leftJoin(movies, sql`${reports.contentType} = 'movie' AND ${reports.contentId} = ${movies.id}`)
      .leftJoin(episodes, sql`${reports.contentType} = 'episode' AND ${reports.contentId} = ${episodes.id}`)
      .leftJoin(tv, sql`${episodes.tvId} = ${tv.id}`)
      .where(parsed.data.status ? eq(reports.status, parsed.data.status) : undefined)
      .orderBy(desc(reports.createdAt))
      .limit(parsed.data.limit);

    return ok({ reports: rows });
  } catch (err) {
    return serverError(err);
  }
}
