/**
 * Extraction pipeline shared types (Phase 48).
 *
 * Pure domain typing — no engine implementation, no I/O — mirroring
 * lib/ocr/ocr_types.ts's split of "types file" vs. "implementation file"
 * so the pipeline's contract can be imported without pulling in Tesseract,
 * OpenAI client code, or any provider runtime.
 */

import type { ConfidenceLevel } from "@/lib/extraction/confidence";
import type { AiFallbackReason } from "@/lib/extraction/ai_gate";
import type { DetectedDocumentType } from "@/lib/extraction/document_type_detection";
import type { RiskClassification } from "@/lib/extraction/risk_classification";
import type { OcrQualityAssessment } from "@/lib/extraction/ocr_quality_analyzer";

/** One extracted field, carrying both the raw OCR-derived value and the normalized value, per spec §12 ("never silently change uncertain values — keep raw, normalized, and the reason"). */
export interface ExtractedField {
  /** Stable field code, e.g. "nationalId", "issueDate". */
  code: string;
  /** Human-readable label for the review UI. */
  label: string;
  /** Value exactly as read off the OCR text (before any normalization). */
  rawValue: string | null;
  /** Value after normalization (Thai numerals -> Arabic, BE -> ISO, etc.). Equal to rawValue when no normalization was needed/applied. */
  normalizedValue: string | null;
  /** Why normalizedValue differs from rawValue, or null when they're identical. Never silently applied without a stated reason. */
  normalizationReason: string | null;
  /** Per-field confidence, 0-1, when derivable (e.g. average OCR word confidence over the matched region). null when not computable. */
  confidence: number | null;
  /** Validation outcome for this specific field (see field_validation.ts). */
  validation: FieldValidationResult;
}

export interface FieldValidationResult {
  valid: boolean;
  /** Empty when valid. Structured, never silently discarding an invalid value — the field and its warnings are still shown for review. */
  warnings: string[];
}

export type ProcessingStatus =
  | "not_processed"
  | "ocr_complete"
  | "needs_review"
  | "ai_suggested"
  | "ai_used"
  | "approved"
  | "failed";

export type ProviderUsed = "local_ocr" | "ocr_service" | "paid_ai" | "cache_reused";

export interface ExtractionPipelineResult {
  status: ProcessingStatus;
  providerUsed: ProviderUsed;
  documentType: DetectedDocumentType;
  fields: ExtractedField[];
  /** Overall confidence, 0-1, or null when it could not be computed (e.g. OCR produced no text at all). */
  overallConfidence: number | null;
  confidenceLevel: ConfidenceLevel;
  /** The gate's verdict for THIS result, kept alongside it so the review UI can explain "why AI was/wasn't used" without recomputing anything. */
  aiFallbackReason: AiFallbackReason;
  aiWasUsed: boolean;
  aiProviderModel: string | null;
  /** True when this result came from the extraction cache rather than fresh processing. */
  fromCache: boolean;
  processingStartedAt: string;
  processingCompletedAt: string;
  /** Version tag for the deterministic extraction rules that produced this result — part of the cache key (see fingerprint.ts). */
  rulesVersion: string;
  /** Phase 48B — risk_classification.ts's verdict, computed once at pipeline time and cached alongside the rest of the result. */
  risk: RiskClassification;
  /** Phase 48B — ocr_quality_analyzer.ts's verdict over the raw OCR output. null only for a cache-reused result predating this field (never recomputed from cache — the cached OCR data is gone by then). */
  ocrQuality: OcrQualityAssessment | null;
}
