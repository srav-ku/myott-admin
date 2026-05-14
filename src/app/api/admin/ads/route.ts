import { getDb } from '@/db/client';
import { ads } from '@/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { fail } from '@/lib/http';
import { AD_CONFIG } from '@/lib/ad-config';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    const db = await getDb();
    const results = await db
      .select()
      .from(ads)
      .orderBy(desc(ads.priority), desc(ads.createdAt))
      .limit(100);

    return NextResponse.json({ ok: true, ads: results });
  } catch (error) {
    console.error('Failed to fetch admin ads:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch ads', ads: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as any;
    const { 
      position, 
      type, 
      provider, 
      imageUrl, 
      redirectUrl, 
      unitId, 
      isActive, 
      priority, 
      frequencyLimit 
    } = body;

    if (!position || !type || !provider) {
      return fail('Position, type, and provider are required', 400);
    }

    const db = await getDb();

    // 1. Validate max ads per position
    const existingInPos = await db
      .select()
      .from(ads)
      .where(and(eq(ads.position, position), eq(ads.isActive, true)));
    
    if (isActive && existingInPos.length >= AD_CONFIG.MAX_ADS_PER_POSITION) {
      return fail(`Max ${AD_CONFIG.MAX_ADS_PER_POSITION} active ads allowed for ${position}`, 400);
    }

    // 2. Validate priority conflict
    const priorityConflict = await db
      .select()
      .from(ads)
      .where(and(eq(ads.position, position), eq(ads.priority, priority ?? 0)))
      .limit(1);
    
    if (priorityConflict.length > 0) {
      return fail(`Priority ${priority ?? 0} is already used in ${position}`, 400);
    }
    
    const result = await db
      .insert(ads)
      .values({
        position,
        type,
        provider,
        imageUrl,
        redirectUrl,
        unitId,
        isActive: isActive ?? false,
        priority: priority ?? 0,
        frequencyLimit: frequencyLimit ?? 0,
      })
      .returning();

    return NextResponse.json({ ok: true, ad: result[0] });
  } catch (error) {
    console.error('Failed to create ad:', error);
    return fail('Failed to create ad', 500);
  }
}
