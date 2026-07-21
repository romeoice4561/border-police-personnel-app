/**
 * Commander Dashboard page orchestration (Phase 49A.1 — Dataset Consolidation).
 *
 * ONE officer-profile repository load + ONE CommanderQueryDataset build per
 * Dashboard page request. All section composers consume that shared load.
 */
import "server-only";

import {
  orchestrateCommanderDashboardPageData,
  type CommanderDashboardPageData,
  type OrchestrateCommanderDashboardPageDataDeps,
} from "@/lib/commander_dashboard/orchestrate_page_data";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { getSkillCatalog } from "@/lib/server/officer_service";
import { resolveOfficerPortraitsBatch } from "@/lib/server/officer_portrait_service";

export type { CommanderDashboardPageData };

export type LoadCommanderDashboardPageDataDeps = Partial<
  Omit<OrchestrateCommanderDashboardPageDataDeps, "asOf">
> & {
  asOf?: Date;
};

/**
 * Single entry point for app/dashboard/page.tsx.
 * Exactly one officer-profile load and one dataset build; all sections compose
 * from that result. Injectable deps exist for call-count tests only.
 */
export async function loadCommanderDashboardPageData(
  deps: LoadCommanderDashboardPageDataDeps = {}
): Promise<CommanderDashboardPageData> {
  return orchestrateCommanderDashboardPageData({
    asOf: deps.asOf ?? new Date(),
    loadOfficerProfiles: deps.loadOfficerProfiles ?? loadCommanderOfficerProfiles,
    loadOrganizationEngine: deps.loadOrganizationEngine ?? loadOrganizationEngine,
    getSkillCatalog: deps.getSkillCatalog ?? getSkillCatalog,
    resolvePortraits: deps.resolvePortraits ?? resolveOfficerPortraitsBatch,
  });
}
