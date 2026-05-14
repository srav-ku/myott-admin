/**
 * GET /api/links?movie_id=&episode_id=
 * Public endpoint to fetch links for a specific movie or episode.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { ok, fail, parseQuery, serverError } from '@/lib/http';
import { getDb } from '@/db/client';
import { links } from '@/db/schema';
import { requireUser } from '@/lib/user';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  movie_id: z.coerce.number().int().positive().optional(),
  episode_id: z.coerce.number().int().positive().optional(),
}).refine(d => d.movie_id !== undefined || d.episode_id !== undefined, {
  message: 'Provide movie_id or episode_id',
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = parseQuery(url, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const q = parsed.data;

  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    // Stealth mode check
    if (!guard.user.stealthMode) {
      return ok({ links: [] });
    }

    const db = await getDb();
    const rows = await db
      .select({
        id: links.id,
        quality: links.quality,
        type: links.type,
        languages: links.languages,
      })
      .from(links)
      .where(
        q.movie_id !== undefined
          ? eq(links.movieId, q.movie_id)
          : eq(links.episodeId, q.episode_id!)
      );
    return ok({ links: rows });
  } catch (err) {
    return serverError(err);
  }
}
