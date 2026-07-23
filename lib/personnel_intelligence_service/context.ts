/**
 * Request-scoped Personnel Intelligence Service context (Phase 49.5).
 *
 * Built once per server request from the shared CIC page-data load.
 * Holds no global mutable cache — each create() returns a fresh object.
 */
import type { CommanderDashboard } from "@/lib/intelligence";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { CommanderIntelligenceCenterViewModel } from "@/lib/commander_intelligence_center/types";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import type { IntelligenceActor, AuthorizedOrgScope } from "@/lib/personnel_intelligence_service/permissions";
import { resolveAuthorizedOrgScope } from "@/lib/personnel_intelligence_service/permissions";

export interface PersonnelIntelligenceServiceContext {
  asOf: Date;
  asOfIso: string;
  actor: IntelligenceActor;
  authorizedScope: AuthorizedOrgScope;
  dataset: CommanderQueryDataset;
  dashboard: CommanderDashboard;
  viewModel: CommanderDashboardViewModel;
  center: CommanderIntelligenceCenterViewModel;
  /** Monotonic id for this context instance (tests prove no sharing). */
  contextId: string;
}

let contextSeq = 0;

export interface CreatePersonnelIntelligenceContextInput {
  actor: IntelligenceActor;
  asOf: Date;
  dataset: CommanderQueryDataset;
  dashboard: CommanderDashboard;
  viewModel: CommanderDashboardViewModel;
  center: CommanderIntelligenceCenterViewModel;
}

export function createPersonnelIntelligenceContext(
  input: CreatePersonnelIntelligenceContextInput
): PersonnelIntelligenceServiceContext {
  contextSeq += 1;
  return {
    asOf: input.asOf,
    asOfIso: input.asOf.toISOString(),
    actor: input.actor,
    authorizedScope: resolveAuthorizedOrgScope(input.actor),
    dataset: input.dataset,
    dashboard: input.dashboard,
    viewModel: input.viewModel,
    center: input.center,
    contextId: `pis-${contextSeq}-${Date.now()}`,
  };
}
