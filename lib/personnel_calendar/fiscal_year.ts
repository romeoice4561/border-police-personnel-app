/**
 * Thai government fiscal year helpers.
 *
 * Fiscal year N starts 1 Oct (N-1) and ends 30 Sep N.
 */

import { utcDate } from "@/lib/personnel_calendar/calendar";
import type { FiscalYear } from "@/lib/personnel_calendar/types";

export function currentFiscalYear(date: Date = new Date()): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return month >= 10 ? year + 1 : year;
}

export function fiscalYearStart(fiscalYear: number): Date {
  return utcDate(fiscalYear - 1, 10, 1);
}

export function fiscalYearEnd(fiscalYear: number): Date {
  return utcDate(fiscalYear, 9, 30);
}

export function nextFiscalYear(fiscalYear: number): number {
  return fiscalYear + 1;
}

export function previousFiscalYear(fiscalYear: number): number {
  return fiscalYear - 1;
}

export function fiscalYearForDate(date: Date): FiscalYear {
  const year = currentFiscalYear(date);
  return {
    year,
    start: fiscalYearStart(year),
    end: fiscalYearEnd(year),
  };
}
