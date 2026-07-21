/**
 * OCR quality analyzer (Phase 48B — spec §5).
 *
 * Assesses the RAW OCR output's own quality signals — text length, line
 * count, per-word confidence distribution, and how many expected fields
 * came back empty — independent of document type or AI. This runs entirely
 * on data already present in OCRResult (Phase 10A) and ExtractedField
 * (Phase 48A); it invents no new measurement source.
 *
 * "rotation hints" and "blur hints" are explicitly UNAVAILABLE in this
 * phase: Tesseract.js does not report orientation/skew or blur/sharpness
 * metrics through this project's OCREngine contract, and no image-analysis
 * library exists here (confirmed absent during Phase 48 research). Rather
 * than fabricate a heuristic guess, both fields are always null with
 * available=false — an honest "we don't have this signal yet," not a
 * silently wrong estimate.
 *
 * A POOR verdict recommends AGAINST calling AI (spec §5: "reduce
 * unnecessary AI usage" — garbage in, garbage out; AI on an unreadable
 * image just wastes budget for an equally unusable result, so the right
 * action is "retake the photo," not "spend AI on it"). This module only
 * recommends; it does not call shouldUseAiFallback() itself or override its
 * decision — the review UI/route layer decides how heavily to weight the
 * recommendation.
 *
 * Pure — no I/O, no React.
 */

import type { OCRResult } from "@/lib/ocr/ocr_types";

export type OcrQualityLevel = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNKNOWN";

export interface OcrQualityMetrics {
  textLength: number;
  lineCount: number;
  wordCount: number;
  /** Fraction (0-1) of recognized words at or above a "confident" threshold (70/100). null when there are zero words to measure. */
  highConfidenceWordFraction: number | null;
  /** Average per-word confidence, 0-100. null when there are zero words. */
  averageWordConfidence: number | null;
  /** How many of the caller-supplied expected field codes came back with no usable value. */
  missingFieldCount: number;
  expectedFieldCount: number;
  /** Lines with no recognizable text relative to their bounding box — approximated here as lines whose trimmed text is empty; 0 when line data is unavailable. */
  emptyLineCount: number;
  rotationHint: { detected: boolean; degrees: number | null } | null;
  blurHint: { detected: boolean; score: number | null } | null;
}

export interface OcrQualityAssessment {
  level: OcrQualityLevel;
  metrics: OcrQualityMetrics;
  /** False for POOR (retake instead of spending AI on unreadable input) — true otherwise. UNKNOWN (no text at all) is also false: there is nothing for AI to work from either. */
  recommendAiUsage: boolean;
  /** Populated when level is POOR — spec §5's exact required message. */
  recommendation: string | null;
}

const CONFIDENT_WORD_THRESHOLD = 70;

function computeMetrics(ocrResult: OCRResult, expectedFieldCodes: readonly string[], presentFieldCodes: readonly string[]): OcrQualityMetrics {
  const wordCount = ocrResult.words.length;
  const confidences = ocrResult.words.map((w) => w.confidence);
  const averageWordConfidence = wordCount > 0 ? confidences.reduce((sum, c) => sum + c, 0) / wordCount : null;
  const highConfidenceWordFraction =
    wordCount > 0 ? confidences.filter((c) => c >= CONFIDENT_WORD_THRESHOLD).length / wordCount : null;

  const missingFieldCount = expectedFieldCodes.filter((code) => !presentFieldCodes.includes(code)).length;
  const emptyLineCount = ocrResult.lines.filter((l) => l.text.trim().length === 0).length;

  return {
    textLength: ocrResult.fullText.length,
    lineCount: ocrResult.lines.length,
    wordCount,
    highConfidenceWordFraction,
    averageWordConfidence,
    missingFieldCount,
    expectedFieldCount: expectedFieldCodes.length,
    emptyLineCount,
    // Explicitly unavailable — see module header. Never a guessed value.
    rotationHint: { detected: false, degrees: null },
    blurHint: { detected: false, score: null },
  };
}

/**
 * Classifies overall quality from the measured metrics. "UNKNOWN" is
 * returned only when there is no text at all to measure (OCR produced
 * nothing) — distinct from "POOR," which means text WAS produced but is of
 * low quality, mirroring confidence.ts's null-vs-low distinction.
 */
function classifyLevel(metrics: OcrQualityMetrics): OcrQualityLevel {
  if (metrics.textLength === 0 || metrics.wordCount === 0) return "UNKNOWN";

  const conf = metrics.averageWordConfidence ?? 0;
  const highConfFraction = metrics.highConfidenceWordFraction ?? 0;
  const fieldCompleteness = metrics.expectedFieldCount > 0 ? 1 - metrics.missingFieldCount / metrics.expectedFieldCount : 1;

  const score = conf / 100 * 0.5 + highConfFraction * 0.3 + fieldCompleteness * 0.2;

  if (score >= 0.85) return "EXCELLENT";
  if (score >= 0.65) return "GOOD";
  if (score >= 0.4) return "FAIR";
  return "POOR";
}

export function analyzeOcrQuality(
  ocrResult: OCRResult,
  fields: { expectedFieldCodes: readonly string[]; presentFieldCodes: readonly string[] }
): OcrQualityAssessment {
  const metrics = computeMetrics(ocrResult, fields.expectedFieldCodes, fields.presentFieldCodes);
  const level = classifyLevel(metrics);

  return {
    level,
    metrics,
    recommendAiUsage: level !== "POOR" && level !== "UNKNOWN",
    recommendation: level === "POOR" ? "Retake image before using AI." : null,
  };
}
