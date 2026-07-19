import { test } from "node:test";
import assert from "node:assert/strict";

import { computeFileHealth, computeInsights, computeRecommendedActions, groupRecentActivity } from "@/lib/document/epf_insights";
import { computeCompleteness, computeDashboardStats, computeRecentActivity, RECOMMENDED_CHECKLIST_CODES } from "@/lib/document/epf_intelligence";
import type { OfficerDocument } from "@/lib/database/query_types";

// Phase 46B — deterministic executive insights, built only on Phase 46A's outputs.

let nextId = 1;
function doc(ov: Partial<OfficerDocument>): OfficerDocument {
  return {
    id: nextId++,
    officerId: 1,
    documentType: "OTHER",
    title: "Doc",
    description: null,
    storagePath: null,
    fileUrl: null,
    originalFilename: null,
    mimeType: null,
    fileSize: null,
    uploadedAt: null,
    uploadedBy: null,
    verifiedAt: null,
    verifiedBy: null,
    version: 1,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...ov,
  } as OfficerDocument;
}

// ── computeFileHealth ────────────────────────────────────────────────────────

test("computeFileHealth: 90-100% is healthy", () => {
  assert.equal(computeFileHealth({ items: [], presentCount: 9, totalCount: 10, percent: 90 }).level, "healthy");
  assert.equal(computeFileHealth({ items: [], presentCount: 10, totalCount: 10, percent: 100 }).level, "healthy");
});

test("computeFileHealth: 70-89% is needs_attention", () => {
  assert.equal(computeFileHealth({ items: [], presentCount: 7, totalCount: 10, percent: 70 }).level, "needs_attention");
  assert.equal(computeFileHealth({ items: [], presentCount: 8, totalCount: 9, percent: 89 }).level, "needs_attention");
});

test("computeFileHealth: below 70% is incomplete", () => {
  assert.equal(computeFileHealth({ items: [], presentCount: 1, totalCount: 10, percent: 10 }).level, "incomplete");
  assert.equal(computeFileHealth({ items: [], presentCount: 0, totalCount: 10, percent: 0 }).level, "incomplete");
});

test("computeFileHealth: percent is passed through unchanged, never recomputed", () => {
  const health = computeFileHealth({ items: [], presentCount: 3, totalCount: 4, percent: 75 });
  assert.equal(health.percent, 75);
});

// ── computeInsights ──────────────────────────────────────────────────────────

test("computeInsights: never returns more than 5 insights", () => {
  const docs = [doc({ documentType: "GP7" }), doc({ documentType: "TRAINING_CERTIFICATE" }), doc({ documentType: "AWARD" })];
  const completeness = computeCompleteness(docs, true);
  const stats = computeDashboardStats(docs);
  const insights = computeInsights(completeness, stats, docs);
  assert.ok(insights.length <= 5);
});

test("computeInsights: flags missing GP7 as critical when GP7 is absent", () => {
  const completeness = computeCompleteness([], false);
  const stats = computeDashboardStats([]);
  const insights = computeInsights(completeness, stats, []);
  const gp7Insight = insights.find((i) => i.id === "missing-gp7");
  assert.ok(gp7Insight);
  assert.equal(gp7Insight?.severity, "critical");
});

test("computeInsights: does not flag missing GP7 once GP7 is uploaded", () => {
  const docs = [doc({ documentType: "GP7" })];
  const completeness = computeCompleteness(docs, false);
  const stats = computeDashboardStats(docs);
  const insights = computeInsights(completeness, stats, docs);
  assert.ok(!insights.some((i) => i.id === "missing-gp7"));
});

test("computeInsights: portrait insight flips between missing/has based on the real portrait signal", () => {
  const noPortrait = computeInsights(computeCompleteness([], false), computeDashboardStats([]), []);
  assert.ok(noPortrait.some((i) => i.id === "missing-portrait"));
  const withPortrait = computeInsights(computeCompleteness([], true), computeDashboardStats([]), []);
  assert.ok(withPortrait.some((i) => i.id === "has-portrait"));
});

test("computeInsights: critical insights sort before positive/informational ones", () => {
  const docs: OfficerDocument[] = [];
  const completeness = computeCompleteness(docs, false); // GP7 + Medical both missing → 2 critical
  const stats = computeDashboardStats(docs);
  const insights = computeInsights(completeness, stats, docs);
  const firstCriticalIndex = insights.findIndex((i) => i.severity === "critical");
  const firstInformationalIndex = insights.findIndex((i) => i.severity === "informational");
  assert.ok(firstCriticalIndex !== -1);
  if (firstInformationalIndex !== -1) assert.ok(firstCriticalIndex < firstInformationalIndex);
});

