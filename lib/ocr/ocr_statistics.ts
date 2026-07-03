/**
 * OCR statistics (Phase 10A).
 *
 * Accumulates per-image OCR outcomes into the summary Phase 10A requires:
 * average confidence, average OCR time, cache hit rate, and total characters
 * extracted. A small stateful builder (like BatchReportBuilder /
 * DefaultClassificationStatisticsBuilder) so a runner can record each result
 * as it finishes without holding every OCRResult in memory. Behind an
 * interface so it stays injectable and testable.
 */

import type { OCRResult, OCRSource } from "@/lib/ocr/ocr_types";
import { characterCount } from "@/lib/ocr/ocr_result";

export interface OCRSummary {
  total_images: number;
  /** Freshly-OCR'd images (cache misses). */
  fresh: number;
  /** Images served from the cache. */
  cache_hits: number;
  /** cache_hits / total_images, 0-1, rounded to 4 dp. */
  cache_hit_rate: number;
  /** Mean overall confidence across all recorded results, 0-100, 2 dp. */
  average_confidence: number;
  /** Mean processing time across freshly-OCR'd images only, ms (cache hits take ~0ms and would skew this), rounded. */
  average_ocr_time_ms: number;
  /** Total characters extracted across all recorded results. */
  characters_extracted: number;
}

/** Contract for building the OCR summary. */
export interface OCRStatisticsBuilder {
  /** Records one OCR outcome, noting whether it came from cache or a fresh run. */
  add(result: OCRResult, source: OCRSource): void;
  build(): OCRSummary;
}

export class DefaultOCRStatisticsBuilder implements OCRStatisticsBuilder {
  private totalImages = 0;
  private freshCount = 0;
  private cacheHits = 0;
  private confidenceSum = 0;
  private freshTimeSum = 0;
  private charactersExtracted = 0;

  add(result: OCRResult, source: OCRSource): void {
    this.totalImages += 1;
    this.confidenceSum += result.confidence;
    this.charactersExtracted += characterCount(result);

    if (source === "cache") {
      this.cacheHits += 1;
    } else {
      this.freshCount += 1;
      // Only fresh runs have a meaningful processing time; cache hits are
      // effectively instantaneous and would otherwise drag the average down.
      this.freshTimeSum += result.processingTimeMs;
    }
  }

  build(): OCRSummary {
    return {
      total_images: this.totalImages,
      fresh: this.freshCount,
      cache_hits: this.cacheHits,
      cache_hit_rate: this.totalImages > 0 ? Math.round((this.cacheHits / this.totalImages) * 10_000) / 10_000 : 0,
      average_confidence:
        this.totalImages > 0 ? Math.round((this.confidenceSum / this.totalImages) * 100) / 100 : 0,
      average_ocr_time_ms: this.freshCount > 0 ? Math.round(this.freshTimeSum / this.freshCount) : 0,
      characters_extracted: this.charactersExtracted,
    };
  }
}
