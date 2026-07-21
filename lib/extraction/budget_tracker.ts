/**
 * Daily/monthly/per-user budget tracker (Phase 48B — spec §2).
 *
 * A pure, reusable "read model" over budget_policy.ts's numeric limits and
 * usage_meter.ts's recorded events. Turns "how many calls have happened" +
 * "what's the limit" into display-ready remaining-budget figures for the
 * cost dashboard / commander view — never a second source of truth for
 * limits (those stay in AiUsagePolicy) or for counts (those stay in
 * UsageMeter via computeAiCallHistory). No persistence — the injected
 * UsageMeter is process-lifetime in-memory, same as every other Phase 48
 * store.
 *
 * Pure — no I/O, no React.
 */

import type { AiUsagePolicy } from "@/lib/extraction/budget_policy";
import { computeAiCallHistory, type UsageMeter } from "@/lib/extraction/usage_meter";

export interface BudgetSnapshot {
  dailyCalls: number;
  /** null when the policy has no configured daily limit (unlimited). */
  dailyLimit: number | null;
  /** null when dailyLimit is null; otherwise max(0, dailyLimit - dailyCalls). */
  dailyRemaining: number | null;
  monthlyCalls: number;
  monthlyLimit: number | null;
  monthlyRemaining: number | null;
  /** null when no userId was supplied to computeBudgetSnapshot. */
  perUserDailyCalls: number | null;
  perUserDailyLimit: number | null;
  perUserDailyRemaining: number | null;
  /** True when ANY configured limit (daily, monthly, or this user's daily) has been reached or exceeded. */
  budgetExhausted: boolean;
  /** True when AI is unavailable for a reason other than budget (policy.aiFallbackEnabled === false). Distinct from budgetExhausted so the UI can show "disabled" vs. "out of budget" with different messaging. */
  aiDisabled: boolean;
}

function remaining(limit: number | null, used: number): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}

export function computeBudgetSnapshot(
  policy: AiUsagePolicy,
  meter: UsageMeter,
  input: { userId: string | null; asOf?: Date } = { userId: null }
): BudgetSnapshot {
  const history = computeAiCallHistory(meter, { documentFingerprint: "", userId: input.userId, asOf: input.asOf });
  // documentFingerprint is intentionally blank here — this tracker reports
  // aggregate daily/monthly/per-user usage, never a single document's count
  // (that's callHistory.callsForThisDocument, used directly by ai_gate.ts).

  const dailyRemaining = remaining(policy.dailyCallLimit, history.callsToday);
  const monthlyRemaining = remaining(policy.monthlyCallLimit, history.callsThisMonth);
  const perUserDailyRemaining = input.userId !== null ? remaining(policy.perUserDailyLimit, history.callsTodayForThisUser) : null;

  const budgetExhausted =
    (policy.dailyCallLimit !== null && history.callsToday >= policy.dailyCallLimit) ||
    (policy.monthlyCallLimit !== null && history.callsThisMonth >= policy.monthlyCallLimit) ||
    (input.userId !== null && policy.perUserDailyLimit !== null && history.callsTodayForThisUser >= policy.perUserDailyLimit);

  return {
    dailyCalls: history.callsToday,
    dailyLimit: policy.dailyCallLimit,
    dailyRemaining,
    monthlyCalls: history.callsThisMonth,
    monthlyLimit: policy.monthlyCallLimit,
    monthlyRemaining,
    perUserDailyCalls: input.userId !== null ? history.callsTodayForThisUser : null,
    perUserDailyLimit: policy.perUserDailyLimit,
    perUserDailyRemaining,
    budgetExhausted,
    aiDisabled: !policy.aiFallbackEnabled,
  };
}
