/**
 * Dashboard: commander intelligence overview.
 *
 * Server component fetches prepared intelligence from the pure Commander
 * Intelligence Engine. Client components only render and filter prepared data.
 *
 * Phase 42 — Commander Dashboard Intelligence: the page now leads with
 * decision-support sections built from lib/commander_dashboard/
 * view_model.ts's CommanderDashboardViewModel — Action Center, Promotion
 * Intelligence, Promotion Priority Candidates, Birthday Intelligence,
 * Retirement Awareness — each consuming PromotionSummary/AgeSummary/
 * RetirementSummary (via getCommanderDashboardViewModel) rather than
 * recalculating promotion/age/retirement/fiscal-year logic on the page.
 * The PRE-EXISTING CommanderDashboardPanel/DashboardKpiSection (personnel
 * totals + officer-card grid) are kept, unchanged, but moved below the new
 * sections and de-emphasized (Task 10: "generic totals must not dominate
 * the page") — see docs/COMMANDER_DASHBOARD_INTELLIGENCE.md.
 */
import { DashboardWorkspaceHeader } from "@/components/intelligence/dashboard_workspace_header";
import { DashboardKpiSection } from "@/components/intelligence/dashboard_kpi_section";
import { DashboardActionCenter } from "@/components/intelligence/dashboard_action_center";
import { DashboardPromotionIntelligence } from "@/components/intelligence/dashboard_promotion_intelligence";
import { DashboardPromotionPriority } from "@/components/intelligence/dashboard_promotion_priority";
import { DashboardTrainingOverview } from "@/components/intelligence/dashboard_training_overview";
import { DashboardTrainingPriority } from "@/components/intelligence/dashboard_training_priority";
import { DashboardBirthdayIntelligence } from "@/components/intelligence/dashboard_birthday_intelligence";
import { DashboardRetirementAwareness } from "@/components/intelligence/dashboard_retirement_awareness";
import { CommanderDashboardPanel } from "@/components/intelligence/commander_dashboard_panel";
import { SkillDashboard } from "@/components/intelligence/skill_dashboard";
import { WorkspaceLayout, WorkspaceSection } from "@/components/workspace/workspace_section";
import { getCommanderDashboardIntelligence } from "@/lib/server/commander_intelligence_service";
import { getCommanderDashboardViewModel } from "@/lib/server/commander_dashboard_service";
import { getSkillDashboardData } from "@/lib/server/skill_dashboard_service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, viewModel, skillDashboard] = await Promise.all([
    getCommanderDashboardIntelligence(),
    getCommanderDashboardViewModel(),
    getSkillDashboardData(),
  ]);

  return (
    <WorkspaceLayout>
      <DashboardWorkspaceHeader displayFiscalYearTh={viewModel.displayFiscalYearTh} />

      <DashboardActionCenter items={viewModel.actionCenter} />

      <DashboardPromotionIntelligence promotion={viewModel.promotion} />

      <DashboardPromotionPriority candidates={viewModel.promotion.priorityCandidates} />

      {/* Phase 45 completion pass (Task 6): visually secondary to Promotion
          Intelligence — a smaller card grid, placed after the Promotion
          Priority list. */}
      <WorkspaceSection className="opacity-95">
        <DashboardTrainingOverview training={viewModel.training} totalPersonnel={viewModel.personnelOverview.totalPersonnel} />
      </WorkspaceSection>

      {/* Phase 45 completion pass (Task 10): hides itself entirely when
          there are no real priority records — never a decorative empty panel. */}
      <DashboardTrainingPriority officers={viewModel.training.priorityOfficers} />

      <DashboardBirthdayIntelligence birthdays={viewModel.birthdays} />

      <DashboardRetirementAwareness retirement={viewModel.retirement} />

      {/* Existing supporting overview metrics — kept, unchanged, but now
          visually secondary (last in reading order) per Task 10: generic
          personnel totals must not dominate the page. */}
      <WorkspaceSection className="opacity-90">
        <DashboardKpiSection summary={dashboard.summary} training={viewModel.training} />
      </WorkspaceSection>

      {/* Phase 48A.1 Part E: WorkspaceSection (untitled — both panels already
          render their own internal <h2>, so a wrapper title would duplicate
          the heading) still gives consistent section spacing/alignment
          around each panel. No data or business logic changed. */}
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
