/**
 * Retirement + BMI calculators (Phase 26B Part 5 Part O — "Optional
 * Improvements").
 *
 * Both values are explicitly "Auto Calculated" per spec — derived purely
 * from Date of Birth / Weight / Height for DISPLAY only, never persisted as
 * their own column (there is no Officer.bmi or Officer.retirementYear in the
 * schema — recomputing on every read is cheap and guarantees the displayed
 * value can never drift from its inputs). Thai civil/police service
 * retirement age is 60.
 *
 * Pure — no I/O, no React.
 */

import { calculateAge, calculateRetirement } from "@/lib/personnel_calendar";
import { formatThaiPersonnelDate, parseThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";

/** Normalizes persisted dates after the Server -> Client boundary (RSC serializes Date as ISO strings). */
function personnelDateInput(value: Date | string | null | undefined): Date | null {
  return parseThaiPersonnelDate(value);
}

export interface RetirementInfo {
  retirementYearBE: number;
  retirementDateThai: string;
  /** Years remaining until retirement, floored at 0 (never negative for an already-retired officer). */
  yearsRemaining: number;
}

/**
 * Retirement Year (B.E.) + Countdown, derived from Date of Birth alone.
 * Returns null when dateOfBirth is unset — never guessed.
 */
export function calculateRetirementYearBE(dateOfBirth: Date | string | null, today: Date = new Date()): RetirementInfo | null {
  const dob = personnelDateInput(dateOfBirth);
  if (!dob) return null;
  const retirement = calculateRetirement(dob, today);
  if (!retirement) return null;
  return {
    retirementYearBE: retirement.retirementFiscalYear + 543,
    retirementDateThai: formatThaiPersonnelDate(retirement.retirementDate),
    yearsRemaining: retirement.remaining.years,
  };
}

/** BMI = weight(kg) / height(m)^2, rounded to 1 decimal. Returns null when either input is unset (never guessed). */
export function calculateBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Current Age (Phase 26B Part 6 Part A/E) — whole years since Date of Birth,
 * accounting for whether this year's birthday has occurred yet (not just a
 * plain year subtraction). Returns null when dateOfBirth is unset.
 */
export function calculateCurrentAge(dateOfBirth: Date | string | null, today: Date = new Date()): number | null {
  const dob = personnelDateInput(dateOfBirth);
  if (!dob) return null;
  return calculateAge(dob, today)?.years ?? null;
}
