/**
 * Helpers for constructing and inspecting ImageClassificationResult values.
 *
 * Kept separate from image_classifier.ts / classification_engine.ts so the
 * result shape can be built/tested independently, mirroring
 * lib/import/job_result.ts's pattern in this codebase.
 */

import type { ImageCategory, ImageClassificationResult } from "@/lib/classifier/classification_types";
import { PROCESSABLE_CATEGORY } from "@/lib/classifier/classification_types";

/** Builds a classification result, deriving `shouldProcess` from the category so callers can't accidentally set them inconsistently. */
export function buildClassificationResult(
  category: ImageCategory,
  confidence: number,
  reason: string
): ImageClassificationResult {
  return {
    category,
    confidence,
    reason,
    shouldProcess: category === PROCESSABLE_CATEGORY,
  };
}

/** True only for PERSONNEL_PROFILE — the sole category that should reach OpenAI Vision. */
export function isProcessable(result: ImageClassificationResult): boolean {
  return result.category === PROCESSABLE_CATEGORY && result.shouldProcess;
}
