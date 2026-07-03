/**
 * ImportState
 *
 * Tracks the current state of every known ImportJob by id, independent of
 * queue ordering. The queue answers "what runs next"; this store answers
 * "what is the current status of job X" and "give me all jobs in status Y."
 *
 * In-memory only in this phase. See docs/IMPORT_PIPELINE.md for the future
 * persistence extension point.
 */

import type { ImportJob, ImportJobStatus } from "@/types/import";

/** Contract for a job state store. Allows swapping in a persisted store later. */
export interface ImportStateStore {
  get(id: string): ImportJob | undefined;
  upsert(job: ImportJob): void;
  remove(id: string): void;
  listByStatus(status: ImportJobStatus): ImportJob[];
  all(): ImportJob[];
}

/**
 * In-memory job state store.
 *
 * Future extension point: back this with a persistent store (e.g. Supabase)
 * in a later phase behind the same `ImportStateStore` interface.
 */
export class InMemoryImportState implements ImportStateStore {
  private readonly jobs = new Map<string, ImportJob>();

  get(id: string): ImportJob | undefined {
    return this.jobs.get(id);
  }

  upsert(job: ImportJob): void {
    this.jobs.set(job.id, job);
  }

  remove(id: string): void {
    this.jobs.delete(id);
  }

  listByStatus(status: ImportJobStatus): ImportJob[] {
    return this.all().filter((job) => job.status === status);
  }

  all(): ImportJob[] {
    return Array.from(this.jobs.values());
  }
}
