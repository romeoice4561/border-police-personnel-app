/**
 * Alert Engine (Phase 48C — spec §7).
 *
 * Prepares alert OBJECTS from already-computed state (ReviewWorkload,
 * BudgetSnapshot, HealthSummary, plus one configurable threshold for
 * "unsupported rate" and "OCR failure spike"). This module never sends a
 * notification, never has a side effect, and never calls any transport
 * (email/Slack/push) — per spec §7's explicit "No notifications," it only
 * returns a list of Alert records a future notifier could consume.
 *
 * Every alert's severity/message is derived from real numbers already
 * computed elsewhere (review_workload.ts, budget_tracker.ts,
 * operational_health.ts, cost_dashboard.ts) — this module composes, it
 * does not re-derive.
 *
 * Pure — no I/O, no React, no notification transport.
 */

import type { ReviewWorkload } from "@/lib/intelligence/review_workload";
import { pendingReviewTotal, unsupportedDocumentCount } from "@/lib/intelligence/kpi_definitions";
import type { BudgetSnapshot } from "@/lib/extraction/budget_tracker";
import type { HealthSummary } from "@/lib/extraction/operational_health";

export type AlertCode =
  | "REVIEW_BACKLOG"
  | "HIGH_UNSUPPORTED_RATE"
  | "OCR_FAILURE_SPIKE"
  | "BUDGET_EXHAUSTED"
  | "QUEUE_UNAVAILABLE"
  | "HEALTH_DEGRADED";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface Alert {
  code: AlertCode;
  severity: AlertSeverity;
  message: string;
}

export interface AlertThresholds {
  /** Alert when pendingReviewTotal(workload) is at or above this. */
  reviewBacklogThreshold: number;
  /** Alert when unsupportedDocumentCount / totalDocumentsSeen exceeds this fraction (0-1). */
  unsupportedRateThreshold: number;
  /** Alert when a single-run OCR failure count (caller-supplied — see AlertEngineInput) is at or above this. */
  ocrFailureSpikeThreshold: number;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  reviewBacklogThreshold: 20,
  unsupportedRateThreshold: 0.15,
  ocrFailureSpikeThreshold: 5,
};

export interface AlertEngineInput {
  workload: ReviewWorkload;
  /** Total ACTIVE documents observed across whatever population the caller is alerting for — the denominator for the unsupported-rate alert. 0 means "nothing to rate," never divided by zero. */
  totalDocumentsObserved: number;
  budgetSnapshot: BudgetSnapshot;
  health: HealthSummary;
  /** Recent OCR failure count — sourced by the caller by filtering observability.ts's RuntimeEvent stream for type "OCR_FINISHED" with detail.outcome === "failure" (or usage_meter.ts's UsageEvent stream, outcome === "failure" with ocrProviderUsed !== null) over whatever recent window they choose; this module has no opinion on the window and never estimates this count itself. */
  recentOcrFailureCount: number;
  thresholds?: AlertThresholds;
}

export function evaluateAlerts(input: AlertEngineInput): Alert[] {
  const thresholds = input.thresholds ?? DEFAULT_ALERT_THRESHOLDS;
  const alerts: Alert[] = [];

  const pending = pendingReviewTotal(input.workload);
  if (pending >= thresholds.reviewBacklogThreshold) {
    alerts.push({ code: "REVIEW_BACKLOG", severity: "WARNING", message: `Review backlog: ${pending} items pending (threshold ${thresholds.reviewBacklogThreshold}).` });
  }

  const unsupported = unsupportedDocumentCount(input.workload);
  if (input.totalDocumentsObserved > 0) {
    const rate = unsupported / input.totalDocumentsObserved;
    if (rate >= thresholds.unsupportedRateThreshold) {
      alerts.push({
        code: "HIGH_UNSUPPORTED_RATE",
        severity: "WARNING",
        message: `Unsupported document rate: ${Math.round(rate * 100)}% (${unsupported}/${input.totalDocumentsObserved}, threshold ${Math.round(thresholds.unsupportedRateThreshold * 100)}%).`,
      });
    }
  }

  if (input.recentOcrFailureCount >= thresholds.ocrFailureSpikeThreshold) {
    alerts.push({ code: "OCR_FAILURE_SPIKE", severity: "CRITICAL", message: `OCR failure spike: ${input.recentOcrFailureCount} recent failures (threshold ${thresholds.ocrFailureSpikeThreshold}).` });
  }

  if (input.budgetSnapshot.budgetExhausted) {
    alerts.push({ code: "BUDGET_EXHAUSTED", severity: "WARNING", message: "AI budget is exhausted for the current period." });
  }

  if (input.health.queueHealthy !== "HEALTHY") {
    alerts.push({ code: "QUEUE_UNAVAILABLE", severity: input.health.queueHealthy === "UNAVAILABLE" ? "CRITICAL" : "WARNING", message: `Queue status: ${input.health.queueHealthy}.` });
  }

  if (input.health.overallStatus !== "HEALTHY") {
    alerts.push({
      code: "HEALTH_DEGRADED",
      severity: input.health.overallStatus === "UNAVAILABLE" ? "CRITICAL" : "WARNING",
      message: `Overall system health: ${input.health.overallStatus}. ${input.health.notes.join(" ")}`.trim(),
    });
  }

  return alerts;
}
