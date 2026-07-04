/**
 * Server-side officer data access (Phase 15A).
 *
 * The seam Server Components use to read an officer straight from the
 * persistence layer — REUSING the existing OfficerQueryRepository (Phase 13),
 * so there is no duplicated query and no business logic in React. Runs only on
 * the server (it imports the Prisma-backed database client); a Server
 * Component awaits `getOfficerProfile(id)` directly.
 *
 * A single PrismaClient is created lazily per process and reused across
 * requests (the standard pattern for Next server code), not instantiated per
 * render. This module is server-only by construction — it imports the
 * Prisma-backed database client, so it is only ever imported by Server
 * Components (the officer detail page), never shipped to the browser.
 */

import { createDatabaseClient } from "@/lib/database/database";
import { OfficerQueryRepository } from "@/lib/database/repositories/officer_query_repository";
import type { ReadDatabaseClient, OfficerWithRelations } from "@/lib/database/query_types";

let cachedRepository: OfficerQueryRepository | undefined;

/** Lazily builds (once) the officer query repository over the real database client. */
function officerRepository(): OfficerQueryRepository {
  if (!cachedRepository) {
    const client = createDatabaseClient() as unknown as ReadDatabaseClient;
    cachedRepository = new OfficerQueryRepository(client);
  }
  return cachedRepository;
}

/**
 * Fetches one officer with its ordered timeline and phones, or null if not
 * found. Pure pass-through to the repository — the calling Server Component
 * decides how to render (or 404).
 */
export async function getOfficerProfile(officerId: string): Promise<OfficerWithRelations | null> {
  return officerRepository().findByOfficerId(officerId);
}
