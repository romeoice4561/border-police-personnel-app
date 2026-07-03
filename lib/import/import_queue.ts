/**
 * ImportQueue
 *
 * Holds jobs awaiting processing, ordered by priority with FIFO tie-break
 * within the same priority. This is the "what could run next" structure;
 * ImportScheduler decides "what actually runs next" (and may layer batching
 * / concurrency policy on top).
 *
 * In-memory only. Designed to scale to tens of thousands of queued jobs
 * without O(n) scans on the hot path (enqueue/dequeue use a priority-bucketed
 * FIFO structure rather than sorting on every call).
 */

import type { ImportJob, ImportJobPriority } from "@/types/import";

const PRIORITY_ORDER: ImportJobPriority[] = ["urgent", "high", "normal", "low"];

/** Contract for an import queue. Allows swapping in a persisted/distributed queue later. */
export interface ImportQueueStore {
  enqueue(job: ImportJob): void;
  dequeue(): ImportJob | undefined;
  peek(): ImportJob | undefined;
  cancel(id: string): boolean;
  retry(id: string): boolean;
  clear(): void;
  size(): number;
}

/**
 * In-memory priority queue with FIFO ordering within each priority bucket.
 *
 * Future extension point: back this with a persisted/distributed queue
 * (e.g. Redis, SQS-like service) behind the same `ImportQueueStore`
 * interface when running across multiple processes/machines.
 */
export class ImportQueue implements ImportQueueStore {
  private readonly buckets: Record<ImportJobPriority, ImportJob[]> = {
    urgent: [],
    high: [],
    normal: [],
    low: [],
  };

  /** Jobs removed from their bucket (cancelled) but kept for retry lookup. */
  private readonly cancelled = new Map<string, ImportJob>();

  enqueue(job: ImportJob): void {
    this.buckets[job.priority].push(job);
  }

  dequeue(): ImportJob | undefined {
    for (const priority of PRIORITY_ORDER) {
      const bucket = this.buckets[priority];
      if (bucket.length > 0) {
        return bucket.shift();
      }
    }
    return undefined;
  }

  peek(): ImportJob | undefined {
    for (const priority of PRIORITY_ORDER) {
      const bucket = this.buckets[priority];
      if (bucket.length > 0) {
        return bucket[0];
      }
    }
    return undefined;
  }

  /** Removes a queued job by id, if present, and remembers it for a possible retry. */
  cancel(id: string): boolean {
    for (const priority of PRIORITY_ORDER) {
      const bucket = this.buckets[priority];
      const index = bucket.findIndex((job) => job.id === id);
      if (index !== -1) {
        const [job] = bucket.splice(index, 1);
        this.cancelled.set(id, job);
        return true;
      }
    }
    return false;
  }

  /** Re-enqueues a previously cancelled/failed job by id, if known. */
  retry(id: string): boolean {
    const job = this.cancelled.get(id);
    if (!job) return false;
    this.cancelled.delete(id);
    this.enqueue(job);
    return true;
  }

  clear(): void {
    for (const priority of PRIORITY_ORDER) {
      this.buckets[priority] = [];
    }
    this.cancelled.clear();
  }

  size(): number {
    return PRIORITY_ORDER.reduce((total, priority) => total + this.buckets[priority].length, 0);
  }
}
