/**
 * KPI definitions (Phase 48C — spec §8).
 *
 * Every named number the commander-facing modules (executive_summary.ts,
 * alert_engine.ts, commander_dashboard.ts) report is computed HERE exactly
 * once, then referenced everywhere else — never re-derived inline in a
 * different module with slightly different logic. This mirrors
 * lib/extraction/ai_gate.ts's "one centralized decision function" principle
 * applied to KPI math instead of AI decisions.
 *
 * Every function here is a pure aggregation over already-computed
 * DocumentReadiness / ReviewWorkload / CompletenessScore results — it does
 * not read documents or call the database itself.
 *
 * Pure — no I/O, no React.
 */

import type { DocumentReadiness, ReadinessLevel } from "@/lib/intelligence/document_readiness";
import type { ReviewWorkload } from "@/lib/intelligence/review_workload";
import { expiryStatus } from "@/lib/document/document_expiry";
import type { OfficerDocument } from "@/lib/database/query_types";

export interface OfficerReadinessRecord {
  officerId: number;
  readiness: DocumentReadiness;
}

// ── Readiness KPIs ───────────────────────────────────────────────────────────

export function countByReadinessLevel(records: readonly OfficerReadinessRecord[]): Record<ReadinessLevel, number> {
  const counts: Record<ReadinessLevel, number> = { READY: 0, NEEDS_REVIEW: 0, INCOMPLETE: 0, BLOCKED: 0, UNKNOWN: 0 };
  for (const record of records) counts[record.readiness.level] += 1;
  return counts;
}

export function readyOfficerCount(records: readonly OfficerReadinessRecord[]): number {
  return records.filter((r) => r.readiness.level === "READY").length;
}

export function officersNeedingReviewCount(records: readonly OfficerReadinessRecord[]): number {
  return records.filter((r) => r.readiness.level === "NEEDS_REVIEW").length;
}

export function officersBlockedCount(records: readonly OfficerReadinessRecord[]): number {
  return records.filter((r) => r.readiness.level === "BLOCKED").length;
}

/** Mean completeness overallScore across all supplied officers. null when the list is empty — never a fabricated 0. */
export function averageCompletenessScore(records: readonly OfficerReadinessRecord[]): number | null {
  if (records.length === 0) return null;
  const sum = records.reduce((total, r) => total + r.readiness.completeness.overallScore, 0);
  return Math.round(sum / records.length);
}

// ── Workload KPIs ────────────────────────────────────────────────────────────

export function pendingReviewTotal(workload: ReviewWorkload): number {
  return (
    workload.pendingOcrReviews.length +
    workload.pendingManualApprovals.length +
    workload.pendingAiSuggestions.length +
    workload.pendingExpiryActions.length +
    workload.unsupportedDocuments.length
  );
}

// ── Expiry KPIs ──────────────────────────────────────────────────────────────

/** Count of active documents, across the supplied lists, expiring within the standard window (document_expiry.ts's EXPIRING_SOON_THRESHOLD_DAYS) — never a separately-hardcoded threshold. */
export function expiringSoonCount(documentLists: readonly (readonly OfficerDocument[])[], asOf: Date = new Date()): number {
  let count = 0;
  for (const documents of documentLists) {
    for (const doc of documents) {
      if (!doc.isActive) continue;
      if (expiryStatus(doc.expiryDate, asOf) === "expiring_soon") count += 1;
    }
  }
  return count;
}

/** Reuses ReviewWorkload.unsupportedDocuments (already computed by review_workload.ts) rather than re-deriving "which documents are unsupported" a second time. */
export function unsupportedDocumentCount(workload: ReviewWorkload): number {
  return workload.unsupportedDocuments.length;
}
