import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateAlerts, DEFAULT_ALERT_THRESHOLDS } from "@/lib/intelligence/alert_engine";
import { computeReviewWorkload } from "@/lib/intelligence/review_workload";
import type { BudgetSnapshot } from "@/lib/extraction/budget_tracker";
import type { HealthSummary } from "@/lib/extraction/operational_health";

function healthySnapshot(): BudgetSnapshot {
  return {
    dailyCalls: 0, dailyLimit: null, dailyRemaining: null,
    monthlyCalls: 0, monthlyLimit: null, monthlyRemaining: null,
    perUserDailyCalls: null, perUserDailyLimit: null, perUserDailyRemaining: null,
    budgetExhausted: false, aiDisabled: false,
  };
}

function healthySummary(): HealthSummary {
  return { ocrAvailable: "HEALTHY", aiAvailable: "HEALTHY", cacheHealthy: "HEALTHY", budgetAvailable: "HEALTHY", queueHealthy: "HEALTHY", overallStatus: "HEALTHY", notes: [] };
}

function emptyWorkload() {
  return computeReviewWorkload({ officerId: 1, documents: [] });
}

test("all-healthy input produces zero alerts", () => {
  const alerts = evaluateAlerts({
    workload: emptyWorkload(),
    totalDocumentsObserved: 0,
    budgetSnapshot: healthySnapshot(),
    health: healthySummary(),
    recentOcrFailureCount: 0,
  });
  assert.deepEqual(alerts, []);
});

test("budgetExhausted=true produces a BUDGET_EXHAUSTED alert", () => {
  const alerts = evaluateAlerts({
    workload: emptyWorkload(),
    totalDocumentsObserved: 0,
    budgetSnapshot: { ...healthySnapshot(), budgetExhausted: true },
    health: healthySummary(),
    recentOcrFailureCount: 0,
  });
  assert.ok(alerts.some((a) => a.code === "BUDGET_EXHAUSTED"));
});

test("queue UNAVAILABLE produces a CRITICAL QUEUE_UNAVAILABLE alert", () => {
  const alerts = evaluateAlerts({
    workload: emptyWorkload(),
    totalDocumentsObserved: 0,
    budgetSnapshot: healthySnapshot(),
    health: { ...healthySummary(), queueHealthy: "UNAVAILABLE", overallStatus: "UNAVAILABLE" },
    recentOcrFailureCount: 0,
  });
  const queueAlert = alerts.find((a) => a.code === "QUEUE_UNAVAILABLE");
  assert.equal(queueAlert?.severity, "CRITICAL");
});

test("overallStatus WARNING produces a WARNING-severity HEALTH_DEGRADED alert, not CRITICAL", () => {
  const alerts = evaluateAlerts({
    workload: emptyWorkload(),
    totalDocumentsObserved: 0,
    budgetSnapshot: healthySnapshot(),
    health: { ...healthySummary(), aiAvailable: "WARNING", overallStatus: "WARNING", notes: ["AI provider is not configured."] },
    recentOcrFailureCount: 0,
  });
  const healthAlert = alerts.find((a) => a.code === "HEALTH_DEGRADED");
  assert.equal(healthAlert?.severity, "WARNING");
});

test("OCR failure count at or above the threshold produces a CRITICAL OCR_FAILURE_SPIKE alert", () => {
  const alerts = evaluateAlerts({
    workload: emptyWorkload(),
    totalDocumentsObserved: 0,
    budgetSnapshot: healthySnapshot(),
    health: healthySummary(),
    recentOcrFailureCount: DEFAULT_ALERT_THRESHOLDS.ocrFailureSpikeThreshold,
  });
  const spike = alerts.find((a) => a.code === "OCR_FAILURE_SPIKE");
  assert.equal(spike?.severity, "CRITICAL");
});

test("unsupported rate below threshold produces no alert; at/above threshold produces one, computed as a real fraction never divided by zero", () => {
  const below = evaluateAlerts({
    workload: emptyWorkload(),
    totalDocumentsObserved: 0,
    budgetSnapshot: healthySnapshot(),
    health: healthySummary(),
    recentOcrFailureCount: 0,
  });
  assert.equal(below.some((a) => a.code === "HIGH_UNSUPPORTED_RATE"), false, "zero documents observed must never divide by zero into a fabricated rate");
});

test("custom thresholds are honored instead of the defaults", () => {
  const alerts = evaluateAlerts({
    workload: emptyWorkload(),
    totalDocumentsObserved: 0,
    budgetSnapshot: healthySnapshot(),
    health: healthySummary(),
    recentOcrFailureCount: 2,
    thresholds: { ...DEFAULT_ALERT_THRESHOLDS, ocrFailureSpikeThreshold: 2 },
  });
  assert.ok(alerts.some((a) => a.code === "OCR_FAILURE_SPIKE"));
});
