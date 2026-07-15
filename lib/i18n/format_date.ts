/**
 * Locale-aware date formatting (Phase 43, requirement 5).
 *
 * Thai renders the Buddhist Era (พ.ศ. = Gregorian + 543) with Thai month
 * names; English renders the Gregorian year (A.D.) with English month names.
 * Both read from the SAME structured {day, month, yearBE} the app already
 * stores (yearBE is the persisted value — a display concern, per thai_date.ts),
 * so no data changes and no business logic is touched.
 *
 * Pure — no React, no I/O. React components pass the active `language` (from
 * useLanguage); report/PDF/print templates pass whichever language the document
 * is being generated in. One formatter, no per-language duplication.
 */

import { THAI_MONTHS, yearBEToGregorian } from "@/lib/officer_profile/thai_date";
import type { Language } from "@/lib/i18n/dictionary";

const EN_MONTHS: readonly string[] = [
  "",
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface StructuredDate {
  day?: number | null;
  month?: number | null;
  yearBE?: number | null;
  isPresent?: boolean;
}

/** Localized "present / ongoing" word. */
export function presentLabel(language: Language): string {
  return language === "th" ? "ปัจจุบัน" : "Present";
}

/**
 * Formats a structured {day, month, yearBE} date in the active language.
 * - th: "1 มกราคม 2560" (Buddhist Era year, Thai month)
 * - en: "1 January 2017 A.D." (Gregorian year, English month)
 * Missing day/month degrade gracefully to just the (converted) year; a fully
 * unknown year returns "—". `isPresent` yields the localized "present" word.
 */
export function formatLocalizedDate(input: StructuredDate, language: Language): string {
  if (input.isPresent) return presentLabel(language);
  if (input.yearBE == null) return "—";

  const monthNames = language === "th" ? THAI_MONTHS : EN_MONTHS;
  const monthName = input.month != null && input.month >= 1 && input.month <= 12 ? monthNames[input.month] : "";
  const year = language === "th" ? input.yearBE : yearBEToGregorian(input.yearBE);

  const parts: string[] = [];
  if (input.day != null && monthName) parts.push(String(input.day));
  if (monthName) parts.push(monthName);
  parts.push(String(year));

  const text = parts.join(" ");
  // Disambiguate the calendar system in English (Thai readers assume พ.ศ.).
  return language === "en" ? `${text} A.D.` : text;
}

/** Formats just a Buddhist-Era year in the active language ("2560" in th; "2017 A.D." in en). */
export function formatLocalizedYearBE(yearBE: number | null | undefined, language: Language): string {
  if (yearBE == null) return "—";
  return language === "th" ? String(yearBE) : `${yearBEToGregorian(yearBE)} A.D.`;
}

/** The era label for the active language ("พ.ศ." / "A.D.") — for headings/columns that name the calendar. */
export function eraLabel(language: Language): string {
  return language === "th" ? "พ.ศ." : "A.D.";
}
