/**
 * Commander Search promotion-column display helpers (Commander Promotion
 * UX refinement; Phase 49.9 semantic alignment).
 *
 * Pure presentation-only text/number formatting over ALREADY-COMPUTED
 * PromotionSummary fields (lib/intelligence/promotion) — no eligibility,
 * priority, or duration calculation happens here. Extracted from
 * components/commander/results/commander_results_table.tsx so the
 * missed-opportunity display helper is unit-testable without a React render.
 */

/**
 * "รอการแต่งตั้งมาแล้ว" — whole promotion opportunities already missed.
 *
 * Phase 49.9: PromotionSummary.overdueYears is completed waiting years
 * (first eligible cycle = 0; after one completed cycle = 1). This helper
 * therefore returns overdueYears when positive, else null — it must NOT
 * subtract one (that compensated for the old mistaken 1-based ordinal
 * stored in overdueYears). Returns null (not 0) when overdueYears is
 * null/0 — never a fabricated zero.
 */
export function overdueOpportunities(overdueYears: number | null): number | null {
  if (overdueYears == null || overdueYears <= 0) return null;
  return overdueYears;
}
