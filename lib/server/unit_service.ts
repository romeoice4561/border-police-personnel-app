/**
 * Server-side unit data access (Phase 23A — Officer Profile Workspace).
 *
 * The seam Server Components use to read the distinct unit list — REUSING
 * the existing UnitQueryRepository (Phase 13), so there is no duplicated
 * query. Feeds the Unit Combobox's suggestions on the Officer Profile
 * Workspace (existing units are suggested, but the user may always type a
 * brand-new one — never a forced dropdown).
 *
 * Mirrors officer_service.ts's lazy-per-process repository cache exactly.
 */

import { createDatabaseClient } from "@/lib/database/database";
import { UnitQueryRepository } from "@/lib/database/repositories/unit_query_repository";
import type { ReadDatabaseClient } from "@/lib/database/query_types";

let cachedRepository: UnitQueryRepository | undefined;

function unitRepository(): UnitQueryRepository {
  if (!cachedRepository) {
    const client = createDatabaseClient() as unknown as ReadDatabaseClient;
    cachedRepository = new UnitQueryRepository(client);
  }
  return cachedRepository;
}

/** Distinct unit names, most populous first — for the Unit combobox's suggestions. */
export async function getKnownUnits(): Promise<string[]> {
  const units = await unitRepository().listWithCounts();
  return units.map((u) => u.unit);
}
