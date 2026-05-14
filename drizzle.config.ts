import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.LOCAL_DB_PATH ?? './local.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;
