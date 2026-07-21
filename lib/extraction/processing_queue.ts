/**
 * Processing queue architecture (Phase 48B — spec §7).
 *
 * Prepares the data model and state transitions for a future background
 * queue WITHOUT a real background worker — the current pipeline stays
 * fully synchronous (a route handler calls runExtractionPipeline and waits
 * for the result, exactly as in Phase 48A). This module exists so the
 * dashboard/health-summary/commander views have a real "queue size" and
 * "queue health" concept to report today (in this phase, an in-memory
 * queue that a synchronous caller enqueues into and immediately drains),
 * and so a future phase can swap in an actual async worker without
 * changing the state machine or the types anything else depends on.
 *
 * Pure state machine + one injectable in-memory store — no timers, no
 * setInterval, no real concurrency.
 */

export type QueueItemStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type QueuePriority = "NORMAL" | "HIGH";

export interface QueueItem {
  id: string;
  documentFingerprint: string;
  status: QueueItemStatus;
  priority: QueuePriority;
  retryable: boolean;
  attempts: number;
  enqueuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Present only on FAILED items — a short, safe (non-sensitive) error summary, never raw document content. */
  failureReason: string | null;
}

/**
 * Legal transitions, enforced by transitionQueueItem() below — mirrors
 * extraction_pipeline_types.ts's ProcessingStatus in spirit (a fixed,
 * explicit state machine rather than a free-form status string anything
 * can set to anything).
 */
const LEGAL_TRANSITIONS: Record<QueueItemStatus, readonly QueueItemStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: ["QUEUED"], // retry re-enters the queue, only when retryable
  CANCELLED: [],
};

export class InvalidQueueTransitionError extends Error {
  constructor(from: QueueItemStatus, to: QueueItemStatus) {
    super(`Illegal queue transition: ${from} -> ${to}`);
    this.name = "InvalidQueueTransitionError";
  }
}

export function canTransition(from: QueueItemStatus, to: QueueItemStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export interface ProcessingQueue {
  enqueue(item: Omit<QueueItem, "status" | "attempts" | "startedAt" | "completedAt" | "failureReason">): QueueItem;
  transition(id: string, to: QueueItemStatus, options?: { failureReason?: string }): QueueItem;
  get(id: string): QueueItem | null;
  list(): readonly QueueItem[];
  /** Items currently QUEUED or RUNNING — the live "queue size" the dashboard reports. */
  activeCount(): number;
}

/**
 * In-memory queue. High-priority items are returned first by list() (a
 * future worker would drain in this order), but nothing here actually
 * drains automatically — the current synchronous pipeline enqueues,
 * transitions to RUNNING, does the real work inline, then transitions to
 * COMPLETED/FAILED, all within the same request. See
 * extraction_api_handlers.ts for that wiring.
 */
export class InMemoryProcessingQueue implements ProcessingQueue {
  private readonly items = new Map<string, QueueItem>();

  enqueue(item: Omit<QueueItem, "status" | "attempts" | "startedAt" | "completedAt" | "failureReason">): QueueItem {
    const queueItem: QueueItem = {
      ...item,
      status: "QUEUED",
      attempts: 0,
      startedAt: null,
      completedAt: null,
      failureReason: null,
    };
    this.items.set(queueItem.id, queueItem);
    return queueItem;
  }

  transition(id: string, to: QueueItemStatus, options: { failureReason?: string } = {}): QueueItem {
    const existing = this.items.get(id);
    if (!existing) throw new Error(`No queue item with id "${id}".`);
    if (!canTransition(existing.status, to)) throw new InvalidQueueTransitionError(existing.status, to);

    const now = new Date().toISOString();
    const updated: QueueItem = {
      ...existing,
      status: to,
      attempts: to === "RUNNING" ? existing.attempts + 1 : existing.attempts,
      startedAt: to === "RUNNING" ? now : existing.startedAt,
      completedAt: to === "COMPLETED" || to === "FAILED" || to === "CANCELLED" ? now : existing.completedAt,
      failureReason: to === "FAILED" ? (options.failureReason ?? null) : to === "QUEUED" ? null : existing.failureReason,
    };
    this.items.set(id, updated);
    return updated;
  }

  get(id: string): QueueItem | null {
    return this.items.get(id) ?? null;
  }

  list(): readonly QueueItem[] {
    return [...this.items.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "HIGH" ? -1 : 1;
      return a.enqueuedAt.localeCompare(b.enqueuedAt);
    });
  }

  activeCount(): number {
    return [...this.items.values()].filter((i) => i.status === "QUEUED" || i.status === "RUNNING").length;
  }
}
