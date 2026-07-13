/**
 * Dashboard: commander intelligence overview.
 *
 * Server component fetches prepared intelligence from the pure Commander
 * Intelligence Engine. Client components only render and filter prepared data.
 */
import { PageHeader } from "@/components/common/page_header";
import { CommanderDashboardPanel } from "@/components/intelligence/commander_dashboard_panel";
import { getCommanderDashboardIntelligence } from "@/lib/server/commander_intelligence_service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboard = await getCommanderDashboardIntelligence();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Commander Dashboard"
        description="Actionable readiness, retirement, profile, and promotion intelligence for commanders."
      />

      <CommanderDashboardPanel dashboard={dashboard} />
    </div>
  );
}
