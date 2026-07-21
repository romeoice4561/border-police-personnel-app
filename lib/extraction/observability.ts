/**
 * Structured runtime observability events (Phase 48B — spec §8).
 *
 * A single, typed event stream distinct from usage_meter.ts's UsageEvent:
 * UsageEvent records COMPLETED processing attempts for budget/cost
 * accounting (one row per OCR/AI call, after the fact). RuntimeEvent
 * records the individual STEPS of the pipeline as they happen (start,
 * finish, cache hit, gate decision, validation outcome) — the finer-
 * grained stream the cost dashboard (dashboard.ts) and commander view
 * (commander_view.ts) aggregate into counters like "OCR Requests" or "AI
 * Cancelled," which usage_meter.ts alone cannot distinguish (it has no
 * event for "user was shown the AI button and declined").
 *
 * Every event carries ONLY safe, already-redacted data — no raw OCR text,
 * no field values, no national ID numbers. Event payloads are restricted by
 * type to counts/codes/durations, so there is no field a caller could
 * accidentally populate with sensitive content.
 *
 * Pure — no I/O; the emitter is an injectable in-memory sink, same pattern
 * as usage_meter.ts's InMemoryUsageMeter.
 */

export type RuntimeEventType =
  | "OCR_STARTED"
  | "OCR_FINISHED"
  | "CACHE_HIT"
  | "CACHE_MISS"
  | "AI_RECOMMENDED"
  | "AI_CONFIRMED"
  | "AI_CANCELLED"
  | "AI_BLOCKED"
  | "VALIDATION_FAILED"
  | "EXTRACTION_COMPLETED";

export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: string;
  documentFingerprint: string;
  /** Safe, non-sensitive detail — a document type code, a gate reason, a duration, never raw text or identity values. */
  detail: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ObservabilityEmitter {
  emit(event: Omit<RuntimeEvent, "timestamp">): void;
  getEvents(): readonly RuntimeEvent[];
  countByType(type: RuntimeEventType): number;
}

export class InMemoryObservabilityEmitter implements ObservabilityEmitter {
  private readonly events: RuntimeEvent[] = [];

  emit(event: Omit<RuntimeEvent, "timestamp">): void {
    this.events.push({ ...event, timestamp: new Date().toISOString() });
  }

  getEvents(): readonly RuntimeEvent[] {
    return this.events;
  }

  countByType(type: RuntimeEventType): number {
    return this.events.filter((e) => e.type === type).length;
  }
}
