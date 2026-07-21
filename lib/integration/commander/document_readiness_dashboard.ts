/**
 * Commander Dashboard document-readiness KPI aggregation (Phase 49A — §4).
 *
 * Pure aggregation over CommanderQueryOfficer[] — every officer's
 * `documentIntelligence`/`documentExpiryInfo` was already computed ONCE by
 * toQueryOfficer.ts (Phase 49A wiring) from data
 * loadCommanderOfficerProfiles() already bulk-loaded; this module performs
 * zero additional I/O and zero re-derivation of readiness/completeness —
 * it only counts what's already there. Mirrors
 * lib/commander_dashboard/view_model.ts's "pure composition over an
 * already-loaded dataset" pattern exactly.
 *
 * Pure — no I/O, no React.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";

export interface DocumentReadinessDashboardKpis {
  readyCount: number;
  needsReviewCount: number;
  incompleteCount: number;
  blockedCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  pendingOcrReviewCount: number;
  unsupportedDocumentCount: number;
  totalOfficers: number;
}

export function computeDocumentReadinessDashboardKpis(officers: readonly CommanderQueryOfficer[]): DocumentReadinessDashboardKpis {
  let readyCount = 0;
  let needsReviewCount = 0;
  let incompleteCount = 0;
  let blockedCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  let pendingOcrReviewCount = 0;
  let unsupportedDocumentCount = 0;

  for (const officer of officers) {
    const intelligence = officer.documentIntelligence;
    switch (intelligence.readinessLevel) {
      case "READY":
        readyCount += 1;
        break;
      case "NEEDS_REVIEW":
        needsReviewCount += 1;
        break;
      case "INCOMPLETE":
        incompleteCount += 1;
        break;
      case "BLOCKED":
        blockedCount += 1;
        break;
      // UNKNOWN is intentionally not counted into any KPI card — see
      // dashboard_document_readiness.tsx's "intelligence unavailable"
      // empty state instead of a fabricated bucket.
    }
    if (intelligence.expiringSoonCount > 0) expiringSoonCount += 1;
    if (intelligence.expiredCount > 0) expiredCount += 1;
    if (intelligence.pendingReviewCount > 0) pendingOcrReviewCount += 1;
    if (intelligence.unsupportedCount > 0) unsupportedDocumentCount += 1;
  }

  return {
    readyCount,
    needsReviewCount,
    incompleteCount,
    blockedCount,
    expiringSoonCount,
    expiredCount,
    pendingOcrReviewCount,
    unsupportedDocumentCount,
    totalOfficers: officers.length,
  };
}
