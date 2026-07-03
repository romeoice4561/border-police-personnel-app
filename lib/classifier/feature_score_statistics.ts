/**
 * FeatureScoreStatistics (Phase 10B).
 *
 * Aggregates the FeatureScoreEngine's per-image ClassificationScore output
 * into the summary Phase 10B requires: top matched features, average
 * classification confidence, and the category distribution. A small stateful
 * builder (like the OCR/classification builders in this codebase) fed via the
 * engine's `onScored` observer, so no re-scoring is needed and the classifier
 * return type is unchanged.
 *
 * Pure aggregation — no OCR, no OpenAI, no I/O.
 */

import type { ClassificationScore } from "@/lib/classifier/classification_score";
import type { ImageCategory } from "@/lib/classifier/classification_types";

export interface TopFeatureCount {
  id: string;
  category: string;
  /** How many images this feature contributed to. */
  images: number;
  /** Total matches summed across those images. */
  totalMatches: number;
}

export interface FeatureScoreSummary {
  total_images: number;
  average_confidence: number;
  /** Count per resulting category (the distribution). */
  category_distribution: Record<ImageCategory, number>;
  /** Features that contributed to the most images, most first. */
  top_matched_features: TopFeatureCount[];
  /** Share of images that ended UNKNOWN, 0-1, 4 dp. */
  unknown_rate: number;
}

const ALL_CATEGORIES: ImageCategory[] = [
  "PERSONNEL_PROFILE",
  "TIMELINE",
  "ORGANIZATION_CHART",
  "COVER_PAGE",
  "TITLE_PAGE",
  "TABLE",
  "MAP",
  "DIAGRAM",
  "INDEX_PAGE",
  "UNKNOWN",
];

export interface FeatureScoreStatisticsBuilder {
  add(score: ClassificationScore): void;
  build(): FeatureScoreSummary;
}

export class DefaultFeatureScoreStatisticsBuilder implements FeatureScoreStatisticsBuilder {
  private totalImages = 0;
  private confidenceSum = 0;
  private readonly distribution = new Map<ImageCategory, number>();
  private readonly featureImages = new Map<string, TopFeatureCount>();

  add(score: ClassificationScore): void {
    this.totalImages += 1;
    this.confidenceSum += score.confidence;
    this.distribution.set(score.category, (this.distribution.get(score.category) ?? 0) + 1);

    for (const feature of score.topFeatures) {
      let entry = this.featureImages.get(feature.id);
      if (!entry) {
        entry = { id: feature.id, category: feature.category, images: 0, totalMatches: 0 };
        this.featureImages.set(feature.id, entry);
      }
      entry.images += 1;
      entry.totalMatches += feature.matches;
    }
  }

  build(): FeatureScoreSummary {
    const category_distribution = {} as Record<ImageCategory, number>;
    for (const category of ALL_CATEGORIES) {
      category_distribution[category] = this.distribution.get(category) ?? 0;
    }

    const top_matched_features = Array.from(this.featureImages.values())
      .sort((a, b) => b.images - a.images || b.totalMatches - a.totalMatches)
      .slice(0, 12);

    const unknownCount = category_distribution.UNKNOWN;

    return {
      total_images: this.totalImages,
      average_confidence:
        this.totalImages > 0 ? Math.round((this.confidenceSum / this.totalImages) * 100) / 100 : 0,
      category_distribution,
      top_matched_features,
      unknown_rate: this.totalImages > 0 ? Math.round((unknownCount / this.totalImages) * 10_000) / 10_000 : 0,
    };
  }
}
