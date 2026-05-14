/**
 * Client for the stream-extractor Cloudflare Worker (`workers/extractor/`).
 *
 * Returns null on any failure so callers can fall back to the primary URL.
 * Never throws.
 */
import 'server-only';

export type ExtractResult = {
  stream_url: string;
  /** Unix seconds. If absent, caller decides TTL. */
  expires_at?: number;
  /** Optional hint for the player. */
  type?: 'hls' | 'mp4' | 'webm' | 'mkv' | 'embed';
};

const DEFAULT_TIMEOUT_MS = 5_000;

export async function callExtractor(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<ExtractResult | null> {
  const base = process.env.EXTRACTOR_URL;
  if (!base) {
    console.warn('[extractor] EXTRACTOR_URL not set — skipping extraction');
    return null;
  }
  const ac = new AbortController();
  const timer = setTimeout(
    () => ac.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const res = await fetch(new URL('/extract', base).toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.EXTRACTOR_API_KEY
          ? { 'x-api-key': process.env.EXTRACTOR_API_KEY }
          : {}),
      },
      body: JSON.stringify({ url }),
      signal: ac.signal,
      // Worker responses must NOT be cached by Next — each link's link_id
      // already gives us a stable cache key in our own DB.
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(
        `[extractor] worker returned ${res.status} for ${url.slice(0, 80)}`,
      );
      return null;
    }
    const data = (await res.json()) as Partial<ExtractResult>;
    if (!data?.stream_url || typeof data.stream_url !== 'string') {
      return null;
    }
    return {
      stream_url: data.stream_url,
      expires_at: typeof data.expires_at === 'number' ? data.expires_at : undefined,
      type: data.type,
    };
  } catch (err) {
    console.error('[extractor] call failed:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
