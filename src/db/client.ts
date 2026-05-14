/**
 * Database client. Returns a Drizzle client backed by:
 *  - libSQL (file-backed SQLite with prebuilt binaries).
 *
 * Schema is SQLite-dialect.
 *
 * Usage in API routes:
 *   const db = await getDb();
 */
import 'server-only';
import {
  drizzle as drizzleLibsql,
  type LibSQLDatabase,
} from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export type DbClient = LibSQLDatabase<typeof schema>;

let _localDb: LibSQLDatabase<typeof schema> | null = null;

function getLocalDb(): LibSQLDatabase<typeof schema> {
  if (_localDb) return _localDb;
  const path = process.env.LOCAL_DB_PATH ?? './local.db';
  const url = path.startsWith('file:') ? path : `file:${path}`;
  const client = createClient({ url });
  _localDb = drizzleLibsql(client, { schema });
  return _localDb;
}

/**
 * Get a Drizzle client. In local dev we use a local libSQL file.
 */
export async function getDb(): Promise<DbClient> {
  return getLocalDb();
}

export { schema };
