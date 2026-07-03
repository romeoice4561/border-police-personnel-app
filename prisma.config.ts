/**
 * Prisma 7 configuration (Phase 12).
 *
 * In Prisma 7, connection URLs no longer live in schema.prisma. This file
 * supplies the datasource URL used by the Prisma CLI for migrate/introspect
 * commands (from DATABASE_URL, with an optional DIRECT_URL for pooled
 * Supabase connections). The runtime PrismaClient gets its connection via a
 * driver adapter instead — see lib/database/database.ts.
 *
 * No secrets are hardcoded; URLs are read from the environment only.
 */

import { defineConfig } from "prisma/config";

// Read the migration connection URL directly from process.env (rather than
// Prisma's env() helper, which throws on an unset variable). DIRECT_URL is
// preferred for migrations — a non-pooled connection on Supabase — falling
// back to DATABASE_URL. Left undefined when neither is set, so CLI commands
// that don't need a DB (validate/generate) still work in this environment.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
