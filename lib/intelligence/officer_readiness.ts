/**
 * Officer Readiness view model (Phase 48C — spec §5).
 *
 * The per-officer-profile counterpart to commander_dashboard.ts's
 * department-wide view — composes document_readiness.ts,
 * completeness_score.ts, review_workload.ts, and (optionally)
 * caller-supplied quality/budget signals into the exact shape spec §5
 * names: Document Readiness, Completion Score, Pending Reviews, Quality
 * Warnings, Outstanding Documents, Budget Impact.
 *
 * "Quality Warnings" are read from caller-supplied per-document
 * OcrQualityAssessment/RiskClassification (same caller-injection pattern as
 * document_review_status.ts, since no persisted link from a document to its
 * OCR quality/risk exists) — a document with no supplied assessment simply
 * contributes no warning, never a fabricated one.
 *
 * "Budget Impact" is a count of real AI usage events (usage_meter.ts) for
 * this officer's document fingerprints — 0 when no usage events are
 * supplied, never estimated. Fingerprinting a document requires its bytes,
 * which this pure view-model layer does not have; callers that DO have a
 * documentId -> fingerprint mapping (e.g. from a recent /extract or
 * /extract/ai-fallback response) pass it in.
 *
 * Pure — no I/O, no React.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import { computeDocumentReadiness, type DocumentReadiness } from "@/lib/intelligence/document_readiness";
import { computeReviewWorkload, type ReviewWorkload } from "@/lib/intelligence/review_workload";
import type { DocumentReviewStatus } from "@/lib/intelligence/document_review_status";
import { pendingReviewTotal } from "@/lib/intelligence/kpi_definitions";
import type { UsageMeter } from "@/lib/extraction/usage_meter";

export interface QualityWarning {
  documentId: number;
  documentType: string;
  /** "low"|"unknown" OCR confidence, or a POOR ocrQuality level, or a SENSITIVE/NEEDS_REVIEW risk — the caller-supplied reason string from the underlying assessment, never re-derived here. */
  reason: string;
}

export interface BudgetImpact {
  /** Count of real AI usage events (usage_meter.ts) attributable to this officer's documents. 0 when no fingerprint mapping or usage events are supplied — never estimated. */
  aiCallsAttributed: number;
}

export interface OfficerReadinessViewModel {
  officerId: number;
  readiness: DocumentReadiness;
  completionScore: number;
  pendingReviewsCount: number;
  qualityWarnings: QualityWarning[];
  /** Document type codes from the recommended checklist with no active document — same list document_readiness.ts's completeness.missingRequiredDocuments already computes, re-exposed here under the profile-facing name spec §5 uses. */
  outstandingDocuments: string[];
  budgetImpact: BudgetImpact;
}

export interface ComputeOfficerReadinessInput {
  officerId: number;
  documents: readonly OfficerDocument[];
  reviewStatusByDocumentId?: ReadonlyMap<number, DocumentReviewStatus>;
  /** Caller-supplied quality warning reasons, keyed by documentId — see module header. */
  qualityWarningsByDocumentId?: ReadonlyMap<number, string>;
  /** Caller-supplied documentId -> file fingerprint mapping, for budget-impact attribution. */
  fingerprintByDocumentId?: ReadonlyMap<number, string>;
  usageMeter?: UsageMeter;
  asOf?: Date;
}

function computeBudgetImpact(
  documents: readonly OfficerDocument[],
  fingerprintByDocumentId: ReadonlyMap<number, string> | undefined,
  usageMeter: UsageMeter | undefined
): BudgetImpact {
  if (!fingerprintByDocumentId || !usageMeter) return { aiCallsAttributed: 0 };
  const fingerprints = new Set(documents.map((d) => fingerprintByDocumentId.get(d.id)).filter((f): f is string => f !== undefined));
  if (fingerprints.size === 0) return { aiCallsAttributed: 0 };
  const aiCallsAttributed = usageMeter.countMatching((e) => e.aiProviderUsed !== null && fingerprints.has(e.documentFingerprint));
  return { aiCallsAttributed };
}

export function computeOfficerReadiness(input: ComputeOfficerReadinessInput): OfficerReadinessViewModel {
  const asOf = input.asOf ?? new Date();
  const readiness = computeDocumentReadiness({ documents: input.documents, reviewStatusByDocumentId: input.reviewStatusByDocumentId, asOf });
  const workload: ReviewWorkload = computeReviewWorkload(
    { officerId: input.officerId, documents: input.documents, reviewStatusByDocumentId: input.reviewStatusByDocumentId },
    asOf
  );

  const qualityWarnings: QualityWarning[] = [];
  if (input.qualityWarningsByDocumentId) {
    for (const doc of input.documents) {
      if (!doc.isActive) continue;
      const reason = input.qualityWarningsByDocumentId.get(doc.id);
      if (reason) qualityWarnings.push({ documentId: doc.id, documentType: doc.documentType, reason });
    }
  }

  return {
    officerId: input.officerId,
    readiness,
    completionScore: readiness.completeness.overallScore,
    pendingReviewsCount: pendingReviewTotal(workload),
    qualityWarnings,
    outstandingDocuments: readiness.completeness.missingRequiredDocuments,
    budgetImpact: computeBudgetImpact(input.documents, input.fingerprintByDocumentId, input.usageMeter),
  };
}
