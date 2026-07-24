/**
 * Commander Promotion UX refinement — promotion_display.ts tests (Phase 49.9).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { overdueOpportunities } from "@/lib/commander_query/promotion_display";

test("first eligible cycle (overdueYears=0) has not missed any opportunity", () => {
  assert.equal(overdueOpportunities(0), null);
});

test("one completed waiting year (overdueYears=1) -> 1 missed opportunity", () => {
  assert.equal(overdueOpportunities(1), 1);
});

test("not yet eligible (overdueYears null) returns null, never a fabricated zero", () => {
  assert.equal(overdueOpportunities(null), null);
});

test("three missed opportunities when overdueYears is 3 — no local −1 repair", () => {
  assert.equal(overdueOpportunities(3), 3);
});
