/**
 * Operational health summary (Phase 48B — spec §9).
 *
 * Aggregates the availability of each dependency the extraction pipeline
 * relies on into one glanceable status. Every individual check reuses a
 * capability the container/policy modules already expose — this module
 * adds no new probing, no network calls, no polling; it only reads what's
 * already known synchronously (e.g. "is the AI provider configured" is
 * ExtractionContainer.aiProviderConfigured, not a new health-check ping).
 *
 * Pure — no I/O, no React.
 */

import type { ExtractionCache } from "@/lib/extraction/extraction_cache";
import type { AiUsagePolicy } from "@/lib/extraction/budget_policy";
import type { BudgetSnapshot } from "@/lib/extraction/budget_tracker";
import type { ProcessingQueue } from "@/lib/extraction/processing_queue";

export type ComponentHealth = "HEALTHY" | "WARNING" | "UNAVAILABLE";

export interface HealthSummary {
  ocrAvailable: ComponentHealth;
  aiAvailable: ComponentHealth;
  cacheHealthy: ComponentHealth;
  budgetAvailable: ComponentHealth;
  queueHealthy: ComponentHealth;
  overallStatus: ComponentHealth;
  /** Human-readable notes for any component not HEALTHY — empty when everything is healthy. */
  notes: string[];
}

/** Worse-of, used to fold per-component statuses into overallStatus — UNAVAILABLE always dominates WARNING, which always dominates HEALTHY. */
function worseOf(a: ComponentHealth, b: ComponentHealth): ComponentHealth {
  const rank: Record<ComponentHealth, number> = { HEALTHY: 0, WARNING: 1, UNAVAILABLE: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export interface HealthCheckInput {
  /** True as long as an OCREngine is injected — Tesseract itself has no separate "is it up" probe (it's a local, in-process library, not a remote service), so this reflects wiring, not runtime availability. */
  ocrEngineConfigured: boolean;
  aiProviderConfigured: boolean;
  cache: ExtractionCache;
  usagePolicy: AiUsagePolicy;
  budgetSnapshot: BudgetSnapshot;
  queue: ProcessingQueue;
  /** A queue backlog at/above this many active items is reported as WARNING, not UNAVAILABLE — the pipeline stays synchronous in this phase, so a nonzero queue only ever reflects in-flight requests, never a stuck backlog. */
  queueWarningThreshold: number;
}

export function computeHealthSummary(input: HealthCheckInput): HealthSummary {
  const notes: string[] = [];

  const ocrAvailable: ComponentHealth = input.ocrEngineConfigured ? "HEALTHY" : "UNAVAILABLE";
  if (ocrAvailable !== "HEALTHY") notes.push("No OCR engine is configured.");

  const aiAvailable: ComponentHealth = input.aiProviderConfigured ? "HEALTHY" : "WARNING";
  if (aiAvailable !== "HEALTHY") notes.push("AI provider is not configured — Tier 1/Tier 2 extraction still works.");

  // The cache is an in-process object; "healthy" here means it exists and
  // responds to a lookup without throwing — a synchronous, zero-cost check,
  // never a fabricated uptime metric.
  let cacheHealthy: ComponentHealth = "HEALTHY";
  try {
    input.cache.get("__health_check__");
  } catch {
    cacheHealthy = "UNAVAILABLE";
    notes.push("Extraction cache threw on a lookup.");
  }

  let budgetAvailable: ComponentHealth = "HEALTHY";
  if (input.budgetSnapshot.aiDisabled) {
    budgetAvailable = "WARNING";
    notes.push("AI fallback is disabled by policy.");
  } else if (input.budgetSnapshot.budgetExhausted) {
    budgetAvailable = "WARNING";
    notes.push("AI budget is exhausted for the current period.");
  }

  const activeCount = input.queue.activeCount();
  const queueHealthy: ComponentHealth = activeCount >= input.queueWarningThreshold ? "WARNING" : "HEALTHY";
  if (queueHealthy !== "HEALTHY") notes.push(`Queue has ${activeCount} active items (threshold ${input.queueWarningThreshold}).`);

  const overallStatus = [ocrAvailable, aiAvailable, cacheHealthy, budgetAvailable, queueHealthy].reduce(worseOf, "HEALTHY" as ComponentHealth);

  return { ocrAvailable, aiAvailable, cacheHealthy, budgetAvailable, queueHealthy, overallStatus, notes };
}
