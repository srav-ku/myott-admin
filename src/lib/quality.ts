/**
 * Strict quality enum. Anything else is rejected at the boundary so admins
 * can't poison the DB with "1080", "HD", "FullHD", etc.
 */
import { QUALITIES, type Quality } from '@/db/schema';

export { QUALITIES, type Quality };

const SYNONYMS: Record<string, Quality> = {
  '720p': '720p',
  '720': '720p',
  hd: '720p',
  '1080p': '1080p',
  '1080': '1080p',
  fhd: '1080p',
  fullhd: '1080p',
  'full hd': '1080p',
};

/**
 * Strict-mode parser.
 * - Pass `{ strict: true }` (default) to accept ONLY exact "720p" / "1080p".
 * - Pass `{ strict: false }` to also accept common synonyms (used by CSV import).
 */
export function parseQuality(
  input: unknown,
  opts: { strict?: boolean } = {},
): Quality | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (opts.strict === false) {
    return SYNONYMS[s] ?? null;
  }
  return (QUALITIES as readonly string[]).includes(s) ? (s as Quality) : null;
}
