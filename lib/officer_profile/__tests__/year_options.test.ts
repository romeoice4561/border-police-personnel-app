import { test } from "node:test";
import assert from "node:assert/strict";

import { YEAR_OPTIONS, isValidTimelineYear } from "@/lib/officer_profile/year_options";

test("YEAR_OPTIONS spans exactly 2531-2575 inclusive, descending", () => {
  assert.equal(YEAR_OPTIONS.length, 2575 - 2531 + 1);
  assert.equal(YEAR_OPTIONS[0], "2575");
  assert.equal(YEAR_OPTIONS[YEAR_OPTIONS.length - 1], "2531");
});

test("isValidTimelineYear accepts every year in range, rejects 2-digit shorthand", () => {
  assert.equal(isValidTimelineYear("2531"), true);
  assert.equal(isValidTimelineYear("2575"), true);
  assert.equal(isValidTimelineYear("2550"), true);
  // The spec explicitly forbids "31"/"32"/"33" instead of "2531"/"2532"/"2533".
  assert.equal(isValidTimelineYear("31"), false);
  assert.equal(isValidTimelineYear("2530"), false); // one below range
  assert.equal(isValidTimelineYear("2576"), false); // one above range
});
