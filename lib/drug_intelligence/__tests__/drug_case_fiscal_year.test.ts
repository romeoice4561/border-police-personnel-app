/**
 * Tests for the DI-3.1 DrugCase fiscal-year wrapper. The Sep 30 / Oct 1
 * boundary rule itself is already exhaustively tested at its canonical
 * source (lib/personnel_calendar/__tests__/personnel_calendar.test.ts) —
 * this file only confirms the Drug-specific adapter delegates correctly
 * and handles the Drug-specific null-arrestDate case that helper's other
 * callers don't have.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fiscalYearForDrugCaseArrestDate } from "@/lib/drug_intelligence/drug_case_fiscal_year";

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

test("null arrestDate returns null — never guesses a fiscal year from another field", () => {
  assert.equal(fiscalYearForDrugCaseArrestDate(null), null);
});

test("2026-09-30 falls in FY 2569 (Buddhist Era) — the last day of the fiscal year", () => {
  const summary = fiscalYearForDrugCaseArrestDate(utcDate(2026, 9, 30));
  assert.ok(summary);
  assert.equal(summary?.fiscalYearBe, 2569);
});

test("2026-10-01 falls in FY 2570 (Buddhist Era) — the first day of the next fiscal year", () => {
  const summary = fiscalYearForDrugCaseArrestDate(utcDate(2026, 10, 1));
  assert.ok(summary);
  assert.equal(summary?.fiscalYearBe, 2570);
});

test("delegates display text formatting to the canonical helper — never hand-derives \"ปีงบประมาณ N\" itself", () => {
  const summary = fiscalYearForDrugCaseArrestDate(utcDate(2026, 10, 1));
  assert.equal(summary?.displayFiscalYearTh, "ปีงบประมาณ 2570");
});
