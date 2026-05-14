/**
 * Apply Drizzle migrations to the local libSQL file used by `next dev`.
 * Run with: npm run db:migrate
 */
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import { resolve } from 'node:path';
import { languages, links } from './schema';
import { sql } from 'drizzle-orm';

const languageMap: Record<string, string> = {
  'en': 'English',
  'hi': 'Hindi',
  'te': 'Telugu',
  'ta': 'Tamil',
  'zh': 'Chinese',
  'es': 'Spanish',
  'ja': 'Japanese',
  'ko': 'Korean',
  'fr': 'French',
  'ml': 'Malayalam',
  'kn': 'Kannada',
  'bn': 'Bengali',
};

async function main() {
  const dbPath = process.env.LOCAL_DB_PATH ?? './local.db';
  const url = dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`;
  const migrationsFolder = resolve(process.cwd(), 'drizzle/migrations');

  const client = createClient({ url });
  const db = drizzle(client);

  console.log(`[migrate] applying migrations from ${migrationsFolder} -> ${dbPath}`);
  await migrate(db, { migrationsFolder });
  console.log('[migrate] schema migrations done.');

  // Seed languages table
  console.log('[migrate] seeding languages table...');
  const languagesToInsert = Object.values(languageMap).map((name) => ({ name }));
  await db.insert(languages)
    .values(languagesToInsert)
    .onConflictDoNothing({ target: languages.name });
  console.log('[migrate] languages table seeded.');

  // Update existing links to use full language names
  console.log('[migrate] updating links languages from codes to full names...');
  const existingLinks = await db.select().from(links);

  for (const link of existingLinks) {
    if (link.languages && Array.isArray(link.languages)) {
      const updatedLanguages = link.languages.map((code) => languageMap[code] || code); // Fallback to code if not found
      await db.update(links)
        .set({ languages: updatedLanguages as any }) // Drizzle-orm expects any for JSON column updates
        .where(sql`${links.id} = ${link.id}`);
    }
  }
  console.log('[migrate] links languages updated.');

  client.close();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});

