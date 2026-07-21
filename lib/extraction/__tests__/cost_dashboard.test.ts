import { test } from "node:test";
import assert from "node:assert/strict";

import { computeCostDashboardMetrics } from "@/lib/extraction/cost_dashboard";
import { InMemoryObservabilityEmitter } from "@/lib/extraction/observability";
import { InMemoryUsageMeter } from "@/lib/extraction/usage_meter";
import { InMemoryProcessingQueue } from "@/lib/extraction/processing_queue";

test("zero activity -> all counts zero, estimatedAiAvoidance is null (never fabricated 0%/100%)", () => {
  const metrics = computeCostDashboardMetrics(new InMemoryObservabilityEmitter(), new InMemoryUsageMeter(), new InMemoryProcessingQueue());
  assert.equal(metrics.ocrRequests, 0);
  assert.equal(metrics.estimatedAiAvoidance, null);
  assert.equal(metrics.averageOcrTimeMs, null);
  assert.equal(metrics.averageAiTimeMs, null);
});

test("cache hits count as both OCR requests and duplicate documents", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "CACHE_HIT", documentFingerprint: "a", detail: {} });
  emitter.emit({ type: "CACHE_MISS", documentFingerprint: "b", detail: {} });
  const metrics = computeCostDashboardMetrics(emitter, new InMemoryUsageMeter(), new InMemoryProcessingQueue());
  assert.equal(metrics.ocrRequests, 2);
  assert.equal(metrics.ocrCacheHits, 1);
  assert.equal(metrics.ocrCacheMisses, 1);
  assert.equal(metrics.duplicateDocuments, 1);
});

test("estimatedAiAvoidance = (ocrRequests - aiConfirmed) / ocrRequests, computed only from real counters", () => {
  const emitter = new InMemoryObservabilityEmitter();
  for (let i = 0; i < 10; i++) emitter.emit({ type: "CACHE_MISS", documentFingerprint: `d${i}`, detail: {} });
  emitter.emit({ type: "AI_CONFIRMED", documentFingerprint: "d0", detail: {} });
  emitter.emit({ type: "AI_CONFIRMED", documentFingerprint: "d1", detail: {} });
  const metrics = computeCostDashboardMetrics(emitter, new InMemoryUsageMeter(), new InMemoryProcessingQueue());
  assert.equal(metrics.ocrRequests, 10);
  assert.equal(metrics.aiConfirmed, 2);
  assert.equal(metrics.estimatedAiAvoidance, 0.8);
});

test("average OCR/AI time is computed only from usage_meter durations, split by provider type", () => {
  const meter = new InMemoryUsageMeter();
  meter.record({
    timestamp: new Date().toISOString(), documentFingerprint: "a", ocrProviderUsed: "local_ocr", aiProviderUsed: null,
    aiModelUsed: null, aiCallReason: null, cacheResult: "miss", outcome: "success", processingDurationMs: 100,
    inputPages: 1, tokenUsage: null, estimatedCostUsd: null, userId: null,
  });
  meter.record({
    timestamp: new Date().toISOString(), documentFingerprint: "b", ocrProviderUsed: "local_ocr", aiProviderUsed: null,
    aiModelUsed: null, aiCallReason: null, cacheResult: "miss", outcome: "success", processingDurationMs: 200,
    inputPages: 1, tokenUsage: null, estimatedCostUsd: null, userId: null,
  });
  meter.record({
    timestamp: new Date().toISOString(), documentFingerprint: "c", ocrProviderUsed: null, aiProviderUsed: "openai",
    aiModelUsed: "gpt-5.5", aiCallReason: "LOW_OCR_CONFIDENCE", cacheResult: "miss", outcome: "success", processingDurationMs: 3000,
    inputPages: 1, tokenUsage: null, estimatedCostUsd: null, userId: null,
  });
  const metrics = computeCostDashboardMetrics(new InMemoryObservabilityEmitter(), meter, new InMemoryProcessingQueue());
  assert.equal(metrics.averageOcrTimeMs, 150);
  assert.equal(metrics.averageAiTimeMs, 3000);
});

test("manualReviews counts only EXTRACTION_COMPLETED events flagged NEEDS_REVIEW in detail", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "a", detail: { riskLevel: "SAFE" } });
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "b", detail: { riskLevel: "NEEDS_REVIEW" } });
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "c", detail: { riskLevel: "SENSITIVE" } });
  const metrics = computeCostDashboardMetrics(emitter, new InMemoryUsageMeter(), new InMemoryProcessingQueue());
  assert.equal(metrics.documentsCompleted, 3);
  assert.equal(metrics.manualReviews, 1);
});

test("currentQueueSize reflects the live queue's activeCount", () => {
  const queue = new InMemoryProcessingQueue();
  queue.enqueue({ id: "1", documentFingerprint: "a", priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  const metrics = computeCostDashboardMetrics(new InMemoryObservabilityEmitter(), new InMemoryUsageMeter(), queue);
  assert.equal(metrics.currentQueueSize, 1);
});
