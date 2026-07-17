/**
 * Thai Buddhist Era display layer (Phase 40B).
 *
 * ONE reusable formatter for turning a real `Date` (stored/calculated in
 * Gregorian, per the project's ISO/Gregorian storage policy — see
 * docs/THAI_DATE_AND_RETIREMENT_STANDARD.md) into a Buddhist-Era, Thai-
 * language display string. Wraps the existing canonical primitives —
 * THAI_MONTHS / THAI_MONTH_ABBREVIATIONS / yearGregorianToBE
 * (lib/officer_profile/thai_date.ts) — it does not reimplement BE
 * conversion or month names, it gives display formatting ONE entry point
 * so call sites stop hand-rolling `getUTCFullYear() + 543`.
 *
 * Rules enforced here:
 *   - never renders "Invalid Date"
 *   - a missing/invalid date renders the Thai fallback "ไม่มีข้อมูล"
 *   - Buddhist Era conversion always goes through yearGregorianToBE,
 *     never a raw literal 543 in a call site
 *
 * Pure — no I/O, no React.
 */

import { THAI_MONTHS, THAI_MONTH_ABBREVIATIONS, yearGregorianToBE } from "@/lib/officer_profile/thai_date";

const MISSING_DATE_TH = "ไม่มีข้อมูล";

function isValidDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/** Converts a Gregorian year to its Buddhist-Era display value, e.g. 2026 -> 2569. Thin re-export of the canonical converter so callers never hardcode +543. */
export function toBuddhistEraYear(gregorianYear: number): number {
  return yearGregorianToBE(gregorianYear);
}

/** "พ.ศ. 2569" from a Date's year. Returns the Thai fallback for a missing/invalid date. */
export function formatBuddhistEraYearTh(date: Date | null | undefined): string {
  if (!isValidDate(date)) return MISSING_DATE_TH;
  return `พ.ศ. ${toBuddhistEraYear(date.getUTCFullYear())}`;
}

/** Compact Buddhist-Era year only, e.g. "2569" — for contexts where "พ.ศ." is already implied (a column header, a chart axis already labeled). Returns the Thai fallback for a missing/invalid date. */
export function formatCompactBuddhistEraYearTh(date: Date | null | undefined): string {
  if (!isValidDate(date)) return MISSING_DATE_TH;
  return String(toBuddhistEraYear(date.getUTCFullYear()));
}

/** Full Thai date, e.g. "11 สิงหาคม 2528". Returns the Thai fallback for a missing/invalid date. */
export function formatFullThaiDateTh(date: Date | null | undefined): string {
  if (!isValidDate(date)) return MISSING_DATE_TH;
  const day = date.getUTCDate();
  const month = THAI_MONTHS[date.getUTCMonth() + 1] ?? "";
  const yearBE = toBuddhistEraYear(date.getUTCFullYear());
  return `${day} ${month} ${yearBE}`;
}

/** Short Thai date, e.g. "11 ส.ค. 2528". Returns the Thai fallback for a missing/invalid date. */
export function formatShortThaiDateTh(date: Date | null | undefined): string {
  if (!isValidDate(date)) return MISSING_DATE_TH;
  const day = date.getUTCDate();
  const month = THAI_MONTH_ABBREVIATIONS[date.getUTCMonth() + 1] ?? "";
  const yearBE = toBuddhistEraYear(date.getUTCFullYear());
  return `${day} ${month} ${yearBE}`;
}
