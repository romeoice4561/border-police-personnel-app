/**
 * BatchProcessor
 *
 * Takes a large set of scanned images (potentially tens of thousands),
 * turns each into an ImportJob, enqueues them, and drives the
 * ImportScheduler through repeated batches until the queue is drained.
 *
 * This is the top of the orchestration stack: Scanner output -> here ->
 * ImportQueue -> ImportScheduler -> ImportWorker -> ImportPipeline.
 * No Scanner implementation exists yet (no Google Drive integration in this
 * phase) — `ScannedImage[]` is accepted as plain input so a real scanner can
 * be plugged in later without changing this module.
 */

import { createImportJob, transitionJob } from "@/lib/import/import_job";
import type { ImportQueueStore } from "@/lib/import/import_queue";
import type { ImportScheduler } from "@/lib/import/import_scheduler";
import type { ImportEventEmitter } from "@/lib/import/import_events";
import type { BatchResult, ImportJobPriority, ScannedImage } from "@/types/import";

export interface BatchProcessorDependencies {
  queue: ImportQueueStore;
  scheduler: ImportScheduler;
  events?: ImportEventEmitter;
}

export interface ProcessAllOptions {
  priority?: ImportJobPriority;
  batchSize?: number;
}

/**
 * Enqueues large sets of scanned images and drains them through the
 * scheduler in batches, so tens of thousands of jobs can be processed
 * without holding them all in memory as in-flight work at once.
 *
 * Future extension point: stream scanned images (e.g. paginated Google
 * Drive listing) instead of accepting a fully materialized array, once a
 * real scanner exists.
 */
export class BatchProcessor {
  private readonly queue: ImportQueueStore;
  private readonly scheduler: ImportScheduler;
  private readonly events?: ImportEventEmitter;

  constructor(dependencies: BatchProcessorDependencies) {
    this.queue = dependencies.queue;
    this.scheduler = dependencies.scheduler;
    this.events = dependencies.events;
  }

  /** Converts scanned images into jobs and enqueues them, without running the scheduler. */
  enqueueAll(images: ScannedImage[], priority: ImportJobPriority = "normal"): void {
    for (const image of images) {
      const pending = createImportJob(image, { id: image.hash, priority });
      const queued = transitionJob(pending, "Queued");
      this.queue.enqueue(queued);
      this.events?.emit({ type: "JobQueued", job: queued });
    }
  }

  /**
   * Enqueues all images, then repeatedly runs scheduler batches until the
   * queue is drained. Returns every BatchResult produced.
   */
  async processAll(images: ScannedImage[], options: ProcessAllOptions = {}): Promise<BatchResult[]> {
    this.enqueueAll(images, options.priority);

    const batches: BatchResult[] = [];
    let batchIndex = 0;

    while (this.scheduler.pendingCount() > 0) {
      const batchId = `batch-${batchIndex}`;
      const batch = await this.scheduler.runBatch(batchId, options.batchSize);
      batches.push(batch);
      batchIndex += 1;
    }

    return batches;
  }
}
