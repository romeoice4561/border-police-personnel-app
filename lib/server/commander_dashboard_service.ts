/**
 * Commander Dashboard server data service (Phase 42 — Commander Dashboard
 * Intelligence; Phase 49A.1 — dataset-accepting pure composers for single-load
 * orchestration).
 *
 * Fetch-owning entry points remain for backward compatibility. The Dashboard
 * page must use loadCommanderDashboardPageData() so profile/dataset loads
 * happen exactly once per request.
 */
import "server-only";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { DocumentReadinessDashboardKpis } from "@/lib/integration/commander/document_readiness_dashboard";
import {
  buildCommanderDashboardViewModelFromDataset,
  buildDocumentReadinessDashboardKpisFromDataset,
  toDashboardSourceOfficer,
} from "@/lib/commander_dashboard/dataset_composers";

export {
  buildCommanderDashboardViewModelFromDataset,
  buildDocumentReadinessDashboardKpisFromDataset,
  toDashboardSourceOfficer,
};

/**
 * Fetch-owning entry point. Prefer loadCommanderDashboardPageData on the
 * Dashboard page.
 */
export async function getCommanderDashboardViewModel(): Promise<CommanderDashboardViewModel> {
  const asOf = new Date();
  const dataset = await getCommanderQueryDataset();
  return buildCommanderDashboardViewModelFromDataset(dataset, asOf);
}

/**
 * Fetch-owning Document Readiness entry point. Prefer the pure
 * buildDocumentReadinessDashboardKpisFromDataset with a shared dataset on
 * the Dashboard page.
 */
export async function getDocumentReadinessDashboardKpis(): Promise<DocumentReadinessDashboardKpis> {
  const dataset = await getCommanderQueryDataset();
  return buildDocumentReadinessDashboardKpisFromDataset(dataset);
}
