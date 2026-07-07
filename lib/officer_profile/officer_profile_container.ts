/**
 * Officer Profile Workspace dependency container (Phase 23A).
 *
 * Assembles the workspace's write-side graph — OfficerProfileService over an
 * injected DatabaseClient. Mirrors the Gallery/ProfilePhoto containers'
 * DI seam exactly:
 *   - `createOfficerProfileContainer(client)` builds the graph from any
 *     DatabaseClient (the real Prisma client in production, a fake in tests).
 *   - `getOfficerProfileContainer()` lazily creates the production graph
 *     backed by the real Supabase-connected Prisma client, reused per
 *     process — not a global singleton of shared mutable state.
 *
 * No OCR, no AI, no Gallery/ProfilePhoto coupling.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { OfficerProfileService } from "@/lib/officer_profile/officer_profile_service";

export interface OfficerProfileContainer {
  service: OfficerProfileService;
}

/** Builds the container from any DatabaseClient (real or fake). Pure — no I/O. */
export function createOfficerProfileContainer(client: DatabaseClient): OfficerProfileContainer {
  return { service: new OfficerProfileService({ db: client }) };
}

let cachedClient: DatabaseClient | undefined;

/**
 * Lazily builds (once per process) the production container backed by the
 * real Prisma client. Imported dynamically so this module never pulls the
 * Prisma runtime unless a real request needs it.
 */
export async function getOfficerProfileContainer(): Promise<OfficerProfileContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as DatabaseClient;
  }
  return createOfficerProfileContainer(cachedClient);
}
