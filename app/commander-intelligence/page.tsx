/**
 * Commander Intelligence Center — Workforce Intelligence workspace (Phase 52.2).
 *
 * Server component: ONE loadCommanderWorkforcePageData({ filters }) call.
 * All UI metrics come from CommanderWorkforceViewModel — no intelligence recalculation.
 * Legacy Phase 49B/50 CIC lives at /commander-intelligence/legacy.
 */
import { WorkspaceLayout } from "@/components/workspace/workspace_section";
import { CommanderWorkforcePage } from "@/components/commander-workforce/commander-workforce-page";
import { loadCommanderWorkforcePageData } from "@/lib/server/commander_workforce_page_data";
import {
  parseWorkforceFiltersFromSearchParams,
  searchParamsRecordToURLSearchParams,
} from "@/lib/commander_workforce/url_filters";

export const dynamic = "force-dynamic";

export default async function CommanderIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const filters = parseWorkforceFiltersFromSearchParams(
    searchParamsRecordToURLSearchParams(resolved)
  );
  const { viewModel } = await loadCommanderWorkforcePageData({ filters });

  return (
    <WorkspaceLayout className="min-w-0">
      <CommanderWorkforcePage viewModel={viewModel} />
    </WorkspaceLayout>
  );
}
