/**
 * POST /api/admin/tv/[tvId]/episodes/import
 *
 * Bulk-import episodes (and optional links) from a CSV body.
 *
 * CSV columns (case-insensitive, only season_number+episode_number required):
 *   season_number,episode_number,title,primary_stream_url,quality,languages
 *
 * Languages: pipe / comma / semicolon-separated string of codes or names.
 *   e.g. "en|hi|te"  or  "english,hindi"
 *
 * Behavior:
 *   - Upserts episodes by (tv_id, season_number, episode_number).
 *   - If primary_stream_url is provided, also creates a link with the given
 *     quality (defaults to "1080p") and a default `type` of "extract".
 *   - Returns a summary { inserted_episodes, inserted_links, skipped, errors }.
 *
 * Accepts either:
 *   - text/csv body (raw CSV text), or
 *   - application/json: { csv: "..." }
 */
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { ok, fail, notFound, serverError } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { episodes, links, tv } from '@/db/schema';
import { parseCsv } from '@/lib/csv';
import { parseQuality } from '@/lib/quality';
import { normalizeLanguages } from '@/lib/languages';

export const runtime = 'nodejs';

type RowError = { row: number; reason: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tvId: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { tvId: raw } = await ctx.params;
  const tvId = Number(raw);
  if (!Number.isFinite(tvId) || tvId <= 0) return fail('Invalid tvId', 400);

  // Read CSV text from body
  let csvText: string;
  const ctype = req.headers.get('content-type') ?? '';
  try {
    if (ctype.includes('application/json')) {
      const body = (await req.json()) as { csv?: string };
      if (typeof body.csv !== 'string') return fail('Missing "csv" field', 400);
      csvText = body.csv;
    } else {
      csvText = await req.text();
    }
  } catch {
    return fail('Could not read request body', 400);
  }

  if (!csvText.trim()) return fail('Empty CSV body', 400);

  const { header, rows } = parseCsv(csvText);
  if (rows.length === 0) return fail('No data rows', 400);
  for (const required of ['season_number', 'episode_number']) {
    if (!header.includes(required)) {
      return fail(`Missing required column: ${required}`, 400);
    }
  }

  const db = await getDb();
  const showRows = await db
    .select()
    .from(tv)
    .where(eq(tv.id, tvId))
    .limit(1);
  if (showRows.length === 0) return notFound('TV show not found');

  let insertedEpisodes = 0;
  let insertedLinks = 0;
  const skipped: RowError[] = [];
  const errors: RowError[] = [];

  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // header is row 1
      const seasonNumber = Number(r.season_number);
      const episodeNumber = Number(r.episode_number);
      if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) {
        skipped.push({
          row: rowNum,
          reason: 'season_number/episode_number not numeric',
        });
        continue;
      }

      // Upsert episode
      let episodeId: number;
      try {
        const inserted = await db
          .insert(episodes)
          .values({
            tvId,
            seasonNumber,
            episodeNumber,
            title: r.title || null,
            overview: r.overview || null,
            stillPath: r.still_path || null,
          })
          .onConflictDoUpdate({
            target: [
              episodes.tvId,
              episodes.seasonNumber,
              episodes.episodeNumber,
            ],
            set: {
              title: r.title || null,
              overview: r.overview || null,
              stillPath: r.still_path || null,
              updatedAt: new Date(),
            },
          })
          .returning();
        episodeId = inserted[0].id;
        insertedEpisodes++;
      } catch (err) {
        errors.push({ row: rowNum, reason: (err as Error).message });
        continue;
      }

      // Optional link
      const url = (r.primary_stream_url ?? r.url ?? '').trim();
      if (!url) continue;

      const quality = parseQuality(r.quality || '1080p', { strict: false });
      if (!quality) {
        skipped.push({
          row: rowNum,
          reason: `Episode imported but link skipped — invalid quality "${r.quality}"`,
        });
        continue;
      }
      const langs = normalizeLanguages(r.languages || '');
      const linkType =
        (r.type ?? '').trim().toLowerCase() === 'direct' ? 'direct' : 'extract';

      try {
        // Replace existing link of same quality (admin-friendly idempotent import).
        const existing = await db
          .select()
          .from(links)
          .where(
            and(eq(links.episodeId, episodeId), eq(links.quality, quality)),
          )
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(links)
            .set({
              url,
              type: linkType,
              languages: langs,
              extractedUrl: null,
              expiresAt: null,
              updatedAt: new Date(),
            })
            .where(eq(links.id, existing[0].id));
        } else {
          await db.insert(links).values({
            episodeId,
            movieId: null,
            quality,
            type: linkType,
            url,
            languages: langs,
          });
          insertedLinks++;
        }
      } catch (err) {
        errors.push({
          row: rowNum,
          reason: `Link insert failed: ${(err as Error).message}`,
        });
      }
    }
  } catch (err) {
    return serverError(err);
  }

  return ok({
    inserted_episodes: insertedEpisodes,
    inserted_links: insertedLinks,
    skipped,
    errors,
  });
}
