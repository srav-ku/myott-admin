/**
 * GET  /api/admin/links?movie_id=&episode_id=
 * POST /api/admin/links
 *   Body: { movie_id?, episode_id?, quality, type, url, languages? }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  ok,
  fail,
  badRequest,
  serverError,
  parseJson,
  parseQuery,
} from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { links, LINK_TYPES } from '@/db/schema';
import { parseQuality } from '@/lib/quality';
import { normalizeLanguages } from '@/lib/languages';
import { isUniqueViolation } from '@/lib/db-errors';

export const runtime = 'nodejs';

const ListSchema = z
  .object({
    movie_id: z.coerce.number().int().positive().optional(),
    episode_id: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (d) => d.movie_id !== undefined || d.episode_id !== undefined,
    { message: 'Provide movie_id or episode_id' },
  );

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const parsed = parseQuery(url, ListSchema);
  if (!parsed.ok) return parsed.response;
  const q = parsed.data;

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(links)
      .where(
        q.movie_id !== undefined
          ? eq(links.movieId, q.movie_id)
          : eq(links.episodeId, q.episode_id!),
      );
    return ok({ links: rows });
  } catch (err) {
    return serverError(err);
  }
}

const CreateSchema = z
  .object({
    movie_id: z.number().int().positive().optional(),
    episode_id: z.number().int().positive().optional(),
    quality: z.string(),
    type: z.enum(LINK_TYPES),
    url: z.string().url(),
    languages: z
      .union([z.array(z.string()), z.string()])
      .optional(),
  })
  .refine(
    (d) =>
      (d.movie_id !== undefined ? 1 : 0) +
        (d.episode_id !== undefined ? 1 : 0) ===
      1,
    { message: 'Exactly one of movie_id or episode_id is required' },
  );

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, CreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const quality = parseQuality(data.quality, { strict: true });
  if (!quality) {
    return badRequest('quality must be exactly "720p" or "1080p"');
  }
  const langs = normalizeLanguages(data.languages);

  try {
    const db = await getDb();
    
    // Seed missing languages
    const { languages } = await import('@/db/schema');
    for (const lang of langs) {
      await db.insert(languages).values({ name: lang }).onConflictDoNothing();
    }

    const inserted = await db
      .insert(links)
      .values({
        movieId: data.movie_id ?? null,
        episodeId: data.episode_id ?? null,
        quality,
        type: data.type,
        url: data.url,
        languages: langs,
      })
      .returning();
    return ok({ link: inserted[0] }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail(
        'Link for this quality already exists',
        409,
      );
    }
    return serverError(err);
  }
}
