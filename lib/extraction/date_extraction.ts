/**
 * Date parsing/normalization for OCR-extracted text (Phase 48 — spec §12).
 *
 * Recognizes the handful of date shapes actually seen on Thai official
 * documents (DD/MM/YYYY in Buddhist Era, DD-MM-YYYY, "1 มกราคม 2568") and
 * converts them to a normalized ISO ("yyyy-mm-dd") value — reusing the
 * EXISTING shared Buddhist-Era conversion (yearBEToGregorian,
 * isValidYearBE, THAI_MONTHS, THAI_MONTH_ABBREVIATIONS from
 * lib/officer_profile/thai_date.ts) rather than reimplementing BE math a
 * second time, per the established project convention (see
 * docs/THAI_DATE_AND_RETIREMENT_STANDARD.md's "never a raw literal 543 in a
 * call site" rule, already enforced by lib/intelligence/shared/thai_date.ts).
 *
 * Never silently guesses: an ambiguous or unrecognized date string is
 * returned with normalizedValue = null and a stated reason, never a
 * fabricated date.
 *
 * Pure — no I/O, no React.
 */

import {
  THAI_MONTHS,
  THAI_MONTH_ABBREVIATIONS,
  isValidDay,
  isValidMonth,
  isValidYearBE,
  yearBEToGregorian,
} from "@/lib/officer_profile/thai_date";

export interface ExtractedDate {
  rawValue: string;
  /** ISO yyyy-mm-dd, or null when the raw value could not be confidently parsed. */
  normalizedValue: string | null;
  /** Explains the conversion (e.g. "Buddhist Era 2568 -> 2025") or why parsing failed. Never left unexplained when normalizedValue differs from rawValue, or is null. */
  reason: string;
}

function toIso(yearCE: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yearCE}-${mm}-${dd}`;
}

function monthIndexFromThaiName(text: string): number {
  const fullIndex = THAI_MONTHS.findIndex((m) => m && m === text);
  if (fullIndex > 0) return fullIndex;
  const abbrevIndex = THAI_MONTH_ABBREVIATIONS.findIndex((m) => m && text.startsWith(m.replace(/\.$/, "")));
  return abbrevIndex > 0 ? abbrevIndex : -1;
}

/** Numeric DD/MM/YYYY or DD-MM-YYYY, assumed Buddhist Era (the convention on every Thai official document) unless the year is implausibly small for BE (< 2400), in which case it's treated as already-Gregorian. */
const NUMERIC_DATE_PATTERN = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/;

/** "1 มกราคม 2568" or "1 ม.ค. 2568" — day, Thai month name/abbreviation, Buddhist Era year. */
const THAI_MONTH_NAME_DATE_PATTERN = /(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})/;

/**
 * Attempts to parse ONE date out of `text` (already numeral-normalized by
 * normalizeOcrText — this function does not re-run Thai-numeral conversion
 * itself, callers must normalize first). Returns null when no recognizable
 * date pattern is found at all (as opposed to a pattern that matched but
 * failed validation, which returns an ExtractedDate with normalizedValue
 * null and a reason).
 */
export function extractDate(text: string): ExtractedDate | null {
  const numericMatch = text.match(NUMERIC_DATE_PATTERN);
  if (numericMatch) {
    const [rawValue, dayStr, monthStr, yearStr] = numericMatch;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const rawYear = Number(yearStr);

    if (!isValidDay(day) || !isValidMonth(month)) {
      return { rawValue, normalizedValue: null, reason: `Day or month out of range (day=${day}, month=${month}).` };
    }

    // Buddhist Era years for modern documents are typically 2450-2600;
    // anything below that plausible BE range but a valid 4-digit Gregorian
    // year (1900-2100) is treated as already-Gregorian rather than guessed.
    if (isValidYearBE(rawYear)) {
      const yearCE = yearBEToGregorian(rawYear);
      return { rawValue, normalizedValue: toIso(yearCE, month, day), reason: `Buddhist Era ${rawYear} -> ${yearCE} (Gregorian).` };
    }
    if (rawYear >= 1900 && rawYear <= 2100) {
      return { rawValue, normalizedValue: toIso(rawYear, month, day), reason: "Year already in plausible Gregorian range; no BE conversion applied." };
    }
    return { rawValue, normalizedValue: null, reason: `Year ${rawYear} is not a plausible Buddhist Era or Gregorian year.` };
  }

  const thaiMonthMatch = text.match(THAI_MONTH_NAME_DATE_PATTERN);
  if (thaiMonthMatch) {
    const [rawValue, dayStr, monthName, yearStr] = thaiMonthMatch;
    const day = Number(dayStr);
    const monthIndex = monthIndexFromThaiName(monthName);
    const yearBE = Number(yearStr);

    if (monthIndex === -1) {
      return { rawValue, normalizedValue: null, reason: `"${monthName}" is not a recognized Thai month name.` };
    }
    if (!isValidDay(day) || !isValidYearBE(yearBE)) {
      return { rawValue, normalizedValue: null, reason: `Day or Buddhist Era year out of range (day=${day}, yearBE=${yearBE}).` };
    }

    const yearCE = yearBEToGregorian(yearBE);
    return { rawValue, normalizedValue: toIso(yearCE, monthIndex, day), reason: `Buddhist Era ${yearBE} -> ${yearCE} (Gregorian); month "${monthName}" resolved to index ${monthIndex}.` };
  }

  return null;
}
