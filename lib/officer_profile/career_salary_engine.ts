/**
 * Career salary engine (Phase 28A foundation; Phase 28B — Career
 * Intelligence Engine adds evaluateTwoStepEligibility).
 *
 * Pure utilities over an officer's persisted SalaryHistory rows (one
 * salary-step result — 0.5/1.0/1.5/2.0 — per Buddhist-Era year), PLUS the
 * first deterministic (non-AI) business rule: whether the officer may
 * receive a 2.0 ("Two-Step") result in the CURRENT Buddhist year without
 * creating three consecutive 2.0 years. This is business logic, not a
 * foundation stub — but it is still just ONE reusable rule function with no
 * UI/React/database dependency, so Dashboard, Search, Reports, a future AI
 * layer, and Commander View can all call it and get the identical answer.
 *
 * Distinct from lib/officer_profile/career_calculator.ts (which operates on
 * Timeline rows — assignment history — not salary-step results). Pure
 * derivation — no I/O, no database, no React.
 */

import { currentYearBE } from "@/lib/officer_profile/thai_date";

export interface SalaryHistoryLike {
  yearBE: number;
  salaryStep: number;
  remarks?: string | null;
}

/** A salary step counts as "two-step" (2 ขั้น) at exactly 2.0 — the maximum of the 4 possible values (0.5/1.0/1.5/2.0). */
const TWO_STEP_VALUE = 2.0;

/** Sorts salary-history rows by year, newest (most recent Buddhist-Era year) first — the display order Part 3/4 asks for ("Current Year first, then ย้อนหลัง"). */
export function sortHistory<T extends SalaryHistoryLike>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.yearBE - a.yearBE);
}

/**
 * The most recent salary-history row (highest yearBE), or null when `rows`
 * is empty. Does not assume the "current" row is for the current calendar
 * year — it is simply whichever row has the highest yearBE among what was
 * given, matching "Current Year first" display semantics without silently
 * inventing a row for a year that was never saved.
 */
export function latestHistory<T extends SalaryHistoryLike>(rows: readonly T[]): T | null {
  if (rows.length === 0) return null;
  return sortHistory(rows)[0];
}

/** Counts how many years an officer received a full two-step (2.0) result — a plain count, never an eligibility judgment. */
export function countTwoStep<T extends SalaryHistoryLike>(rows: readonly T[]): number {
  return rows.filter((r) => r.salaryStep === TWO_STEP_VALUE).length;
}

/**
 * Indexes salary-history rows by Buddhist-Era year for O(1) lookup — e.g.
 * `historyMap(rows).get(2569)`. Duplicate years should never occur (the
 * database's `@@unique([officerId, yearBE])` constraint enforces it) but if
 * given duplicates anyway, the LAST row for a given year wins (never throws).
 */
export function historyMap<T extends SalaryHistoryLike>(rows: readonly T[]): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows) map.set(row.yearBE, row);
  return map;
}

// ---------------------------------------------------------------------------
// Phase 28B — Career Intelligence Engine: Two-Step eligibility.
// ---------------------------------------------------------------------------

/** The 3 possible outcomes of a Two-Step eligibility check — never a boolean, so "we don't know" is always distinguishable from "no". */
export enum EligibilityStatus {
  Eligible = "ELIGIBLE",
  NotEligible = "NOT_ELIGIBLE",
  Unknown = "UNKNOWN",
}

/**
 * Machine-readable reason codes for an EvaluationResult — stable identifiers
 * a caller (Dashboard/Search/Reports/AI/Commander View) can branch on
 * without parsing free text, plus a human-readable `reason` string on the
 * result for direct display.
 */
export enum ReasonCode {
  /** The 2 years immediately before the current year both already have a 2.0 result — granting 2.0 this year would make 3 consecutive years. */
  ThreeConsecutive = "THREE_CONSECUTIVE",
  /** Neither of the 2 required prior years is a 2.0 (or only one is) — a 2.0 this year would not create a 3-year run. */
  EligiblePattern = "ELIGIBLE_PATTERN",
  /** One or both of the 2 years immediately before the current year has NO recorded row at all — the run length can't be safely determined. */
  MissingYear = "MISSING_YEAR",
  /** Convenience alias of MissingYear for a caller that only cares "is there enough history at all", not which specific year is missing. */
  InsufficientHistory = "INSUFFICIENT_HISTORY",
}

