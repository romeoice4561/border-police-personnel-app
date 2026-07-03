/**
 * Batch report types and builders for the Phase 9A batch import runner.
 *
 * Kept separate from scripts/run_batch_import.ts so the reporting shape
 * (and the logic that aggregates it) is independently testable, and so a
 * future phase (e.g. a dashboard reading these files) has a stable,
 * documented type to import from rather than an inline shape defined in a
 * script.
 */

export interface RegionSummary {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

export interface BatchSummary {
  total_images: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  resume_skipped: number;
  average_confidence: number;
  average_processing_time_ms: number;
  regions: Record<string, RegionSummary>;
}

export interface FailedImageEntry {
  file: string;
  region: string;
  reason: string;
  timestamp: string;
}

export interface SkippedImageEntry {
  file: string;
  region: string;
  reason: string;
  timestamp: string;
}

/**
 * Accumulates per-image outcomes during a batch run and produces the final
 * BatchSummary/failed/skipped reports. Kept as a small stateful builder
 * (rather than a pure function over a completed list) so the batch runner
 * can update it incrementally as each image finishes, without holding
 * every per-image result in memory for the whole run.
 */
export class BatchReportBuilder {
  private totalImages = 0;
  private processed = 0;
  private successCount = 0;
  private failedCount = 0;
  private skippedCount = 0;
  private resumeSkippedCount = 0;
  private confidenceSum = 0;
  private confidenceSamples = 0;
  private durationSum = 0;
  private durationSamples = 0;
  private readonly regions = new Map<string, RegionSummary>();
  private readonly failedEntries: FailedImageEntry[] = [];
  private readonly skippedEntries: SkippedImageEntry[] = [];

  private regionFor(region: string): RegionSummary {
    let summary = this.regions.get(region);
    if (!summary) {
      summary = { total: 0, success: 0, failed: 0, skipped: 0 };
      this.regions.set(region, summary);
    }
    return summary;
  }

  /** Registers a discovered image up front, before processing begins, so region totals are known from the start. */
  registerDiscovered(region: string): void {
    this.totalImages += 1;
    this.regionFor(region).total += 1;
  }

  recordSuccess(region: string, confidence: number, processingTimeMs: number): void {
    this.processed += 1;
    this.successCount += 1;
    this.regionFor(region).success += 1;

    this.confidenceSum += confidence;
    this.confidenceSamples += 1;
    this.durationSum += processingTimeMs;
    this.durationSamples += 1;
  }

  recordFailure(file: string, region: string, reason: string): void {
    this.processed += 1;
    this.failedCount += 1;
    this.regionFor(region).failed += 1;
    this.failedEntries.push({ file, region, reason, timestamp: new Date().toISOString() });
  }

  recordSkipped(file: string, region: string, reason: string): void {
    this.skippedCount += 1;
    this.regionFor(region).skipped += 1;
    this.skippedEntries.push({ file, region, reason, timestamp: new Date().toISOString() });
  }

  recordResumeSkipped(region: string): void {
    this.resumeSkippedCount += 1;
    // Resume-skipped images were already successfully processed in a prior
    // run; count them toward the region's success total so region totals
    // stay meaningful across repeated runs.
    this.regionFor(region).success += 1;
    this.processed += 1;
  }

  buildSummary(): BatchSummary {
    const regions: Record<string, RegionSummary> = {};
    for (const [region, summary] of this.regions) {
      regions[region] = summary;
    }

    return {
      total_images: this.totalImages,
      processed: this.processed,
      success: this.successCount,
      failed: this.failedCount,
      skipped: this.skippedCount,
      resume_skipped: this.resumeSkippedCount,
      average_confidence:
        this.confidenceSamples > 0 ? Math.round((this.confidenceSum / this.confidenceSamples) * 100) / 100 : 0,
      average_processing_time_ms:
        this.durationSamples > 0 ? Math.round(this.durationSum / this.durationSamples) : 0,
      regions,
    };
  }

  buildFailedReport(): FailedImageEntry[] {
    return this.failedEntries;
  }

  buildSkippedReport(): SkippedImageEntry[] {
    return this.skippedEntries;
  }
}
