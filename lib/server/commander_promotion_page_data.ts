/**
 * Commander Promotion Intelligence page orchestration (Phase 50).
 *
 * Reuses the exact same single officer-profile load + CommanderQueryDataset
 * build as Commander Dashboard / CIC — no second fetch.
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
import { buildCommanderPromotionDashboard } from "@/lib/commander_promotion/build_view_model";
import type { CommanderPromotionViewModel } from "@/lib/commander_promotion/types";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";

export type LoadCommanderPromotionPageDataDeps = Partial<Omit<OrchestrateCommanderDashboardPageDataDeps, "asOf">> & {
  asOf?: Date;
};

export interface CommanderPromotionPageData {
  dataset: CommanderQueryDataset;
  promotion: CommanderPromotionViewModel;
}

export async function loadCommanderPromotionPageData(
  deps: LoadCommanderPromotionPageDataDeps = {}
): Promise<CommanderPromotionPageData> {
  const asOf = deps.asOf ?? new Date();
  const { dataset } = await orchestrateCommanderDashboardPageData({
    asOf,
    loadOfficerProfiles: deps.loadOfficerProfiles ?? loadCommanderOfficerProfiles,
    loadOrganizationEngine: deps.loadOrganizationEngine ?? loadOrganizationEngine,
    getSkillCatalog: deps.getSkillCatalog ?? getSkillCatalog,
    resolvePortraits: deps.resolvePortraits ?? resolveOfficerPortraitsBatch,
  });

  return {
    dataset,
    promotion: buildCommanderPromotionDashboard(dataset, { asOf }),
  };
}
