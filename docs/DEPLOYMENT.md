# Deployment — Border Patrol Personnel Intelligence System

Production deployment runs the Next.js App Router app (Server Components, route
handlers, Prisma/PostgreSQL) on **Netlify**, backed by a **Supabase**
PostgreSQL database. This guide covers the Netlify + GitHub setup, environment
variables, the deploy flow, rollback, and troubleshooting.

> The AI pipeline (OCR, OpenAI Vision, import, database schema) is **not** part
> of the web deploy — it runs as offline scripts (`scripts/run_*`). Netlify
> serves the dashboard + REST API over the already-populated database.

---

## Prerequisites

- A **GitHub** repository containing this project.
- A **Netlify** account/site connected to that repo.
- A **Supabase** project (PostgreSQL) with the schema migrated
  (`npx prisma migrate deploy`) and data imported
  (`npm run db:import`) — see below.
- Node 20 (pinned via `netlify.toml` → `NODE_VERSION = "20"`).

---

## Netlify

`netlify.toml` (committed) configures the build:

- **Build command:** `npm run build` — runs `prisma generate && next build`.
- **Runtime:** `@netlify/plugin-nextjs` (Netlify's official Next.js runtime),
  declared in `netlify.toml`. Netlify auto-installs it on detection; it wires
  the SSR functions + static assets, so **no manual `publish` directory** is
  set (setting `.next` by hand conflicts with the plugin).
- **Node:** pinned to 20 via `[build.environment]`.

`postinstall` also runs `prisma generate` so the client exists after
`npm ci` in the build image.

### First-time setup

1. In Netlify: **Add new site → Import from GitHub**, pick the repo.
2. Netlify reads `netlify.toml`; leave the build command/publish as detected.
3. Set the environment variables (next section) under
   **Site configuration → Environment variables**.
4. Trigger the first deploy.

---

## GitHub

- Netlify builds automatically on every push to the **production branch**
  (default `main`) — this is the continuous-deployment trigger.
- **Deploy Previews** are created for pull requests, giving a throwaway URL per
  PR to validate before merge.
- Keep secrets **out of the repo** — they live only in Netlify's environment
  settings. `.env.local` is git-ignored and used only for local runs.

---

## Environment Variables

Set these in Netlify (**Site configuration → Environment variables**). Presence
is validated at startup by `lib/config/env_validation.ts` and reported by
`npm run verify:prod` and `/api/health`.

| Variable | Requirement | Purpose |
|---|---|---|
| `DATABASE_URL` | **required** | PostgreSQL/Supabase connection string (runtime + migrations). Use the pooled connection for runtime. |
| `DIRECT_URL` | **required** | Direct (non-pooled) Postgres connection, used for migrations. |
| `NEXT_PUBLIC_SUPABASE_URL` | **required** | Supabase project URL (exposed to the client). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **required** | Supabase anon key (exposed to the client). |
| `OPENAI_API_KEY` | feature | OpenAI Vision extraction (offline import pipeline). |
| `GOOGLE_APPLICATION_CREDENTIALS` | feature | Google service-account credentials for Drive scanning. |
| `GOOGLE_DRIVE_ROOT_FOLDER` | feature | Root Drive folder id to scan. |
| `OPENAI_MODEL` | optional | OpenAI model id; defaults in code if unset. |

**required** — the deployed web app needs these to serve its core (DB-backed)
features; a missing one is a startup error. **feature** — enables an offline
pipeline capability; absent → that feature is disabled, but the web app still
runs. `NEXT_PUBLIC_*` variables are inlined into the client bundle, so treat the
anon key as public (never put a service-role key in a `NEXT_PUBLIC_*` var).

---

## Deployment

1. **Verify locally first:**
   ```
   npm run verify:prod
   ```
   Runs Environment → TypeScript → Lint → Prisma → Build → Health. All must
   pass before you push.
2. **Migrate the database** (once per schema change), against the Supabase
   `DIRECT_URL`:
   ```
   npx prisma migrate deploy
   ```
3. **Import/refresh data** (offline, as needed):
   ```
   npm run db:import
   ```
4. **Push to `main`** — Netlify builds and deploys automatically.
5. **Confirm the deploy** by hitting the health endpoint on the live URL:
   ```
   curl https://<your-site>.netlify.app/api/health
   ```
   Expect `{ "data": { "status": "ok", "database": "connected", "version",
   "uptime", "environment": "production", "timestamp" } }` with HTTP 200.

---

## Rollback

Netlify keeps every deploy immutable and re-servable:

1. **Netlify UI → Deploys**: find the last known-good deploy and choose
   **Publish deploy** to roll the live site back to it instantly (no rebuild).
2. Alternatively, **revert the offending commit** in Git and push — Netlify
   builds and publishes the reverted state.
3. **Database rollback** is separate from the app rollback. A schema migration
   is not undone by republishing an old deploy; if a migration caused the
   problem, apply a corrective migration (`prisma migrate`) — do not hand-edit
   production tables. Because imports are **idempotent**, re-running
   `npm run db:import` is safe and creates no duplicates.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `/api/health` returns 503 `status: degraded`, `database: disconnected` | `DATABASE_URL` unset/wrong, or the DB is unreachable. Check the Netlify env vars and the Supabase connection string (pooled for runtime). |
| Build fails on `prisma generate` | Ensure `postinstall`/`build` run it and the Prisma engine can download in the build image (`PRISMA_HIDE_UPDATE_MESSAGE` is set). |
| App builds but pages 500 at runtime | A required env var is missing at runtime — run `npm run verify:prod` (or read `/api/health`'s `environment` + the startup env report) to see which. |
| UI shows a **Development** badge in production | `NODE_ENV` isn't `production` in the deploy — Netlify sets this automatically for production builds; a preview/branch deploy is expected to show a non-production badge. |
| Client can't reach Supabase | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` missing or wrong; these are inlined at build time, so **redeploy** after changing them. |
| Migrations fail | Use `DIRECT_URL` (non-pooled) for `prisma migrate deploy`; the pooled URL can reject migration DDL. |
| Officer pages empty | The database has no data — run `npm run db:import` after `prisma migrate deploy`. |

For the health-check contract and env spec, see `app/api/health/route.ts` and
`lib/config/env_validation.ts`.
