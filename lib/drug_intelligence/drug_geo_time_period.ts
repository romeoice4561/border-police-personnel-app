/**
 * Map time-period presets (Phase DI-8.2, Section 4A).
 *
 * A small, additive helper — NOT a new calendar system. Reuses the existing
 * fiscal-year facade (lib/intelligence/shared/fiscal_year.ts) for the
 * "ไตรมาสนี้"/"ปีงบประมาณนี้" presets rather than re-deriving the Oct-1
 * boundary rule; "วันนี้"/"เดือนนี้" are plain calendar-month arithmetic,
 * since no "this month" helper existed anywhere in the codebase (audited:
 * lib/personnel_calendar, lib/intelligence/shared — neither has one).
 *
 * Returns dateFrom/dateTo as the same YYYY-MM-DD string format
 * DrugGeoFilterState.dateFrom/dateTo already use (the codebase-wide
 * `date.toISOString().slice(0, 10)` convention) — never a new date format.
 *
 * Pure — no I/O, no React.
 */

import { computeFiscalYearSummary, computeFiscalQuarterSummary } from "@/lib/intelligence/shared/fiscal_year";

export const DRUG_GEO_TIME_PERIODS = ["TODAY", "THIS_MONTH", "THIS_QUARTER", "THIS_FISCAL_YEAR", "CUSTOM"] as const;
export type DrugGeoTimePeriod = (typeof DRUG_GEO_TIME_PERIODS)[number];

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves a preset (all except CUSTOM) to a concrete { dateFrom, dateTo }
 * pair, as of `now`. CUSTOM has no computed range — the caller keeps
 * whatever dateFrom/dateTo the user typed, this function is never called
 * for it (callers should branch on period === "CUSTOM" before calling).
 */
export function resolveDrugGeoTimePeriodRange(period: Exclude<DrugGeoTimePeriod, "CUSTOM">, now: Date = new Date()): { dateFrom: string; dateTo: string } {
  switch (period) {
    case "TODAY": {
      const today = toDateOnly(now);
      return { dateFrom: today, dateTo: today };
    }
    case "THIS_MONTH": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      return { dateFrom: toDateOnly(start), dateTo: toDateOnly(end) };
    }
    case "THIS_QUARTER": {
      const { start, end } = computeFiscalQuarterSummary(now);
      return { dateFrom: toDateOnly(start), dateTo: toDateOnly(end) };
    }
    case "THIS_FISCAL_YEAR": {
      const { start, end } = computeFiscalYearSummary(now);
      return { dateFrom: toDateOnly(start), dateTo: toDateOnly(end) };
    }
  }
}

const PERIOD_LABEL_TH: Record<DrugGeoTimePeriod, string> = {
  TODAY: "วันนี้",
  THIS_MONTH: "เดือนนี้",
  THIS_QUARTER: "ไตรมาสนี้",
  THIS_FISCAL_YEAR: "ปีงบประมาณนี้",
  CUSTOM: "กำหนดช่วงเอง",
};
const PERIOD_LABEL_EN: Record<DrugGeoTimePeriod, string> = {
  TODAY: "Today",
  THIS_MONTH: "This month",
  THIS_QUARTER: "This quarter",
  THIS_FISCAL_YEAR: "This fiscal year",
  CUSTOM: "Custom range",
};

export function drugGeoTimePeriodLabel(period: DrugGeoTimePeriod, language: "th" | "en"): string {
  return language === "th" ? PERIOD_LABEL_TH[period] : PERIOD_LABEL_EN[period];
}

export function isValidDrugGeoTimePeriod(value: string): value is DrugGeoTimePeriod {
  return (DRUG_GEO_TIME_PERIODS as readonly string[]).includes(value);
}
