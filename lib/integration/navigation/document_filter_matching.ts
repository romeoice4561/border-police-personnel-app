/**
 * Document-intelligence filter matching (Phase 49A — §5/§6).
 *
 * Pure predicate functions applied against a real
 * OfficerDocumentIntelligence (the canonical contract) plus the officer's
 * expiry info — mirrors components/commander/query/commander_query_center.tsx's
 * existing `applyFilters()` style exactly (one `if (filter && !match) return
 * false` per field) so this composes into that function without a
 * structural rewrite of the existing filter pipeline.
 *
 * Pure — no I/O, no React.
 */
import type { OfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import type { DocumentIntelligenceFilters, CommanderExpiryFilterStatus } from "@/lib/integration/navigation/document_filter_types";
import type { DocumentExpiryInfo } from "@/lib/document/document_expiry";

/**
 * Maps one officer's expiry-tracked documents onto the coarser commander-
 * facing filter status. An officer can have documents in multiple expiry
 * buckets at once — matches if ANY of the officer's expiry-tracked
 * documents falls in the requested bucket (mirrors how
 * epf_expiry_alert_panel.tsx already treats "has an urgent item" per
 * officer, never requiring ALL documents to share one status).
 */
function officerHasExpiryStatus(expiryInfo: readonly DocumentExpiryInfo[], status: CommanderExpiryFilterStatus): boolean {
  switch (status) {
    case "expired":
      return expiryInfo.some((i) => i.status === "expired");
    case "critical":
      return expiryInfo.some((i) => i.status === "expiring_soon" && i.daysRemaining !== null && i.daysRemaining <= 30);
    case "warning":
      return expiryInfo.some((i) => i.status === "expiring_soon" && (i.daysRemaining === null || i.daysRemaining > 30));
    case "upcoming":
      return expiryInfo.some((i) => i.status === "valid");
    case "unknown":
      return expiryInfo.some((i) => i.status === "unknown");
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled expiry filter status: ${exhaustive}`);
    }
  }
}

export function matchesDocumentIntelligenceFilters(
  intelligence: OfficerDocumentIntelligence,
  expiryInfo: readonly DocumentExpiryInfo[],
  filters: DocumentIntelligenceFilters
): boolean {
  if (filters.documentReadiness && intelligence.readinessLevel !== filters.documentReadiness) return false;
  if (filters.documentCompleteness && intelligence.completenessLevel !== filters.documentCompleteness) return false;
  if (filters.expiryStatus && !officerHasExpiryStatus(expiryInfo, filters.expiryStatus)) return false;
  if (filters.pendingOcrReview && intelligence.pendingReviewCount === 0) return false;
  if (filters.unsupportedDocument && intelligence.unsupportedCount === 0) return false;
  if (filters.missingRequiredDocument && intelligence.missingRequiredCount === 0) return false;
  if (filters.qualityWarning && intelligence.qualityWarningCount === 0) return false;
  return true;
}