test("computeInsights: latest-upload-days-ago uses the real most recent upload date, computed against an injected 'now'", () => {
  const uploaded = doc({ documentType: "GP7", uploadedAt: new Date("2026-01-01") });
  const now = new Date("2026-01-13"); // 12 days later
  const completeness = computeCompleteness([uploaded], false);
  const stats = computeDashboardStats([uploaded]);
  const insights = computeInsights(completeness, stats, [uploaded], now);
  const recencyInsight = insights.find((i) => i.id === "latest-upload-days");
  assert.equal(recencyInsight?.value, "12");
});

test("computeInsights: pending verification count reflects real documentStatus()-derived pending docs", () => {
  const pending = doc({ documentType: "GP7", verifiedAt: null });
  const completeness = computeCompleteness([pending], false);
  const stats = computeDashboardStats([pending]);
  const insights = computeInsights(completeness, stats, [pending]);
  const pendingInsight = insights.find((i) => i.id === "pending-verification");
  assert.equal(pendingInsight?.value, "1");
});

test("computeInsights: with zero documents, still returns a completion summary insight (0%), never crashes", () => {
  const completeness = computeCompleteness([], false);
  const stats = computeDashboardStats([]);
  const insights = computeInsights(completeness, stats, []);
  const summary = insights.find((i) => i.id === "completion-summary");
  assert.equal(summary?.value, "0");
});

// ── computeRecommendedActions ────────────────────────────────────────────────

test("computeRecommendedActions: returns empty array when file is 100% complete, nothing pending, no recent activity", () => {
  const docs = RECOMMENDED_CHECKLIST_CODES
    .filter((c) => c !== "OFFICIAL_PORTRAIT")
    .map((code) => doc({ documentType: code, verifiedAt: new Date(), uploadedAt: null }));
  const completeness = computeCompleteness(docs, true);
  const actions = computeRecommendedActions(completeness, docs, []);
  assert.deepEqual(actions, []);
});

test("computeRecommendedActions: upload_missing appears first when checklist items are missing", () => {
  const completeness = computeCompleteness([], false);
  const actions = computeRecommendedActions(completeness, [], []);
  assert.equal(actions[0]?.kind, "upload_missing");
});

test("computeRecommendedActions: verify_pending appears when a pending document exists", () => {
  const pending = doc({ documentType: "GP7", verifiedAt: null });
  const completeness = computeCompleteness([pending], false);
  const actions = computeRecommendedActions(completeness, [pending], []);
  assert.ok(actions.some((a) => a.kind === "verify_pending"));
});

test("computeRecommendedActions: complete_profile only appears when completion < 100%", () => {
  const completeness100 = { items: [], presentCount: 5, totalCount: 5, percent: 100 };
  const actionsAt100 = computeRecommendedActions(completeness100, [], []);
  assert.ok(!actionsAt100.some((a) => a.kind === "complete_profile"));

  const completeness50 = computeCompleteness([], false);
  const actionsAt50 = computeRecommendedActions(completeness50, [], []);
  assert.ok(actionsAt50.some((a) => a.kind === "complete_profile"));
});

test("computeRecommendedActions: never returns more than 4 actions", () => {
  const completeness = computeCompleteness([], false);
  const pending = doc({ documentType: "GP7", verifiedAt: null });
  const activity = computeRecentActivity([pending]);
  const actions = computeRecommendedActions(completeness, [pending], activity);
  assert.ok(actions.length <= 4);
});

// ── groupRecentActivity ──────────────────────────────────────────────────────

test("groupRecentActivity: buckets entries into Today/Last 7 Days/Earlier using real timestamps", () => {
  const now = new Date("2026-07-20T12:00:00Z");
  const today = doc({ documentType: "GP7", uploadedAt: new Date("2026-07-20T08:00:00Z") });
  const withinWeek = doc({ documentType: "NATIONAL_ID", uploadedAt: new Date("2026-07-15T08:00:00Z") });
  const older = doc({ documentType: "PASSPORT", uploadedAt: new Date("2026-06-01T08:00:00Z") });
  const activity = computeRecentActivity([today, withinWeek, older]);
  const groups = groupRecentActivity(activity, now);

  const todayGroup = groups.find((g) => g.key === "today");
  const weekGroup = groups.find((g) => g.key === "last7Days");
  const earlierGroup = groups.find((g) => g.key === "earlier");

  assert.equal(todayGroup?.entries.length, 1);
  assert.equal(weekGroup?.entries.length, 1);
  assert.equal(earlierGroup?.entries.length, 1);
});

test("groupRecentActivity: omits empty groups entirely rather than showing an empty section", () => {
  const now = new Date("2026-07-20T12:00:00Z");
  const today = doc({ documentType: "GP7", uploadedAt: new Date("2026-07-20T08:00:00Z") });
  const activity = computeRecentActivity([today]);
  const groups = groupRecentActivity(activity, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "today");
});

test("groupRecentActivity: empty input returns empty groups array", () => {
  assert.deepEqual(groupRecentActivity([]), []);
});
