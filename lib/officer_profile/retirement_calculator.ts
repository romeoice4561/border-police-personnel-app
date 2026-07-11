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

import { yearGregorianToBE } from "@/lib/officer_profile/thai_date";

const RETIREMENT_AGE = 60;

export interface RetirementInfo {
  retirementYearBE: number;
  /** Years remaining until retirement, floored at 0 (never negative for an already-retired officer). */
  yearsRemaining: number;
}

/**
 * Retirement Year (B.E.) + Countdown, derived from Date of Birth alone.
 * Returns null when dateOfBirth is unset — never guessed.
 */
export function calculateRetirementYearBE(dateOfBirth: Date | null, today: Date = new Date()): RetirementInfo | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const retirementYearCE = dob.getUTCFullYear() + RETIREMENT_AGE;
  const retirementYearBE = yearGregorianToBE(retirementYearCE);
  const yearsRemaining = Math.max(0, retirementYearCE - today.getUTCFullYear());
  return { retirementYearBE, yearsRemaining };
}

/** BMI = weight(kg) / height(m)^2, rounded to 1 decimal. Returns null when either input is unset (never guessed). */
export function calculateBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}
