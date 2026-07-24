/**
 * Commander Promotion Intelligence Dashboard (Phase 50).
 *
 * Server component: one loadCommanderPromotionPageData() call — same
 * orchestrated dataset as Dashboard/CIC. All widgets read the prepared
 * CommanderPromotionViewModel; no promotion/retirement recalculation here.
 */
import { Suspense } from "react";
import { loadCommanderPromotionPageData } from "@/lib/server/commander_promotion_page_data";
import { CpiDashboard } from "@/components/commander/promotion/cpi_dashboard";
import { WorkspaceLayout } from "@/components/workspace/workspace_section";

export const dynamic = "force-dynamic";

export default async function CommanderPromotionPage() {
  const { promotion } = await loadCommanderPromotionPageData();
  return (
    <WorkspaceLayout className="min-w-0">
      <Suspense fallback={<div className="text-sm text-muted">กำลังโหลดแดชบอร์ด…</div>}>
        <CpiDashboard model={promotion} />
      </Suspense>
    </WorkspaceLayout>
  );
}
