/**
 * Document Readiness Engine (Phase 48C — spec §1).
 *
 * Centralized, per-officer readiness classification. Composes over data
 * that already exists — completeness_score.ts (document presence),
 * document_expiry.ts (expiry status), document_status.ts's documentStatus()
 * (manual approval, reusing the app's existing verifiedAt-based "verified
 * vs. pending" convention rather than reinventing it), and caller-supplied
 * per-document OCR/AI review status
 * (document_review_status.ts, since no persisted link from a document to
 * its extraction result exists yet). This module contains NO UI logic —
 * it returns a classification + reasons; every consumer (dashboard,
 * officer profile, alerts) renders that classification however it needs.
 *
 * Priority order (highest severity wins — mirrors ai_gate.ts's own
 * "fixed priority, most severe first" pattern):
 *   BLOCKED       — an active document has failed validation, or an
 *                    active document's format could not be processed at
 *                    all (formatUnsupported), or a required document has
 *                    EXPIRED.
 *   INCOMPLETE    — a required checklist document is missing (never
 *                    uploaded), or completeness overallScore is 0.
 *   NEEDS_REVIEW  — a required document is expiring soon, or has an AI
 *                    recommendation still pending, or is present but has
 *                    never been manually approved (verifiedAt is null).
 *   READY         — every required document present, none expired/
 *                    expiring/blocked/unreviewed.
 *   UNKNOWN        — completeness could not be computed at all (defensive
 *                    fallback; in practice completeness_score.ts always
 *                    returns a real score, even for zero documents, so this
 *                    is reachable only if a caller passes malformed input).
 *
 * Pure — no I/O, no React, no database access.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import { computeCompletenessScore, type CompletenessScore } from "@/lib/intelligence/completeness_score";
import { computeExpiryInfo, type DocumentExpiryInfo } from "@/lib/document/document_expiry";
import { documentStatus } from "@/lib/document/document_status";
import type { DocumentReviewStatus } from "@/lib/intelligence/document_review_status";

export type ReadinessLevel = "READY" | "NEEDS_REVIEW" | "INCOMPLETE" | "BLOCKED" | "UNKNOWN";

export interface ReadinessReason {
  level: ReadinessLevel;
  code:
    | "VALIDATION_FAILED"
    | "FORMAT_UNSUPPORTED"
    | "DOCUMENT_EXPIRED"
    | "MISSING_REQUIRED_DOCUMENT"
    | "ZERO_COMPLETENESS"
    | "DOCUMENT_EXPIRING_SOON"
    | "AI_REVIEW_PENDING"
    | "NOT_MANUALLY_APPROVED";
  documentType: string | null;
  documentId: number | null;
}

export interface DocumentReadiness {
  level: ReadinessLevel;
  reasons: ReadinessReason[];
  completeness: CompletenessScore;
  expiryInfo: DocumentExpiryInfo[];
}

export interface ComputeReadinessInput {
  documents: readonly OfficerDocument[];
  /** Per-document OCR/AI review status, keyed by OfficerDocument.id. A document with no entry is treated as not_processed (document_review_status.ts's notProcessedReviewStatus), never assumed clean. */
  reviewStatusByDocumentId?: ReadonlyMap<number, DocumentReviewStatus>;
  asOf?: Date;
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

export function computeDocumentReadiness(input: ComputeReadinessInput): DocumentReadiness {
  const { documents, reviewStatusByDocumentId, asOf } = input;
  const completeness = computeCompletenessScore(documents);
  const expiryInfo = computeExpiryInfo(documents, asOf);
  const active = activeDocumentsByType(documents);

  const reasons: ReadinessReason[] = [];

  // ── BLOCKED-tier checks ──
  for (const doc of active.values()) {
    const review = reviewStatusByDocumentId?.get(doc.id);
    if (review?.hasValidationFailures) {
      reasons.push({ level: "BLOCKED", code: "VALIDATION_FAILED", documentType: doc.documentType, documentId: doc.id });
    }
    if (review?.formatUnsupported) {
      reasons.push({ level: "BLOCKED", code: "FORMAT_UNSUPPORTED", documentType: doc.documentType, documentId: doc.id });
    }
  }
  for (const info of expiryInfo) {
    if (info.status === "expired") {
      reasons.push({ level: "BLOCKED", code: "DOCUMENT_EXPIRED", documentType: info.document.documentType, documentId: info.document.id });
    }
  }

  // ── INCOMPLETE-tier checks ──
  for (const code of completeness.missingRequiredDocuments) {
    reasons.push({ level: "INCOMPLETE", code: "MISSING_REQUIRED_DOCUMENT", documentType: code, documentId: null });
  }
  if (completeness.overallScore === 0 && completeness.missingRequiredDocuments.length === 0) {
    // Only reachable when there are zero checklist items scored at all
    // (defensive — the real registry always has scored items today).
    reasons.push({ level: "INCOMPLETE", code: "ZERO_COMPLETENESS", documentType: null, documentId: null });
  }

  // ── NEEDS_REVIEW-tier checks ──
  for (const info of expiryInfo) {
    if (info.status === "expiring_soon") {
      reasons.push({ level: "NEEDS_REVIEW", code: "DOCUMENT_EXPIRING_SOON", documentType: info.document.documentType, documentId: info.document.id });
    }
  }
  for (const doc of active.values()) {
    const review = reviewStatusByDocumentId?.get(doc.id);
    if (review?.aiPending) {
      reasons.push({ level: "NEEDS_REVIEW", code: "AI_REVIEW_PENDING", documentType: doc.documentType, documentId: doc.id });
    }
    if (documentStatus(doc) === "pending") {
      reasons.push({ level: "NEEDS_REVIEW", code: "NOT_MANUALLY_APPROVED", documentType: doc.documentType, documentId: doc.id });
    }
  }

  const level = pickHighestSeverity(reasons);
  return { level, reasons, completeness, expiryInfo };
}

const SEVERITY_ORDER: readonly ReadinessLevel[] = ["BLOCKED", "INCOMPLETE", "NEEDS_REVIEW", "READY", "UNKNOWN"];

function pickHighestSeverity(reasons: readonly ReadinessReason[]): ReadinessLevel {
  if (reasons.length === 0) return "READY";
  for (const level of SEVERITY_ORDER) {
    if (reasons.some((r) => r.level === level)) return level;
  }
  return "UNKNOWN";
}
