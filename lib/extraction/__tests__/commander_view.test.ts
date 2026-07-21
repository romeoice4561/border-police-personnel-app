import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCommanderSummary } from "@/lib/extraction/commander_view";
import { InMemoryObservabilityEmitter } from "@/lib/extraction/observability";
import { InMemoryUsageMeter } from "@/lib/extraction/usage_meter";
import { computeBudgetSnapshot } from "@/lib/extraction/budget_tracker";
import { DEFAULT_AI_USAGE_POLICY } from "@/lib/extraction/budget_policy";

function budgetSnapshot() {
  return computeBudgetSnapshot(DEFAULT_AI_USAGE_POLICY, new InMemoryUsageMeter(), { userId: null });
}

test("empty event stream -> all counts zero, all ranked lists empty (never fabricated placeholder entries)", () => {
  const summary = buildCommanderSummary(new InMemoryObservabilityEmitter(), new InMemoryUsageMeter(), budgetSnapshot());
  assert.equal(summary.todaysOcrCount, 0);
  assert.equal(summary.todaysAiCount, 0);
  assert.deepEqual(summary.mostCommonDocumentTypes, []);
  assert.deepEqual(summary.topValidationFailures, []);
});

test("mostCommonDocumentTypes ranks by frequency, most common first", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "a", detail: { documentType: "NATIONAL_ID" } });
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "b", detail: { documentType: "NATIONAL_ID" } });
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "c", detail: { documentType: "PASSPORT" } });
  const summary = buildCommanderSummary(emitter, new InMemoryUsageMeter(), budgetSnapshot());
  assert.deepEqual(summary.mostCommonDocumentTypes[0], { key: "NATIONAL_ID", count: 2 });
  assert.deepEqual(summary.mostCommonDocumentTypes[1], { key: "PASSPORT", count: 1 });
});

test("topValidationFailures ranks VALIDATION_FAILED events by fieldCode", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "VALIDATION_FAILED", documentFingerprint: "a", detail: { fieldCode: "expiryDate" } });
  emitter.emit({ type: "VALIDATION_FAILED", documentFingerprint: "b", detail: { fieldCode: "expiryDate" } });
  emitter.emit({ type: "VALIDATION_FAILED", documentFingerprint: "c", detail: { fieldCode: "nationalId" } });
  const summary = buildCommanderSummary(emitter, new InMemoryUsageMeter(), budgetSnapshot());
  assert.deepEqual(summary.topValidationFailures[0], { key: "expiryDate", count: 2 });
});

test("todaysOcrCount only counts events from the same UTC day as asOf", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "CACHE_MISS", documentFingerprint: "a", detail: {} });
  const summary = buildCommanderSummary(emitter, new InMemoryUsageMeter(), budgetSnapshot(), { asOf: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
  assert.equal(summary.todaysOcrCount, 0, "an event from a different day must not count toward today's total");
});

test("documentsPendingReview counts NEEDS_REVIEW extractions across all recorded history, not just today", () => {
  const emitter = new InMemoryObservabilityEmitter();
  emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: "a", detail: { riskLevel: "NEEDS_REVIEW" } });
  const summary = buildCommanderSummary(emitter, new InMemoryUsageMeter(), budgetSnapshot(), { asOf: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
  assert.equal(summary.documentsPendingReview, 1);
});

test("topN option limits ranked list length", () => {
  const emitter = new InMemoryObservabilityEmitter();
  for (const type of ["A", "B", "C", "D", "E", "F"]) {
    emitter.emit({ type: "EXTRACTION_COMPLETED", documentFingerprint: type, detail: { documentType: type } });
  }
  const summary = buildCommanderSummary(emitter, new InMemoryUsageMeter(), budgetSnapshot(), { topN: 3 });
  assert.equal(summary.mostCommonDocumentTypes.length, 3);
});

test("budgetRemaining passes through the exact supplied snapshot, unmodified", () => {
  const snapshot = budgetSnapshot();
  const summary = buildCommanderSummary(new InMemoryObservabilityEmitter(), new InMemoryUsageMeter(), snapshot);
  assert.equal(summary.budgetRemaining, snapshot);
});
