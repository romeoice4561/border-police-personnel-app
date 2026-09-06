/**
 * Export period resolution (DI-10C).
 *
 * Reuses personnel fiscal-year bounds: FY N is 1 Oct (N-1) through 30 Sep N.
 * Buddhist year converts with the same BE−543 rule as Commander filters.
 *
 * Precedence (Commander `resolveCommanderFilter`):
 * 1. explicit dateFrom + dateTo → authoritative; FY is not applied
 * 2. fiscalYearBe only → convert to Gregorian FY bounds
 * 3. neither → no date filter
 */

import { fiscalYearEnd, fiscalYearStart } from "@/lib/personnel_calendar/fiscal_year";

export const BUDDHIST_ERA_OFFSET = 543;

export type ExportPeriodSource = "EXPLICIT_DATES" | "FISCAL_YEAR" | "NONE";

export interface AppliedExportPeriod {
  dateFrom?: string;
  dateTo?: string;
  appliedFiscalYearBe?: number;
  source: ExportPeriodSource;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function gregorianYearFromBe(fiscalYearBe: number): number {
  return fiscalYearBe - BUDDHIST_ERA_OFFSET;
}

export function resolveExportPeriod(period?: {
  fiscalYearBe?: number;
  dateFrom?: string;
  dateTo?: string;
}): AppliedExportPeriod {
  if (period?.dateFrom && period?.dateTo) {
    return { dateFrom: period.dateFrom, dateTo: period.dateTo, source: "EXPLICIT_DATES" };
  }
  if (period?.fiscalYearBe != null) {
    const gregYear = gregorianYearFromBe(period.fiscalYearBe);
    return {
      dateFrom: isoDay(fiscalYearStart(gregYear)),
      dateTo: isoDay(fiscalYearEnd(gregYear)),
      appliedFiscalYearBe: period.fiscalYearBe,
      source: "FISCAL_YEAR",
    };
  }
  return { source: "NONE" };
}

export function parseExportIsoStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseExportIsoEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`);
}
