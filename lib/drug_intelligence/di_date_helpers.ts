/**
 * Canonical date display helpers for Drug Intelligence (operational UX).
 *
 * ONE entry point for every read-only date shown in a DI page or component.
 *
 * Operational intelligence dates (Category A) include weekday:
 *   วันจันทร์ที่ 10 ส.ค. 69
 *
 * With time (when the source is a real datetime, never invented midnight):
 *   วันจันทร์ที่ 10 ส.ค. 69 เวลา 21:35 น.
 *
 * Compact (Category B / tight layout):
 *   จ. 10 ส.ค. 69
 *
 * DATE-only values (YYYY-MM-DD / Prisma DATE midnight UTC) are calendar-stable
 * and never shift day via local timezone.
 *
 * Pure — no I/O, no React.
 */

import { THAI_MONTH_ABBREVIATIONS, yearGregorianToBE } from "@/lib/officer_profile/thai_date";

const MISSING_TH = "ไม่มีข้อมูล";

/** Sunday → Saturday, full Thai weekday labels (intelligence-useful). */
export const THAI_WEEKDAYS_FULL = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
] as const;

/** Compact weekday abbreviations for constrained UI. */
export const THAI_WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PRISMA_DATE_MIDNIGHT_Z = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(\.\d+)?Z$/;

export type ThaiCalendarParts = {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0=Sun … 6=Sat
  hours: number | null;
  minutes: number | null;
  /** True when source carried a real clock time (not DATE-only / midnight DATE). */
  hasClockTime: boolean;
};

function shortBeYear(yearCE: number): string {
  return String(yearGregorianToBE(yearCE)).slice(-2);
}

function isDateOnlyString(value: string): boolean {
  if (DATE_ONLY_RE.test(value)) return true;
  if (PRISMA_DATE_MIDNIGHT_Z.test(value)) return true;
  return false;
}

function partsFromUtcYmd(year: number, month: number, day: number): ThaiCalendarParts | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
  return {
    year,
    month,
    day,
    weekday: d.getUTCDay(),
    hours: null,
    minutes: null,
    hasClockTime: false,
  };
}

function partsFromBangkokDateTime(date: Date): ThaiCalendarParts | null {
  if (Number.isNaN(date.getTime())) return null;
  const bits = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => bits.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hours = Number(get("hour"));
  const minutes = Number(get("minute"));
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  const probe = partsFromUtcYmd(year, month, day);
  if (!probe) return null;
  return {
    ...probe,
    hours: Number.isFinite(hours) ? hours : null,
    minutes: Number.isFinite(minutes) ? minutes : null,
    hasClockTime: true,
  };
}

/**
 * Resolve calendar parts from a DATE-only or DATETIME value.
 * DATE-only / Prisma DATE midnight UTC → UTC calendar day, no clock time.
 * Real datetimes → Asia/Bangkok wall clock.
 */
export function resolveThaiCalendarParts(value: string | Date | null | undefined): ThaiCalendarParts | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isDateOnlyString(trimmed)) {
      const ymd = trimmed.slice(0, 10);
      const m = DATE_ONLY_RE.exec(ymd);
      if (!m) return null;
      return partsFromUtcYmd(Number(m[1]), Number(m[2]), Number(m[3]));
    }
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    // Date-shaped prefix without Z midnight still treated as calendar when time is absent
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed.slice(0, 10)) && trimmed.length === 10) {
      return partsFromUtcYmd(Number(trimmed.slice(0, 4)), Number(trimmed.slice(5, 7)), Number(trimmed.slice(8, 10)));
    }
    return partsFromBangkokDateTime(d);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // Ambiguous Date object: prefer UTC Y-M-D when time is exactly UTC midnight
    if (
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    ) {
      return partsFromUtcYmd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    }
    return partsFromBangkokDateTime(value);
  }

  return null;
}

function renderOperationalDate(parts: ThaiCalendarParts): string {
  const weekday = THAI_WEEKDAYS_FULL[parts.weekday] ?? "";
  const month = THAI_MONTH_ABBREVIATIONS[parts.month] ?? "";
  return `${weekday}ที่ ${parts.day} ${month} ${shortBeYear(parts.year)}`;
}

function renderCompactDate(parts: ThaiCalendarParts): string {
  const weekday = THAI_WEEKDAYS_SHORT[parts.weekday] ?? "";
  const month = THAI_MONTH_ABBREVIATIONS[parts.month] ?? "";
  return `${weekday} ${parts.day} ${month} ${shortBeYear(parts.year)}`;
}

