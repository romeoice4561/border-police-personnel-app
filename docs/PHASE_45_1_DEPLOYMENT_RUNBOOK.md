# Phase 45.1 Deployment Runbook — Personnel Master Data Expansion

Governs deploying the Phase 45.1 schema migration and application code to the
remote Supabase database. **The remote database has not been touched by any
Phase 45.1 work session** — every command below is a plan for a human
operator to execute manually, with explicit authorization, not something an
agent has run or should run unattended.

## Migration path

```
prisma/migrations/20260721000000_personnel_master_data_expansion/migration.sql
```

Adds 11 nullable columns to `Officer` via `ALTER TABLE ... ADD COLUMN` only:
`academyClass`, `isGpfMember`, `isPoliceFuneralWelfareMember`,
`isCooperativeMember`, `cooperativeName`, `salaryLevel`, `currentSalaryStep`,
`currentSalary`, `netSalary`, `bankName`, `bankAccountNumber`. No existing
column is altered or dropped; no row is deleted; no `NOT NULL` constraint is
added (verified by an automated test —
`lib/officer_profile/__tests__/officer_financial_redaction.test.ts`,
"Migration remains additive and nullable").

## Why order matters — read before deploying

**Prisma queries in this codebase select all Officer scalar fields by
default.** `OfficerRepository.findByOfficerId()` and every other repository
method call `this.db.officer.findUnique(...)`/`findMany(...)` with no
`select` clause, which is Prisma's default `SELECT *` behavior. The
generated Prisma Client (already regenerated locally against the NEW schema
— see `lib/generated/prisma/`) now has TypeScript types and runtime query
logic that **expect** the 11 new columns to exist in the database.

**If the application code from this phase is deployed BEFORE the migration
is applied to the target database, every Officer read/write query will
fail at runtime** — Prisma's query engine builds SQL referencing columns
that do not yet exist, and Postgres will reject it with an
`column "academyClass" of relation "Officer" does not exist`-style error
(or equivalent for whichever column the query engine references first).
This is not a soft-degradation failure mode — the officer list, officer
detail page, Commander Search, and Commander Dashboard would all break for
every user, not just ones touching Phase 45.1 features.

**⚠️ WARNING: Do not deploy Phase 45.1 application code to any environment
before the migration has been applied and verified in that SAME
environment's database.** Migration-first is not optional here.

## Required release order

1. **Verify backup** — see Backup checklist below. Do not proceed without a
   confirmed, restorable backup.
2. **Confirm target `DATABASE_URL`** — run `echo $DATABASE_URL` (or the
   platform-appropriate equivalent) and confirm it points at the intended
   environment (staging vs. production) before running anything. A migration
   applied to the wrong environment cannot be un-applied by re-running this
   runbook.
3. **Check migration status**:
   ```
   npx prisma migrate status
   ```
   Confirm `20260721000000_personnel_master_data_expansion` is the only
   pending migration, and that no other migration is unexpectedly pending
   ahead of it (a sign the target database is behind the version this
   codebase assumes).
4. **Apply the migration**:
   ```
   npx prisma migrate deploy
   ```
   This applies exactly the pending migration(s) in order — it does not
   regenerate the schema from scratch and does not touch any table this
   migration doesn't explicitly `ALTER`.
5. **Verify all 11 columns exist** — see Migration Verification Script
   below (`scripts/verify_personnel_master_data_migration.ts`). Run it
   against the SAME `DATABASE_URL` the migration was just applied to.
6. **Run a read/write smoke test** — see Smoke-test checklist below.
7. **Deploy application code** — only after steps 1-6 pass.
8. **Verify Officer Profile and edit flow** in the deployed environment:
   open any officer's profile, confirm the "ข้อมูลสมาชิกและการเงิน" section
   renders (even if empty), enter Edit Mode, set one field (e.g. Academy
   Class), Save, and confirm it persists on reload.
9. **Monitor logs** for the first period after deploy — watch specifically
   for any Prisma "column does not exist" or "unknown argument" error,
   which would indicate the migration didn't fully apply or the deployed
   code doesn't match the migrated schema version.

