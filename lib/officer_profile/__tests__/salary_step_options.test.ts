import { test } from "node:test";
import assert from "node:assert/strict";

import { SALARY_STEP_OPTIONS, isValidSalaryStep, defaultSalaryHistoryYearOptions } from "@/lib/officer_profile/salary_step_options";

test("SALARY_STEP_OPTIONS is exactly the 4 legal values, in order", () => {
  assert.deepEqual(SALARY_STEP_OPTIONS, [0.5, 1.0, 1.5, 2.0]);
});

test("isValidSalaryStep accepts every legal value, rejects everything else", () => {
  for (const v of [0.5, 1.0, 1.5, 2.0]) assert.equal(isValidSalaryStep(v), true);
  for (const v of [0, 0.25, 3.0, -1]) assert.equal(isValidSalaryStep(v), false);
});

test("defaultSalaryHistoryYearOptions: current year plus previous 3, descending, derived from `now` (never hardcoded)", () => {
  // Buddhist Era 2569 = Gregorian 2026.
  const now = new Date(Date.UTC(2026, 6, 12));
  assert.deepEqual(defaultSalaryHistoryYearOptions(now), [2569, 2568, 2567, 2566]);
});

test("defaultSalaryHistoryYearOptions changes when `now` changes — never a hardcoded year (Part 8)", () => {
  const thisYear = defaultSalaryHistoryYearOptions(new Date(Date.UTC(2026, 6, 12)));
  const nextYear = defaultSalaryHistoryYearOptions(new Date(Date.UTC(2027, 6, 12)));
  assert.notDeepEqual(thisYear, nextYear);
  assert.equal(nextYear[0], thisYear[0] + 1);
});
