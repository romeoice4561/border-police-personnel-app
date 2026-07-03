/**
 * Database client factory (Phase 12).
 *
 * Builds a PrismaClient wired to PostgreSQL via the pg driver adapter
 * (Prisma 7 requires a driver adapter at runtime — the connection URL is no
 * longer read from schema.prisma). The client is CONSTRUCTED and RETURNED,
 * never stored in a module-level singleton, so callers own its lifecycle and
 * tests can inject their own client. No globals.
 *
 * The connection URL is read from the environment only (DATABASE_URL) — never
 * hardcoded. This module has no business logic; repositories hold all data
 * access, and nothing here touches OpenAI/OCR/Google Drive.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

export interface CreateDatabaseClientOptions {
  /** Postgres connection string. Defaults to process.env.DATABASE_URL. */
  connectionString?: string;
}

/**
 * Creates a PrismaClient backed by the pg adapter. Throws a
 * DatabaseConfigError (never silently connects to nothing) when no connection
 * string is available.
 */
export function createDatabaseClient(options: CreateDatabaseClientOptions = {}): PrismaClient {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new DatabaseConfigError(
      "No database connection string configured. Set DATABASE_URL in .env.local (a PostgreSQL/Supabase URL)."
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
