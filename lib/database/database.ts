/**
 * Database client factory (Phase 12).
 *
 * Builds a PrismaClient wired to PostgreSQL via the pg driver adapter.
 * Runtime prefers DATABASE_URL (Supabase pooler — safe under Vercel
 * serverless, where each invocation opens its own connection), then falls
 * back to DIRECT_URL if DATABASE_URL is unavailable. DIRECT_URL remains
 * dedicated to Prisma migrate/introspection (see prisma.config.ts), which use
 * a single, short-lived connection and are unaffected by this change.
 *
 * Phase 49A.2A: default (env-based) clients are reused per process via
 * `globalThis`. Each `new PrismaPg({ connectionString })` opens its own
 * `pg.Pool`; containers that each called `createDatabaseClient()` without
 * sharing exhausted the pooler and caused PATCH `$transaction` to fail with
 * Prisma P2028 ("Unable to start a transaction in the given time").
 */

import "dotenv/config";

// Phase 16B: Prisma 7 `prisma-client` generator — the client is generated to
// lib/generated/prisma (source tree), not node_modules, so there is no
// @prisma/client symlink for the Netlify/OpenNext bundler to fail on.
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

export interface CreateDatabaseClientOptions {
  /** Postgres connection string. Defaults to DATABASE_URL, then DIRECT_URL. */
  connectionString?: string;
}

const globalForDb = globalThis as typeof globalThis & {
  __borderPolicePrisma?: PrismaClient;
};

function buildClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
  });
}

/**
 * Creates a PrismaClient backed by the pg adapter.
 *
 * When `connectionString` is omitted, returns the process-wide singleton
 * (HMR-safe via `globalThis`). Explicit `connectionString` always builds a
 * fresh client (scripts/tests that need an alternate URL).
 */
export function createDatabaseClient(
  options: CreateDatabaseClientOptions = {}
): PrismaClient {
  if (options.connectionString) {
    return buildClient(options.connectionString);
  }

  if (globalForDb.__borderPolicePrisma) {
    return globalForDb.__borderPolicePrisma;
  }

  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

  if (!connectionString) {
    throw new DatabaseConfigError(
      "No database connection string configured. Set DIRECT_URL or DATABASE_URL in .env.local."
    );
  }

  const client = buildClient(connectionString);
  globalForDb.__borderPolicePrisma = client;
  return client;
}
