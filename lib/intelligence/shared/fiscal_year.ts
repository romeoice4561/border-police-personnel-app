/**
 * Thai government fiscal-year facade (Phase 40B).
 *
 * Wraps the existing, already-correct lib/personnel_calendar/fiscal_year.ts
 * (1 Oct - 30 Sep, Gregorian-year-labeled internally) with a Buddhist-Era
 * display pair, so consumers stop hand-deriving "ปีงบประมาณ N" text
 * themselves. Does not change the fiscal-year boundary rule — that rule
 * (30 Sep belongs to FY N, 1 Oct belongs to FY N+1) is unchanged and lives
 * entirely in lib/personnel_calendar/fiscal_year.ts's currentFiscalYear.
 *
 * Pure — no I/O, no React.
 */

import { currentFiscalYear, fiscalYearStart, fiscalYearEnd, utcDate } from "@/lib/personnel_calendar";
import { toBuddhistEraYear } from "@/lib/intelligence/shared/thai_date";

export interface FiscalYearSummary {
  /** Internal numeric fiscal year, Gregorian-labeled (matches lib/personnel_calendar's FiscalYear.year) — technical/calculation value, never shown to a user directly. */
  fiscalYear: number;
  /** The same fiscal year, Buddhist-Era labeled — the value a user sees. */
  fiscalYearBe: number;
  start: Date;
  end: Date;
  /** "ปีงบประมาณ 2570" */
  displayFiscalYearTh: string;
}

/** Computes the Thai government fiscal year containing `date` (defaults to now), with both the internal Gregorian-labeled value and the Buddhist-Era display text. */
export function computeFiscalYearSummary(date: Date = new Date()): FiscalYearSummary {
  const fiscalYear = currentFiscalYear(date);
  const fiscalYearBe = toBuddhistEraYear(fiscalYear);
  return {
    fiscalYear,
    fiscalYearBe,
    start: fiscalYearStart(fiscalYear),
    end: fiscalYearEnd(fiscalYear),
    displayFiscalYearTh: `ปีงบประมาณ ${fiscalYearBe}`,
  };
}

/** 1 (Oct–Dec) .. 4 (Jul–Sep) — the Thai government fiscal quarter, distinct from the calendar quarter. */
export type FiscalQuarter = 1 | 2 | 3 | 4;

export interface FiscalQuarterSummary {
  /** The fiscal year this quarter belongs to (matches computeFiscalYearSummary's fiscalYear for the same date). */
  fiscalYear: number;
  fiscalYearBe: number;
  quarter: FiscalQuarter;
  start: Date;
  end: Date;
  /** "ไตรมาส 2 ปีงบประมาณ 2570" */
  displayFiscalQuarterTh: string;
}

/**
 * Phase DI-7.7, Section 7: Thai government fiscal quarter — Q1=Oct-Dec,
 * Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep (never the calendar quarter, which
 * starts in January). No existing helper in this codebase computed this
 * before DI-7.7 (audited: grep across lib/ for fiscalQuarter/ไตรมาส found
 * nothing) — this is additive to, not a replacement for,
 * computeFiscalYearSummary, and reuses currentFiscalYear/toBuddhistEraYear
 * rather than re-deriving the Oct 1 boundary rule.
 */
export function computeFiscalQuarterSummary(date: Date = new Date()): FiscalQuarterSummary {
  const fiscalYear = currentFiscalYear(date);
  const fiscalYearBe = toBuddhistEraYear(fiscalYear);
  const month = date.getUTCMonth() + 1; // 1-12, calendar month of the given date

  // Fiscal quarter boundaries, expressed as calendar (month, quarter) pairs
  // WITHIN the fiscal year they belong to — Oct/Nov/Dec belong to Q1 of the
  // fiscal year that starts that same October (fiscalYear = calendar year + 1
  // for those months, already handled by currentFiscalYear above).
  let quarter: FiscalQuarter;
  if (month >= 10) quarter = 1; // Oct, Nov, Dec
  else if (month <= 3) quarter = 2; // Jan, Feb, Mar
  else if (month <= 6) quarter = 3; // Apr, May, Jun
  else quarter = 4; // Jul, Aug, Sep

  const quarterStartMonths: Record<FiscalQuarter, number> = { 1: 10, 2: 1, 3: 4, 4: 7 };
  const startMonth = quarterStartMonths[quarter];
  // Q1 starts in the PRECEDING calendar year relative to the fiscal year label.
  const startCalendarYear = quarter === 1 ? fiscalYear - 1 : fiscalYear;
  const start = utcDate(startCalendarYear, startMonth, 1);
  // End = the last day of the quarter's 3rd month, via utcDate's day=0 trick
  // (day 0 of month M means "the last day of month M-1" in Date.UTC's
  // rollover semantics) — avoids hardcoding month lengths/leap years.
  const end = utcDate(startCalendarYear, startMonth + 3, 0);

  return {
    fiscalYear,
    fiscalYearBe,
    quarter,
    start,
    end,
    displayFiscalQuarterTh: `ไตรมาส ${quarter} ปีงบประมาณ ${fiscalYearBe}`,
  };
}
