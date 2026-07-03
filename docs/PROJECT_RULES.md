# Project Rules

## Coding Standards

- TypeScript strict mode everywhere. No `any` unless justified with a comment.
- React Server Components by default; use `"use client"` only when interactivity requires it.
- All external input (API responses, form data, file uploads) validated with Zod before use.
- Prefer composition over inheritance; keep components small and single-purpose.
- No feature logic in `app/` route files beyond composition — business logic lives in `lib/`.

## Folder Structure

```
app/                    Next.js routes (App Router)
components/
  layout/               Page shells, navigation, headers/footers
  ui/                    shadcn/ui primitives
  common/                Shared composite components (cards, tables, etc.)
lib/
  ai/                    Vision extraction, prompt templates, AI client wrappers
  google-drive/          Google Drive API client, folder scanning, sync logic
  parser/                Raw AI output -> structured personnel records
  database/              Prisma client, query helpers, repositories
  utils/                 Generic helpers (formatting, dates, strings)
  types/                 Shared TypeScript types and Zod schemas
database/
  schema/                Human-readable schema documentation
  migrations/            SQL/Prisma migrations
  seeds/                 Seed data scripts
docs/                    All project documentation
scripts/                 One-off and maintenance scripts (CLI-run only)
imports/                 Inbound data staging (not committed with real data)
exports/                 Generated exports (not committed with real data)
storage/                 Local file storage for dev (mirrors Supabase Storage)
supabase/                Supabase project config, local CLI state
prisma/                  Prisma schema and client config
public/images            Static images
public/icons             Static icons
```

## Naming Conventions

- Files: `kebab-case.ts` / `kebab-case.tsx`.
- React components: `PascalCase` for the component name, file name in kebab-case.
- Database tables: `snake_case`, plural (e.g. `officers`, `career_history`).
- Database columns: `snake_case`.
- Zod schemas: suffix with `Schema` (e.g. `OfficerSchema`).
- Types/interfaces: `PascalCase`, no `I` prefix.
- Environment variables: `SCREAMING_SNAKE_CASE`, prefixed by domain (`SUPABASE_`, `GOOGLE_`, `AI_`).

## Git Strategy

- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- One logical change per commit. No mixed doc + feature commits.
- No direct commits to `main`. All work lands via pull request.

## Branch Strategy

- `main` — always deployable.
- `develop` — integration branch for the current phase.
- `feature/<phase>-<short-description>` — e.g. `feature/04-ai-vision`.
- `fix/<short-description>` — bug fixes.
- Delete feature branches after merge.

## Error Handling

- Never swallow errors silently; log with context (module, operation, input identifiers — no PII in logs).
- Use typed error classes per domain (`GoogleDriveError`, `AIVisionError`, `ValidationError`) defined in `lib/types`.
- All import pipeline failures are recorded against `import_jobs`, never just thrown into the void.
- User-facing errors are translated to safe, non-leaking messages; raw errors stay server-side.

## Security

- Never commit secrets, service account keys, or `.env*` files.
- All Supabase access from the client uses row-level security (RLS); server-side privileged operations use the service role key only in server contexts.
- Validate and sanitize all AI-extracted data before persisting — treat AI output as untrusted input.
- Principle of least privilege for all API keys and service accounts.

## Environment Variables

- Defined in `.env.local` (gitignored) with `.env.example` kept up to date.
- Grouped by domain with comments: Supabase, Google Drive, AI provider.
- Never read `process.env` directly outside a single config module (`lib/utils/env.ts`, added when needed).

## Logging Policy

- Structured logging (JSON) in server contexts.
- No PII (names, photos, personal identifiers) in log messages — reference by internal ID only.
- Log levels: `error`, `warn`, `info`, `debug`. Default production level: `info`.

## Documentation Policy

- Every phase that changes architecture or schema updates the relevant doc in `docs/` in the same PR.
- `docs/CHANGELOG.md` updated for every version bump.
- `docs/PROJECT_STATUS.md` updated at the end of every phase.
- `docs/HANDOFF.md` kept current so any engineer (or AI agent) can resume work cold.
