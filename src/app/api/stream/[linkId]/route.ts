import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { links } from '@/db/schema';
import { callExtractor } from '@/lib/extractor';
import { requireUser } from '@/lib/user';

export const runtime = 'nodejs';

const DEFAULT_TTL_SECONDS = 6 * 60 * 60;

type StreamResponse = {
  url: string | null;
  type: 'embed' | 'file' | null;
  error: string | null;
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ linkId: string }> },
) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) {
      return NextResponse.json<StreamResponse>({
        url: null,
        type: null,
        error: 'UNAUTHORIZED',
      }, { status: 401 });
    }

    if (!guard.user.stealthMode) {
      return NextResponse.json<StreamResponse>({
        url: null,
        type: null,
        error: 'STEALTH_REQUIRED',
      }, { status: 403 });
    }

    const { linkId: raw } = await ctx.params;
    const linkId = Number(raw);

    if (!Number.isFinite(linkId) || linkId <= 0) {
      return NextResponse.json<StreamResponse>({
        url: null,
        type: null,
        error: 'INVALID_LINK_ID',
      });
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json<StreamResponse>({
        url: null,
        type: null,
        error: 'LINK_NOT_FOUND',
      });
    }

    const link = rows[0];

    // Case 3: No source URL
    if (!link.url) {
      return NextResponse.json<StreamResponse>({
        url: null,
        type: null,
        error: 'NO_SOURCE',
      });
    }

    // Map DB type to required response type
    const getStreamType = (t?: string | null): 'embed' | 'file' => {
      if (t === 'embed') return 'embed';
      return 'file';
    };

    // 1) Direct stream — return as-is
    if (link.type === 'direct') {
      return NextResponse.json<StreamResponse>({
        url: link.url,
        type: 'file',
        error: null,
      });
    }

    // 2) Extract type — check cache
    const nowMs = Date.now();
    if (
      link.extractedUrl &&
      link.expiresAt &&
      link.expiresAt.getTime() > nowMs
    ) {
      return NextResponse.json<StreamResponse>({
        url: link.extractedUrl,
        type: getStreamType(link.extractedUrl.includes('embed') ? 'embed' : 'file'),
        error: null,
      });
    }

    // 3) Cache miss / expired — call worker
    const result = await callExtractor(link.url);

    if (result?.stream_url) {
      const ttlSeconds = Number(
        process.env.EXTRACT_TTL_SECONDS ?? DEFAULT_TTL_SECONDS,
      );
      const expiresAtSec =
        result.expires_at ?? Math.floor(nowMs / 1000) + ttlSeconds;
      const expiresAt = new Date(expiresAtSec * 1000);

      await db
        .update(links)
        .set({
          extractedUrl: result.stream_url,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(links.id, linkId));

      return NextResponse.json<StreamResponse>({
        url: result.stream_url,
        type: result.type === 'embed' ? 'embed' : 'file',
        error: null,
      });
    }

    // Case 2: Extraction failed (including worker fail/timeout)
    return NextResponse.json<StreamResponse>({
      url: null,
      type: null,
      error: 'EXTRACTION_FAILED',
    });
  } catch {
    // Catch-all for any unexpected errors to ensure API never crashes
    return NextResponse.json<StreamResponse>({
      url: null,
      type: null,
      error: 'INTERNAL_ERROR',
    });
  }
}