/**
 * The engine's answer to "can this officer receive 2.0 this year?" — status
 * plus a machine-readable reasonCode plus a human-readable reason string,
 * and the exact year evaluated (always the real current Buddhist year — see
 * evaluateTwoStepEligibility's docblock). No UI dependency: this is a plain
 * data shape any consumer (Dashboard/Search/Reports/AI/Commander View) can
 * render or branch on identically.
 */
export interface EvaluationResult {
  status: EligibilityStatus;
  reasonCode: ReasonCode;
  reason: string;
  yearBE: number;
}

const REASON_TEXT: Record<ReasonCode, string> = {
  [ReasonCode.ThreeConsecutive]:
    "การให้ 2 ขั้นในปีนี้จะทำให้เกิด 3 ปีติดต่อกันที่ได้รับ 2 ขั้น ซึ่งไม่เป็นไปตามเกณฑ์ / Granting 2.0 this year would create three consecutive years of 2.0 steps.",
  [ReasonCode.EligiblePattern]:
    "ประวัติ 2 ปีย้อนหลังไม่มี 3 ปีติดต่อกันที่ได้รับ 2 ขั้น จึงมีสิทธิ์ได้รับ 2 ขั้นในปีนี้ / The 2 preceding years do not form a three-consecutive-year run, so 2.0 is allowed this year.",
  [ReasonCode.MissingYear]:
    "ไม่มีข้อมูลขั้นเงินเดือนของปีที่จำเป็นต้องใช้ในการประเมิน จึงไม่สามารถระบุผลได้ / A required prior year has no recorded salary-step data, so eligibility cannot be determined.",
  [ReasonCode.InsufficientHistory]:
    "ประวัติขั้นเงินเดือนไม่เพียงพอต่อการประเมิน / There is not enough salary history to evaluate this rule.",
};

/**
 * Evaluates whether an officer may receive a 2.0 ("Two-Step") salary-step
 * result in the CURRENT Buddhist-Era year (always computed from `now` — Part
 * 4: "No hardcoded year. Always calculate using current Buddhist year" —
 * never the year after the officer's latest history row, and independent of
 * whether the current year already has a saved value: the question is
 * always the hypothetical "would assigning 2.0 THIS year violate the rule?").
 *
 * Rule: a 2.0 this year is blocked ONLY if it would create three
 * CONSECUTIVE years of 2.0 — i.e. only if BOTH of the two years immediately
 * before this year already have a recorded 2.0 result (worked examples:
 * 2.0/1.0/2.0/? → ELIGIBLE since 2567≠2.0 breaks the run; 1.0/2.0/2.0/? →
 * NOT_ELIGIBLE since 2567 and 2568 are both 2.0). Only the 2 years
 * immediately preceding the current year are inspected — nothing further
 * back affects a 3-in-a-row check ending at the current year.
 *
 * Never guesses a missing year: if either of the 2 required prior years has
 * NO row at all in `rows`, returns UNKNOWN with reasonCode MissingYear — a
 * year with an explicit non-2.0 value is NOT missing (it legitimately
 * breaks the streak), only a genuinely absent row triggers UNKNOWN.
 */
export function evaluateTwoStepEligibility<T extends SalaryHistoryLike>(
  rows: readonly T[],
  now: Date = new Date()
): EvaluationResult {
  const year = currentYearBE(now);
  const byYear = historyMap(rows);

  const priorYear1 = year - 1;
  const priorYear2 = year - 2;
  const prior1 = byYear.get(priorYear1);
  const prior2 = byYear.get(priorYear2);

  if (prior1 === undefined || prior2 === undefined) {
    return {
      status: EligibilityStatus.Unknown,
      reasonCode: ReasonCode.MissingYear,
      reason: REASON_TEXT[ReasonCode.MissingYear],
      yearBE: year,
    };
  }

  const wouldBeThreeConsecutive = prior1.salaryStep === TWO_STEP_VALUE && prior2.salaryStep === TWO_STEP_VALUE;

  if (wouldBeThreeConsecutive) {
    return {
      status: EligibilityStatus.NotEligible,
      reasonCode: ReasonCode.ThreeConsecutive,
      reason: REASON_TEXT[ReasonCode.ThreeConsecutive],
      yearBE: year,
    };
  }

  return {
    status: EligibilityStatus.Eligible,
    reasonCode: ReasonCode.EligiblePattern,
    reason: REASON_TEXT[ReasonCode.EligiblePattern],
    yearBE: year,
  };
}
