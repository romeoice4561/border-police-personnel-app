/**
 * Manual Personnel Entry dependency container (Phase XX — Admin Only).
 *
 * Mirrors the Officer Profile Workspace container's DI seam exactly:
 *   - `createManualEntryContainer(client)` builds the graph from any
 *     DatabaseClient (the real Prisma client in production, a fake in tests).
 *   - `getManualEntryContainer()` lazily creates the production graph backed
 *     by the real Supabase-connected Prisma client, reused per process.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { ManualEntryService } from "@/lib/manual_entry/manual_entry_service";

export interface ManualEntryContainer {
  service: ManualEntryService;
}

/** Builds the container from any DatabaseClient (real or fake). Pure — no I/O. */
export function createManualEntryContainer(client: DatabaseClient): ManualEntryContainer {
  return { service: new ManualEntryService({ db: client }) };
}

let cachedClient: DatabaseClient | undefined;

/** Lazily builds (once per process) the production container backed by the real Prisma client. */
export async function getManualEntryContainer(): Promise<ManualEntryContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as DatabaseClient;
  }
  return createManualEntryContainer(cachedClient);
}
