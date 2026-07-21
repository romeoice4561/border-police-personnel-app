/**
 * Usage metering (Phase 48 — spec §9).
 *
 * Records observability events for every OCR/AI processing attempt —
 * in-memory only this phase (same "propose, don't persist yet" decision as
 * extraction_cache.ts). Behind a clean interface (UsageMeter) so a future
 * phase can swap in a database-backed implementation without touching
 * anything that records events.
 *
 * Never guesses: `tokenUsage` and `estimatedCostUsd` are null unless the
 * provider actually returned real numbers or a verified pricing
 * configuration was used to compute them (spec §9 — "do not guess token
 * usage, do not guess cost").
 */

export type UsageEventOutcome = "success" | "failure";

export interface UsageEvent {
  timestamp: string;
  documentFingerprint: string;
  ocrProviderUsed: "local_ocr" | "ocr_service" | null;
  aiProviderUsed: string | null;
  aiModelUsed: string | null;
  aiCallReason: string | null;
  cacheResult: "hit" | "miss";
  outcome: UsageEventOutcome;
  processingDurationMs: number;
  inputPages: number;
  /** Only set when the provider's response actually reported token usage — never estimated/guessed. */
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  /** Only set when computed from a verified pricing configuration (see cost_estimator.ts's existing pattern) — null otherwise, never a guess. */
  estimatedCostUsd: number | null;
  userId: string | null;
}

export interface UsageMeter {
  record(event: UsageEvent): void;
  /** All events, newest first — for diagnostics/tests. Never exposes raw OCR text or full field values (events never carry those fields to begin with). */
  getEvents(): readonly UsageEvent[];
  /** Counts matching a predicate — used by budget_policy.ts's AiCallHistory computation. */
  countMatching(predicate: (event: UsageEvent) => boolean): number;
}

export class InMemoryUsageMeter implements UsageMeter {
  private readonly events: UsageEvent[] = [];

  record(event: UsageEvent): void {
    this.events.unshift(event);
  }

  getEvents(): readonly UsageEvent[] {
    return this.events;
  }

  countMatching(predicate: (event: UsageEvent) => boolean): number {
    return this.events.filter(predicate).length;
  }
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}
function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/**
 * Derives budget_policy.ts's AiCallHistory shape from the meter's recorded
 * events — the one place "how many AI calls has this document/day/month/
 * user already used" is computed, so the pipeline never hand-rolls this
 * counting logic inline.
 */
export function computeAiCallHistory(
  meter: UsageMeter,
  input: { documentFingerprint: string; userId: string | null; asOf?: Date }
): { callsForThisDocument: number; callsToday: number; callsThisMonth: number; callsTodayForThisUser: number } {
  const asOf = input.asOf ?? new Date();
  const isAiEvent = (e: UsageEvent) => e.aiProviderUsed !== null;

  return {
    callsForThisDocument: meter.countMatching((e) => isAiEvent(e) && e.documentFingerprint === input.documentFingerprint),
    callsToday: meter.countMatching((e) => isAiEvent(e) && isSameUtcDay(new Date(e.timestamp), asOf)),
    callsThisMonth: meter.countMatching((e) => isAiEvent(e) && isSameUtcMonth(new Date(e.timestamp), asOf)),
    callsTodayForThisUser: meter.countMatching(
      (e) => isAiEvent(e) && e.userId === input.userId && isSameUtcDay(new Date(e.timestamp), asOf)
    ),
  };
}
