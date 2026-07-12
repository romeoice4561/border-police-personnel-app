/**
 * Career salary engine (Phase 28A — Career Intelligence Foundation).
 *
 * Pure utilities over an officer's persisted SalaryHistory rows (one
 * salary-step result — 0.5/1.0/1.5/2.0 — per Buddhist-Era year). This is
 * the FOUNDATION only: it deliberately does NOT determine eligibility for
 * 2-step consideration, promotion readiness, awards, or merit reports —
 * those are future phases, built by reading the utilities here rather than
 * requiring changes to this file or the SalaryHistory schema.
 *
 * Distinct from lib/officer_profile/career_calculator.ts (which operates on
 * Timeline rows — assignment history — not salary-step results). Pure
 * derivation — no I/O, no database, no React.
 */

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
