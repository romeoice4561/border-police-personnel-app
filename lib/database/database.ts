/**
 * Database client factory (Phase 12).
 *
 * Builds a PrismaClient wired to PostgreSQL via the pg driver adapter.
 * Runtime prefers DIRECT_URL (direct connection), then falls back to
 * DATABASE_URL if DIRECT_URL is unavailable.
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
  /** Postgres connection string. Defaults to DIRECT_URL, then DATABASE_URL. */
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
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL;

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