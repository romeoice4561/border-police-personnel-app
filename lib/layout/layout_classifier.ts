/**
 * LayoutClassifier
 *
 * Classifies an image's layout into a broad LayoutCategory using extracted
 * LayoutFeatureSet signals (see layout_features.ts). This runs before
 * template-level detection (see template_detector.ts) — classification
 * answers "what kind of layout is this," while detection answers "which
 * specific template version is this."
 */

import type {
  ClassificationCandidate,
  ClassificationResult,
  LayoutCategory,
  LayoutFeatureSet,
} from "@/lib/layout/layout_types";

/** Contract for a classification backend. Allows swapping in a trained model later. */
export interface LayoutClassifierEngine {
  classify(features: LayoutFeatureSet): Promise<ClassificationResult>;
}

const ALL_CATEGORIES: LayoutCategory[] = [
  "Timeline",
  "ProfileCard",
  "SimpleCard",
  "OrganizationCard",
  "HistoryCard",
  "BiographyCard",
  "MixedLayout",
  "Unknown",
];

/**
 * Rule-based classifier skeleton.
 *
 * Future extension point: replace the heuristic rules below with a trained
 * classifier (e.g. a lightweight ML model) behind the same
 * `LayoutClassifierEngine` interface.
 */
export class HeuristicLayoutClassifier implements LayoutClassifierEngine {
  async classify(features: LayoutFeatureSet): Promise<ClassificationResult> {
    const candidates = this.scoreAllCategories(features);
    const best = candidates[0] ?? { category: "Unknown", confidence: 0 };

    return { best, candidates };
  }

  /**
   * Produces a confidence score per category, sorted descending.
   * Placeholder scoring — real signal weighting is a future extension point.
   */
  private scoreAllCategories(features: LayoutFeatureSet): ClassificationCandidate[] {
    const scores = ALL_CATEGORIES.map((category) => ({
      category,
      confidence: this.scoreCategory(category, features),
    }));

    return scores.sort((a, b) => b.confidence - a.confidence);
  }

  private scoreCategory(category: LayoutCategory, features: LayoutFeatureSet): number {
    switch (category) {
      case "Timeline":
        return features.timelineOrientation !== "none" ? 70 : 10;
      case "BiographyCard":
        return features.textDensity === "dense" ? 60 : 15;
      case "ProfileCard":
        return features.photoRegion ? 55 : 10;
      case "Unknown":
        return 5;
      default:
        return 10;
    }
  }
}

/**
 * Classifies layout features into a LayoutCategory using the provided
 * engine (defaults to the heuristic classifier).
 */
export async function classifyLayout(
  features: LayoutFeatureSet,
  engine: LayoutClassifierEngine = new HeuristicLayoutClassifier()
): Promise<ClassificationResult> {
  return engine.classify(features);
}
