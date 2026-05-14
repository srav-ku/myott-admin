/**
 * POST /api/admin/import
 * Central endpoint to handle bulk imports for both Movies and TV Episodes.
 * Expects a 'type' query parameter: 'movie' or 'tv'.
 * Expects raw CSV text in the body.
 */
import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/http';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  if (!type || !['movie', 'tv'].includes(type)) {
    return fail('Invalid or missing "type" query parameter. Use "movie" or "tv".', 400);
  }

  const csvText = await req.text();
  if (!csvText.trim()) return fail('Empty CSV body', 400);

  const targetUrl = new URL(`/api/admin/import/${type}`, url.origin);
  if (type === 'tv') {
    const tvTmdbId = url.searchParams.get('tv_tmdb_id');
    if (tvTmdbId) {
      targetUrl.searchParams.set('tv_tmdb_id', tvTmdbId);
    }
  }

  const response = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(req.headers.entries()),
      'host': url.host, // Ensure host is correct for internal fetch
    },
    body: csvText,
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
