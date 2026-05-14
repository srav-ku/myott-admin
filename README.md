# OTT Backend (Next.js 15 + Cloudflare D1)

API + (later) frontend for the OTT platform. Designed to deploy to
Cloudflare Pages with a D1 database binding. Locally, runs on `next dev`
backed by a SQLite file so iteration stays fast.

## Layout

```
web/
  src/
    app/
      api/             # All API routes
      page.tsx         # Placeholder root page
    db/
      schema.ts        # Drizzle schema (sqlite-core; works for local + D1)
      client.ts        # getDb() — D1 in prod, better-sqlite3 in dev
      migrate-local.ts # Apply migrations to the local SQLite file
      seed.ts          # Seed default languages
    lib/
      http.ts          # JSON / validation helpers
  drizzle/migrations/  # Generated SQL migrations
  wrangler.toml        # Cloudflare Pages + D1 binding config
  drizzle.config.ts    # Drizzle Kit config
```

## Local development

```bash
pnpm install
pnpm --filter @workspace/web run db:generate    # generate SQL migration files
pnpm --filter @workspace/web run db:migrate:local
pnpm --filter @workspace/web run db:seed
pnpm --filter @workspace/web run dev            # http://localhost:3000
```

Set environment variables in `web/.env.local` (see `web/.env.example`).

## Deploying to Cloudflare Pages

1. Create the D1 database once:
   ```bash
   wrangler d1 create ott-db
   ```
   Paste the printed `database_id` into `wrangler.toml`.
2. Apply migrations to the remote D1:
   ```bash
   pnpm --filter @workspace/web run db:migrate:remote
   ```
3. Set production secrets:
   ```bash
   wrangler pages secret put TMDB_API_KEY
   wrangler pages secret put EXTRACTOR_URL
   ```
4. Deploy:
   ```bash
   pnpm --filter @workspace/web run pages:deploy
   ```
