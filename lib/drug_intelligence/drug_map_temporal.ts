/**
 * Map Temporal Intelligence helpers (DI-8.2.1).
 *
 * Pure — no I/O, no React. Canonical rules:
 *
 * Weekday numbering (ISO-8601): Mon=1 … Sun=7.
 * URL example: weekdays=5,6 → Friday + Saturday.
 *
 * arrestDate without arrestTime = KNOWN DATE / UNKNOWN TIME.
 * Unknown time MAY join date/weekday analysis.
 * Unknown time MUST NOT join hour/time-bucket analysis or time filters.
 * Missing arrestTime is NEVER treated as 00:00.
 *
 * DATE ranges: from > to is invalid.
 * TIME ranges: start > end means overnight (e.g. 20:00–02:00) and is valid.
 */

import { parseThaiClockHhMm } from "@/lib/drug_intelligence/di_date_helpers";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";

/** ISO weekday: Monday=1 … Sunday=7. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ISO_WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export const ISO_WEEKDAY_SHORT_TH: Record<IsoWeekday, string> = {
  1: "จ.",
  2: "อ.",
  3: "พ.",
  4: "พฤ.",
  5: "ศ.",
  6: "ส.",
  7: "อา.",
};

export const ISO_WEEKDAY_FULL_TH: Record<IsoWeekday, string> = {
  1: "จันทร์",
  2: "อังคาร",
  3: "พุธ",
  4: "พฤหัสบดี",
  5: "ศุกร์",
  6: "เสาร์",
  7: "อาทิตย์",
};

export type MapTimeBucketId =
  | "H00_03"
  | "H03_06"
  | "H06_09"
  | "H09_12"
  | "H12_15"
  | "H15_18"
  | "H18_21"
  | "H21_24";

export type MapTimePreset = "ALL_DAY" | MapTimeBucketId | "CUSTOM";

export const MAP_TIME_BUCKETS: readonly {
  id: MapTimeBucketId;
  labelTh: string;
  /** Inclusive start minute-of-day [0, 1440). */
  startMinute: number;
  /** Exclusive end minute-of-day (24:00 = 1440). Last bucket includes through 23:59. */
  endMinute: number;
}[] = [
  { id: "H00_03", labelTh: "00–03", startMinute: 0, endMinute: 3 * 60 },
  { id: "H03_06", labelTh: "03–06", startMinute: 3 * 60, endMinute: 6 * 60 },
  { id: "H06_09", labelTh: "06–09", startMinute: 6 * 60, endMinute: 9 * 60 },
  { id: "H09_12", labelTh: "09–12", startMinute: 9 * 60, endMinute: 12 * 60 },
  { id: "H12_15", labelTh: "12–15", startMinute: 12 * 60, endMinute: 15 * 60 },
  { id: "H15_18", labelTh: "15–18", startMinute: 15 * 60, endMinute: 18 * 60 },
  { id: "H18_21", labelTh: "18–21", startMinute: 18 * 60, endMinute: 21 * 60 },
  { id: "H21_24", labelTh: "21–24", startMinute: 21 * 60, endMinute: 24 * 60 },
];

export const MAP_TIME_PRESET_VALUES: readonly MapTimePreset[] = [
  "ALL_DAY",
  "H00_03",
  "H03_06",
  "H06_09",
  "H09_12",
  "H12_15",
  "H15_18",
  "H18_21",
  "H21_24",
  "CUSTOM",
];

/** Chip / display label e.g. "21:00–24:00" — never stored as a clock value. */
export function mapTimeBucketChipLabel(id: MapTimeBucketId): string {
  const bucket = MAP_TIME_BUCKETS.find((b) => b.id === id);
  if (!bucket) return id;
  const startH = String(Math.floor(bucket.startMinute / 60)).padStart(2, "0");
  const endH = bucket.endMinute >= 24 * 60 ? "24" : String(Math.floor(bucket.endMinute / 60)).padStart(2, "0");
  return `${startH}:00–${endH}:00`;
}

