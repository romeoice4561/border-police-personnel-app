/**
 * Commander Intelligence Center page orchestration (Phase 49B).
 *
 * Reuses the exact same single officer-profile load + single
 * CommanderQueryDataset build that Commander Dashboard already performs
 * (lib/commander_dashboard/orchestrate_page_data.ts) — this page does NOT
 * call loadCommanderOfficerProfiles() or buildCommanderQueryDataset() a
 * second time. The Intelligence Center view model is a pure composition on
 * top of that already-loaded result.
 */
import "server-only";

import {
  orchestrateCommanderDashboardPageData,
  type OrchestrateCommanderDashboardPageDataDeps,
} from "@/lib/commander_dashboard/orchestrate_page_data";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { getSkillCatalog } from "@/lib/server/officer_service";
import { resolveOfficerPortraitsBatch } from "@/lib/server/officer_portrait_service";
import { buildCommanderIntelligenceCenter } from "@/lib/commander_intelligence_center/build_view_model";
import type { CommanderIntelligenceCenterViewModel } from "@/lib/commander_intelligence_center/types";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";

export type LoadCommanderIntelligenceCenterPageDataDeps = Partial<
  Omit<OrchestrateCommanderDashboardPageDataDeps, "asOf">
> & {
  asOf?: Date;
};

export interface CommanderIntelligenceCenterPageData {
  dataset: CommanderQueryDataset;
  center: CommanderIntelligenceCenterViewModel;
}

/**
 * Single entry point for app/commander-intelligence/page.tsx. Calls the SAME
 * dashboard orchestrator Commander Dashboard uses (one profile load, one
 * dataset build, one CommanderDashboard/CommanderDashboardViewModel compose)
 * and layers the Intelligence Center view model on top — no duplicate I/O.
 */
export async function loadCommanderIntelligenceCenterPageData(
  deps: LoadCommanderIntelligenceCenterPageDataDeps = {}
): Promise<CommanderIntelligenceCenterPageData> {
  const asOf = deps.asOf ?? new Date();
  const { dataset, dashboard, viewModel } = await orchestrateCommanderDashboardPageData({
    asOf,
    loadOfficerProfiles: deps.loadOfficerProfiles ?? loadCommanderOfficerProfiles,
    loadOrganizationEngine: deps.loadOrganizationEngine ?? loadOrganizationEngine,
    getSkillCatalog: deps.getSkillCatalog ?? getSkillCatalog,
    resolvePortraits: deps.resolvePortraits ?? resolveOfficerPortraitsBatch,
  });

  return {
    dataset,
    center: buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf }),
  };
}
