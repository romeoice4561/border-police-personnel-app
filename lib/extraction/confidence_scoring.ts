/**
 * Overall confidence scoring (Phase 48).
 *
 * Combines OCR confidence, field-level confidences, and validation outcomes
 * into a single 0-1 overall score — the number ai_gate.ts's
 * classifyConfidence() classifies into high/medium/low/unknown. Kept
 * separate from ai_gate.ts itself so the SCORE computation (a numeric
 * heuristic) and the GATE decision (a policy) are independently testable
 * and independently swappable — a future phase could change how the score
 * is computed without touching the gate's decision logic at all.
 *
 * Pure — no I/O, no React.
 */

import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";

export interface ConfidenceScoreInput {
  /** Tesseract's page-level confidence, 0-100. null when OCR produced no measurable result. */
  ocrConfidence0to100: number | null;
  documentTypeConfidence: number;
  fields: readonly ExtractedField[];
  requiredFieldCodes: readonly string[];
}

/**
 * Weighted blend: OCR quality (30%), document-type-detection confidence
 * (20%), required-field completeness (30%), and validation pass rate
 * (20%). Returns null only when OCR itself produced no measurable
 * confidence at all (nothing to score) — a real 0-scoring result (e.g. type
 * detection totally failed) still returns a real low number, not null,
 * since null specifically means "we could not measure this," per
 * confidence.ts's "unknown" vs. "low" distinction.
 */
export function computeOverallConfidence(input: ConfidenceScoreInput): number | null {
  if (input.ocrConfidence0to100 === null) return null;

  const ocrScore = Math.max(0, Math.min(1, input.ocrConfidence0to100 / 100));
  const typeScore = Math.max(0, Math.min(1, input.documentTypeConfidence));

  const requiredPresent = input.requiredFieldCodes.filter((code) =>
    input.fields.some((f) => f.code === code && f.normalizedValue !== null && f.normalizedValue.trim().length > 0)
  ).length;
  const completenessScore = input.requiredFieldCodes.length > 0 ? requiredPresent / input.requiredFieldCodes.length : 1;

  const validatedFields = input.fields.filter((f) => f.normalizedValue !== null);
  const validFields = validatedFields.filter((f) => f.validation.valid);
  const validationScore = validatedFields.length > 0 ? validFields.length / validatedFields.length : 1;

  const blended = ocrScore * 0.3 + typeScore * 0.2 + completenessScore * 0.3 + validationScore * 0.2;
  return Math.round(blended * 1000) / 1000;
}