export function emptyTimeBucketFrequency(): Record<MapTimeBucketId, number> {
  return {
    H00_03: 0,
    H03_06: 0,
    H06_09: 0,
    H09_12: 0,
    H12_15: 0,
    H15_18: 0,
    H18_21: 0,
    H21_24: 0,
  };
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes from midnight for a valid HH:MM; null if missing/invalid. Never invents 0 for missing. */
export function minutesFromArrestTime(arrestTime: string | null | undefined): number | null {
  const hhmm = parseThaiClockHhMm(arrestTime);
  if (!hhmm) return null;
  const m = HHMM.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * ISO weekday for a DATE-only YYYY-MM-DD (calendar-stable via UTC Y-M-D).
 * Returns null when date missing/invalid.
 */
export function isoWeekdayFromDateOnly(arrestDate: string | Date | null | undefined): IsoWeekday | null {
  if (arrestDate == null || arrestDate === "") return null;
  let y: number;
  let mo: number;
  let d: number;
  if (typeof arrestDate === "string") {
    const ymd = arrestDate.trim().slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  } else {
    if (Number.isNaN(arrestDate.getTime())) return null;
    y = arrestDate.getUTCFullYear();
    mo = arrestDate.getUTCMonth() + 1;
    d = arrestDate.getUTCDate();
  }
  const utc = new Date(Date.UTC(y, mo - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() + 1 !== mo || utc.getUTCDate() !== d) return null;
  const js = utc.getUTCDay(); // 0=Sun … 6=Sat
  return (js === 0 ? 7 : js) as IsoWeekday;
}

export function parseWeekdaysParam(raw: string | null | undefined): IsoWeekday[] {
  if (raw == null || raw.trim() === "") return [];
  const out: IsoWeekday[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n < 1 || n > 7) continue;
    if (!out.includes(n as IsoWeekday)) out.push(n as IsoWeekday);
  }
  return out.sort((a, b) => a - b);
}

export function serializeWeekdaysParam(days: readonly IsoWeekday[]): string | undefined {
  if (!days.length) return undefined;
  const unique = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  return unique.length ? unique.join(",") : undefined;
}

export function caseMatchesWeekdays(
  arrestDate: string | Date | null | undefined,
  selected: readonly IsoWeekday[],
): boolean {
  if (!selected.length) return true; // "ทุกวัน" — no restriction
  const day = isoWeekdayFromDateOnly(arrestDate);
  if (day == null) return false; // no date → cannot match weekday filter
  return selected.includes(day);
}

/**
 * Inclusive HH:MM range. When startMinute > endMinute, overnight:
 * match if minute >= start OR minute < end (end exclusive for 02:00 means < 02:00).
 * Same-day: start <= minute < end, except when end is 24:00 (1440) include through 23:59.
 *
 * Boundary: endMinute of 0 with overnight from 20:00 means times >= 20:00 only? 
 * Spec overnight 20:00–02:00: time >= 20:00 OR time < 02:00.
 * So end is exclusive for the morning side when overnight.
 * Same-day 08:30–14:00: >= 08:30 AND < 14:00? Spec examples use inclusive feel.
 * Use: same-day: start <= m <= endInclusive where endInclusive = endMinute - 1 if end is exclusive bucket end...
 *
 * For custom range UI, endTime "14:00" means through 14:00 inclusive (minute <= 14*60).
 * For bucket H18_24: 18:00–23:59 inclusive = start 1080, endExclusive 1440.
 */
export function timeMatchesRange(
  minute: number | null,
  startMinute: number,
  endMinute: number,
  opts?: { endInclusive?: boolean },
): boolean {
  if (minute == null) return false;
  const endInclusive = opts?.endInclusive ?? true;
  if (startMinute === endMinute) {
    // degenerate: treat as single instant when inclusive
    return endInclusive ? minute === startMinute : false;
  }
  if (startMinute < endMinute) {
    // same calendar span
    if (endInclusive) return minute >= startMinute && minute <= endMinute;
    return minute >= startMinute && minute < endMinute;
  }
  // overnight: >= start OR < end (end exclusive morning) — if endInclusive, <= end for morning? Spec: time < 02:00
  // Use exclusive end for overnight morning side to match "02:00" as stop.
  return minute >= startMinute || minute < endMinute;
}

export function parseHhMmToMinutes(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Allow 24:00 as exclusive end sentinel for "end of day"
  if (trimmed === "24:00") return 24 * 60;
  const hhmm = parseThaiClockHhMm(trimmed);
  if (!hhmm) return null;
  const m = HHMM.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function resolveTimeFilterBounds(
  preset: MapTimePreset,
  customFrom?: string | null,
  customTo?: string | null,
): { active: boolean; startMinute: number; endMinute: number; endInclusive: boolean } | null {
  if (preset === "ALL_DAY") return null;
  if (preset === "CUSTOM") {
    const start = parseHhMmToMinutes(customFrom);
    const end = parseHhMmToMinutes(customTo);
    if (start == null || end == null) return null; // incomplete custom → no time filter yet
    return { active: true, startMinute: start, endMinute: end, endInclusive: true };
  }
  const bucket = MAP_TIME_BUCKETS.find((b) => b.id === preset);
  if (!bucket) return null;
  return { active: true, startMinute: bucket.startMinute, endMinute: bucket.endMinute, endInclusive: false };
}

export function caseMatchesTimeFilter(
  arrestTime: string | null | undefined,
  bounds: { startMinute: number; endMinute: number; endInclusive: boolean } | null,
): boolean {
  if (!bounds) return true; // no time filter — unknown time stays
  const minute = minutesFromArrestTime(arrestTime);
  if (minute == null) return false; // time filter active → unknown time excluded
  return timeMatchesRange(minute, bounds.startMinute, bounds.endMinute, { endInclusive: bounds.endInclusive });
}

export function timeBucketForMinute(minute: number): MapTimeBucketId | null {
  for (const b of MAP_TIME_BUCKETS) {
    if (minute >= b.startMinute && minute < b.endMinute) return b.id;
  }
  return null;
}

export interface TemporalCaseLite {
  id: string;
  arrestDate: string | Date | null;
  arrestTime: string | null;
}

export interface TemporalCoverage {
  total: number;
  withTime: number;
  withoutTime: number;
  /** 0–100, one decimal place (e.g. 56.3). 0 when total=0. */
  coveragePercent: number;
}

export function computeTemporalCoverage(cases: readonly TemporalCaseLite[]): TemporalCoverage {
  const total = cases.length;
  let withTime = 0;
  for (const c of cases) {
    if (minutesFromArrestTime(c.arrestTime) != null) withTime += 1;
  }
  const withoutTime = total - withTime;
  const coveragePercent = total === 0 ? 0 : Math.round((withTime / total) * 1000) / 10;
  return { total, withTime, withoutTime, coveragePercent };
}

export function computeWeekdayFrequency(cases: readonly TemporalCaseLite[]): Record<IsoWeekday, number> {
  const counts: Record<IsoWeekday, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const c of cases) {
    const day = isoWeekdayFromDateOnly(c.arrestDate);
    if (day != null) counts[day] += 1;
  }
  return counts;
}

export function computeTimeBucketFrequency(cases: readonly TemporalCaseLite[]): Record<MapTimeBucketId, number> {
  const counts = emptyTimeBucketFrequency();
  for (const c of cases) {
    const minute = minutesFromArrestTime(c.arrestTime);
    if (minute == null) continue;
    const bucket = timeBucketForMinute(minute);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

export function filterCasesByWeekdays<T extends TemporalCaseLite>(
  cases: readonly T[],
  weekdays: readonly IsoWeekday[],
): T[] {
  if (!weekdays.length) return [...cases];
  return cases.filter((c) => caseMatchesWeekdays(c.arrestDate, weekdays));
}

export function filterCasesByTime<T extends TemporalCaseLite>(
  cases: readonly T[],
  bounds: { startMinute: number; endMinute: number; endInclusive: boolean } | null,
): T[] {
  if (!bounds) return [...cases];
  return cases.filter((c) => caseMatchesTimeFilter(c.arrestTime, bounds));
}

/** Date-range presets including rolling windows for Map temporal UX. */
export type MapDatePreset = "TODAY" | "LAST_7" | "LAST_30" | "THIS_MONTH" | "THIS_FISCAL_YEAR" | "CUSTOM";

function toDateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveMapDatePresetRange(preset: Exclude<MapDatePreset, "CUSTOM">, now: Date = new Date()): { dateFrom: string; dateTo: string } {
  const today = toDateOnlyUtc(now);
  switch (preset) {
    case "TODAY":
      return { dateFrom: today, dateTo: today };
    case "LAST_7": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
      return { dateFrom: toDateOnlyUtc(start), dateTo: today };
    }
    case "LAST_30": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
      return { dateFrom: toDateOnlyUtc(start), dateTo: today };
    }
    case "THIS_MONTH": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      return { dateFrom: toDateOnlyUtc(start), dateTo: toDateOnlyUtc(end) };
    }
    case "THIS_FISCAL_YEAR": {
      const { start, end } = computeFiscalYearSummary(now);
      return { dateFrom: toDateOnlyUtc(start), dateTo: toDateOnlyUtc(end) };
    }
  }
}
