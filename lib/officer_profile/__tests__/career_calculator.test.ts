import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sortByEffectiveDate,
  calculateCareerYears,
  calculateYearsInRank,
  calculateYearsInPosition,
  calculatePromotionWaitingYears,
  calculateCareerYearsSimple,
  type TimelineDateLike,
} from "@/lib/officer_profile/career_calculator";

const TODAY = new Date(Date.UTC(2026, 6, 7)); // 2026-07-07, matches the session's "today"

function entry(ov: Partial<TimelineDateLike>): TimelineDateLike {
  return { day: null, month: null, yearBE: null, isPresent: false, rank: null, position: "", unit: null, ...ov };
}

test("sortByEffectiveDate orders oldest -> newest", () => {
  const entries = [entry({ yearBE: 2565, position: "C" }), entry({ yearBE: 2550, position: "A" }), entry({ yearBE: 2560, position: "B" })];
  const sorted = sortByEffectiveDate(entries);
  assert.deepEqual(sorted.map((e) => e.position), ["A", "B", "C"]);
});

test("sortByEffectiveDate puts entries with no derivable date last, preserving their relative order", () => {
  const entries = [entry({ yearBE: null, position: "no-date-1" }), entry({ yearBE: 2560, position: "dated" }), entry({ yearBE: null, position: "no-date-2" })];
  const sorted = sortByEffectiveDate(entries);
  assert.deepEqual(sorted.map((e) => e.position), ["dated", "no-date-1", "no-date-2"]);
});

test("calculateCareerYears returns 0 for an empty or entirely undated timeline", () => {
  assert.equal(calculateCareerYears([]), 0);
  assert.equal(calculateCareerYears([entry({})]), 0);
});

test("calculateCareerYears spans earliest to latest dated entry when nothing is ongoing", () => {
  const entries = [entry({ yearBE: 2550 }), entry({ yearBE: 2560 })];
  const years = calculateCareerYears(entries, TODAY);
  assert.equal(years, 10);
});

test("calculateCareerYears spans earliest entry to TODAY when any entry isPresent", () => {
  const entries = [entry({ yearBE: 2550 }), entry({ yearBE: 2560, isPresent: true })];
  const years = calculateCareerYears(entries, TODAY);
  // 2550 BE -> 2007 CE, through 2026-07-07 = ~19.5 years
  assert.ok(years > 19 && years < 20, `expected ~19.x, got ${years}`);
});

test("calculateYearsInRank measures from the start of the CURRENT rank's run, not the whole career", () => {
  const entries = [
    entry({ yearBE: 2550, rank: "ร.ต.ต.", position: "p1" }),
    entry({ yearBE: 2555, rank: "ร.ต.ท.", position: "p2" }),
    entry({ yearBE: 2560, rank: "ร.ต.ท.", position: "p3" }), // same rank, different position
  ];
  const years = calculateYearsInRank(entries, TODAY);
  // Current rank run started at 2555 (BE) = 2012 CE -> the LAST dated entry (2560=2017 CE), not today (no isPresent)
  assert.equal(years, 5);
});

test("calculateYearsInRank extends to TODAY when the timeline has an ongoing (isPresent) entry", () => {
  const entries = [
    entry({ yearBE: 2550, rank: "ร.ต.ต.", position: "p1" }),
    entry({ yearBE: 2560, rank: "ร.ต.ท.", position: "p2", isPresent: true }),
  ];
  const years = calculateYearsInRank(entries, TODAY);
  // 2560 BE = 2017 CE -> 2026-07-07 = ~9.5 years
  assert.ok(years > 9 && years < 10, `expected ~9.x, got ${years}`);
});

test("calculateYearsInRank returns 0 when no entry has a determinable rank", () => {
  assert.equal(calculateYearsInRank([entry({ yearBE: 2560, rank: null })], TODAY), 0);
});

test("calculateYearsInPosition groups by position independently of rank", () => {
  const entries = [
    entry({ yearBE: 2550, rank: "A", position: "pos1" }),
    entry({ yearBE: 2555, rank: "A", position: "pos2" }),
    entry({ yearBE: 2558, rank: "B", position: "pos2" }), // rank changed, position did not
  ];
  const years = calculateYearsInPosition(entries, TODAY);
  // pos2 run started at 2555 (BE)=2012 CE, last dated entry at 2558(BE)=2015 CE
  assert.equal(years, 3);
});

test("calculatePromotionWaitingYears equals calculateYearsInRank", () => {
  const entries = [entry({ yearBE: 2550, rank: "A" }), entry({ yearBE: 2560, rank: "B", isPresent: true })];
  assert.equal(calculatePromotionWaitingYears(entries, TODAY), calculateYearsInRank(entries, TODAY));
});

// ── Phase 26B Part 5 Part B: calculateCareerYearsSimple ──────────────────────

test("matches the spec's own worked example exactly: current 2569, earliest 2536 -> 33", () => {
  const entries = [{ yearBE: 2536 }, { yearBE: 2560 }, { yearBE: 2569 }];
  assert.equal(calculateCareerYearsSimple(entries, 2569), 33);
});

test("uses only the EARLIEST yearBE, ignoring row order", () => {
  const entries = [{ yearBE: 2560 }, { yearBE: 2536 }, { yearBE: 2555 }];
  assert.equal(calculateCareerYearsSimple(entries, 2569), 33);
});

test("returns 0 when no entry has a structured yearBE (never guesses from legacy free-text year)", () => {
  assert.equal(calculateCareerYearsSimple([], 2569), 0);
  assert.equal(calculateCareerYearsSimple([{ yearBE: null }, { yearBE: undefined }], 2569), 0);
});

test("ignores un-migrated rows (yearBE null) mixed in with migrated ones", () => {
  const entries = [{ yearBE: 2540 }, { yearBE: null }, { yearBE: 2560 }];
  assert.equal(calculateCareerYearsSimple(entries, 2569), 29);
});

test("never returns a negative value (a future/bad yearBE never produces negative career years)", () => {
  assert.equal(calculateCareerYearsSimple([{ yearBE: 2580 }], 2569), 0);
});
