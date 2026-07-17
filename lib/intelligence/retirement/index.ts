/**
 * Retirement Engine — public Intelligence API (Phase 40A foundation).
 *
 * A thin facade over the existing, stable lib/personnel_calendar/retirement.ts
 * calculator. Phase 40A does NOT relocate or rewrite that calculator — it is
 * production code with its own tests and callers. This module exists so
 * consumers (Dashboard, Commander Search, Officer Workspace, Statistics) can
 * depend on ONE Intelligence-layer entry point and ONE result shape
 * (RetirementSummary) instead of reaching into lib/personnel_calendar
 * directly and re-shaping the result themselves at each call site.
 *
 * Master data in -> Intelligence summary out. No UI, no I/O.
 */

import { calculateRetirement, THAI_GOVERNMENT_RETIREMENT_AGE } from "@/lib/personnel_calendar";
import { yearsFromDuration } from "@/lib/intelligence/shared/duration";
import type { RetirementSummary } from "@/lib/intelligence/shared/types";

export { THAI_GOVERNMENT_RETIREMENT_AGE };

/**
 * Computes an officer's retirement summary from their date of birth alone —
 * the only master-data input this calculation needs. Returns
 * `available: false` (not a computed zero) when dateOfBirth is missing.
 */
export function computeRetirementSummary(
  dateOfBirth: Date | null | undefined,
  asOf: Date = new Date(),
  retirementAge: number = THAI_GOVERNMENT_RETIREMENT_AGE
): RetirementSummary {
  const calculation = calculateRetirement(dateOfBirth, asOf, retirementAge);
  if (!calculation) {
    return {
      available: false,
      retirementAge,
      retirementFiscalYear: null,
      retirementDate: null,
      remaining: null,
      remainingYears: null,
      isRetired: false,
    };
  }
  return {
    available: true,
    retirementAge: calculation.retirementAge,
    retirementFiscalYear: calculation.retirementFiscalYear,
    retirementDate: calculation.retirementDate,
    remaining: calculation.remaining,
    remainingYears: yearsFromDuration(calculation.remaining),
    isRetired: calculation.isRetired,
  };
}
