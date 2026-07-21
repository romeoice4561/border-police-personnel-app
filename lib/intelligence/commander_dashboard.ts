/**
 * Commander Dashboard view model (Phase 48C — spec §4).
 *
 * Extends lib/extraction/commander_view.ts's CommanderSummary (Phase 48B —
 * extraction-pipeline/OCR/AI usage facts) with the officer/document-domain
 * facts spec §4 asks for (today's uploads, officers needing review/blocked,
 * upcoming expirations, document completeness). Kept as a SEPARATE function
 * in lib/intelligence/ rather than a modification to
 * lib/extraction/commander_view.ts, because extraction/ has no business
 * knowing about Officer/OfficerDocument domain concepts (risk_classification
 * etc. in lib/extraction/ are about extracted-field risk, not officer
 * readiness) — this module composes the two without creating a bad
 * dependency direction (intelligence depends on extraction's public types,
 * never the reverse).
 *
 * "Today's uploads" is read directly from OfficerDocument.uploadedAt across
 * the supplied document lists — the one new real signal this module reads
 * itself (no extraction-pipeline event covers "a file was uploaded," only
 * "OCR ran"). Everything else composes over already-computed readiness/
 * workload/KPI outputs. No UI redesign — this is a pure builder function.
 *
 * Pure — no I/O, no React.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import type { CommanderSummary } from "@/lib/extraction/commander_view";
import type { OfficerReadinessRecord } from "@/lib/intelligence/kpi_definitions";
import { officersNeedingReviewCount, officersBlockedCount, averageCompletenessScore } from "@/lib/intelligence/kpi_definitions";
import type { ReviewWorkload } from "@/lib/intelligence/review_workload";
import { computeExpiryInfo, sortByUrgency, type DocumentExpiryInfo } from "@/lib/document/document_expiry";

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export interface CommanderDashboard {
  extractionSummary: CommanderSummary;
  todaysUploads: number;
  /** Documents newly requiring review as of today (pending manual approvals uploaded today) — NOT reviews performed today; see todaysCompletedReviews for that. */
  todaysReviews: number;
  /** Always 0 in this phase — see the function-level comment on countTodaysCompletedReviews() for why: OfficerDocument has no review-completion timestamp to filter by "today," only verifiedAt (an approval flag, not a dated review-completion event with reliable same-day semantics distinct from any other approval). Never a fabricated non-zero count. */
  todaysCompletedReviews: number;
  officersNeedingReview: number;
  officersWithBlockedDocuments: number;
  /** Sorted most-urgent-first (document_expiry.ts's sortByUrgency), capped at options.topN. */
  upcomingExpirations: DocumentExpiryInfo[];
  /** null when readinessRecords is empty — never a fabricated 0. */
  averageDocumentCompleteness: number | null;
}

export interface CommanderDashboardInput {
  extractionSummary: CommanderSummary;
  readinessRecords: readonly OfficerReadinessRecord[];
  workload: ReviewWorkload;
  documentListsForExpiry: readonly (readonly OfficerDocument[])[];
  asOf?: Date;
  topN?: number;
}

export function buildCommanderDashboard(input: CommanderDashboardInput): CommanderDashboard {
  const asOf = input.asOf ?? new Date();
  const topN = input.topN ?? 10;

  let todaysUploads = 0;
  const allExpiryInfo: DocumentExpiryInfo[] = [];
  for (const documents of input.documentListsForExpiry) {
    for (const doc of documents) {
      if (doc.isActive && doc.uploadedAt && isSameUtcDay(new Date(doc.uploadedAt), asOf)) todaysUploads += 1;
    }
    allExpiryInfo.push(...computeExpiryInfo(documents, asOf));
  }

  const todaysReviews = input.workload.pendingManualApprovals.filter((e) => e.ageDays === 0).length;
  const todaysCompletedReviews = countTodaysCompletedReviews();

  const upcomingExpirations = sortByUrgency(allExpiryInfo.filter((e) => e.status === "expiring_soon" || e.status === "expired")).slice(0, topN);

  return {
    extractionSummary: input.extractionSummary,
    todaysUploads,
    todaysReviews,
    todaysCompletedReviews,
    officersNeedingReview: officersNeedingReviewCount(input.readinessRecords),
    officersWithBlockedDocuments: officersBlockedCount(input.readinessRecords),
    upcomingExpirations,
    averageDocumentCompleteness: averageCompletenessScore(input.readinessRecords),
  };
}

/**
 * "Completed reviews today" has no dedicated timestamped event in this
 * phase (OfficerDocument has no "reviewedAt" column — only verifiedAt,
 * which document_status.ts already treats as the approval signal, but
 * without a separate review-completion timestamp there is no way to know
 * WHEN today's completions happened versus a completion from a prior day).
 * Rather than fabricate a "today" filter on a field that isn't a review-
 * completion timestamp, this returns 0 when no such signal is available —
 * honest zero, not a guessed count. If a future phase adds a review-
 * completion timestamp, this function is the one place to wire it in.
 */
function countTodaysCompletedReviews(): number {
  return 0;
}