function renderClock(parts: ThaiCalendarParts): string | null {
  if (!parts.hasClockTime || parts.hours == null || parts.minutes == null) return null;
  const hh = String(parts.hours).padStart(2, "0");
  const mm = String(parts.minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Category A — operational intelligence date with weekday.
 * @example formatThaiOperationalDate("2026-08-10") // "วันจันทร์ที่ 10 ส.ค. 69"
 */
export function formatThaiOperationalDate(value: string | Date | null | undefined): string {
  const parts = resolveThaiCalendarParts(value);
  if (!parts) return MISSING_TH;
  return renderOperationalDate(parts);
}

/**
 * Operational date + time when the source has a real clock time.
 * Never invents 00:00 for DATE-only values.
 * @example formatThaiOperationalDateTime("2026-08-10T21:35:00+07:00")
 * // "วันจันทร์ที่ 10 ส.ค. 69 เวลา 21:35 น."
 */
export function formatThaiOperationalDateTime(value: string | Date | null | undefined): string {
  const parts = resolveThaiCalendarParts(value);
  if (!parts) return MISSING_TH;
  const date = renderOperationalDate(parts);
  const clock = renderClock(parts);
  if (!clock) return date;
  return `${date} เวลา ${clock} น.`;
}

/**
 * Category B / compact layout — abbreviated weekday.
 * @example formatThaiCompactDate("2026-08-10") // "จ. 10 ส.ค. 69"
 */
export function formatThaiCompactDate(value: string | Date | null | undefined): string {
  const parts = resolveThaiCalendarParts(value);
  if (!parts) return MISSING_TH;
  return renderCompactDate(parts);
}

/**
 * Compact date + time when clock exists; otherwise compact date only.
 * @example formatThaiCompactDateTime("2026-08-10T14:30:00+07:00") // "จ. 10 ส.ค. 69 · 14:30 น."
 */
export function formatThaiCompactDateTime(value: string | Date | null | undefined): string {
  const parts = resolveThaiCalendarParts(value);
  if (!parts) return MISSING_TH;
  const date = renderCompactDate(parts);
  const clock = renderClock(parts);
  if (!clock) return date;
  return `${date} · ${clock} น.`;
}

/** Clock-only "21:35 น." when time exists; never for DATE-only. */
export function formatThaiOperationalTime(value: string | Date | null | undefined): string | null {
  const parts = resolveThaiCalendarParts(value);
  if (!parts) return null;
  const clock = renderClock(parts);
  return clock ? `${clock} น.` : null;
}

/**
 * Validate a wall-clock HH:MM (or HH:MM:SS) string from fields like arrestTime.
 * Returns "21:35" or null — never invents midnight.
 */
export function parseThaiClockHhMm(time: string | null | undefined): string | null {
  if (time == null) return null;
  const trimmed = time.trim();
  if (!trimmed) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(trimmed);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

/**
 * Clock label for a separate HH:MM field (e.g. DrugCase.arrestTime).
 * @example formatThaiClockLabel("21:35") // "21:35 น."
 */
export function formatThaiClockLabel(time: string | null | undefined): string | null {
  const hhmm = parseThaiClockHhMm(time);
  return hhmm ? `${hhmm} น.` : null;
}

/**
 * Operational DATE + optional separate clock field (arrestTime), never invents 00:00.
 * @example formatThaiOperationalDateWithClock("2026-08-10", "21:35")
 * // "วันจันทร์ที่ 10 ส.ค. 69 เวลา 21:35 น."
 */
export function formatThaiOperationalDateWithClock(
  value: string | Date | null | undefined,
  time: string | null | undefined,
): string {
  const date = formatThaiOperationalDate(value);
  if (date === MISSING_TH) return date;
  const clock = parseThaiClockHhMm(time);
  return clock ? `${date} เวลา ${clock} น.` : date;
}

/**
 * Join operational date with an optional location label.
 * @example formatThaiOperationalDateWithPlace("2026-08-10", "สุราษฎร์ธานี")
 * // "วันจันทร์ที่ 10 ส.ค. 69 · สุราษฎร์ธานี"
 */
export function formatThaiOperationalDateWithPlace(
  value: string | Date | null | undefined,
  place: string | null | undefined,
): string {
  const date = formatThaiOperationalDate(value);
  if (date === MISSING_TH) return date;
  const loc = place?.trim();
  return loc ? `${date} · ${loc}` : date;
}

/**
 * Standard DI read-only date — operational weekday form (Category A).
 * Prefer this (or formatThaiOperationalDate) for arrest / first seen / timeline days.
 */
export function formatDiDate(value: string | Date | null | undefined): string {
  return formatThaiOperationalDate(value);
}

/**
 * Collaboration / workflow timestamps: compact weekday + time when available.
 * Does not invent midnight for DATE-only values.
 */
export function formatDiDateTime(value: string | Date | null | undefined): string {
  return formatThaiCompactDateTime(value);
}
