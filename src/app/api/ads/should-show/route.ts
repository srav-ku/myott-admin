import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, serverError, parseQuery } from '@/lib/http';
import { requireUser } from '@/lib/user';
import { shouldShowRewardAd } from '@/lib/ad-logic';
import { QUALITIES } from '@/db/schema';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  quality: z.enum(QUALITIES),
});

/**
 * GET /api/ads/should-show?quality=720p|1080p
 * Returns { show: true/false }
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const url = new URL(req.url);
    const parsed = parseQuery(url, QuerySchema);
    if (!parsed.ok) return parsed.response;

    const show = await shouldShowRewardAd(guard.user.id, parsed.data.quality);
    
    return ok({ show });
  } catch (err) {
    return serverError(err);
  }
}
