/**
 * ImportWorker
 *
 * Processes a single ImportJob end-to-end through the ImportPipeline,
 * emitting lifecycle events (JobStarted, JobCompleted, JobFailed, JobRetry)
 * and measuring duration. Multiple workers can be run concurrently by a
 * future ImportScheduler without any changes here — the worker is stateless
 * aside from its injected dependencies.
 */

import type { ImageInput } from "@/lib/layout/layout_types";
import { ImportPipeline } from "@/lib/import/import_pipeline";
import type { ImportEventEmitter } from "@/lib/import/import_events";
import type { ImportStateStore } from "@/lib/import/import_state";
import { transitionJob } from "@/lib/import/import_job";
import { isFailure } from "@/lib/import/job_result";
import type { ImportJob, ImportJobResult } from "@/types/import";

const DEFAULT_MAX_RETRIES = 3;

export interface ImportWorkerDependencies {
  pipeline?: ImportPipeline;
  events?: ImportEventEmitter;
  state?: ImportStateStore;
  maxRetries?: number;
}

/** Contract for a single-job worker. Allows swapping in a different execution strategy later. */
export interface ImportWorkerEngine {
  process(job: ImportJob, image: ImageInput): Promise<ImportJobResult>;
}

/**
 * Processes one job at a time. A pool of these (see import_scheduler.ts)
 * provides horizontal concurrency without changing this class.
 */
export class ImportWorker implements ImportWorkerEngine {
  private readonly pipeline: ImportPipeline;
  private readonly events?: ImportEventEmitter;
  private readonly state?: ImportStateStore;
  private readonly maxRetries: number;

  constructor(dependencies: ImportWorkerDependencies = {}) {
    this.pipeline = dependencies.pipeline ?? new ImportPipeline();
    this.events = dependencies.events;
    this.state = dependencies.state;
    this.maxRetries = dependencies.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async process(job: ImportJob, image: ImageInput): Promise<ImportJobResult> {
    const startedAt = Date.now();
    this.events?.emit({ type: "JobStarted", job });

    const result = await this.pipeline.run(job, image);
    const durationMs = Date.now() - startedAt;

    if (isFailure(result)) {
      this.state?.upsert(result.failure.job);

      if (result.failure.job.retry_count < this.maxRetries) {
        const retried = transitionJob(result.failure.job, "Retrying");
        this.state?.upsert(retried);
        this.events?.emit({ type: "JobRetry", job: retried, attempt: retried.retry_count });
      } else {
        this.events?.emit({ type: "JobFailed", job: result.failure.job, error: result.failure.error });
      }

      return result;
    }

    this.state?.upsert(result.success.job);
    this.events?.emit({ type: "JobCompleted", job: result.success.job, durationMs });

    return result;
  }
}
