/**
 * DrugCase fiscal-year helper (Phase DI-3.1, Section 10).
 *
 * A thin Drug Intelligence wrapper over the ALREADY-CANONICAL, already
 * boundary-tested Thai government fiscal-year helper
 * (lib/personnel_calendar/fiscal_year.ts's currentFiscalYear, wrapped for
 * Buddhist-Era display by lib/intelligence/shared/fiscal_year.ts's
 * computeFiscalYearSummary) — this file does NOT reimplement the Oct
 * 1–Sep 30 boundary rule; it only adapts that helper to DrugCase's
 * `arrestDate: Date | null` shape (a case may have no recorded arrest
 * date, unlike the Personnel-side callers this helper already serves).
 *
 * No fiscalYear column is added to DrugCase — derived on demand from
 * arrestDate, per Section 10's explicit instruction not to persist a
 * redundant manually-maintained value.
 *
 * Pure — no I/O, no React.
 */

import { computeFiscalYearSummary, type FiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";

/** Derives the Thai government fiscal year a DrugCase's arrestDate falls into. Returns null when arrestDate is not recorded — never guesses a fiscal year from another field. */
export function fiscalYearForDrugCaseArrestDate(arrestDate: Date | null): FiscalYearSummary | null {
  if (!arrestDate) return null;
  return computeFiscalYearSummary(arrestDate);
}
