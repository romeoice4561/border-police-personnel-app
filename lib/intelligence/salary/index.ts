/**
 * Salary Engine — public Intelligence API (Phase 40A foundation).
 *
 * A thin facade over the existing, stable lib/officer_profile/
 * career_salary_engine.ts (two-step/"2 ขั้น" eligibility rule). Not
 * relocated or rewritten — this module wraps its EvaluationResult into the
 * shared SalarySummary shape so consumers depend on one Intelligence-layer
 * type instead of the engine's own enum-based result.
 *
 * Master data in -> Intelligence summary out. No UI, no I/O.
 */

import { countTwoStep, evaluateTwoStepEligibility, EligibilityStatus, type SalaryHistoryLike } from "@/lib/officer_profile/career_salary_engine";
import type { SalarySummary } from "@/lib/intelligence/shared/types";

/**
 * Composes an officer's two-step salary summary from their SalaryHistory
 * rows. `available: false` only when there is no history at all — an
 * UNKNOWN eligibility result (missing a required prior year) is still
 * "available" (the engine ran), just not eligible.
 */
export function computeSalarySummary<T extends SalaryHistoryLike>(rows: readonly T[], now: Date = new Date()): SalarySummary {
  if (rows.length === 0) {
    return { available: false, twoStepCount: 0, eligibleTwoStep: false, mustSkipStep: false };
  }
  const evaluation = evaluateTwoStepEligibility(rows, now);
  return {
    available: true,
    twoStepCount: countTwoStep(rows),
    eligibleTwoStep: evaluation.status === EligibilityStatus.Eligible,
    mustSkipStep: evaluation.status === EligibilityStatus.NotEligible,
  };
}
