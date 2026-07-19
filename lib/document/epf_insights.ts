/**
 * e-PF Executive Insights (Phase 46B — Executive UX & Intelligence Polish).
 *
 * Deterministic, rule-based derivations built ONLY on top of Phase 46A's
 * existing intelligence outputs (CompletenessResult, EpfDashboardStats,
 * RecentActivityEntry[]) — this module never recomputes completeness,
 * storage, or activity itself; it only reads their already-computed results
 * and turns them into short executive-facing statements.
 *
 * IMPORTANT: this is NOT an LLM and never will be in this phase. Every
 * insight/action/health verdict is a plain if/else over real numbers already
 * on the page. No text is invented — every generated string is built from a
 * translation key and, where needed, a concrete number/date already present
 * in the intelligence result. If a signal doesn't exist (e.g. zero
 * documents), the corresponding insight/action is simply not generated —
 * never a fabricated placeholder.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import type { CompletenessResult, EpfDashboardStats, RecentActivityEntry } from "@/lib/document/epf_intelligence";
import { documentStatus } from "@/lib/document/document_status";

// ── File Health ──────────────────────────────────────────────────────────────

export type FileHealthLevel = "healthy" | "needs_attention" | "incomplete";

export interface FileHealth {
  level: FileHealthLevel;
  percent: number;
}

/**
 * Thresholds are presentation-only (spec §2) — never persisted, recomputed
 * fresh from `completeness.percent` on every render.
 *   90–100% → healthy
 *   70–89%  → needs_attention
 *   below 70% → incomplete
 */
export function computeFileHealth(completeness: CompletenessResult): FileHealth {
  const percent = completeness.percent;
  let level: FileHealthLevel;
  if (percent >= 90) level = "healthy";
  else if (percent >= 70) level = "needs_attention";
  else level = "incomplete";
  return { level, percent };
}

// ── AI Insights (deterministic, rule-based — NOT an LLM) ───────────────────

export type InsightSeverity = "critical" | "notable" | "positive" | "informational";

export interface Insight {
  /** Stable id for React keys / tests — not shown to the user. */
  id: string;
  severity: InsightSeverity;
  /** Translation key for the insight's static template. */
  labelKey: string;
  /** Optional concrete value to interpolate (a real number/date/label already computed elsewhere) — the dictionary has no interpolation, so callers render labelKey + value as adjacent text, never string-concatenate into one translated string. */
  value?: string;
  /** Where `value` renders relative to labelKey's text — "before" (e.g. "3 documents pending…") or "after" (e.g. "…was 12 days ago"). Ignored when `value` is undefined. */
  valuePosition?: "before" | "after";
  /** Optional second translation key rendered after `value` (e.g. "...12" + "days ago."). */
  suffixKey?: string;
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  notable: 1,
  positive: 2,
  informational: 3,
};

function daysSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Generates up to 5 deterministic insight statements, most important first.
 * Ordering: severity bucket (critical > notable > positive > informational),
 * then a stable secondary order (checklist/category order) within each
 * bucket — never randomized, never LLM-generated. `now` is injectable for
 * testability; defaults to the real current time.
 */
export function computeInsights(
  completeness: CompletenessResult,
  stats: EpfDashboardStats,
  documents: readonly OfficerDocument[],
  now: Date = new Date()
): Insight[] {
  const insights: Insight[] = [];

  // Critical: specific missing checklist items that are commonly required
  // (GP7, Official Portrait, Medical) get their own named insight rather
  // than only appearing bundled in the missing count.
  const missingByCode = new Map(completeness.items.filter((i) => i.state === "missing").map((i) => [i.code, i]));
  if (missingByCode.has("GP7")) {
    insights.push({ id: "missing-gp7", severity: "critical", labelKey: "epf.insight.missingGp7" });
  }
  if (missingByCode.has("MEDICAL_DOCUMENT")) {
    insights.push({ id: "missing-medical", severity: "critical", labelKey: "epf.insight.missingMedical" });
  }
  if (missingByCode.has("OFFICIAL_PORTRAIT")) {
    insights.push({ id: "missing-portrait", severity: "notable", labelKey: "epf.insight.missingPortrait" });
  } else {
    insights.push({ id: "has-portrait", severity: "positive", labelKey: "epf.insight.hasPortrait" });
  }

  // Notable: pending-verification documents (real signal — documentStatus()
  // already distinguishes verified/pending/missing).
  const pendingCount = [...documents].filter((d) => d.isActive && documentStatus(d) === "pending").length;
  if (pendingCount > 0) {
    insights.push({
      id: "pending-verification",
      severity: "notable",
      labelKey: "epf.insight.pendingVerification",
      value: String(pendingCount),
      valuePosition: "before",
    });
  }

  // Positive: category presence facts (training/awards available).
  if (completeness.items.find((i) => i.code === "TRAINING_CERTIFICATE")?.state === "present") {
    insights.push({ id: "has-training", severity: "positive", labelKey: "epf.insight.hasTraining" });
  }
  if (completeness.items.find((i) => i.code === "AWARD")?.state === "present") {
    insights.push({ id: "has-awards", severity: "positive", labelKey: "epf.insight.hasAwards" });
  }

  // Informational: recency + overall completion summary.
  if (stats.mostRecentDocument?.uploadedAt) {
    const days = daysSince(new Date(stats.mostRecentDocument.uploadedAt), now);
    insights.push({
      id: "latest-upload-days",
      severity: "informational",
      labelKey: "epf.insight.latestUploadDaysAgo",
      value: String(days),
      valuePosition: "after",
      suffixKey: "epf.insight.latestUploadDaysAgoSuffix",
    });
  }
  insights.push({
    id: "completion-summary",
    severity: "informational",
    labelKey: "epf.insight.completionSummary",
    value: String(completeness.percent),
    valuePosition: "after",
    suffixKey: "epf.insight.completionSummarySuffix",
  });

  insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return insights.slice(0, 5);
}

