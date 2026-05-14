import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { userAdState, ads, users } from '@/db/schema';
import { AD_CONFIG } from './ad-config';
import type { Quality } from '@/db/schema';

/**
 * Main decision engine for showing reward ads.
 * Follows strict rules based on quality, usage patterns, and daily limits.
 */
export async function shouldShowRewardAd(userId: string, quality: Quality): Promise<boolean> {
  const db = await getDb();

  // 1. Check stealth_mode
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stealthMode: true },
  });
  if (!user || !user.stealthMode) return false;

  // 2. Check if there are active rewarded ads
  const activeAds = await db.query.ads.findFirst({
    where: and(eq(ads.isActive, true), eq(ads.type, 'rewarded')),
  });
  if (!activeAds) return false;

  // 3. Load / Initialize user ad state
  let state = await db.query.userAdState.findFirst({
    where: eq(userAdState.userId, userId),
  });

  const todayStr = new Date().toISOString().split('T')[0];

  if (!state) {
    // New state
    [state] = await db.insert(userAdState).values({
      userId,
      lastResetDate: todayStr,
    }).returning();
  } else if (state.lastResetDate !== todayStr) {
    // New day reset
    [state] = await db.update(userAdState)
      .set({
        dailyCount: 0,
        sessionCount: 0,
        lastResetDate: todayStr,
      })
      .where(eq(userAdState.userId, userId))
      .returning();
  }

  // 5. Daily limit check
  if (state.dailyCount >= AD_CONFIG.DAILY_LIMIT) return false;

  // 6. Minimum gap check (minutes)
  if (state.lastShownAt) {
    const gapMs = Date.now() - state.lastShownAt.getTime();
    const minGapMs = AD_CONFIG.MIN_GAP_MINUTES * 60 * 1000;
    if (gapMs < minGapMs) return false;
  }

  // 7. New user grace check
  if (state.sessionCount < AD_CONFIG.NEW_USER_GRACE_PLAYS) return false;

  // 8. 1080p always triggers if above criteria met
  if (quality === '1080p') return true;

  // 9. 720p soft trigger
  if (quality === '720p') {
    if (state.sessionCount >= AD_CONFIG.SOFT_TRIGGER_THRESHOLD) return true;
    return false;
  }

  // 10. Heavy user logic
  if (state.sessionCount >= AD_CONFIG.HEAVY_USER_THRESHOLD) {
    // Slightly increase probability or just return true
    // For now, if they are heavy users, we show ads more consistently
    return true;
  }

  return false;
}

/**
 * Updates user ad state after an ad is successfully shown.
 */
export async function updateAdState(userId: string) {
  const db = await getDb();
  const state = await db.query.userAdState.findFirst({
    where: eq(userAdState.userId, userId),
  });

  if (!state) return;

  await db.update(userAdState)
    .set({
      dailyCount: state.dailyCount + 1,
      sessionCount: state.sessionCount + 1,
      lastShownAt: new Date(),
    })
    .where(eq(userAdState.userId, userId));
}
