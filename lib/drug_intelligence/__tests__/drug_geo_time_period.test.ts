/**
 * DI-8.2 — map time-period preset tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDrugGeoTimePeriodRange, drugGeoTimePeriodLabel, isValidDrugGeoTimePeriod } from "@/lib/drug_intelligence/drug_geo_time_period";

test("TODAY resolves to the same date for both dateFrom and dateTo", () => {
  const now = new Date(Date.UTC(2026, 5, 15)); // 15 Jun 2026
  const range = resolveDrugGeoTimePeriodRange("TODAY", now);
  assert.equal(range.dateFrom, "2026-06-15");
  assert.equal(range.dateTo, "2026-06-15");
});

test("THIS_MONTH resolves to the first and last day of the calendar month", () => {
  const now = new Date(Date.UTC(2026, 1, 10)); // 10 Feb 2026 (leap year)
  const range = resolveDrugGeoTimePeriodRange("THIS_MONTH", now);
  assert.equal(range.dateFrom, "2026-02-01");
  assert.equal(range.dateTo, "2026-02-28");
});

test("THIS_MONTH handles a leap-year February correctly", () => {
  const now = new Date(Date.UTC(2028, 1, 10)); // Feb 2028 is a leap year
  const range = resolveDrugGeoTimePeriodRange("THIS_MONTH", now);
  assert.equal(range.dateTo, "2028-02-29");
});

test("THIS_QUARTER resolves to the Thai fiscal quarter (Oct-Dec = Q1), not the calendar quarter", () => {
  const now = new Date(Date.UTC(2026, 9, 15)); // 15 Oct 2026 — fiscal Q1
  const range = resolveDrugGeoTimePeriodRange("THIS_QUARTER", now);
  assert.equal(range.dateFrom, "2026-10-01");
  assert.equal(range.dateTo, "2026-12-31");
});

test("THIS_FISCAL_YEAR resolves to 1 Oct - 30 Sep, not the calendar year", () => {
  const now = new Date(Date.UTC(2026, 5, 15)); // 15 Jun 2026 — within FY2026 (started 1 Oct 2025)
  const range = resolveDrugGeoTimePeriodRange("THIS_FISCAL_YEAR", now);
  assert.equal(range.dateFrom, "2025-10-01");
  assert.equal(range.dateTo, "2026-09-30");
});

test("drugGeoTimePeriodLabel returns Thai and English labels", () => {
  assert.equal(drugGeoTimePeriodLabel("THIS_FISCAL_YEAR", "th"), "ปีงบประมาณนี้");
  assert.equal(drugGeoTimePeriodLabel("THIS_FISCAL_YEAR", "en"), "This fiscal year");
  assert.equal(drugGeoTimePeriodLabel("CUSTOM", "th"), "กำหนดช่วงเอง");
});

test("isValidDrugGeoTimePeriod distinguishes valid from invalid values", () => {
  assert.equal(isValidDrugGeoTimePeriod("THIS_MONTH"), true);
  assert.equal(isValidDrugGeoTimePeriod("NEXT_WEEK"), false);
  assert.equal(isValidDrugGeoTimePeriod(""), false);
});
