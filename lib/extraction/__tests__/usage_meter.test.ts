import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryUsageMeter, computeAiCallHistory, type UsageEvent } from "@/lib/extraction/usage_meter";

function event(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    timestamp: new Date().toISOString(),
    documentFingerprint: "fp-1",
    ocrProviderUsed: "local_ocr",
    aiProviderUsed: null,
    aiModelUsed: null,
    aiCallReason: null,
    cacheResult: "miss",
    outcome: "success",
    processingDurationMs: 100,
    inputPages: 1,
    tokenUsage: null,
    estimatedCostUsd: null,
    userId: "user-1",
    ...overrides,
  };
}

test("records and retrieves events, newest first", () => {
  const meter = new InMemoryUsageMeter();
  meter.record(event({ documentFingerprint: "a" }));
  meter.record(event({ documentFingerprint: "b" }));
  const events = meter.getEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].documentFingerprint, "b");
});

test("countMatching filters correctly", () => {
  const meter = new InMemoryUsageMeter();
  meter.record(event({ aiProviderUsed: "openai" }));
  meter.record(event({ aiProviderUsed: null }));
  assert.equal(meter.countMatching((e) => e.aiProviderUsed !== null), 1);
});

test("computeAiCallHistory: counts only AI events (aiProviderUsed !== null) for a specific document", () => {
  const meter = new InMemoryUsageMeter();
  meter.record(event({ documentFingerprint: "fp-1", aiProviderUsed: "openai" }));
  meter.record(event({ documentFingerprint: "fp-1", aiProviderUsed: null })); // OCR-only, not an AI call
  meter.record(event({ documentFingerprint: "fp-2", aiProviderUsed: "openai" }));

  const history = computeAiCallHistory(meter, { documentFingerprint: "fp-1", userId: "user-1" });
  assert.equal(history.callsForThisDocument, 1);
});

test("computeAiCallHistory: counts calls today vs. a different day", () => {
  const meter = new InMemoryUsageMeter();
  const today = new Date("2026-07-20T10:00:00Z");
  const yesterday = new Date("2026-07-19T10:00:00Z");

  meter.record(event({ aiProviderUsed: "openai", timestamp: today.toISOString() }));
  meter.record(event({ aiProviderUsed: "openai", timestamp: yesterday.toISOString() }));

  const history = computeAiCallHistory(meter, { documentFingerprint: "fp-x", userId: "user-1", asOf: today });
  assert.equal(history.callsToday, 1);
});

test("computeAiCallHistory: per-user daily count only counts the matching user", () => {
  const meter = new InMemoryUsageMeter();
  const now = new Date("2026-07-20T10:00:00Z");
  meter.record(event({ aiProviderUsed: "openai", userId: "user-A", timestamp: now.toISOString() }));
  meter.record(event({ aiProviderUsed: "openai", userId: "user-B", timestamp: now.toISOString() }));

  const history = computeAiCallHistory(meter, { documentFingerprint: "fp-x", userId: "user-A", asOf: now });
  assert.equal(history.callsTodayForThisUser, 1);
});

test("no usage events recorded -> all counts are zero, never crashes", () => {
  const meter = new InMemoryUsageMeter();
  const history = computeAiCallHistory(meter, { documentFingerprint: "fp-none", userId: null });
  assert.deepEqual(history, { callsForThisDocument: 0, callsToday: 0, callsThisMonth: 0, callsTodayForThisUser: 0 });
});
