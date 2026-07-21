/**
 * Per-document review status input (Phase 48C).
 *
 * The readiness/workload engines need to know, PER DOCUMENT, whether OCR
 * has run, whether AI was recommended/used, whether validation failed, and
 * whether the format is unsupported. None of that is persisted anywhere —
 * lib/extraction/extraction_cache.ts is keyed by file content fingerprint,
 * not by OfficerDocument.id, and Phase 48A/48B were explicitly in-memory,
 * process-lifetime only (see extraction_cache.ts's header). There is no
 * database link from a document row to its last extraction result.
 *
 * Rather than fabricate that link, this module defines the SHAPE the
 * readiness engine needs and treats it as a caller-supplied input — a
 * caller that DOES have a live ExtractionPipelineResult for a given
 * document (e.g. a page that just ran /extract for it, or a future
 * persistence layer once one exists) maps it through
 * `reviewStatusFromExtractionResult()`. A document with no known
 * extraction result defaults to "not_processed" — never guessed as
 * reviewed or clean.
 *
 * Pure — no I/O, no React, no cache access.
 */

import type { ProcessingStatus } from "@/lib/extraction/extraction_pipeline_types";
import type { ExtractionPipelineResult } from "@/lib/extraction/extraction_pipeline_types";

export interface DocumentReviewStatus {
  documentId: number;
  /** Mirrors extraction_pipeline_types.ts's ProcessingStatus, plus "not_processed" for a document nobody has ever run OCR on. */
  ocrStatus: ProcessingStatus | "not_processed";
  aiWasUsed: boolean;
  aiPending: boolean;
  hasValidationFailures: boolean;
  /** True only for a document whose format the pipeline explicitly reported as unsupported (e.g. a PDF — see extraction_api_handlers.ts's pdfOcrUnsupported path). Distinct from "not_processed" (never attempted) — this means "attempted, and it can't be done automatically." */
  formatUnsupported: boolean;
}

export function notProcessedReviewStatus(documentId: number): DocumentReviewStatus {
  return { documentId, ocrStatus: "not_processed", aiWasUsed: false, aiPending: false, hasValidationFailures: false, formatUnsupported: false };
}

/**
 * Maps a live pipeline result (already fetched/run by the caller — this
 * function performs no lookup of its own) onto the review-status shape the
 * readiness/workload engines consume.
 */
export function reviewStatusFromExtractionResult(documentId: number, result: ExtractionPipelineResult): DocumentReviewStatus {
  return {
    documentId,
    ocrStatus: result.status,
    aiWasUsed: result.aiWasUsed,
    aiPending: result.status === "ai_suggested" && !result.aiWasUsed,
    hasValidationFailures: result.fields.some((f) => f.normalizedValue !== null && !f.validation.valid),
    formatUnsupported: false,
  };
}

/** For the explicit "PDF OCR unsupported" outcome (extraction_api_handlers.ts's pdfOcrUnsupported response) — a distinct, non-ExtractionPipelineResult shape, so it needs its own constructor rather than being forced through reviewStatusFromExtractionResult(). */
export function unsupportedFormatReviewStatus(documentId: number): DocumentReviewStatus {
  return { documentId, ocrStatus: "not_processed", aiWasUsed: false, aiPending: false, hasValidationFailures: false, formatUnsupported: true };
}
