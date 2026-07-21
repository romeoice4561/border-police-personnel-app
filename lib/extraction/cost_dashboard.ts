/**
 * AI cost intelligence dashboard view model (Phase 48B — spec §1).
 *
 * A pure aggregation over already-recorded runtime data — this module
 * introduces NO new counters of its own; every figure below is derived
 * from observability.ts's RuntimeEvent stream, usage_meter.ts's UsageEvent
 * stream, or processing_queue.ts's live queue state. If a metric cannot be
 * computed from real recorded events (e.g. zero requests so far), it is
 * reported as 0 or null — never guessed or interpolated.
 *
 * "Estimated AI Avoidance" is the one figure spec §1 explicitly warns
 * against fabricating: it is computed ONLY as
 * (ocrRequests - aiConfirmed) / ocrRequests from the actual event counts
 * in the provided emitter, and is null when ocrRequests is 0 (nothing to
 * divide by, not "0% avoidance").
 *
 * Pure — no I/O, no React.
 */

import type { ObservabilityEmitter } from "@/lib/extraction/observability";
import type { UsageMeter } from "@/lib/extraction/usage_meter";
import type { ProcessingQueue } from "@/lib/extraction/processing_queue";

export interface CostDashboardMetrics {
  ocrRequests: number;
  ocrCacheHits: number;
  ocrCacheMisses: number;
  duplicateDocuments: number;
  aiRecommendations: number;
  aiConfirmed: number;
  aiCancelled: number;
  aiCallsBlocked: number;
  manualReviews: number;
  documentsCompleted: number;
  /** Milliseconds. null when there is no recorded OCR duration data yet. */
  averageOcrTimeMs: number | null;
  /** Milliseconds. null when there is no recorded AI duration data yet. */
  averageAiTimeMs: number | null;
  currentQueueSize: number;
  /**
   * Fraction 0-1 of OCR requests that did NOT result in a confirmed AI
   * call — i.e. how much of the traffic the deterministic pipeline alone
   * handled. null when ocrRequests is 0 (spec §1: never fabricate this).
   */
  estimatedAiAvoidance: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeCostDashboardMetrics(
  observability: ObservabilityEmitter,
  usageMeter: UsageMeter,
  queue: ProcessingQueue
): CostDashboardMetrics {
  const ocrCacheHits = observability.countByType("CACHE_HIT");
  const ocrCacheMisses = observability.countByType("CACHE_MISS");
  const ocrRequests = ocrCacheHits + ocrCacheMisses;

  const aiRecommendations = observability.countByType("AI_RECOMMENDED");
  const aiConfirmed = observability.countByType("AI_CONFIRMED");
  const aiCancelled = observability.countByType("AI_CANCELLED");
  const aiCallsBlocked = observability.countByType("AI_BLOCKED");
  const documentsCompleted = observability.countByType("EXTRACTION_COMPLETED");

  const manualReviews = observability
    .getEvents()
    .filter((e) => e.type === "EXTRACTION_COMPLETED" && e.detail.riskLevel === "NEEDS_REVIEW").length;

  const usageEvents = usageMeter.getEvents();
  const ocrDurations = usageEvents.filter((e) => e.ocrProviderUsed !== null).map((e) => e.processingDurationMs);
  const aiDurations = usageEvents.filter((e) => e.aiProviderUsed !== null).map((e) => e.processingDurationMs);

  return {
    ocrRequests,
    ocrCacheHits,
    ocrCacheMisses,
    // A cache hit IS a duplicate under this pipeline's exact-fingerprint
    // cache (see extraction_pipeline.ts) — no separate counter invented.
    duplicateDocuments: ocrCacheHits,
    aiRecommendations,
    aiConfirmed,
    aiCancelled,
    aiCallsBlocked,
    manualReviews,
    documentsCompleted,
    averageOcrTimeMs: average(ocrDurations),
    averageAiTimeMs: average(aiDurations),
    currentQueueSize: queue.activeCount(),
    estimatedAiAvoidance: ocrRequests > 0 ? (ocrRequests - aiConfirmed) / ocrRequests : null,
  };
}
