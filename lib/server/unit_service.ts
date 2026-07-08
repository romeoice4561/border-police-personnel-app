/**
 * Server-side unit data access (Phase 23A — Officer Profile Workspace;
 * Phase 23B — filter suggestions to valid Border Patrol units, bug #4).
 *
 * The seam Server Components use to read the distinct unit list — REUSING
 * the existing UnitQueryRepository (Phase 13), so there is no duplicated
 * query. Feeds the Unit Combobox's suggestions on the Officer Profile
 * Workspace (existing units are suggested, but the user may always type a
 * brand-new one — never a forced dropdown).
 *
 * Phase 23B: the raw currentUnit values are polluted with ranks, schools,
 * phone numbers, provinces, and OCR garbage. getKnownUnits now filters them
 * to genuine Border Patrol units (filterValidBorderPatrolUnits) so the
 * autocomplete list is clean. The Unit field stays free text; only the
 * SUGGESTIONS are filtered — no stored value is altered.
 *
 * Mirrors officer_service.ts's lazy-per-process repository cache exactly.
 */

import { createDatabaseClient } from "@/lib/database/database";
import { UnitQueryRepository } from "@/lib/database/repositories/unit_query_repository";
import { filterValidBorderPatrolUnits } from "@/lib/officer_profile/unit_filter";
import type { ReadDatabaseClient } from "@/lib/database/query_types";

let cachedRepository: UnitQueryRepository | undefined;

function unitRepository(): UnitQueryRepository {
  if (!cachedRepository) {
    const client = createDatabaseClient() as unknown as ReadDatabaseClient;
    cachedRepository = new UnitQueryRepository(client);
  }
  return cachedRepository;
}

/** Distinct VALID Border Patrol units (ranks/schools/garbage filtered out) — for the Unit combobox's suggestions. */
export async function getKnownUnits(): Promise<string[]> {
  const units = await unitRepository().listWithCounts();
  return filterValidBorderPatrolUnits(units.map((u) => u.unit));
}
