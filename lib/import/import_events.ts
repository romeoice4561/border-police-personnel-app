/**
 * Import pipeline event types and a minimal typed emitter.
 *
 * Decouples producers (worker, scheduler, batch processor) from consumers
 * (metrics collector, future logging/UI layers) without depending on any
 * concrete transport. No database, no API — purely in-process.
 */

import type { BatchResult, ImportJob } from "@/types/import";

export interface JobQueuedEvent {
  type: "JobQueued";
  job: ImportJob;
}

export interface JobStartedEvent {
  type: "JobStarted";
  job: ImportJob;
}

export interface JobCompletedEvent {
  type: "JobCompleted";
  job: ImportJob;
  durationMs: number;
}

export interface JobFailedEvent {
  type: "JobFailed";
  job: ImportJob;
  error: string;
}

export interface JobRetryEvent {
  type: "JobRetry";
  job: ImportJob;
  attempt: number;
}

export interface BatchCompletedEvent {
  type: "BatchCompleted";
  batch: BatchResult;
}

export type ImportEvent =
  | JobQueuedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | JobRetryEvent
  | BatchCompletedEvent;

export type ImportEventType = ImportEvent["type"];

export type ImportEventListener<T extends ImportEvent = ImportEvent> = (event: T) => void;

/** Contract for an import event bus. Allows swapping in a real message bus later. */
export interface ImportEventEmitter {
  on<T extends ImportEventType>(type: T, listener: ImportEventListener<Extract<ImportEvent, { type: T }>>): void;
  off<T extends ImportEventType>(type: T, listener: ImportEventListener<Extract<ImportEvent, { type: T }>>): void;
  emit(event: ImportEvent): void;
}

/**
 * In-process event emitter for import pipeline events.
 *
 * Future extension point: replace with a durable/distributed event bus
 * (e.g. backed by a queue service) behind the same `ImportEventEmitter`
 * interface if the pipeline is scaled across multiple processes.
 */
export class InMemoryImportEventEmitter implements ImportEventEmitter {
  // Listeners for different event subtypes are stored in one heterogeneous
  // map keyed by event type; each bucket is narrowed back to its specific
  // listener type at the `on`/`off` call site (where T is known), and
  // `emit` only ever invokes a bucket with events matching its own key, so
  // this is sound despite the widened value type.
  private readonly listeners = new Map<ImportEventType, Set<ImportEventListener<ImportEvent>>>();

  on<T extends ImportEventType>(type: T, listener: ImportEventListener<Extract<ImportEvent, { type: T }>>): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener as ImportEventListener<ImportEvent>);
  }

  off<T extends ImportEventType>(type: T, listener: ImportEventListener<Extract<ImportEvent, { type: T }>>): void {
    this.listeners.get(type)?.delete(listener as ImportEventListener<ImportEvent>);
  }

  emit(event: ImportEvent): void {
    const handlers = this.listeners.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(event);
    }
  }
}
