/**
 * ImportMetrics
 *
 * Collects running pipeline statistics from import events: images
 * processed, average duration, validation failures, template distribution,
 * and average confidence. Designed to subscribe to an ImportEventEmitter so
 * it stays decoupled from the worker/scheduler internals.
 */

import type { ImportEvent, ImportEventEmitter } from "@/lib/import/import_events";
import type { ImportMetricsSnapshot } from "@/types/import";

/** Contract for a metrics collector. Allows swapping in a persisted/exported metrics backend later. */
export interface ImportMetricsCollector {
  record(event: ImportEvent): void;
  snapshot(): ImportMetricsSnapshot;
  reset(): void;
}

/**
 * In-memory metrics collector.
 *
 * Future extension point: export snapshots to an external metrics/
 * observability system (e.g. Prometheus, a logging pipeline) rather than
 * only exposing an in-process snapshot.
 */
export class InMemoryImportMetrics implements ImportMetricsCollector {
  private imagesProcessed = 0;
  private totalDurationMs = 0;
  private validationFailures = 0;
  private confidenceSum = 0;
  private confidenceSamples = 0;
  private readonly templateDistribution = new Map<string, number>();

  /** Subscribes this collector to the relevant event types on the given emitter. */
  attach(emitter: ImportEventEmitter): void {
    emitter.on("JobCompleted", (event) => this.record(event));
    emitter.on("JobFailed", (event) => this.record(event));
  }

  record(event: ImportEvent): void {
    switch (event.type) {
      case "JobCompleted": {
        this.imagesProcessed += 1;
        this.totalDurationMs += event.durationMs;

        if (typeof event.job.confidence === "number") {
          this.confidenceSum += event.job.confidence;
          this.confidenceSamples += 1;
        }

        if (event.job.template) {
          const current = this.templateDistribution.get(event.job.template) ?? 0;
          this.templateDistribution.set(event.job.template, current + 1);
        }
        break;
      }
      case "JobFailed": {
        this.validationFailures += 1;
        break;
      }
      default:
        break;
    }
  }

  snapshot(): ImportMetricsSnapshot {
    return {
      imagesProcessed: this.imagesProcessed,
      averageDurationMs: this.imagesProcessed > 0 ? this.totalDurationMs / this.imagesProcessed : 0,
      validationFailures: this.validationFailures,
      templateDistribution: Object.fromEntries(this.templateDistribution),
      averageConfidence: this.confidenceSamples > 0 ? this.confidenceSum / this.confidenceSamples : 0,
    };
  }

  reset(): void {
    this.imagesProcessed = 0;
    this.totalDurationMs = 0;
    this.validationFailures = 0;
    this.confidenceSum = 0;
    this.confidenceSamples = 0;
    this.templateDistribution.clear();
  }
}
