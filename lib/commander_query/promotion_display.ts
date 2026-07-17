/**
 * Commander Search promotion-column display helpers (Commander Promotion
 * UX refinement).
 *
 * Pure presentation-only text/number formatting over ALREADY-COMPUTED
 * PromotionSummary fields (lib/intelligence/promotion) — no eligibility,
 * priority, or duration calculation happens here. Extracted from
 * components/commander/results/commander_results_table.tsx so the
 * reinterpretation logic (overdueOpportunities) is unit-testable without a
 * React render.
 */

/**
 * "เกินกำหนด" — whole promotion opportunities already missed, derived from
 * PromotionSummary.overdueYears (itself unchanged/unmodified —
 * `currentCycle - eligibleCycle + 1` once eligible, i.e. "which numbered
 * eligibility year this is"). Year 1 = the officer's first eligible year,
 * not yet overdue, so `overdueYears - 1` is the count of promotion rounds
 * that have already passed since first becoming eligible. Example: first
 * eligible fiscal year 2568, current fiscal year 2569 -> overdueYears is 2
 * (2569 is eligibility year 2) -> 1 missed opportunity. Floored at 0/null
 * (never negative). Returns null (not 0) when overdueYears itself is
 * null/0 (not yet eligible / not applicable) — never a fabricated zero.
 */
export function overdueOpportunities(overdueYears: number | null): number | null {
  if (overdueYears == null || overdueYears <= 0) return null;
  const missed = overdueYears - 1;
  return missed > 0 ? missed : null;
}
