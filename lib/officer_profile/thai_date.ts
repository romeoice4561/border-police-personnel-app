/**
 * Thai calendar date utilities (Phase 26B Part 3 — Timeline Date Model).
 *
 * Pure, dependency-free helpers for the structured Day / Month(Thai) /
 * Year(Buddhist Era) timeline model. Buddhist Era = Gregorian + 543.
 *
 * No I/O, no React — shared between the Zod schema (server), the date
 * dropdowns (client), and the backfill script.
 */

/** Thai month names, 1-indexed (index 0 unused) so `THAI_MONTHS[month]` reads naturally. */
export const THAI_MONTHS: readonly string[] = [
  "",
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

/** Common Thai month abbreviations (with and without a trailing period), 1-indexed, for parsing legacy free-text dates. */
const THAI_MONTH_ABBREVIATIONS: readonly string[] = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** { value: 1..12, label: "มกราคม" } options for the Month dropdown. */
export const MONTH_OPTIONS: ReadonlyArray<{ value: number; label: string }> = THAI_MONTHS.slice(1).map((label, i) => ({
  value: i + 1,
  label,
}));

const MIN_YEAR_BE = 2470;
const MAX_YEAR_BE = 2600;

/** Every valid Buddhist-Era year in a broad, sane range, descending (most recent first) for the Year dropdown. */
export const YEAR_BE_OPTIONS: readonly number[] = Array.from(
  { length: MAX_YEAR_BE - MIN_YEAR_BE + 1 },
  (_, i) => MAX_YEAR_BE - i
);

export function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

export function isValidMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

export function isValidYearBE(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR_BE && year <= MAX_YEAR_BE;
}

/** Converts a Buddhist-Era year to Gregorian (BE = CE + 543). */
export function yearBEToGregorian(yearBE: number): number {
  return yearBE - 543;
}

/** Converts a Gregorian year to Buddhist Era. */
export function yearGregorianToBE(yearCE: number): number {
  return yearCE + 543;
}

/** The current Buddhist-Era year (Phase 26B Part 5 Part B — "Career Years (Calculated)" always anchors to this). Accepts an explicit `now` for deterministic tests. */
export function currentYearBE(now: Date = new Date()): number {
  return yearGregorianToBE(now.getUTCFullYear());
}

/**
 * Builds the DATE-only effectiveDate a structured timeline entry sorts and
 * compares by. Day/month default to 1 when unknown (a year-only entry still
 * gets a valid, comparable date, anchored to the start of that year). Returns
 * null when yearBE itself is unknown — there is nothing to anchor a date to.
 */
export function toEffectiveDate(input: { day?: number | null; month?: number | null; yearBE?: number | null }): Date | null {
  if (input.yearBE == null || !isValidYearBE(input.yearBE)) return null;
  const month = input.month != null && isValidMonth(input.month) ? input.month : 1;
  const day = input.day != null && isValidDay(input.day) ? input.day : 1;
  const gregorianYear = yearBEToGregorian(input.yearBE);
  // UTC to avoid local-timezone shifting the date by one day.
  return new Date(Date.UTC(gregorianYear, month - 1, day));
}

/** Formats a structured date as Thai text, e.g. "1 มกราคม 2560" / "มกราคม 2560" / "2560" / "ปัจจุบัน". */
export function formatThaiDate(input: { day?: number | null; month?: number | null; yearBE?: number | null; isPresent?: boolean }): string {
  if (input.isPresent) return "ปัจจุบัน";
  if (input.yearBE == null) return "—";
  const parts: string[] = [];
  if (input.day != null && input.month != null) parts.push(String(input.day));
  if (input.month != null) parts.push(THAI_MONTHS[input.month] ?? "");
  parts.push(String(input.yearBE));
  return parts.filter(Boolean).join(" ");
}

export interface ParsedLegacyDate {
  day: number | null;
  month: number | null;
  yearBE: number | null;
  isPresent: boolean;
}

/**
 * Best-effort parse of a legacy free-text Timeline.year value into structured
 * fields, for the one-time backfill script. Never throws — returns all-null
 * (isPresent=false) for anything unrecognized, so an ungrokkable legacy
 * string is simply left for a human to fill in via the editor, never guessed.
 *
 * Recognized shapes (all seen in production data):
 *   "2560"                    -> year-only
 *   "2567-ปัจจุบัน"            -> present, anchored at the start year
 *   "ปัจจุบัน"                 -> present, no anchor year
 *   "1 ก.พ. 2532"              -> full date, 4-digit BE year
 *   "1 ก.พ.66" / "1 ก.พ. 66"   -> full date, 2-digit BE year (00-99 -> 2500+n,
 *                                 matching how these records were actually
 *                                 typed for a modern-era officer roster)
 *   "2563-2564"                -> plain year range (no ปัจจุบัน) -> anchored at
 *                                 the START year, not present (a promotion
 *                                 that happened somewhere in that span — the
 *                                 exact day/month is genuinely unknown, so
 *                                 day/month are left null rather than guessed)
 *   "ธ.ค. 2558" / "ธ.ค.2558"   -> month + 4-digit year, no day
 *   "16 ก.ย. 2556 - ปัจจุบัน"  -> full date range ending in ปัจจุบัน -> anchored
 *                                 at the full START date, isPresent=true
 */
export function parseLegacyTimelineYear(raw: string): ParsedLegacyDate {
  const value = raw.trim();
  const NONE: ParsedLegacyDate = { day: null, month: null, yearBE: null, isPresent: false };
  if (!value) return NONE;

  if (/^ปัจจุบัน$/.test(value)) return { ...NONE, isPresent: true };

  // A range whose START is a full Thai date (e.g. "16 ก.ย. 2556 - ปัจจุบัน") —
  // tried before the plain-year range below since a full date also starts
  // with digits.
  const fullDatePresentMatch = value.match(/^(\d{1,2})\s*([ก-๙.]+)\.?\s*(\d{2,4})\s*-\s*ปัจจุบัน$/);
  if (fullDatePresentMatch) {
    const parsedStart = parseFullThaiDate(fullDatePresentMatch[1], fullDatePresentMatch[2], fullDatePresentMatch[3]);
    if (parsedStart) return { ...parsedStart, isPresent: true };
  }

  const rangeMatch = value.match(/^(\d{4})\s*-\s*ปัจจุบัน$/);
  if (rangeMatch) {
    const yearBE = Number(rangeMatch[1]);
    return { day: null, month: null, yearBE: isValidYearBE(yearBE) ? yearBE : null, isPresent: true };
  }

  // A plain year range with no ปัจจุบัน (e.g. "2563-2564") — anchored at the
  // start year; the exact day/month within that span is genuinely unknown.
  const plainRangeMatch = value.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (plainRangeMatch) {
    const yearBE = Number(plainRangeMatch[1]);
    return { day: null, month: null, yearBE: isValidYearBE(yearBE) ? yearBE : null, isPresent: false };
  }

  if (/^\d{4}$/.test(value)) {
    const yearBE = Number(value);
    return { day: null, month: null, yearBE: isValidYearBE(yearBE) ? yearBE : null, isPresent: false };
  }

  const fullDateMatch = value.match(/^(\d{1,2})\s*([ก-๙.]+)\s*(\d{2,4})$/);
  if (fullDateMatch) {
    const parsed = parseFullThaiDate(fullDateMatch[1], fullDateMatch[2], fullDateMatch[3]);
    if (parsed) return { ...parsed, isPresent: false };
  }

  // Month + year, no day (e.g. "ธ.ค. 2558").
  const monthYearMatch = value.match(/^([ก-๙.]+)\.?\s*(\d{4})$/);
  if (monthYearMatch) {
    const monthIndex = monthIndexFromAbbreviation(monthYearMatch[1]);
    const yearBE = Number(monthYearMatch[2]);
    if (monthIndex > 0 && isValidYearBE(yearBE)) {
      return { day: null, month: monthIndex, yearBE, isPresent: false };
    }
  }

  return NONE;
}

function monthIndexFromAbbreviation(monthText: string): number {
  return THAI_MONTH_ABBREVIATIONS.findIndex((abbr) => abbr && normalizeMonthText(abbr) === normalizeMonthText(monthText));
}

/** Shared day+month-abbreviation+year(2-or-4-digit) parse used by both the plain full-date and the "...-ปัจจุบัน" range shapes. */
function parseFullThaiDate(dayText: string, monthText: string, yearText: string): { day: number; month: number; yearBE: number } | null {
  const day = Number(dayText);
  const monthIndex = monthIndexFromAbbreviation(monthText);
  const rawYear = Number(yearText);
  const yearBE = rawYear < 100 ? 2500 + rawYear : rawYear;
  if (monthIndex > 0 && isValidDay(day) && isValidYearBE(yearBE)) {
    return { day, month: monthIndex, yearBE };
  }
  return null;
}

function normalizeMonthText(s: string): string {
  return s.replace(/\./g, "").trim();
}
