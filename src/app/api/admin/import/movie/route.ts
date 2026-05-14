/**
 * POST /api/admin/import/movie
 * Strict bulk-import for Movies.
 */
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { ok, fail, serverError } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/db/client';
import { movies, links, languages, QUALITIES, LINK_TYPES } from '@/db/schema';
import { parseCsv } from '@/lib/csv';
import { getOrCreateMovieByTmdbId } from '@/lib/persist';
import { parseQuality } from '@/lib/quality';
import { normalizeLanguages } from '@/lib/languages';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const csvText = await req.text();
  if (!csvText.trim()) return fail('Empty CSV body', 400);

  const { header, rows } = parseCsv(csvText);
  const required = ['tmdb_id', 'stream_url', 'quality', 'type'];
  for (const h of required) {
    if (!header.includes(h)) return fail(`Missing required column: ${h}`, 400);
  }

  const db = await getDb();
  let added = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { row: number; reason: string }[] = [];

  // Pre-fetch existing languages from DB for efficient lookup
  // Ensure these are stored and retrieved in the normalized (Title Case) format
  const langRows = await db.select().from(languages);
  const langSet = new Set(langRows.map(l => l.name)); // Store normalized names directly

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // CSV rows are 1-indexed, +1 for header

    // Use a try-catch block for each row to allow processing other rows if one fails
    try {
      const tmdbId = Number(r.tmdb_id);
      const title = r.title || null; // Optional, TMDB fetch will override if needed
      const streamUrl = (r.stream_url || '').trim();
      // Use parseQuality for consistency, although not directly language related
      const quality = parseQuality(r.quality, { strict: false }); // Allow synonyms for quality
      const type = r.type?.trim().toLowerCase() as 'direct' | 'extract';
      
      // --- Language Processing ---
      // Normalize languages: comma-separated, trimmed, Title Case, deduplicated
      const normalizedLangs = normalizeLanguages(r.languages || ''); // This function handles splitting, trimming, normalization, and deduplication

      // Validation checks
      if (isNaN(tmdbId) || tmdbId <= 0) {
        failed++;
        errors.push({ row: rowNum, reason: 'Invalid TMDB ID' });
        continue;
      }
      if (!streamUrl) {
        failed++;
        errors.push({ row: rowNum, reason: 'Missing stream_url' });
        continue;
      }
      if (!quality) {
        failed++;
        errors.push({ row: rowNum, reason: `Invalid quality: ${r.quality}. Use 720p or 1080p.` });
        continue;
      }
      if (!LINK_TYPES.includes(type)) { // Assuming LINK_TYPES is imported or defined
        failed++;
        errors.push({ row: rowNum, reason: `Invalid type: ${r.type}. Use direct or extract.` });
        continue;
      }
      // --- End Language Processing ---

      // 2. Language Handling: add new languages if they don't exist
      for (const lang of normalizedLangs) { // Iterate over normalized languages
        if (!langSet.has(lang)) { // Check if normalized language exists in the set
          // Insert the normalized language name (already Title Case)
          await db.insert(languages).values({ name: lang }).onConflictDoNothing();
          langSet.add(lang); // Add to the set for future checks in this run
        }
      }

      // 1. Get or create movie from TMDB if not found locally
      const { row: movie } = await getOrCreateMovieByTmdbId(tmdbId);
      if (!movie) {
        failed++;
        errors.push({ row: rowNum, reason: `Failed to fetch/persist movie for TMDB #${tmdbId}` });
        continue;
      }

      // 3. Duplicate Handling: Skip if this exact URL for this movie already exists
      const existingLinkByUrl = await db.select().from(links).where(and(
        eq(links.movieId, movie.id),
        eq(links.url, streamUrl)
      )).limit(1);

      if (existingLinkByUrl.length > 0) {
        skipped++;
        continue;
      }

      // 4. Upsert/Update link based on quality
      const existingLinkByQuality = await db.select().from(links).where(and(
        eq(links.movieId, movie.id),
        eq(links.quality, quality as any) // Cast to 'any' due to strict enum validation in schema
      )).limit(1);

      if (existingLinkByQuality.length > 0) {
        // Update existing link for this quality
        await db.update(links).set({
          url: streamUrl,
          type,
          languages: normalizedLangs, // Use normalized array
          extractedUrl: null, // Clear extracted URL on manual update
          expiresAt: null,    // Clear expiry on manual update
          updatedAt: new Date()
        }).where(eq(links.id, existingLinkByQuality[0].id));
      } else {
        // Insert new link
        await db.insert(links).values({
          movieId: movie.id,
          url: streamUrl,
          quality: quality as any, // Assuming parseQuality returns valid enum type
          type,
          languages: normalizedLangs, // Use normalized array
        });
      }
      added++;

    } catch (err) {
      failed++;
      errors.push({ row: rowNum, reason: (err as Error).message });
    }
  }

  return ok({ success: true, added, skipped, failed, errors });
}