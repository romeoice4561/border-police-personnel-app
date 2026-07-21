import { test } from "node:test";
import assert from "node:assert/strict";

import { computeHealthSummary } from "@/lib/extraction/operational_health";
import { InMemoryExtractionCache } from "@/lib/extraction/extraction_cache";
import { InMemoryProcessingQueue } from "@/lib/extraction/processing_queue";
import { DEFAULT_AI_USAGE_POLICY } from "@/lib/extraction/budget_policy";
import { computeBudgetSnapshot } from "@/lib/extraction/budget_tracker";
import { InMemoryUsageMeter } from "@/lib/extraction/usage_meter";

function healthyInput(overrides: Partial<Parameters<typeof computeHealthSummary>[0]> = {}) {
  const cache = new InMemoryExtractionCache();
  const queue = new InMemoryProcessingQueue();
  const meter = new InMemoryUsageMeter();
  const budgetSnapshot = computeBudgetSnapshot(DEFAULT_AI_USAGE_POLICY, meter, { userId: null });
  return {
    ocrEngineConfigured: true,
    aiProviderConfigured: true,
    cache,
    usagePolicy: DEFAULT_AI_USAGE_POLICY,
    budgetSnapshot,
    queue,
    queueWarningThreshold: 10,
    ...overrides,
  };
}

test("all components healthy -> overallStatus HEALTHY, no notes", () => {
  const summary = computeHealthSummary(healthyInput());
  assert.equal(summary.overallStatus, "HEALTHY");
  assert.deepEqual(summary.notes, []);
});

test("no OCR engine configured -> UNAVAILABLE dominates overall status", () => {
  const summary = computeHealthSummary(healthyInput({ ocrEngineConfigured: false }));
  assert.equal(summary.ocrAvailable, "UNAVAILABLE");
  assert.equal(summary.overallStatus, "UNAVAILABLE");
});

test("AI not configured -> WARNING, not UNAVAILABLE (OCR-only still works)", () => {
  const summary = computeHealthSummary(healthyInput({ aiProviderConfigured: false }));
  assert.equal(summary.aiAvailable, "WARNING");
  assert.equal(summary.overallStatus, "WARNING");
});

test("budget exhausted -> budgetAvailable WARNING", () => {
  const meter = new InMemoryUsageMeter();
  meter.record({
    timestamp: new Date().toISOString(),
    documentFingerprint: "fp",
    ocrProviderUsed: null,
    aiProviderUsed: "openai",
    aiModelUsed: "gpt-5.5",
    aiCallReason: "LOW_OCR_CONFIDENCE",
    cacheResult: "miss",
    outcome: "success",
    processingDurationMs: 1,
    inputPages: 1,
    tokenUsage: null,
    estimatedCostUsd: null,
    userId: null,
  });
  const policy = { ...DEFAULT_AI_USAGE_POLICY, dailyCallLimit: 1 };
  const budgetSnapshot = computeBudgetSnapshot(policy, meter, { userId: null });
  const summary = computeHealthSummary(healthyInput({ usagePolicy: policy, budgetSnapshot }));
  assert.equal(summary.budgetAvailable, "WARNING");
});

test("queue at or above the warning threshold -> queueHealthy WARNING", () => {
  const queue = new InMemoryProcessingQueue();
  queue.enqueue({ id: "1", documentFingerprint: "fp1", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  queue.enqueue({ id: "2", documentFingerprint: "fp2", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  const summary = computeHealthSummary(healthyInput({ queue, queueWarningThreshold: 2 }));
  assert.equal(summary.queueHealthy, "WARNING");
});

test("overall status is the WORST of all components, never averaged or hidden", () => {
  const summary = computeHealthSummary(healthyInput({ ocrEngineConfigured: false, aiProviderConfigured: false }));
  assert.equal(summary.overallStatus, "UNAVAILABLE", "UNAVAILABLE must dominate even when AI's own status is only WARNING");
});
