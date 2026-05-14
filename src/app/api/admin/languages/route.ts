import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { languages } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/admin/languages
 * Returns a list of all language names from the database.
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const allLanguages = await db.select({ name: languages.name }).from(languages);
    return NextResponse.json({ languages: allLanguages.map(l => l.name) });
  } catch (error) {
    console.error('[api/admin/languages] failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/languages
 * Adds a new language to the database.
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Invalid language name' },
        { status: 400 }
      );
    }

    // Check if language already exists (case-insensitive for user input, but store as provided)
    const existing = await db.select().from(languages).where(eq(languages.name, name));
    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Language '${name}' already exists` },
        { status: 409 }
      ); // Conflict
    }

    await db.insert(languages).values({ name });
    return NextResponse.json({ ok: true, message: `Language '${name}' added.` });
  } catch (error) {
    console.error('[api/admin/languages] failed to add language:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
