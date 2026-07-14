import { utcDate } from "@/lib/personnel_calendar";
import { isValidDay, isValidMonth, isValidYearBE, yearBEToGregorian, yearGregorianToBE } from "@/lib/officer_profile/thai_date";

const THAI_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseThaiPersonnelDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : utcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());

  const raw = value.trim();
  if (!raw) return null;

  const thaiMatch = raw.match(THAI_DATE_RE);
  if (thaiMatch) {
    const day = Number(thaiMatch[1]);
    const month = Number(thaiMatch[2]);
    const yearBE = Number(thaiMatch[3]);
    if (!isValidDay(day) || !isValidMonth(month) || !isValidYearBE(yearBE)) return null;
    return utcDate(yearBEToGregorian(yearBE), month, day);
  }

  const isoMatch = raw.match(ISO_DATE_RE);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    // ISO strings from the API/client are stored internally as Gregorian.
    if (!isValidDay(day) || !isValidMonth(month)) return null;
    return utcDate(year, month, day);
  }

  return null;
}

export function formatThaiPersonnelDate(value: Date | string | null | undefined): string {
  const date = typeof value === "string" ? parseThaiPersonnelDate(value) : value;
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yearBE = yearGregorianToBE(d.getUTCFullYear());
  return `${day}/${month}/${yearBE}`;
}

export function toGregorianDateInputValue(value: string | Date | null | undefined): string | null {
  const date = parseThaiPersonnelDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}
