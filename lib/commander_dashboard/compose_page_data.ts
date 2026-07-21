/**
 * Pure Commander Dashboard page composition (Phase 49A.1).
 *
 * Takes an already-built CommanderQueryDataset + the OfficerWithRelations[]
 * rows used to build it, and produces every dashboard section view model.
 * No I/O — the server orchestrator owns loading.
 */
import { buildSkillDashboard, type SkillDashboardData } from "@/lib/capability/skill_dashboard";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { buildCommanderDashboard, type CommanderDashboard } from "@/lib/intelligence";
import { toIntelligenceInput } from "@/lib/intelligence/officer_intelligence_input";
import type { DocumentReadinessDashboardKpis } from "@/lib/integration/commander/document_readiness_dashboard";
import {
  buildCommanderDashboardViewModelFromDataset,
  buildDocumentReadinessDashboardKpisFromDataset,
} from "@/lib/commander_dashboard/dataset_composers";

export interface CommanderDashboardPageComposition {
  /** Same dataset instance passed into every dataset-consuming composer. */
  dataset: CommanderQueryDataset;
  viewModel: CommanderDashboardViewModel;
  documentReadinessKpis: DocumentReadinessDashboardKpis;
  dashboard: CommanderDashboard;
  skillDashboard: SkillDashboardData;
}

export interface ComposeCommanderDashboardPageDataInput {
  officers: readonly OfficerWithRelations[];
  dataset: CommanderQueryDataset;
  asOf: Date;
}

/**
 * Pure page composition. Callers must pass the SAME dataset instance that was
 * built from `officers` (no second conversion / no second document-intelligence
 * pass). Document KPIs read officer.documentIntelligence already present on
 * the dataset rows.
 */
export function composeCommanderDashboardPageData(
  input: ComposeCommanderDashboardPageDataInput
): CommanderDashboardPageComposition {
  const { officers, dataset, asOf } = input;

  const viewModel = buildCommanderDashboardViewModelFromDataset(dataset, asOf);
  const documentReadinessKpis = buildDocumentReadinessDashboardKpisFromDataset(dataset);
  const dashboard = buildCommanderDashboard(officers.map((officer) => toIntelligenceInput(officer)));
  const skillDashboard = buildSkillDashboard(officers, asOf);

  return {
    dataset,
    viewModel,
    documentReadinessKpis,
    dashboard,
    skillDashboard,
  };
}
