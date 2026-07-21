import "server-only";
import { resolveOfficerPortraitsBatch } from "@/lib/server/officer_portrait_service";
import { loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { getSkillCatalog } from "@/lib/server/officer_service";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import { buildCommanderQueryDataset } from "@/lib/commander_query/build_dataset";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";

// Phase 44: re-exported for existing call sites (e.g.
// lib/officer_intelligence/view_model.ts) — the pure per-officer
// composition itself now lives in lib/commander_query/query_officer.ts (no
// server-only import) so it can be unit-tested directly.
export { toQueryOfficer } from "@/lib/commander_query/query_officer";

/**
 * Loads the canonical Commander Search / Dashboard officer dataset.
 * Commander Search and other independent entry points keep calling this.
 * The Commander Dashboard page must NOT call this repeatedly — use
 * loadCommanderDashboardPageData() which loads profiles once and builds
 * the same dataset via buildCommanderQueryDataset().
 */
export async function getCommanderQueryDataset(): Promise<CommanderQueryDataset> {
  const asOf = new Date();
  const [officers, organizationEngine, skillCatalog] = await Promise.all([
    loadCommanderOfficerProfiles(),
    loadOrganizationEngine(),
    getSkillCatalog(),
  ]);
  // Phase 43: batch-resolve Official Portraits ONCE here, upstream of every
  // consumer (Commander Search, Commander Dashboard), via the canonical
  // resolver — so no caller can regress onto the unreliable legacy
  // thumbnailUrl/driveFileId fields. Constant query count, not N+1.
  const portraits = await resolveOfficerPortraitsBatch(officers.map((officer) => officer.officerId));
  const officialPortraitByOfficerId = new Map<string, string | null>();
  for (const officer of officers) {
    officialPortraitByOfficerId.set(officer.officerId, portraits.get(officer.officerId)?.thumbnailUrl ?? null);
  }
  return buildCommanderQueryDataset({
    officers,
    organizationEngine,
    skillCatalog,
    officialPortraitByOfficerId,
    asOf,
  });
}
