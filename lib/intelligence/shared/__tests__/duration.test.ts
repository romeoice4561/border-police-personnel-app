/**
 * yearCountSince tests (Phase 44.1 — position-level year-count fix).
 *
 * `yearCountSince` is the commander-facing Buddhist-Era YEAR-COUNT
 * primitive (`currentYearBe - startYearBe`), distinct from `yearsSince`/
 * `yearsFromDuration` (exact elapsed chronological duration). See the
 * function's own doc comment in lib/intelligence/shared/duration.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { yearCountSince } from "@/lib/intelligence/shared/duration";

test("2569 - 2564 = 5, never adding 1 after subtraction", () => {
  assert.equal(yearCountSince(2564, 2569), 5);
});

test("same year -> 0, not 1", () => {
  assert.equal(yearCountSince(2569, 2569), 0);
});

test("null start year -> null, never a fabricated 0", () => {
  assert.equal(yearCountSince(null, 2569), null);
});

test("start year in the future relative to currentYearBe -> negative, not clamped (caller decides how to display)", () => {
  assert.equal(yearCountSince(2570, 2569), -1);
});

test("result is always a whole number — no decimal possible from year subtraction", () => {
  const result = yearCountSince(2560, 2569);
  assert.equal(result, 9);
  assert.ok(Number.isInteger(result));
});
