import { test } from "node:test";
import assert from "node:assert/strict";

import { computeBudgetSnapshot } from "@/lib/extraction/budget_tracker";
import { InMemoryUsageMeter, type UsageEvent } from "@/lib/extraction/usage_meter";
import { DEFAULT_AI_USAGE_POLICY, type AiUsagePolicy } from "@/lib/extraction/budget_policy";

function aiEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    timestamp: new Date().toISOString(),
    documentFingerprint: "fp-1",
    ocrProviderUsed: null,
    aiProviderUsed: "openai",
    aiModelUsed: "gpt-5.5",
    aiCallReason: "LOW_OCR_CONFIDENCE",
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

test("unlimited policy (nulls) reports null remaining, never a fabricated number", () => {
  const meter = new InMemoryUsageMeter();
  const snapshot = computeBudgetSnapshot(DEFAULT_AI_USAGE_POLICY, meter, { userId: null });
  assert.equal(snapshot.dailyLimit, null);
  assert.equal(snapshot.dailyRemaining, null);
  assert.equal(snapshot.monthlyRemaining, null);
  assert.equal(snapshot.budgetExhausted, false);
});

test("daily limit reached -> budgetExhausted true, dailyRemaining 0", () => {
  const meter = new InMemoryUsageMeter();
  meter.record(aiEvent());
  meter.record(aiEvent());
  const policy: AiUsagePolicy = { ...DEFAULT_AI_USAGE_POLICY, dailyCallLimit: 2 };
  const snapshot = computeBudgetSnapshot(policy, meter, { userId: null });
  assert.equal(snapshot.dailyCalls, 2);
  assert.equal(snapshot.dailyRemaining, 0);
  assert.equal(snapshot.budgetExhausted, true);
});

test("remaining never goes negative even if calls somehow exceed the limit", () => {
  const meter = new InMemoryUsageMeter();
  for (let i = 0; i < 5; i++) meter.record(aiEvent());
  const policy: AiUsagePolicy = { ...DEFAULT_AI_USAGE_POLICY, dailyCallLimit: 2 };
  const snapshot = computeBudgetSnapshot(policy, meter, { userId: null });
  assert.equal(snapshot.dailyRemaining, 0);
});

test("per-user tracking is null when no userId is supplied, even if a limit is configured", () => {
  const meter = new InMemoryUsageMeter();
  const policy: AiUsagePolicy = { ...DEFAULT_AI_USAGE_POLICY, perUserDailyLimit: 3 };
  const snapshot = computeBudgetSnapshot(policy, meter, { userId: null });
  assert.equal(snapshot.perUserDailyCalls, null);
  assert.equal(snapshot.perUserDailyRemaining, null);
});

test("per-user limit reached for one user does not exhaust another user's budget", () => {
  const meter = new InMemoryUsageMeter();
  meter.record(aiEvent({ userId: "user-1" }));
  meter.record(aiEvent({ userId: "user-1" }));
  const policy: AiUsagePolicy = { ...DEFAULT_AI_USAGE_POLICY, perUserDailyLimit: 2 };

  const snapshotUser1 = computeBudgetSnapshot(policy, meter, { userId: "user-1" });
  assert.equal(snapshotUser1.budgetExhausted, true);

  const snapshotUser2 = computeBudgetSnapshot(policy, meter, { userId: "user-2" });
  assert.equal(snapshotUser2.perUserDailyCalls, 0);
  assert.equal(snapshotUser2.budgetExhausted, false);
});

test("aiDisabled reflects policy.aiFallbackEnabled independently of any numeric budget", () => {
  const meter = new InMemoryUsageMeter();
  const policy: AiUsagePolicy = { ...DEFAULT_AI_USAGE_POLICY, aiFallbackEnabled: false };
  const snapshot = computeBudgetSnapshot(policy, meter, { userId: null });
  assert.equal(snapshot.aiDisabled, true);
  assert.equal(snapshot.budgetExhausted, false, "disabled and exhausted are distinct states");
});

test("only AI events count toward budget — OCR-only events are ignored", () => {
  const meter = new InMemoryUsageMeter();
  meter.record({ ...aiEvent(), aiProviderUsed: null, aiModelUsed: null });
  meter.record({ ...aiEvent(), aiProviderUsed: null, aiModelUsed: null });
  const policy: AiUsagePolicy = { ...DEFAULT_AI_USAGE_POLICY, dailyCallLimit: 5 };
  const snapshot = computeBudgetSnapshot(policy, meter, { userId: null });
  assert.equal(snapshot.dailyCalls, 0);
});
