/**
 * Dashboard: commander intelligence overview.
 *
 * Server component fetches prepared intelligence from the pure Commander
 * Intelligence Engine. Client components only render and filter prepared data.
 */
import { TranslatedPageHeader } from "@/components/common/translated_page_header";
import { CommanderDashboardPanel } from "@/components/intelligence/commander_dashboard_panel";
import { SkillDashboard } from "@/components/intelligence/skill_dashboard";
import { getCommanderDashboardIntelligence } from "@/lib/server/commander_intelligence_service";
import { getSkillDashboardData } from "@/lib/server/skill_dashboard_service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, skillDashboard] = await Promise.all([
    getCommanderDashboardIntelligence(),
    getSkillDashboardData(),
  ]);

  return (
    <div className="space-y-8">
      <TranslatedPageHeader titleKey="dashboard.commanderDashboard" descriptionKey="dashboard.subtitle" />

      <CommanderDashboardPanel dashboard={dashboard} />

      {/* Phase 44: Personnel Capability Intelligence analytics. */}
      <SkillDashboard data={skillDashboard} />
    </div>
  );
}
