/**
 * POST /api/admin/episodes/[id]/links
 *
 * Bulk-save links for a single episode (1080p and 720p).
 * Body: {
 *   links: [
 *     { quality: '1080p', url: '...', type: 'direct'|'extract', languages: [...] },
 *     { quality: '720p', url: '...', type: 'direct'|'extract', languages: [...] }
 *   ]
 * }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { ok, fail, badRequest, serverError, parseJson } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { links, LINK_TYPES } from '@/db/schema';
import { parseQuality } from '@/lib/quality';
import { normalizeLanguages } from '@/lib/languages';

export const runtime = 'nodejs';

const LinkSchema = z.object({
  quality: z.string(),
  url: z.string().url().or(z.literal('')), // allow empty to delete
  type: z.enum(LINK_TYPES).optional().default('extract'),
  languages: z.array(z.string()).optional().default(['en']),
});

const BulkSchema = z.object({
  links: z.array(LinkSchema),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id: raw } = await ctx.params;
  const epId = Number(raw);
  if (!Number.isFinite(epId)) return fail('Invalid episodeId', 400);

  const parsed = await parseJson(req, BulkSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = await getDb();

    for (const item of parsed.data.links) {
      const quality = parseQuality(item.quality, { strict: true });
      if (!quality) continue;

      if (!item.url) {
        // Delete if empty
        await db
          .delete(links)
          .where(and(eq(links.episodeId, epId), eq(links.quality, quality)));
        continue;
      }

      const langs = normalizeLanguages(item.languages);

      // Upsert
      const existing = await db
        .select()
        .from(links)
        .where(and(eq(links.episodeId, epId), eq(links.quality, quality)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(links)
          .set({
            url: item.url,
            type: (item.type ?? 'extract') as any,
            languages: langs,
            extractedUrl: null,
            expiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(links.id, existing[0].id));
      } else {
        await db.insert(links).values({
          episodeId: epId,
          quality: quality as any,
          url: item.url,
          type: (item.type ?? 'extract') as any,
          languages: langs,
        } as any);
      }
    }

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/admin/episodes/[id]/links
 * Returns all links for this episode.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id: raw } = await ctx.params;
  const epId = Number(raw);

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(links)
      .where(eq(links.episodeId, epId));
    return ok({ links: rows });
  } catch (err) {
    return serverError(err);
  }
}
