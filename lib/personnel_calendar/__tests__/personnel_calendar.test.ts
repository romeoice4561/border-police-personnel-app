import assert from "node:assert/strict";
import test from "node:test";
import {
  addYears,
  calculateAge,
  calculateGovernmentServiceDuration,
  calculateRetirement,
  calculateRetirementDate,
  currentFiscalYear,
  evaluateEligibility,
  fiscalYearEnd,
  fiscalYearForDate,
  fiscalYearStart,
  isLeapYear,
  nextFiscalYear,
  previousFiscalYear,
  utcDate,
  type EligibilityRule,
} from "@/lib/personnel_calendar";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

test("calculates exact current age in years, months, and days", () => {
  assert.deepEqual(calculateAge(utcDate(1985, 9, 30), utcDate(2026, 7, 14)), {
    years: 40,
    months: 9,
    days: 14,
  });
});

test("calculates government service years from official service start date", () => {
  assert.deepEqual(calculateGovernmentServiceDuration(utcDate(2010, 4, 1), utcDate(2026, 7, 14)), {
    years: 16,
    months: 3,
    days: 13,
  });
});

test("fiscal year helpers use Thai government fiscal year boundaries", () => {
  assert.equal(currentFiscalYear(utcDate(2026, 9, 30)), 2026);
  assert.equal(currentFiscalYear(utcDate(2026, 10, 1)), 2027);
  assert.equal(iso(fiscalYearStart(2027)), "2026-10-01");
  assert.equal(iso(fiscalYearEnd(2027)), "2027-09-30");
  assert.equal(nextFiscalYear(2027), 2028);
  assert.equal(previousFiscalYear(2027), 2026);
  assert.deepEqual(
    {
      year: fiscalYearForDate(utcDate(2026, 10, 1)).year,
      start: iso(fiscalYearForDate(utcDate(2026, 10, 1)).start),
      end: iso(fiscalYearForDate(utcDate(2026, 10, 1)).end),
    },
    { year: 2027, start: "2026-10-01", end: "2027-09-30" }
  );
});

test("born 30 Sep retires at end of same fiscal year", () => {
  assert.equal(iso(calculateRetirementDate(utcDate(1985, 9, 30))), "2045-09-30");
});

test("born 1 Oct retires at end of next fiscal year", () => {
  assert.equal(iso(calculateRetirementDate(utcDate(1985, 10, 1))), "2046-09-30");
});

test("born 2 Oct retires at end of next fiscal year", () => {
  const retirement = calculateRetirement(utcDate(1985, 10, 2), utcDate(2045, 10, 2));
  assert.equal(iso(retirement!.retirementDate), "2046-09-30");
  assert.equal(retirement!.retirementFiscalYear, 2046);
  assert.deepEqual(retirement!.remaining, { years: 0, months: 11, days: 28 });
});

test("leap year and 29 Feb are handled without invalid dates", () => {
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2100), false);
  assert.equal(iso(addYears(utcDate(2000, 2, 29), 1)), "2001-02-28");
  assert.equal(iso(calculateRetirementDate(utcDate(1988, 2, 29))), "2048-09-30");
});

test("retirement remaining time is zero after retirement date", () => {
  const retirement = calculateRetirement(utcDate(1965, 9, 30), utcDate(2025, 10, 1));
  assert.equal(retirement!.isRetired, true);
  assert.deepEqual(retirement!.remaining, { years: 0, months: 0, days: 0 });
});

test("eligibility framework evaluates pluggable module rules without policy baked in", () => {
  const rules: EligibilityRule[] = [
    {
      module: "RETIREMENT",
      code: "retirement-review",
      evaluate: () => ({ module: "RETIREMENT", status: "needs_review", reasons: ["Within retirement review workflow."] }),
    },
  ];

  const results = evaluateEligibility({ asOf: utcDate(2026, 7, 14) }, rules, ["PROMOTION", "RETIREMENT"]);
  assert.deepEqual(results, [
    { module: "PROMOTION", status: "not_applicable", reasons: ["No rule registered."], effectiveDate: null },
    { module: "RETIREMENT", status: "needs_review", reasons: ["Within retirement review workflow."], effectiveDate: null },
  ]);
});
