/**
 * Injectable Commander Dashboard page orchestration (Phase 49A.1).
 *
 * Pure of framework/`server-only` so unit tests can spy loader call counts.
 * Production wires real loaders via lib/server/commander_dashboard_page_data.ts.
 */
import type { SkillCatalog } from "@/lib/capability/capability_types";
import {
  composeCommanderDashboardPageData,
  type CommanderDashboardPageComposition,
} from "@/lib/commander_dashboard/compose_page_data";
import { buildCommanderQueryDataset } from "@/lib/commander_query/build_dataset";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";

export type CommanderDashboardPageData = CommanderDashboardPageComposition;

export interface OrchestrateCommanderDashboardPageDataDeps {
  asOf: Date;
  loadOfficerProfiles: () => Promise<OfficerWithRelations[]>;
  loadOrganizationEngine: () => Promise<OrganizationEngine>;
  getSkillCatalog: () => Promise<SkillCatalog>;
  /** Returns officerId → portrait-like object with thumbnailUrl. */
  resolvePortraits: (officerIds: readonly string[]) => Promise<ReadonlyMap<string, { thumbnailUrl: string | null }>>;
}

/**
 * Loads officer profiles exactly once, builds CommanderQueryDataset exactly
 * once, then composes every dashboard section from that shared result.
 */
export async function orchestrateCommanderDashboardPageData(
  deps: OrchestrateCommanderDashboardPageDataDeps
): Promise<CommanderDashboardPageData> {
  const { asOf, loadOfficerProfiles, loadOrganizationEngine, getSkillCatalog, resolvePortraits } = deps;

  const [officers, organizationEngine, skillCatalog] = await Promise.all([
    loadOfficerProfiles(),
    loadOrganizationEngine(),
    getSkillCatalog(),
  ]);

  const portraits = await resolvePortraits(officers.map((officer) => officer.officerId));
  const officialPortraitByOfficerId = new Map<string, string | null>();
  for (const officer of officers) {
    officialPortraitByOfficerId.set(officer.officerId, portraits.get(officer.officerId)?.thumbnailUrl ?? null);
  }

  const dataset = buildCommanderQueryDataset({
    officers,
    organizationEngine,
    skillCatalog,
    officialPortraitByOfficerId,
    asOf,
  });

  return composeCommanderDashboardPageData({ officers, dataset, asOf });
}
