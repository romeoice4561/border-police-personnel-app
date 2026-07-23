/**
 * Server adapter for Personnel Intelligence Service (Phase 49.5).
 *
 * One orchestrated Commander dataset load per request → request-scoped
 * service context → PersonnelIntelligenceService. Does not modify CIC modules;
 * mirrors the same orchestrate + compose sequence CIC page-data uses.
 */
import "server-only";

import {
  orchestrateCommanderDashboardPageData,
  type OrchestrateCommanderDashboardPageDataDeps,
} from "@/lib/commander_dashboard/orchestrate_page_data";
import { buildCommanderIntelligenceCenter } from "@/lib/commander_intelligence_center/build_view_model";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { getSkillCatalog } from "@/lib/server/officer_service";
import { resolveOfficerPortraitsBatch } from "@/lib/server/officer_portrait_service";
import {
  createPersonnelIntelligenceContext,
  type PersonnelIntelligenceServiceContext,
} from "@/lib/personnel_intelligence_service/context";
import {
  createPersonnelIntelligenceService,
  type PersonnelIntelligenceService,
} from "@/lib/personnel_intelligence_service/service";
import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";

export type CreatePersonnelIntelligenceServiceDeps = Partial<
  Omit<OrchestrateCommanderDashboardPageDataDeps, "asOf">
> & {
  asOf?: Date;
  actor: IntelligenceActor;
};

export interface PersonnelIntelligenceServiceBundle {
  service: PersonnelIntelligenceService;
  /** Request-scoped context (Phase 49.6 tool executor reuse). */
  context: PersonnelIntelligenceServiceContext;
  contextId: string;
  asOfIso: string;
  officerCount: number;
}

/**
 * Builds a request-scoped intelligence service. Loads officer profiles +
 * dataset exactly once via orchestrateCommanderDashboardPageData.
 */
export async function createPersonnelIntelligenceServiceForRequest(
  deps: CreatePersonnelIntelligenceServiceDeps
): Promise<PersonnelIntelligenceServiceBundle> {
  const asOf = deps.asOf ?? new Date();
  const { dataset, dashboard, viewModel } = await orchestrateCommanderDashboardPageData({
    asOf,
    loadOfficerProfiles: deps.loadOfficerProfiles ?? loadCommanderOfficerProfiles,
    loadOrganizationEngine: deps.loadOrganizationEngine ?? loadOrganizationEngine,
    getSkillCatalog: deps.getSkillCatalog ?? getSkillCatalog,
    resolvePortraits: deps.resolvePortraits ?? resolveOfficerPortraitsBatch,
  });
  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf });
  const context = createPersonnelIntelligenceContext({
    actor: deps.actor,
    asOf,
    dataset,
    dashboard,
    viewModel,
    center,
  });
  const service = createPersonnelIntelligenceService(context);

  if (process.env.NODE_ENV !== "production") {
    console.info("[personnel-intelligence]", {
      op: "createService",
      contextId: context.contextId,
      role: deps.actor.role,
      officerCount: dataset.officers.length,
    });
  }

  return {
    service,
    context,
    contextId: context.contextId,
    asOfIso: context.asOfIso,
    officerCount: dataset.officers.length,
  };
}
