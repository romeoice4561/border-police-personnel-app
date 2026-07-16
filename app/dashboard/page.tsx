/**
 * Dashboard: commander intelligence overview.
 *
 * Server component fetches prepared intelligence from the pure Commander
 * Intelligence Engine. Client components only render and filter prepared data.
 *
 * Phase 48A — Enterprise Workspace Foundation reference implementation: this
 * page is the FIRST to compose the new shared workspace layout (WorkspaceHeader
 * + DashboardKpiSection on the shared KpiCard/KpiGrid) instead of the
 * page-specific TranslatedPageHeader + CommanderSummaryCards it used before.
 * No data/engine change — CommanderDashboardPanel and SkillDashboard render
 * exactly the same intelligence as before; only the header/KPI presentation
 * layer changed. Every other page keeps its current header/KPI components
 * unchanged until Phase 48B migrates them one by one.
 */
import { DashboardWorkspaceHeader } from "@/components/intelligence/dashboard_workspace_header";
import { DashboardKpiSection } from "@/components/intelligence/dashboard_kpi_section";
import { CommanderDashboardPanel } from "@/components/intelligence/commander_dashboard_panel";
import { SkillDashboard } from "@/components/intelligence/skill_dashboard";
import { WorkspaceLayout, WorkspaceSection } from "@/components/workspace/workspace_section";
import { getCommanderDashboardIntelligence } from "@/lib/server/commander_intelligence_service";
import { getSkillDashboardData } from "@/lib/server/skill_dashboard_service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, skillDashboard] = await Promise.all([
    getCommanderDashboardIntelligence(),
    getSkillDashboardData(),
  ]);

  return (
    <WorkspaceLayout>
      <DashboardWorkspaceHeader />

      <DashboardKpiSection summary={dashboard.summary} />

      <WorkspaceSection>
        <CommanderDashboardPanel dashboard={dashboard} />
      </WorkspaceSection>

      {/* Phase 44: Personnel Capability Intelligence analytics. */}
      <WorkspaceSection>
        <SkillDashboard data={skillDashboard} />
      </WorkspaceSection>
    </WorkspaceLayout>
  );
}
