/**
 * PATCH  /api/admin/links/[id]
 *   Body: { quality?, type?, url?, languages? }
 *   Note: changing `url` invalidates the extracted cache.
 * DELETE /api/admin/links/[id]
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  ok,
  fail,
  badRequest,
  notFound,
  serverError,
  parseJson,
} from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { links, LINK_TYPES } from '@/db/schema';
import { parseQuality } from '@/lib/quality';
import { normalizeLanguages } from '@/lib/languages';
import { isUniqueViolation } from '@/lib/db-errors';

export const runtime = 'nodejs';

const UpdateSchema = z.object({
  quality: z.string().optional(),
  type: z.enum(LINK_TYPES).optional(),
  url: z.string().url().optional(),
  languages: z.union([z.array(z.string()), z.string()]).optional(),
});

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return fail('Invalid id', 400);

  const parsed = await parseJson(req, UpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.quality !== undefined) {
    const q = parseQuality(data.quality, { strict: true });
    if (!q) return badRequest('quality must be "720p" or "1080p"');
    patch.quality = q;
  }
  if (data.type !== undefined) patch.type = data.type;
  if (data.url !== undefined) {
    patch.url = data.url;
    // Invalidate extracted cache when source URL changes
    patch.extractedUrl = null;
    patch.expiresAt = null;
  }
  if (data.languages !== undefined) {
    patch.languages = normalizeLanguages(data.languages);
  }

  try {
    const db = await getDb();

    // Seed missing languages
    if (patch.languages) {
      const { languages } = await import('@/db/schema');
      const langs = patch.languages as string[];
      for (const lang of langs) {
        await db.insert(languages).values({ name: lang }).onConflictDoNothing();
      }
    }

    const updated = await db
      .update(links)
      .set(patch)
      .where(eq(links.id, id))
      .returning();
    if (updated.length === 0) return notFound('Link not found');
    return ok({ link: updated[0] });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail('Link for this quality already exists', 409);
    }
    return serverError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return fail('Invalid id', 400);

  try {
    const db = await getDb();
    const deleted = await db
      .delete(links)
      .where(eq(links.id, id))
      .returning();
    if (deleted.length === 0) return notFound('Link not found');
    return ok({ deleted: deleted[0].id });
  } catch (err) {
    return serverError(err);
  }
}
