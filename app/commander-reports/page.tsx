/**
 * Executive Report Center (Phase 49C).
 *
 * Server component: ONE loadCommanderReportsPageData() call — delegates to
 * loadCommanderIntelligenceCenterPageData() so the page reuses the exact same
 * officer-profile load + CommanderQueryDataset as the Intelligence Center.
 * Report builders then filter/project that in-memory set only.
 */
import { ReportsWorkspace } from "@/components/commander/reports/reports_workspace";
import { loadCommanderReportsPageData } from "@/lib/server/commander_reports_page_data";

export const dynamic = "force-dynamic";

export default async function CommanderReportsPage() {
  const { dataset } = await loadCommanderReportsPageData();
  const asOfIso = new Date().toISOString();

  return <ReportsWorkspace dataset={dataset} asOfIso={asOfIso} />;
}
