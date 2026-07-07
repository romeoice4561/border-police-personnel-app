/**
 * Database client factory (Phase 12).
 *
 * Builds a PrismaClient wired to PostgreSQL via the pg driver adapter.
 * Runtime prefers DATABASE_URL (Supabase pooler — safe under Vercel
 * serverless, where each invocation opens its own connection), then falls
 * back to DIRECT_URL if DATABASE_URL is unavailable. DIRECT_URL remains
 * dedicated to Prisma migrate/introspection (see prisma.config.ts), which use
 * a single, short-lived connection and are unaffected by this change.
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

/**
 * Creates a PrismaClient backed by the pg adapter.
 */
export function createDatabaseClient(
  options: CreateDatabaseClientOptions = {}
): PrismaClient {
  const connectionString =
    options.connectionString ??
    process.env.DATABASE_URL ??
    process.env.DIRECT_URL;

  if (!connectionString) {
    throw new DatabaseConfigError(
      "No database connection string configured. Set DIRECT_URL or DATABASE_URL in .env.local."
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
  });
}