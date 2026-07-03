/**
 * ImportScheduler
 *
 * Decides *when* and *how many* queued jobs run, on top of ImportQueue's
 * priority/FIFO ordering. Supports single-job scheduling, batch scheduling,
 * and is structured so concurrent workers can be introduced later without
 * changing its public interface.
 *
 * This phase runs batches sequentially (concurrency = 1 is the safe
 * default), but `maxConcurrency` is already part of the config and the
 * per-job execution is isolated per call, so raising it later to run
 * multiple jobs in parallel (e.g. via Promise.all in batches) is a small,
 * additive change.
 */

import type { ImageInput } from "@/lib/layout/layout_types";
import type { ImportQueueStore } from "@/lib/import/import_queue";
import type { ImportWorkerEngine } from "@/lib/import/import_worker";
import type { ImportEventEmitter } from "@/lib/import/import_events";
import type { BatchResult, ImportJob, ImportJobResult } from "@/types/import";

/** Resolves the ImageInput a given job should be processed against. */
export interface JobImageResolver {
  resolve(job: ImportJob): ImageInput;
}

/** Default resolver: treats the job's filename as the image source. Swap for a real resolver later. */
export class FilenameImageResolver implements JobImageResolver {
  resolve(job: ImportJob): ImageInput {
    return { source: job.filename, hash: job.hash };
  }
}

export interface ImportSchedulerConfig {
  /** Reserved for future parallel execution; sequential batches today. */
  maxConcurrency?: number;
  batchSize?: number;
}

export interface ImportSchedulerDependencies {
  queue: ImportQueueStore;
  worker: ImportWorkerEngine;
  imageResolver?: JobImageResolver;
  events?: ImportEventEmitter;
  config?: ImportSchedulerConfig;
}

/**
 * Pulls jobs from an ImportQueue and hands them to a worker, either one at
 * a time (`runNext`) or in batches (`runBatch`).
 *
 * Future extension point: raise `maxConcurrency` and dispatch jobs to a
 * worker pool concurrently instead of the current sequential loop.
 */
export class ImportScheduler {
  private readonly queue: ImportQueueStore;
  private readonly worker: ImportWorkerEngine;
  private readonly imageResolver: JobImageResolver;
  private readonly events?: ImportEventEmitter;
  private readonly config: Required<ImportSchedulerConfig>;

  constructor(dependencies: ImportSchedulerDependencies) {
    this.queue = dependencies.queue;
    this.worker = dependencies.worker;
    this.imageResolver = dependencies.imageResolver ?? new FilenameImageResolver();
    this.events = dependencies.events;
    this.config = {
      maxConcurrency: dependencies.config?.maxConcurrency ?? 1,
      batchSize: dependencies.config?.batchSize ?? 50,
    };
  }

  /** Dequeues and processes a single job, if any is available. */
  async runNext(): Promise<ImportJobResult | undefined> {
    const job = this.queue.dequeue();
    if (!job) return undefined;

    const image = this.imageResolver.resolve(job);
    return this.worker.process(job, image);
  }

  /**
   * Processes up to `config.batchSize` queued jobs (or fewer if the queue
   * empties first), emitting a BatchCompleted event with the aggregate
   * result.
   */
  async runBatch(batchId: string, size: number = this.config.batchSize): Promise<BatchResult> {
    const startedAt = new Date().toISOString();
    const results: ImportJobResult[] = [];

    for (let i = 0; i < size; i += 1) {
      const result = await this.runNext();
      if (!result) break;
      results.push(result);
    }

    const finishedAt = new Date().toISOString();
    const succeeded = results.filter((r) => r.outcome === "success").length;
    const failed = results.length - succeeded;

    const batch: BatchResult = {
      batchId,
      total: results.length,
      succeeded,
      failed,
      results,
      startedAt,
      finishedAt,
    };

    this.events?.emit({ type: "BatchCompleted", batch });

    return batch;
  }

  /** Number of jobs currently waiting in the queue. */
  pendingCount(): number {
    return this.queue.size();
  }
}
