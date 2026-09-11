/**
 * Canonical date display helpers for Drug Intelligence screens (DI-7.4.2).
 *
 * ONE entry point for every read-only date shown in a DI page or component.
 * Wraps formatShortThaiDateTh (lib/intelligence/shared/thai_date.ts) so all
 * DI screens share the same Buddhist-Era, short-month format:
 *
 *   14 ส.ค. 2569
 *
 * Rules:
 *   - missing/null/undefined/invalid → "ไม่มีข้อมูล"
 *   - never renders "Invalid Date"
 *   - does NOT change API/DB dates, URL dates, or HTML input values
 *   - do not use this for date <input> values — use toGregorianDateInputValue instead
 *
 * Pure — no I/O, no React.
 */

import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import { THAI_MONTH_ABBREVIATIONS, yearGregorianToBE } from "@/lib/officer_profile/thai_date";

const MISSING_TH = "ไม่มีข้อมูล";

/**
 * Standard Thai short-date for Drug Intelligence read-only display.
 * Accepts ISO string, Date object, or null/undefined.
 * Returns "ไม่มีข้อมูล" for any missing or unparseable value.
 *
 * @example
 * formatDiDate("2026-08-14T10:00:00Z") // "14 ส.ค. 2569"
 * formatDiDate(null)                    // "ไม่มีข้อมูล"
 */
export function formatDiDate(value: string | Date | null | undefined): string {
  if (!value) return MISSING_TH;
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return MISSING_TH;
  return formatShortThaiDateTh(d);
}

/**
 * Local date + time for collaboration timestamps (notes). Uses the same
 * Buddhist-Era short-month vocabulary as formatDiDate; hours/minutes are
 * the viewer's local clock, not a second calendar system.
 *
 * @example
 * formatDiDateTime("2026-08-14T10:05:00") // "14 ส.ค. 2569 10:05" (local)
 */
export function formatDiDateTime(value: string | Date | null | undefined): string {
  if (!value) return MISSING_TH;
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return MISSING_TH;
  const day = d.getDate();
  const month = THAI_MONTH_ABBREVIATIONS[d.getMonth() + 1] ?? "";
  const yearBE = yearGregorianToBE(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${yearBE} ${hh}:${mm}`;
}
