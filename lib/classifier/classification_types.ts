/**
 * Shared types for the Smart Image Classification Engine (Phase 8.5).
 *
 * Sits strictly between Image Source and the Layout Detector /OpenAI
 * Vision call:
 *
 *   Image Source -> Smart Image Classification Engine -> Layout Detector
 *   -> OpenAI Vision -> Validation -> Normalization -> Career Engine
 *
 * Pure domain typing only — no OpenAI API calls, no Google Drive SDK, no
 * database, no UI.
 */

import type { LayoutFeatureSet, TemplateDetectionResult } from "@/lib/layout/layout_types";

/** Every category an image must be classified into — exactly one per image. */
export type ImageCategory =
  | "PERSONNEL_PROFILE"
  | "TIMELINE"
  | "ORGANIZATION_CHART"
  | "COVER_PAGE"
  | "TITLE_PAGE"
  | "TABLE"
  | "MAP"
  | "DIAGRAM"
  | "INDEX_PAGE"
  | "UNKNOWN";

/** Only PERSONNEL_PROFILE should ever be sent to OpenAI Vision. */
export const PROCESSABLE_CATEGORY: ImageCategory = "PERSONNEL_PROFILE";

/** Confidence threshold below which a classification is downgraded to UNKNOWN (and therefore skipped). */
export const MIN_CLASSIFICATION_CONFIDENCE = 60;

/** Final output of classifying a single image, before any Vision call is made. */
export interface ImageClassificationResult {
  category: ImageCategory;
  /** 0-100. */
  confidence: number;
  /** Human-readable explanation of why this category/confidence was chosen. */
  reason: string;
  /** true only when category === PERSONNEL_PROFILE. */
  shouldProcess: boolean;
}

/**
 * Signals available to the classifier before any Vision call — layout
 * detection output, low-level visual features, and (optionally) a small
 * text sample. Deliberately excludes filename, folder name, and image
 * path: classification must be based on document content/structure only
 * (see docs/IMAGE_CLASSIFICATION_ENGINE.md, "Classification Rules").
 */
export interface ClassificationSignals {
  detection: TemplateDetectionResult;
  features: LayoutFeatureSet;
  /** A text sample drawn from the image, if any lightweight text source is available. Never OpenAI Vision output. */
  textSample?: string;
}

/** Contract for a single classification rule. Allows composing/reordering/extending rules independently (SOLID: one rule, one responsibility). */
export interface ClassificationRule {
  /** Returns a candidate classification if this rule's pattern matches, or undefined if it does not apply. */
  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined;
}

/** Contract for the top-level engine composing all classification rules. */
export interface ImageClassificationEngine {
  classify(signals: ClassificationSignals): ImageClassificationResult;
}
