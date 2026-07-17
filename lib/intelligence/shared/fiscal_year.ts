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

import { currentFiscalYear, fiscalYearStart, fiscalYearEnd } from "@/lib/personnel_calendar";
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