## Backup checklist

- [ ] Confirm Supabase automatic backups are current (Supabase dashboard →
      Database → Backups), **or**
- [ ] Take a manual snapshot / `pg_dump` of the `Officer` table (or full
      database) immediately before running the migration
- [ ] Verify the backup is restorable (not just that it completed —
      actually test a restore against a scratch database if this is a
      production deployment)
- [ ] Confirm no other uncommitted/pending migration exists ahead of this
      one (`npx prisma migrate status`)
- [ ] Schedule the migration during a low-traffic window if this is a
      production database

## Exact apply command

```
npx prisma migrate deploy
```

Run from the repository root with `DATABASE_URL` set to the target
environment. This is the ONLY command that should be run to apply this
migration — not `prisma migrate dev` (interactive, dev-only, may prompt to
reset), not `prisma db push` (schema-diffing, bypasses the migration history
this project relies on for repeatable, auditable deploys).

## Migration verification (read-only, no data modified)

See `scripts/verify_personnel_master_data_migration.ts`
(Task 8 — documented in full below). Confirms the 11 expected columns exist
on `Officer` via `information_schema.columns` — a read-only query, never a
write, never a schema change.

```
npx tsx scripts/verify_personnel_master_data_migration.ts
```

## Smoke-test checklist (after migration, before/after code deploy)

- [ ] `npx prisma migrate status` shows no pending migrations
- [ ] `npx tsx scripts/verify_personnel_master_data_migration.ts` reports
      all 11 columns present
- [ ] A read query against any existing Officer row succeeds and the new
      columns return `null` (never an error, never a fabricated value) for
      a pre-migration record
- [ ] A write: set one new field (e.g. `academyClass`) on a single test
      officer via the application's Edit Mode, save, reload, confirm it
      persisted
- [ ] Confirm an UNRELATED field edit (e.g. changing `phone`) on the SAME
      officer does not clear the financial fields just set (regression
      guard for the "editing unrelated fields never erases these values"
      requirement)
- [ ] Confirm the officer list / Commander Search / Commander Dashboard
      still load without error (these don't display the new fields
      directly but DO run `SELECT *`-shaped Officer queries that would
      fail if the migration were incomplete)

## Rollback strategy

The migration is purely additive (11 nullable `ADD COLUMN` statements) — no
existing data or behavior depends on these columns, so:

- **If the migration fails partway** (rare for additive `ALTER TABLE`, but
  possible under lock contention or a connection drop): re-run
  `npx prisma migrate deploy` — Prisma tracks applied migrations in its
  `_prisma_migrations` table and will not re-apply a completed migration,
  but will retry an incomplete one from where its migration history says it
  left off. If a statement partially applied, prefer restoring from the
  pre-migration backup over manually patching `_prisma_migrations`.
- **If the migration succeeds but the deployed code needs to be rolled
  back**: the migration does NOT need to be reverted — the 11 nullable
  columns are inert to any pre-Phase-45.1 code path (no prior query
  selects or depends on them). Simply redeploy the previous application
  version; the extra columns are silently ignored by old Prisma Client
  code generated before this phase.
- **If the columns must be removed entirely** (e.g. the feature is
  cancelled): write a follow-up migration with
  `ALTER TABLE "Officer" DROP COLUMN "..."` for each of the 11 columns.
  This is a separate, deliberate migration — never done by hand against
  the live database, and never bundled into this runbook's scope.

## What this runbook does NOT cover

- Creating the backup infrastructure itself (assumes Supabase's existing
  backup capability or the operator's own `pg_dump` tooling).
- True server-side authorization for the financial fields this migration
  enables — see `docs/PERSONNEL_MASTER_DATA_STANDARD.md` and
  `lib/officer_profile/officer_financial_redaction.ts` for the current
  state (server-boundary masking of the bank account number only; no
  server-verified permission check exists for any field yet, since this
  codebase has no server-verifiable session). This runbook covers SCHEMA
  deployment safety only, not the separate, still-open RBAC gap.
