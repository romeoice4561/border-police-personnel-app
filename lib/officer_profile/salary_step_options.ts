/**
 * Salary step options (Phase 28A — Career Intelligence Foundation).
 *
 * The 4 legal salary-step results an officer can receive for a year — a
 * true closed set (Section 10's spec: "Possible values are 0.5, 1.0, 1.5,
 * 2.0"), unlike Rank/Position/Unit, which must preserve arbitrary legacy
 * free text. Pure data — no I/O, no React.
 */

import { currentYearBE } from "@/lib/officer_profile/thai_date";

export const SALARY_STEP_OPTIONS = [0.5, 1.0, 1.5, 2.0] as const;

export type SalaryStep = (typeof SALARY_STEP_OPTIONS)[number];

export function isValidSalaryStep(value: number): value is SalaryStep {
  return (SALARY_STEP_OPTIONS as readonly number[]).includes(value);
}

/**
 * The default Year (พ.ศ.) dropdown range for a new Salary History row —
 * the current Buddhist-Era year plus the previous 3 (Part 3's spec:
 * "Default should include current year plus previous three years"),
 * descending (current year first). NEVER hardcoded — always derived from
 * `now` (Part 8: "Always calculate from today's date").
 */
export function defaultSalaryHistoryYearOptions(now: Date = new Date()): number[] {
  const current = currentYearBE(now);
  return [current, current - 1, current - 2, current - 3];
}