// ── Recommended Next Actions ─────────────────────────────────────────────────

export type ActionKind = "upload_missing" | "complete_profile" | "review_recent" | "verify_pending";

export interface RecommendedAction {
  id: string;
  kind: ActionKind;
  labelKey: string;
  value?: string;
  /** Present only for upload_missing — the checklist code to jump the Missing Panel/Upload flow to. */
  typeCode?: string;
}

const ACTION_PRIORITY: Record<ActionKind, number> = {
  upload_missing: 0,
  verify_pending: 1,
  review_recent: 2,
  complete_profile: 3,
};

/**
 * Priority order (spec §4): upload missing required document > complete
 * profile > review recently updated document > verify pending document —
 * re-ranked here as upload_missing > verify_pending > review_recent >
 * complete_profile because a specific missing/pending document is a more
 * concrete, actionable next step than the general "keep going" nudge;
 * complete_profile only appears once nothing more specific remains. Returns
 * an empty array when there is genuinely nothing actionable (spec §4: "Hide
 * the card when no actionable items exist").
 */
export function computeRecommendedActions(
  completeness: CompletenessResult,
  documents: readonly OfficerDocument[],
  recentActivity: readonly RecentActivityEntry[]
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  const missing = completeness.items.filter((i) => i.state === "missing");
  for (const item of missing.slice(0, 2)) {
    actions.push({ id: `upload-${item.code}`, kind: "upload_missing", labelKey: "epf.action.uploadMissing", typeCode: item.code });
  }

  const pending = [...documents].filter((d) => d.isActive && documentStatus(d) === "pending");
  if (pending.length > 0) {
    actions.push({ id: "verify-pending", kind: "verify_pending", labelKey: "epf.action.verifyPending", value: String(pending.length) });
  }

  if (recentActivity.length > 0) {
    actions.push({ id: "review-recent", kind: "review_recent", labelKey: "epf.action.reviewRecent" });
  }

  if (completeness.percent < 100) {
    actions.push({ id: "complete-profile", kind: "complete_profile", labelKey: "epf.action.completeProfile", value: String(completeness.percent) });
  }

  actions.sort((a, b) => ACTION_PRIORITY[a.kind] - ACTION_PRIORITY[b.kind]);
  return actions.slice(0, 4);
}

// ── Recent activity grouping ─────────────────────────────────────────────────

export type ActivityGroupKey = "today" | "last7Days" | "earlier";

export interface ActivityGroup {
  key: ActivityGroupKey;
  entries: RecentActivityEntry[];
}

/** Groups an already-sorted (newest-first) activity list into Today/Last 7 Days/Earlier using real timestamps only. */
export function groupRecentActivity(entries: readonly RecentActivityEntry[], now: Date = new Date()): ActivityGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<ActivityGroupKey, RecentActivityEntry[]> = { today: [], last7Days: [], earlier: [] };
  for (const entry of entries) {
    if (entry.at >= startOfToday) groups.today.push(entry);
    else if (entry.at >= sevenDaysAgo) groups.last7Days.push(entry);
    else groups.earlier.push(entry);
  }

  return (["today", "last7Days", "earlier"] as const)
    .map((key) => ({ key, entries: groups[key] }))
    .filter((g) => g.entries.length > 0);
}
