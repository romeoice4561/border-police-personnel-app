/**
 * Tests for computeFiscalQuarterSummary (Phase DI-7.7, Section 7). The
 * underlying Oct 1 fiscal-year boundary itself is already exhaustively
 * tested at its canonical source (lib/personnel_calendar/__tests__) — this
 * file covers the NEW fiscal-quarter boundaries this phase adds: Q1=Oct-Dec,
 * Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFiscalQuarterSummary } from "@/lib/intelligence/shared/fiscal_year";

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

test("2026-10-01 (fiscal year start) is Q1 of FY 2570", () => {
  const s = computeFiscalQuarterSummary(utcDate(2026, 10, 1));
  assert.equal(s.quarter, 1);
  assert.equal(s.fiscalYearBe, 2570);
});

test("2026-12-31 (last day of Q1) is still Q1 of FY 2570", () => {
  const s = computeFiscalQuarterSummary(utcDate(2026, 12, 31));
  assert.equal(s.quarter, 1);
  assert.equal(s.fiscalYearBe, 2570);
});

test("2027-01-01 (first day of Q2) rolls to Q2, same fiscal year FY 2570", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 1, 1));
  assert.equal(s.quarter, 2);
  assert.equal(s.fiscalYearBe, 2570);
});

test("2027-03-31 (last day of Q2) is still Q2", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 3, 31));
  assert.equal(s.quarter, 2);
});

test("2027-04-01 (first day of Q3) rolls to Q3", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 4, 1));
  assert.equal(s.quarter, 3);
});

test("2027-06-30 (last day of Q3) is still Q3", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 6, 30));
  assert.equal(s.quarter, 3);
});

test("2027-07-01 (first day of Q4) rolls to Q4", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 7, 1));
  assert.equal(s.quarter, 4);
});

test("2027-09-30 (last day of Q4, last day of FY 2570) is still Q4 of FY 2570", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 9, 30));
  assert.equal(s.quarter, 4);
  assert.equal(s.fiscalYearBe, 2570);
});

test("2027-10-01 rolls into Q1 of the NEXT fiscal year, FY 2571", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 10, 1));
  assert.equal(s.quarter, 1);
  assert.equal(s.fiscalYearBe, 2571);
});

test("start/end dates bound the quarter correctly (Q1 of FY 2570 = 2026-10-01 .. 2026-12-31)", () => {
  const s = computeFiscalQuarterSummary(utcDate(2026, 11, 15));
  assert.equal(s.start.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(s.end.toISOString().slice(0, 10), "2026-12-31");
});

test("start/end dates bound Q4 correctly (Q4 of FY 2570 = 2027-07-01 .. 2027-09-30)", () => {
  const s = computeFiscalQuarterSummary(utcDate(2027, 8, 1));
  assert.equal(s.start.toISOString().slice(0, 10), "2027-07-01");
  assert.equal(s.end.toISOString().slice(0, 10), "2027-09-30");
});

test("displayFiscalQuarterTh is Thai-labeled with Buddhist-Era year, never hand-derived at call sites", () => {
  const s = computeFiscalQuarterSummary(utcDate(2026, 11, 1));
  assert.equal(s.displayFiscalQuarterTh, "ไตรมาส 1 ปีงบประมาณ 2570");
});
