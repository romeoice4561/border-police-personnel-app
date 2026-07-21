/**
 * Review Workload Engine (Phase 48C — spec §3).
 *
 * Aggregates PENDING work across a set of officers' documents — pending OCR
 * reviews, pending manual approvals, pending AI suggestions, pending expiry
 * actions, unsupported documents, and review-age statistics. Built entirely
 * from document_readiness.ts's per-officer output (one readiness call per
 * officer, already composing completeness/expiry/review-status) plus the
 * documents' own timestamps — no new data source, no new query.
 *
 * "Review age" is measured from OfficerDocument.uploadedAt (the only
 * existing timestamp representing "when did this arrive needing review") to
 * `asOf`. A document with no uploadedAt is excluded from age statistics
 * (never a fabricated age).
 *
 * Pure — no I/O, no React.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import { documentStatus } from "@/lib/document/document_status";
import { computeExpiryInfo } from "@/lib/document/document_expiry";
import type { DocumentReviewStatus } from "@/lib/intelligence/document_review_status";

export interface ReviewWorkloadInput {
  officerId: number;
  documents: readonly OfficerDocument[];
  reviewStatusByDocumentId?: ReadonlyMap<number, DocumentReviewStatus>;
}

export interface PendingReviewEntry {
  officerId: number;
  documentId: number;
  documentType: string;
  /** Days since uploadedAt, as of the computation time. null when uploadedAt is unknown (never fabricated). */
  ageDays: number | null;
}

export interface ReviewWorkload {
  pendingOcrReviews: PendingReviewEntry[];
  pendingManualApprovals: PendingReviewEntry[];
  pendingAiSuggestions: PendingReviewEntry[];
  pendingExpiryActions: PendingReviewEntry[];
  unsupportedDocuments: PendingReviewEntry[];
  /** Milliseconds. null when there are zero entries with a known age across all pending categories combined. */
  averageReviewAgeDays: number | null;
  oldestPendingReview: PendingReviewEntry | null;
}

function activeDocumentsByType(documents: readonly OfficerDocument[]): Map<string, OfficerDocument> {
  const map = new Map<string, OfficerDocument>();
  for (const doc of documents) {
    if (!doc.isActive) continue;
    const existing = map.get(doc.documentType);
    if (!existing || doc.version > existing.version) map.set(doc.documentType, doc);
  }
  return map;
}

function ageDaysOf(doc: OfficerDocument, asOf: Date): number | null {
  if (!doc.uploadedAt) return null;
  const uploaded = new Date(doc.uploadedAt).getTime();
  return Math.max(0, Math.round((asOf.getTime() - uploaded) / (1000 * 60 * 60 * 24)));
}

function toEntry(officerId: number, doc: OfficerDocument, asOf: Date): PendingReviewEntry {
  return { officerId, documentId: doc.id, documentType: doc.documentType, ageDays: ageDaysOf(doc, asOf) };
}

/**
 * Computes workload for ONE officer's documents. Callers aggregating across
 * a department loop this over multiple officers and concatenate the result
 * arrays (see combineReviewWorkloads below) — this function has no
 * department-wide query of its own (none exists; see Phase 48C research).
 */
export function computeReviewWorkload(input: ReviewWorkloadInput, asOf: Date = new Date()): ReviewWorkload {
  const { officerId, documents, reviewStatusByDocumentId } = input;
  const active = activeDocumentsByType(documents);
  const expiryInfo = computeExpiryInfo(documents, asOf);

  const pendingOcrReviews: PendingReviewEntry[] = [];
  const pendingManualApprovals: PendingReviewEntry[] = [];
  const pendingAiSuggestions: PendingReviewEntry[] = [];
  const unsupportedDocuments: PendingReviewEntry[] = [];

  for (const doc of active.values()) {
    const review = reviewStatusByDocumentId?.get(doc.id);
    if (!review || review.ocrStatus === "not_processed") {
      pendingOcrReviews.push(toEntry(officerId, doc, asOf));
    }
    if (documentStatus(doc) === "pending") {
      pendingManualApprovals.push(toEntry(officerId, doc, asOf));
    }
    if (review?.aiPending) {
      pendingAiSuggestions.push(toEntry(officerId, doc, asOf));
    }
    if (review?.formatUnsupported) {
      unsupportedDocuments.push(toEntry(officerId, doc, asOf));
    }
  }

  const pendingExpiryActions = expiryInfo
    .filter((info) => info.status === "expired" || info.status === "expiring_soon")
    .map((info) => toEntry(officerId, info.document, asOf));

  return finalizeWorkload({ pendingOcrReviews, pendingManualApprovals, pendingAiSuggestions, pendingExpiryActions, unsupportedDocuments });
}

/** The single place averageReviewAgeDays/oldestPendingReview are derived from the 5 pending-entry lists — used by both computeReviewWorkload() and combineReviewWorkloads() so the two never compute age statistics differently. */
function finalizeWorkload(
  lists: Pick<ReviewWorkload, "pendingOcrReviews" | "pendingManualApprovals" | "pendingAiSuggestions" | "pendingExpiryActions" | "unsupportedDocuments">
): ReviewWorkload {
  const allPending = [
    ...lists.pendingOcrReviews,
    ...lists.pendingManualApprovals,
    ...lists.pendingAiSuggestions,
    ...lists.pendingExpiryActions,
    ...lists.unsupportedDocuments,
  ];
  const knownAges = allPending.map((e) => e.ageDays).filter((a): a is number => a !== null);
  const averageReviewAgeDays = knownAges.length === 0 ? null : Math.round(knownAges.reduce((sum, a) => sum + a, 0) / knownAges.length);
  const oldestPendingReview =
    allPending.filter((e) => e.ageDays !== null).sort((a, b) => (b.ageDays as number) - (a.ageDays as number))[0] ?? null;

  return { ...lists, averageReviewAgeDays, oldestPendingReview };
}

/** Merges per-officer ReviewWorkload results into one department-wide aggregate — used by the commander dashboard, which iterates officers one at a time (see §6 of the Phase 48C research: no bulk document query exists). */
export function combineReviewWorkloads(workloads: readonly ReviewWorkload[]): ReviewWorkload {
  return finalizeWorkload({
    pendingOcrReviews: workloads.flatMap((w) => w.pendingOcrReviews),
    pendingManualApprovals: workloads.flatMap((w) => w.pendingManualApprovals),
    pendingAiSuggestions: workloads.flatMap((w) => w.pendingAiSuggestions),
    pendingExpiryActions: workloads.flatMap((w) => w.pendingExpiryActions),
    unsupportedDocuments: workloads.flatMap((w) => w.unsupportedDocuments),
  });
}
