import "server-only";
import { resolveOfficerPortraitsBatch } from "@/lib/server/officer_portrait_service";
import { loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { POSITION_LEVELS } from "@/lib/commander_query/position_level";
import { getSkillCatalog } from "@/lib/server/officer_service";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";

// Phase 44: re-exported for existing call sites (e.g.
// lib/officer_intelligence/view_model.ts) — the pure per-officer
// composition itself now lives in lib/commander_query/query_officer.ts (no
// server-only import) so it can be unit-tested directly.
export { toQueryOfficer };

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b, "th"));
}

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
  const rows = officers.map((officer) => {
    const labels = organizationEngine.resolveLabels({
      headquartersId: officer.headquartersId,
      regionId: officer.regionId,
      battalionId: officer.battalionId,
      companyId: officer.companyId,
    });
    const officialPortraitUrl = portraits.get(officer.officerId)?.thumbnailUrl ?? null;
    return toQueryOfficer(officer, asOf, labels, officialPortraitUrl);
  });

  return {
    officers: rows,
    options: {
      ranks: uniqueSorted(rows.map((row) => row.rank)),
      positionLevels: [...POSITION_LEVELS],
      regions: organizationEngine.getRegions().map((region) => ({
        id: region.id,
        label: organizationEngine.resolveLabels({ headquartersId: region.headquartersId, regionId: region.id, battalionId: null, companyId: null }).borderPatrolDivision ?? region.nameTh,
      })),
      battalions: organizationEngine.getBattalions().map((battalion) => ({
        id: battalion.id,
        regionId: battalion.regionId,
        label: battalion.nameTh,
      })),
      companies: organizationEngine.getCompanies().map((company) => ({
        id: company.id,
        battalionId: company.battalionId,
        label: company.nameTh,
      })),
      priorities: ["low", "medium", "high", "critical"],
      skillCatalog,
    },
  };
}
