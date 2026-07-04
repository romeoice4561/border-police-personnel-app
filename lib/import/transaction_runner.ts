/**
 * TransactionRunner (Phase 17).
 *
 * Thin wrapper over the DatabaseClient's interactive `$transaction`: runs the
 * given unit of work with a transaction-scoped client, committing on success
 * and rolling back on ANY thrown error. It also normalizes low-level driver
 * failures into the engine's structured `DatabaseError` (preserving the
 * engine's own ImportError subclasses unchanged), so the caller always sees a
 * typed cause.
 *
 * This is the ONLY place the engine calls $transaction, so every officer
 * import is guaranteed atomic: officer upsert + timeline replace + phone
 * replace + unit upsert either all commit together or all roll back.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DatabaseError, ImportError } from "@/lib/import/types";

/**
 * Runs `work` inside a single database transaction. On success the transaction
 * commits and the result is returned; on failure it rolls back and the error
 * is rethrown. Engine ImportErrors pass through as-is; anything else (a raw
 * Prisma/pg error) is wrapped in DatabaseError.
 */
export async function runInTransaction<T>(
  client: DatabaseClient,
  work: (tx: DatabaseClient) => Promise<T>
): Promise<T> {
  try {
    return await client.$transaction(async (tx) => work(tx));
  } catch (error) {
    if (error instanceof ImportError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Transaction rolled back: ${message}`, error);
  }
}
