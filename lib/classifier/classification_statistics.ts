/**
 * ClassificationStatistics
 *
 * Aggregates per-image ImageClassificationResults into the
 * logs/classification_summary.json report: per-category counts plus
 * estimated cost/time/API-call savings from skipping non-personnel
 * images. Pure aggregation over already-computed classification results —
 * no OpenAI calls, no file I/O (the batch runner writes the file).
 */

import type { ImageCategory, ImageClassificationResult } from "@/lib/classifier/classification_types";

export interface ClassificationSummary {
  total_images: number;
  processed_images: number;
  skipped_images: number;
  personnel_profiles: number;
  timelines: number;
  organization_charts: number;
  cover_pages: number;
  title_pages: number;
  tables: number;
  maps: number;
  diagrams: number;
  index_pages: number;
  unknown: number;
  estimated_api_calls_saved: number;
  estimated_cost_saved_usd: number;
  estimated_processing_time_saved_seconds: number;
}

/** Per-image cost/time assumptions used to estimate savings from skipped (non-PERSONNEL_PROFILE) images. */
export interface SavingsAssumptions {
  /** Estimated USD cost of one OpenAI Vision call, used to project cost saved per skipped image. */
  estimatedCostPerCallUsd: number;
  /** Estimated wall-clock seconds one OpenAI Vision call takes, used to project time saved per skipped image. */
  estimatedProcessingSecondsPerCall: number;
}

const DEFAULT_ASSUMPTIONS: SavingsAssumptions = {
  estimatedCostPerCallUsd: 0.01,
  estimatedProcessingSecondsPerCall: 6,
};

/** Contract for building the classification summary. Allows swapping in different savings assumptions/reporting later. */
export interface ClassificationStatisticsBuilder {
  add(result: ImageClassificationResult): void;
  build(): ClassificationSummary;
}

export class DefaultClassificationStatisticsBuilder implements ClassificationStatisticsBuilder {
  private totalImages = 0;
  private processedImages = 0;
  private skippedImages = 0;
  private readonly categoryCounts: Record<ImageCategory, number> = {
    PERSONNEL_PROFILE: 0,
    TIMELINE: 0,
    ORGANIZATION_CHART: 0,
    COVER_PAGE: 0,
    TITLE_PAGE: 0,
    TABLE: 0,
    MAP: 0,
    DIAGRAM: 0,
    INDEX_PAGE: 0,
    UNKNOWN: 0,
  };

  constructor(private readonly assumptions: SavingsAssumptions = DEFAULT_ASSUMPTIONS) {}

  add(result: ImageClassificationResult): void {
    this.totalImages += 1;
    this.categoryCounts[result.category] += 1;

    if (result.shouldProcess) {
      this.processedImages += 1;
    } else {
      this.skippedImages += 1;
    }
  }

  build(): ClassificationSummary {
    return {
      total_images: this.totalImages,
      processed_images: this.processedImages,
      skipped_images: this.skippedImages,
      personnel_profiles: this.categoryCounts.PERSONNEL_PROFILE,
      timelines: this.categoryCounts.TIMELINE,
      organization_charts: this.categoryCounts.ORGANIZATION_CHART,
      cover_pages: this.categoryCounts.COVER_PAGE,
      title_pages: this.categoryCounts.TITLE_PAGE,
      tables: this.categoryCounts.TABLE,
      maps: this.categoryCounts.MAP,
      diagrams: this.categoryCounts.DIAGRAM,
      index_pages: this.categoryCounts.INDEX_PAGE,
      unknown: this.categoryCounts.UNKNOWN,
      estimated_api_calls_saved: this.skippedImages,
      estimated_cost_saved_usd:
        Math.round(this.skippedImages * this.assumptions.estimatedCostPerCallUsd * 1_000_000) / 1_000_000,
      estimated_processing_time_saved_seconds: this.skippedImages * this.assumptions.estimatedProcessingSecondsPerCall,
    };
  }
}
