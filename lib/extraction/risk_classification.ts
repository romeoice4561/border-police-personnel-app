/**
 * Document risk classification (Phase 48B — spec §4).
 *
 * Classifies an extraction result's RISK level — a separate axis from
 * confidence. Confidence measures "how sure are we this reading is
 * correct"; risk measures "how sensitive/consequential is this document
 * type, and how much scrutiny does its current state warrant." A
 * high-confidence National ID extraction is still SENSITIVE (it carries a
 * national ID number); an UNKNOWN document always NEEDS_REVIEW regardless
 * of how "confident" a meaningless detection score is.
 *
 * This module only classifies — it does not decide whether to call AI.
 * ai_gate.ts remains the single decision point; risk is surfaced to it (and
 * to the review UI / dashboards) as additional context only.
 *
 * Pure — no I/O, no React.
 */

import type { SupportedDocumentTypeCode } from "@/lib/extraction/document_type_detection";
import type { ConfidenceLevel } from "@/lib/extraction/confidence";

export type RiskLevel = "SAFE" | "NEEDS_REVIEW" | "SENSITIVE" | "UNKNOWN";

/** Document types that inherently carry personally-identifying or otherwise sensitive data, regardless of extraction quality. */
const SENSITIVE_DOCUMENT_TYPES: ReadonlySet<SupportedDocumentTypeCode> = new Set([
  "NATIONAL_ID",
  "PASSPORT",
  "DRIVER_LICENSE",
  "MEDICAL_DOCUMENT",
  "SALARY_DOCUMENT",
]);

/** Document types with no identity/financial/medical content — administrative record-keeping only. */
const SAFE_DOCUMENT_TYPES: ReadonlySet<SupportedDocumentTypeCode> = new Set([
  "TRAINING_CERTIFICATE",
  "EDUCATION_CERTIFICATE",
  "AWARD",
  "FIREARMS_QUALIFICATION",
]);

export interface RiskClassificationInput {
  documentType: SupportedDocumentTypeCode;
  confidenceLevel: ConfidenceLevel;
  hasValidationFailures: boolean;
}

export interface RiskClassification {
  level: RiskLevel;
  reasons: string[];
}

/**
 * Priority: UNKNOWN type always -> NEEDS_REVIEW (there's nothing to assess
 * risk against yet). Otherwise: sensitive document types are always
 * SENSITIVE regardless of confidence (the data is sensitive independent of
 * how well it was read). Validation failures or low/unknown confidence on a
 * non-sensitive type -> NEEDS_REVIEW. Everything else on a known-safe type
 * -> SAFE. A known type that is neither in the sensitive nor safe list
 * (e.g. SALARY_DOCUMENT is sensitive, ANNUAL_EVALUATION is neither list)
 * defaults to NEEDS_REVIEW rather than guessing SAFE.
 */
export function classifyDocumentRisk(input: RiskClassificationInput): RiskClassification {
  const reasons: string[] = [];

  if (input.documentType === "UNKNOWN") {
    return { level: "NEEDS_REVIEW", reasons: ["Document type could not be determined."] };
  }

  if (SENSITIVE_DOCUMENT_TYPES.has(input.documentType)) {
    reasons.push(`${input.documentType} documents contain personally-identifying or sensitive data.`);
    return { level: "SENSITIVE", reasons };
  }

  if (input.hasValidationFailures) {
    reasons.push("One or more extracted fields failed validation.");
  }
  if (input.confidenceLevel === "low" || input.confidenceLevel === "unknown") {
    reasons.push(`Extraction confidence is ${input.confidenceLevel}.`);
  }
  if (reasons.length > 0) {
    return { level: "NEEDS_REVIEW", reasons };
  }

  if (SAFE_DOCUMENT_TYPES.has(input.documentType)) {
    return { level: "SAFE", reasons: [] };
  }

  // A recognized type outside both lists (e.g. ANNUAL_EVALUATION) —
  // conservative default rather than assuming SAFE for a type this module
  // hasn't been explicitly told is low-risk.
  return { level: "NEEDS_REVIEW", reasons: ["Document type has no explicit risk classification yet."] };
}
