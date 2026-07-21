/**
 * Commander-friendly summary view model (Phase 48B — spec §11).
 *
 * A higher-level read model over the same event streams cost_dashboard.ts
 * uses, reshaped for a non-technical "what happened today, what needs my
 * attention" summary rather than raw operational counters. No new UI is
 * built for this in this phase (per explicit instruction) — this is a pure
 * builder function the future commander page/panel will call.
 *
 * Every ranked list ("most common document types," "top validation
 * failures," etc.) is built purely by counting values already present in
 * RuntimeEvent.detail — nothing here invents data the pipeline didn't
 * already record. A field being absent from recorded events (e.g. no
 * events carried a documentType) simply yields an empty list, not a
 * fabricated placeholder entry.
 *
 * Pure — no I/O, no React.
 */

import type { ObservabilityEmitter, RuntimeEvent } from "@/lib/extraction/observability";
import type { UsageMeter } from "@/lib/extraction/usage_meter";
import type { BudgetSnapshot } from "@/lib/extraction/budget_tracker";

export interface RankedCount {
  key: string;
  count: number;
}

export interface CommanderSummary {
  todaysOcrCount: number;
  todaysAiCount: number;
  documentsPendingReview: number;
  budgetRemaining: BudgetSnapshot;
  mostCommonDocumentTypes: RankedCount[];
  topValidationFailures: RankedCount[];
  topOcrErrors: RankedCount[];
  topDuplicateDocuments: RankedCount[];
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

function rankBy(events: readonly RuntimeEvent[], detailKey: string, limit: number): RankedCount[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const value = event.detail[detailKey];
    if (typeof value !== "string" || value.length === 0) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function buildCommanderSummary(
  observability: ObservabilityEmitter,
  usageMeter: UsageMeter,
  budgetSnapshot: BudgetSnapshot,
  options: { asOf?: Date; topN?: number } = {}
): CommanderSummary {
  const asOf = options.asOf ?? new Date();
  const topN = options.topN ?? 5;
  const events = observability.getEvents();
  const todaysEvents = events.filter((e) => isSameUtcDay(new Date(e.timestamp), asOf));

  const todaysOcrCount = todaysEvents.filter((e) => e.type === "CACHE_HIT" || e.type === "CACHE_MISS").length;
  const todaysAiCount = todaysEvents.filter((e) => e.type === "AI_CONFIRMED").length;
  const documentsPendingReview = events.filter(
    (e) => e.type === "EXTRACTION_COMPLETED" && e.detail.riskLevel === "NEEDS_REVIEW"
  ).length;

  const validationFailureEvents = events.filter((e) => e.type === "VALIDATION_FAILED");
  const ocrFailureEvents = events.filter((e) => e.type === "OCR_FINISHED" && e.detail.outcome === "failure");
  const duplicateEvents = events.filter((e) => e.type === "CACHE_HIT");
  const completedEvents = events.filter((e) => e.type === "EXTRACTION_COMPLETED");

  return {
    todaysOcrCount,
    todaysAiCount,
    documentsPendingReview,
    budgetRemaining: budgetSnapshot,
    mostCommonDocumentTypes: rankBy(completedEvents, "documentType", topN),
    topValidationFailures: rankBy(validationFailureEvents, "fieldCode", topN),
    topOcrErrors: rankBy(ocrFailureEvents, "errorCode", topN),
    topDuplicateDocuments: rankBy(duplicateEvents, "documentType", topN),
  };
}
