/**
 * Retirement Engine — public Intelligence API (Phase 40A foundation; Phase
 * 40B strengthens the output per the Data Standardization spec).
 *
 * A thin facade over the existing, stable lib/personnel_calendar/retirement.ts
 * calculator. Phase 40A/40B do NOT relocate or rewrite that calculator — it
 * is production code with its own tests and callers, and it ALREADY
 * correctly implements the Thai fiscal-year retirement rule (an officer
 * born on or after 1 October retires at the end of the FOLLOWING fiscal
 * year, since Thai FY N runs 1 Oct (N-1) - 30 Sep N and
 * currentFiscalYear() rolls forward for any date in October or later — see
 * lib/personnel_calendar/retirement.ts's own doc comment and
 * lib/personnel_calendar/fiscal_year.ts's currentFiscalYear). This module
 * exists so consumers (Dashboard, Commander Search, Officer Workspace,
 * Statistics) can depend on ONE Intelligence-layer entry point and ONE
 * result shape (RetirementSummary) — now including exact remaining
 * duration and Buddhist-Era Thai display text — instead of reaching into
 * lib/personnel_calendar directly and re-shaping the result themselves at
 * each call site.
 *
 * Master data in -> Intelligence summary out. No UI, no I/O.
 */

import { calculateRetirement, THAI_GOVERNMENT_RETIREMENT_AGE } from "@/lib/personnel_calendar";
import { yearsFromDuration } from "@/lib/intelligence/shared/duration";
import { formatExactDurationTh } from "@/lib/intelligence/shared/exact_duration";
import { formatFullThaiDateTh, toBuddhistEraYear } from "@/lib/intelligence/shared/thai_date";
import type { RetirementSummary } from "@/lib/intelligence/shared/types";

export { THAI_GOVERNMENT_RETIREMENT_AGE };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
      reason: "MISSING_DATE_OF_BIRTH",
      retirementAge,
      retirementFiscalYear: null,
      retirementFiscalYearBe: null,
      retirementDate: null,
      remaining: null,
      remainingYears: null,
      exactRemainingDuration: null,
      remainingDays: null,
      isRetired: false,
      displayRetirementDateTh: null,
      displayRetirementYearTh: null,
      displayRemainingTh: null,
    };
  }

  const remainingDays = calculation.isRetired
    ? 0
    : Math.round((calculation.retirementDate.getTime() - asOf.getTime()) / MS_PER_DAY);

  return {
    available: true,
    retirementAge: calculation.retirementAge,
    retirementFiscalYear: calculation.retirementFiscalYear,
    retirementFiscalYearBe: toBuddhistEraYear(calculation.retirementFiscalYear),
    retirementDate: calculation.retirementDate,
    remaining: calculation.remaining,
    remainingYears: yearsFromDuration(calculation.remaining),
    exactRemainingDuration: calculation.remaining,
    remainingDays,
    isRetired: calculation.isRetired,
    displayRetirementDateTh: formatFullThaiDateTh(calculation.retirementDate),
    displayRetirementYearTh: `ปีงบประมาณ ${toBuddhistEraYear(calculation.retirementFiscalYear)}`,
    displayRemainingTh: calculation.isRetired ? "เกษียณแล้ว" : formatExactDurationTh(calculation.remaining),
  };
}
