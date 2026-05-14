/**
 * POST /api/admin/import/tv
 * Strict bulk-import for TV Episodes.
 * Body must be raw CSV.
 */
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { ok, fail, notFound, serverError } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { episodes, links, languages, tv, LINK_TYPES } from '@/db/schema';
import { parseCsv } from '@/lib/csv';
import { getOrCreateTvByTmdbId } from '@/lib/persist';
import { parseQuality, QUALITIES } from '@/lib/quality';
import { normalizeLanguages } from '@/lib/languages';

export const runtime = 'nodejs';

type RowError = { row: number; reason: string };

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const tvTmdbIdParam = url.searchParams.get('tv_tmdb_id');

  if (!tvTmdbIdParam) {
    return fail('Missing "tv_tmdb_id" query parameter for TV import.', 400);
  }
  const tvTmdbId = Number(tvTmdbIdParam);
  if (!Number.isFinite(tvTmdbId) || tvTmdbId <= 0) {
    return fail('Invalid "tv_tmdb_id" query parameter.', 400);
  }

  const csvText = await req.text();
  if (!csvText.trim()) return fail('Empty CSV body', 400);

  const { header, rows } = parseCsv(csvText);
  const required = ['season_number', 'episode_number', 'stream_url', 'quality', 'type'];
  for (const h of required) {
    if (!header.includes(h)) return fail(`Missing required column: ${h}`, 400);
  }

  const db = await getDb();
  let addedEpisodes = 0;
  let addedLinks = 0;
  let skipped = 0;
  let failed = 0;
  const errors: RowError[] = [];

  // Pre-fetch languages for efficiency
  const langRows = await db.select().from(languages);
  const langSet = new Set(langRows.map(l => l.name.toLowerCase()));

  // 1. Get or create TV show using TMDB ID
  const { row: show } = await getOrCreateTvByTmdbId(tvTmdbId);
  if (!show) {
    return notFound(`TV show with TMDB ID ${tvTmdbId} not found or could not be created.`);
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // CSV rows are 1-indexed, +1 for header

    try {
      const seasonNumber = Number(r.season_number);
      const episodeNumber = Number(r.episode_number);
      const title = r.title || null;
      const streamUrl = (r.stream_url || '').trim();
      const quality = parseQuality(r.quality, { strict: true }); // Use strict parsing for enum
      const type = r.type?.toLowerCase() as 'direct' | 'extract';
      const langs = normalizeLanguages(r.languages || '');

      // Validation checks
      if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) {
        failed++;
        errors.push({ row: rowNum, reason: 'season_number and episode_number must be numbers.' });
        continue;
      }
      if (!streamUrl) {
        failed++;
        errors.push({ row: rowNum, reason: 'stream_url is required.' });
        continue;
      }
      if (!quality) {
        failed++;
        errors.push({ row: rowNum, reason: `Invalid quality "${r.quality}". Must be one of ${QUALITIES.join(', ')}.` });
        continue;
      }
      if (!LINK_TYPES.includes(type)) {
        failed++;
        errors.push({ row: rowNum, reason: `Invalid type "${r.type}". Must be one of ${LINK_TYPES.join(', ')}.` });
        continue;
      }

      // 2. Ensure episode exists, create if not
      let [episode] = await db.select().from(episodes).where(and(
        eq(episodes.tvId, show.id),
        eq(episodes.seasonNumber, seasonNumber),
        eq(episodes.episodeNumber, episodeNumber)
      )).limit(1);

      if (!episode) {
        const inserted = await db.insert(episodes).values({
          tvId: show.id,
          seasonNumber,
          episodeNumber,
          title,
        }).returning();
        episode = inserted[0];
        addedEpisodes++;
      } else {
        // Update episode if title changed or other fields need update
        await db.update(episodes).set({
          title,
          updatedAt: new Date(),
        }).where(eq(episodes.id, episode.id));
      }

      // 3. Language Handling
      for (const lang of langs) {
        if (!langSet.has(lang.toLowerCase())) {
          await db.insert(languages).values({ name: lang }).onConflictDoNothing();
          langSet.add(lang.toLowerCase());
        }
      }

      // 4. Duplicate Handling: Skip if this exact URL for this episode already exists
      const existingLinkByUrl = await db.select().from(links).where(and(
        eq(links.episodeId, episode.id),
        eq(links.url, streamUrl)
      )).limit(1);

      if (existingLinkByUrl.length > 0) {
        skipped++;
        continue;
      }

      // 5. Check if a link for this quality already exists, update if so, else insert.
      const existingLinkByQuality = await db.select().from(links).where(and(
        eq(links.episodeId, episode.id),
        eq(links.quality, quality)
      )).limit(1);

      if (existingLinkByQuality.length > 0) {
        await db.update(links).set({
          url: streamUrl,
          type,
          languages: langs,
          extractedUrl: null, // Clear extracted URL on manual update
          expiresAt: null,    // Clear expiry on manual update
          updatedAt: new Date()
        }).where(eq(links.id, existingLinkByQuality[0].id));
      } else {
        await db.insert(links).values({
          episodeId: episode.id,
          url: streamUrl,
          quality: quality,
          type,
          languages: langs,
        });
      }
      addedLinks++;
    } catch (err) {
      failed++;
      errors.push({ row: rowNum, reason: (err as Error).message });
    }
  }

  return ok({
    added_episodes: addedEpisodes,
    added_links: addedLinks,
    skipped,
    failed,
    errors,
  });
}
