/**
 * Thin server adapter for Workforce Intelligence ViewModel (Phase 52.1).
 * Loads CommanderQueryDataset once and composes — no intelligence recalculation.
 */
import "server-only";

import { composeCommanderWorkforceViewModel } from "@/lib/commander_workforce/compose";
import type { ComposeCommanderWorkforceInput } from "@/lib/commander_workforce/contracts";
import type { CommanderWorkforceViewModel, WorkforceOrgPublicIndex } from "@/lib/commander_workforce/types";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";

export interface CommanderWorkforcePageData {
  dataset: CommanderQueryDataset;
  viewModel: CommanderWorkforceViewModel;
}

export function buildOrgPublicIndexFromEngine(engine: {
  getRegions: () => readonly { id: number; code: string; nameTh: string }[];
  getBattalions: (regionId?: number) => readonly {
    id: number;
    code: string;
    nameTh: string;
  }[];
  getCompanies: (battalionId?: number) => readonly {
    id: number;
    code: string;
    nameTh: string;
  }[];
}): WorkforceOrgPublicIndex {
  const regionById: Record<string, string> = {};
  const divisionById: Record<string, string> = {};
  const companyById: Record<string, string> = {};
  const regionLabelByCode: Record<string, string> = {};
  const divisionLabelByCode: Record<string, string> = {};
  const companyLabelByCode: Record<string, string> = {};

  for (const region of engine.getRegions()) {
    regionById[String(region.id)] = region.code;
    regionLabelByCode[region.code] = region.nameTh;
  }
  for (const battalion of engine.getBattalions()) {
    divisionById[String(battalion.id)] = battalion.code;
    divisionLabelByCode[battalion.code] = battalion.nameTh;
  }
  for (const company of engine.getCompanies()) {
    companyById[String(company.id)] = company.code;
    companyLabelByCode[company.code] = company.nameTh;
  }

  return {
    regionById,
    divisionById,
    companyById,
    regionLabelByCode,
    divisionLabelByCode,
    companyLabelByCode,
  };
}

/**
 * Loads dataset once (+ org codes), then composes the pure ViewModel.
 * Does not calculate promotion/retirement/training intelligence itself.
 */
export async function loadCommanderWorkforcePageData(
  options: {
    asOf?: Date;
    filters?: ComposeCommanderWorkforceInput["filters"];
    scope?: ComposeCommanderWorkforceInput["scope"];
    /** Test injection — when provided, skips getCommanderQueryDataset. */
    dataset?: CommanderQueryDataset;
    orgPublicIndex?: WorkforceOrgPublicIndex;
  } = {}
): Promise<CommanderWorkforcePageData> {
  const asOf = options.asOf ?? new Date();
  const dataset = options.dataset ?? (await getCommanderQueryDataset());

  let orgPublicIndex = options.orgPublicIndex;
  if (!orgPublicIndex) {
    try {
      const engine = await loadOrganizationEngine();
      orgPublicIndex = buildOrgPublicIndexFromEngine(engine);
    } catch {
      orgPublicIndex = undefined;
    }
  }

  const viewModel = composeCommanderWorkforceViewModel({
    officers: dataset.officers,
    asOfDate: asOf,
    filters: options.filters,
    scope: options.scope,
    orgPublicIndex,
    now: asOf,
  });

  return { dataset, viewModel };
}
