/**
 * Server-only TMDB v3 client.
 * - Reads `TMDB_API_KEY` from env.
 * - In-memory caching using Map.
 * - Automatic retries for stability.
 */
import 'server-only';

const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';

// Simple in-memory cache
const tmdbCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getKey(): string {
  const k = process.env.TMDB_API_KEY;
  if (!k) throw new Error('TMDB_API_KEY is not set');
  return k;
}

export type TmdbParams = Record<
  string,
  string | number | boolean | undefined | null
>;

/**
 * Enhanced fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 2,
): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        // In Next.js, we might still want this for underlying fetch optimizations
        next: { revalidate: 3600 }, 
      });
      
      // If OK, return immediately
      if (res.ok) return res;
      
      // If not-retryable (e.g. 401, 404), return it
      if (res.status !== 429 && res.status < 500) return res;
      
      // Otherwise wait and retry
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
    }
  }
  throw lastErr || new Error('Fetch failed after retries');
}

/**
 * Core TMDB caller with caching and retries
 */
export async function tmdb<T = unknown>(
  path: string,
  params: TmdbParams = {},
): Promise<T> {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', getKey());
  url.searchParams.set('language', params.language?.toString() ?? 'en-US');
  
  for (const [k, v] of Object.entries(params)) {
    if (k === 'language') continue;
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  const cacheKey = url.toString();
  const cached = tmdbCache.get(cacheKey);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }

  try {
    const res = await fetchWithRetry(url.toString(), {
      headers: { accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`TMDB ${path} -> ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as T;
    
    // Store in cache
    tmdbCache.set(cacheKey, {
      data,
      expiry: Date.now() + CACHE_TTL,
    });

    return data;
  } catch (err) {
    console.error(`[tmdb] Critical failure for ${path}:`, err);
    throw err;
  }
}

/** Try a TMDB call, returning `null` instead of throwing. */
export async function tmdbSafe<T = unknown>(
  path: string,
  params: TmdbParams = {},
): Promise<T | null> {
  try {
    return await tmdb<T>(path, params);
  } catch {
    return null;
  }
}

/** Build a TMDB image URL. Returns `null` for null inputs. */
export function tmdbImg(
  path: string | null | undefined,
  size:
    | 'w92'
    | 'w154'
    | 'w185'
    | 'w300'
    | 'w342'
    | 'w500'
    | 'w780'
    | 'original' = 'w500',
): string | null {
  if (!path) return null;
  return `${TMDB_IMG_BASE}/${size}${path}`;
}

/* -------------------------------------------------------------------------- */
/*                              Response shapes                               */
/* -------------------------------------------------------------------------- */

export type TmdbGenre = { id: number; name: string };

export type TmdbListItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  media_type?: 'movie' | 'tv' | 'person';
  original_language?: string;
};

export type TmdbPaged<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

export type TmdbMovieDetail = {
  id: number;
  imdb_id: string | null;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string;
  runtime: number | null;
  genres: TmdbGenre[];
  original_language: string;
};

export type TmdbTvDetail = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  genres: TmdbGenre[];
  external_ids?: { imdb_id: string | null };
  original_language: string;
};

export type TmdbSeasonDetail = {
  id: number;
  season_number: number;
  episodes: Array<{
    id: number;
    season_number: number;
    episode_number: number;
    name: string;
    overview: string;
    still_path: string | null;
    air_date: string | null;
    runtime: number | null;
  }>;
};
