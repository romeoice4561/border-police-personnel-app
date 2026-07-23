/**
 * Commander Intelligence Center (Phase 49B).
 *
 * Server component: ONE loadCommanderIntelligenceCenterPageData() call —
 * reusing the exact same officer-profile load + CommanderQueryDataset build
 * Commander Dashboard already performs — composes every section below. No
 * business logic is duplicated here; every KPI/matrix/action/timeline/table
 * value was already computed by lib/commander_intelligence_center/
 * build_view_model.ts from existing Promotion/Retirement/Training/Document
 * Intelligence engines.
 */
import { CicWorkspaceHeader } from "@/components/commander/intelligence_center/cic_workspace_header";
import { CicKpiSection } from "@/components/commander/intelligence_center/cic_kpi_section";
import { CicExecutiveSummary } from "@/components/commander/intelligence_center/cic_executive_summary";
import { CicPriorityMatrix } from "@/components/commander/intelligence_center/cic_priority_matrix";
import { CicActionCenter } from "@/components/commander/intelligence_center/cic_action_center";
import { CicTimeline } from "@/components/commander/intelligence_center/cic_timeline";
import { CicExecutiveTable } from "@/components/commander/intelligence_center/cic_executive_table";
import { CicExportBar } from "@/components/commander/intelligence_center/cic_export_bar";
import { WorkspaceLayout, WorkspaceSection } from "@/components/workspace/workspace_section";
import { loadCommanderIntelligenceCenterPageData } from "@/lib/server/commander_intelligence_center_page_data";

export const dynamic = "force-dynamic";

export default async function CommanderIntelligencePage() {
  const { center } = await loadCommanderIntelligenceCenterPageData();

  return (
    <WorkspaceLayout className="min-w-0">
      <CicWorkspaceHeader />

      <CicKpiSection kpis={center.kpis} />

      <CicExecutiveSummary summary={center.executiveSummary} />

      <CicPriorityMatrix buckets={center.priorityMatrix} />

      <CicActionCenter items={center.actionCenter} />

      <CicTimeline buckets={center.timeline} />

      <WorkspaceSection className="min-w-0">
        <CicExecutiveTable rows={center.executiveTable} />
      </WorkspaceSection>

      <CicExportBar center={center} />
    </WorkspaceLayout>
  );
}
