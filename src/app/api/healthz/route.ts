import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    const result = (await db.run(sql`SELECT 1 AS ok`)) as unknown as {
      rows?: unknown;
      results?: unknown;
    };
    return NextResponse.json({
      ok: true,
      db: 'reachable',
      result: result.rows ?? result.results ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
