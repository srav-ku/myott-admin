/**
 * Language normalization.
 * We now store FULL NAMES ONLY (e.g. "English", "Hindi") instead of ISO codes.
 * This system is DB-driven, so we avoid hardcoded maps.
 */

/** Normalize a single language name (Title Case). */
export function normalizeLanguage(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  
  // Convert to Title Case (e.g. "english" -> "English")
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Normalize an arbitrary list/string of languages to a deduped array of full names.
 * Accepts:
 *   - array of strings: ["English", "hindi"]
 *   - delimited string: "English|Hindi" or "English, Hindi"
 */
export function normalizeLanguages(
  input: string | string[] | null | undefined,
): string[] {
  if (input == null) return [];
  const parts: string[] = Array.isArray(input)
    ? input
    : String(input).split(/[|,;/]/);
  const out = new Set<string>();
  for (const p of parts) {
    const name = normalizeLanguage(p);
    if (name) out.add(name);
  }
  return [...out];
}
