import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, serverError, fail } from '@/lib/http';
import { getDb } from '@/db/client';
import { adEvents, AD_EVENT_TYPES } from '@/db/schema';
import { requireUser } from '@/lib/user';
import { updateAdState } from '@/lib/ad-logic';

export const runtime = 'nodejs';

const BodySchema = z.object({
  adId: z.number().optional(),
  type: z.enum(AD_EVENT_TYPES),
});

/**
 * POST /api/ads/event
 * Logs ad events (impression, click, reward_completed).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return fail('Invalid request body', 400);

    const { adId, type } = parsed.data;
    const db = await getDb();

    await db.insert(adEvents).values({
      userId: guard.user.id,
      adId: adId || null,
      type,
    });

    // If reward completed, update the ad state
    if (type === 'reward_completed') {
      await updateAdState(guard.user.id);
    }

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
