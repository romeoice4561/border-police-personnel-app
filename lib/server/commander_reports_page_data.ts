/**
 * Executive Report Center page orchestration (Phase 49C).
 *
 * Thin wrapper: reuses loadCommanderIntelligenceCenterPageData() so the
 * page performs the SAME single officer-profile load + CommanderQueryDataset
 * build as the Intelligence Center — no second query, no engine rebuild.
 */
import "server-only";

import {
  loadCommanderIntelligenceCenterPageData,
  type CommanderIntelligenceCenterPageData,
  type LoadCommanderIntelligenceCenterPageDataDeps,
} from "@/lib/server/commander_intelligence_center_page_data";

export type LoadCommanderReportsPageDataDeps = LoadCommanderIntelligenceCenterPageDataDeps;
export type CommanderReportsPageData = CommanderIntelligenceCenterPageData;

/**
 * Single entry point for app/commander-reports/page.tsx.
 * Delegates entirely to the CIC page-data loader.
 */
export async function loadCommanderReportsPageData(
  deps: LoadCommanderReportsPageDataDeps = {}
): Promise<CommanderReportsPageData> {
  return loadCommanderIntelligenceCenterPageData(deps);
}
