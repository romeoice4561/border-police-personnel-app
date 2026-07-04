/**
 * Database client factory (Phase 12).
 *
 * Builds a PrismaClient wired to PostgreSQL via the pg driver adapter.
 * Runtime prefers DIRECT_URL (direct connection), then falls back to
 * DATABASE_URL if DIRECT_URL is unavailable.
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
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