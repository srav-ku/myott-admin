/**
 * PATCH  /api/admin/tv/[tvId]/episodes/[id]
 * DELETE /api/admin/tv/[tvId]/episodes/[id]
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import {
  ok,
  fail,
  notFound,
  serverError,
  parseJson,
} from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { episodes } from '@/db/schema';

export const runtime = 'nodejs';

const UpdateSchema = z.object({
  title: z.string().nullish(),
  overview: z.string().nullish(),
  still_path: z.string().nullish(),
  season_number: z.number().int().min(0).optional(),
  episode_number: z.number().int().min(0).optional(),
});

function parseIds(raw: { tvId: string; id: string }) {
  const tvId = Number(raw.tvId);
  const id = Number(raw.id);
  if (!Number.isFinite(tvId) || tvId <= 0) return null;
  if (!Number.isFinite(id) || id <= 0) return null;
  return { tvId, id };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ tvId: string; id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const ids = parseIds(await ctx.params);
  if (!ids) return fail('Invalid id', 400);

  const parsed = await parseJson(req, UpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) patch.title = data.title;
  if (data.overview !== undefined) patch.overview = data.overview;
  if (data.still_path !== undefined) patch.stillPath = data.still_path;
  if (data.season_number !== undefined) patch.seasonNumber = data.season_number;
  if (data.episode_number !== undefined) patch.episodeNumber = data.episode_number;

  try {
    const db = await getDb();
    const updated = await db
      .update(episodes)
      .set(patch)
      .where(and(eq(episodes.id, ids.id), eq(episodes.tvId, ids.tvId)))
      .returning();
    if (updated.length === 0) return notFound('Episode not found');
    return ok({ episode: updated[0] });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ tvId: string; id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const ids = parseIds(await ctx.params);
  if (!ids) return fail('Invalid id', 400);

  try {
    const db = await getDb();
    const deleted = await db
      .delete(episodes)
      .where(and(eq(episodes.id, ids.id), eq(episodes.tvId, ids.tvId)))
      .returning();
    if (deleted.length === 0) return notFound('Episode not found');
    return ok({ deleted: deleted[0].id });
  } catch (err) {
    return serverError(err);
  }
}
