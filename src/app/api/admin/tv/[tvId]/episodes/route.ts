/**
 * GET  /api/admin/tv/[tvId]/episodes?season=N
 * POST /api/admin/tv/[tvId]/episodes
 *   Body: { season_number, episode_number, title?, overview?, still_path? }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import {
  ok,
  fail,
  notFound,
  serverError,
  parseJson,
  parseQuery,
} from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { episodes, tv, links } from '@/db/schema';
import { isUniqueViolation } from '@/lib/db-errors';

export const runtime = 'nodejs';

const ListQuerySchema = z.object({
  season: z.coerce.number().int().min(0).optional(),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tvId: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { tvId: raw } = await ctx.params;
  const tvId = Number(raw);
  if (!Number.isFinite(tvId) || tvId <= 0) return fail('Invalid tvId', 400);
  const url = new URL(req.url);
  const parsed = parseQuery(url, ListQuerySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = await getDb();
    const where =
      parsed.data.season !== undefined
        ? and(
            eq(episodes.tvId, tvId),
            eq(episodes.seasonNumber, parsed.data.season),
          )
        : eq(episodes.tvId, tvId);
    
    const epRows = await db.select().from(episodes).where(where);
    if (epRows.length === 0) return ok({ episodes: [] });

    const epIds = epRows.map((e) => e.id);
    const linkRows = await db
      .select()
      .from(links)
      .where(inArray(links.episodeId, epIds));

    const grouped = epRows.map((ep) => ({
      ...ep,
      links: linkRows.filter((l) => l.episodeId === ep.id),
    }));

    return ok({ episodes: grouped });
  } catch (err) {
    return serverError(err);
  }
}

const CreateSchema = z.object({
  season_number: z.number().int().min(0),
  episode_number: z.number().int().min(0),
  title: z.string().optional(),
  overview: z.string().optional(),
  still_path: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tvId: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { tvId: raw } = await ctx.params;
  const tvId = Number(raw);
  if (!Number.isFinite(tvId) || tvId <= 0) return fail('Invalid tvId', 400);

  const parsed = await parseJson(req, CreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  try {
    const db = await getDb();
    const showRows = await db
      .select()
      .from(tv)
      .where(eq(tv.id, tvId))
      .limit(1);
    if (showRows.length === 0) return notFound('TV show not found');

    const inserted = await db
      .insert(episodes)
      .values({
        tvId,
        seasonNumber: data.season_number,
        episodeNumber: data.episode_number,
        title: data.title ?? null,
        overview: data.overview ?? null,
        stillPath: data.still_path ?? null,
      })
      .returning();
    return ok({ episode: inserted[0] }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail(
        'Episode already exists for this season/episode number',
        409,
      );
    }
    return serverError(err);
  }
}
