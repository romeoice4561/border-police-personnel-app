/**
 * Commander Promotion UX refinement — promotion_display.ts tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { overdueOpportunities } from "@/lib/commander_query/promotion_display";

test("first eligible fiscal year 2568, current fiscal year 2569 -> 1 missed opportunity (overdueYears=2)", () => {
  // 2569 is eligibility year 2 (per the task's exact example), so overdueYears=2.
  assert.equal(overdueOpportunities(2), 1);
});

test("the officer's first eligible year (overdueYears=1) has not missed any opportunity yet", () => {
  assert.equal(overdueOpportunities(1), null);
});

test("not yet eligible (overdueYears null or 0) returns null, never a fabricated zero", () => {
  assert.equal(overdueOpportunities(null), null);
  assert.equal(overdueOpportunities(0), null);
});

test("three missed opportunities when overdueYears is 4", () => {
  assert.equal(overdueOpportunities(4), 3);
});
