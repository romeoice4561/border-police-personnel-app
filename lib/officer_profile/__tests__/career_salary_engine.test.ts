import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sortHistory,
  latestHistory,
  countTwoStep,
  historyMap,
  evaluateTwoStepEligibility,
  EligibilityStatus,
  ReasonCode,
} from "@/lib/officer_profile/career_salary_engine";

interface Row {
  id: number;
  yearBE: number;
  salaryStep: number;
  remarks: string | null;
}

function row(id: number, yearBE: number, salaryStep: number, remarks: string | null = null): Row {
  return { id, yearBE, salaryStep, remarks };
}

test("sortHistory orders rows newest year first (descending)", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2569, 2.0), row(3, 2567, 0.5)];
  assert.deepEqual(sortHistory(rows).map((r) => r.yearBE), [2569, 2567, 2566]);
});

test("sortHistory does not mutate the input array", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2569, 2.0)];
  const original = [...rows];
  sortHistory(rows);
  assert.deepEqual(rows, original);
});

test("sortHistory returns an empty array for empty input", () => {
  assert.deepEqual(sortHistory([]), []);
});

test("latestHistory returns the row with the highest yearBE", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2569, 2.0), row(3, 2567, 0.5)];
  assert.equal(latestHistory(rows)?.yearBE, 2569);
});

test("latestHistory returns null for an empty list (never invents a row)", () => {
  assert.equal(latestHistory([]), null);
});

test("latestHistory with a single row returns that row", () => {
  const rows = [row(1, 2568, 1.5)];
  assert.equal(latestHistory(rows)?.id, 1);
});

test("countTwoStep counts only rows with salaryStep exactly 2.0", () => {
  const rows = [row(1, 2566, 2.0), row(2, 2567, 1.5), row(3, 2568, 2.0), row(4, 2569, 1.0)];
  assert.equal(countTwoStep(rows), 2);
});

test("countTwoStep returns 0 when no row is a two-step result", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2567, 0.5)];
  assert.equal(countTwoStep(rows), 0);
});

test("countTwoStep returns 0 for an empty list", () => {
  assert.equal(countTwoStep([]), 0);
});

test("historyMap indexes rows by yearBE for O(1) lookup", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2569, 2.0)];
  const map = historyMap(rows);
  assert.equal(map.get(2569)?.salaryStep, 2.0);
  assert.equal(map.get(2566)?.salaryStep, 1.0);
  assert.equal(map.get(2568), undefined);
});

test("historyMap: given duplicate years (should never occur in practice — enforced by the DB unique constraint), the LAST row wins rather than throwing", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2566, 2.0)];
  const map = historyMap(rows);
  assert.equal(map.get(2566)?.id, 2);
});

// ── Phase 28B: evaluateTwoStepEligibility ──
//
// `now` is fixed to a deterministic date so "the current Buddhist year" is
// always 2569 in these tests (2026-07-12 CE = 2569 BE), matching every
// worked example in the phase spec. A separate test (Part 4) proves the
// evaluated year genuinely shifts with `now` rather than being hardcoded.

const NOW_2569 = new Date(Date.UTC(2026, 6, 12));

test("Case A (spec worked example): 2566=2.0, 2567=1.0, 2568=2.0 -> 2569 is ELIGIBLE (only two consecutive years, 2567 breaks the run)", () => {
  const rows = [row(1, 2566, 2.0), row(2, 2567, 1.0), row(3, 2568, 2.0)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  assert.equal(result.status, EligibilityStatus.Eligible);
  assert.equal(result.reasonCode, ReasonCode.EligiblePattern);
  assert.equal(result.yearBE, 2569);
});

test("Case B (spec worked example): 2566=1.0, 2567=2.0, 2568=2.0 -> 2569 is NOT_ELIGIBLE (would become three consecutive years)", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2567, 2.0), row(3, 2568, 2.0)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  assert.equal(result.status, EligibilityStatus.NotEligible);
  assert.equal(result.reasonCode, ReasonCode.ThreeConsecutive);
  assert.equal(result.yearBE, 2569);
});

test("1-2-2 pattern (same as Case B, phrased per Part 6's pattern list): NOT_ELIGIBLE", () => {
  const rows = [row(1, 2566, 1.0), row(2, 2567, 2.0), row(3, 2568, 2.0)];
  assert.equal(evaluateTwoStepEligibility(rows, NOW_2569).status, EligibilityStatus.NotEligible);
});

test("2-2-? pattern with only the 2 required prior years present: NOT_ELIGIBLE", () => {
  const rows = [row(1, 2567, 2.0), row(2, 2568, 2.0)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  assert.equal(result.status, EligibilityStatus.NotEligible);
  assert.equal(result.reasonCode, ReasonCode.ThreeConsecutive);
});

test("missing years: only 2567 present, 2568 absent -> UNKNOWN (never guessed)", () => {
  const rows = [row(1, 2567, 2.0)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  assert.equal(result.status, EligibilityStatus.Unknown);
  assert.equal(result.reasonCode, ReasonCode.MissingYear);
});

test("missing years: only 2568 present, 2567 absent -> UNKNOWN (never guessed)", () => {
  const rows = [row(1, 2568, 2.0)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  assert.equal(result.status, EligibilityStatus.Unknown);
  assert.equal(result.reasonCode, ReasonCode.MissingYear);
});

test("single year of history (2568 only): UNKNOWN — 2567 is still missing", () => {
  const rows = [row(1, 2568, 1.0)];
  assert.equal(evaluateTwoStepEligibility(rows, NOW_2569).status, EligibilityStatus.Unknown);
});

test("two years of history covering exactly 2567 and 2568: enough to decide, no UNKNOWN", () => {
  const rows = [row(1, 2567, 0.5), row(2, 2568, 1.0)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  assert.equal(result.status, EligibilityStatus.Eligible);
});

test("empty history: UNKNOWN (no prior years recorded at all)", () => {
  const result = evaluateTwoStepEligibility([], NOW_2569);
  assert.equal(result.status, EligibilityStatus.Unknown);
  assert.equal(result.reasonCode, ReasonCode.MissingYear);
});

test("random insertion order does not affect the result (historyMap/lookup is order-independent)", () => {
  const inOrder = [row(1, 2566, 1.0), row(2, 2567, 2.0), row(3, 2568, 2.0)];
  const shuffled = [row(3, 2568, 2.0), row(1, 2566, 1.0), row(2, 2567, 2.0)];
  assert.deepEqual(evaluateTwoStepEligibility(inOrder, NOW_2569), evaluateTwoStepEligibility(shuffled, NOW_2569));
});

test("years further back than the 2 immediately preceding the current year never affect the result (only a 3-run ending at the current year matters)", () => {
  const withOldHistory = [row(1, 2560, 2.0), row(2, 2561, 2.0), row(3, 2562, 2.0), row(4, 2567, 1.0), row(5, 2568, 2.0)];
  const withoutOldHistory = [row(4, 2567, 1.0), row(5, 2568, 2.0)];
  assert.deepEqual(evaluateTwoStepEligibility(withOldHistory, NOW_2569), evaluateTwoStepEligibility(withoutOldHistory, NOW_2569));
});

test("a non-2.0 value in either required prior year is NOT treated as missing — it legitimately breaks the streak (ELIGIBLE, not UNKNOWN)", () => {
  const rows = [row(1, 2567, 0.5), row(2, 2568, 0.5)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  assert.equal(result.status, EligibilityStatus.Eligible);
  assert.notEqual(result.status, EligibilityStatus.Unknown);
});

test("Part 4: the evaluated year is always the REAL current Buddhist year, never hardcoded — changing `now` changes yearBE and the whole evaluation", () => {
  const rows = [row(1, 2567, 2.0), row(2, 2568, 2.0)]; // would make 2569 NOT_ELIGIBLE
  const thisYear = evaluateTwoStepEligibility(rows, new Date(Date.UTC(2026, 6, 12)));
  const nextYear = evaluateTwoStepEligibility(rows, new Date(Date.UTC(2027, 6, 12)));
  assert.equal(thisYear.yearBE, 2569);
  assert.equal(nextYear.yearBE, 2570);
  // A year later, 2567/2568 are no longer the 2 years immediately preceding
  // the current year (2568/2569 are), and 2569 has no recorded row, so the
  // evaluation flips to UNKNOWN — proving the function truly recomputes
  // from `now` rather than caching/hardcoding a year.
  assert.equal(thisYear.status, EligibilityStatus.NotEligible);
  assert.equal(nextYear.status, EligibilityStatus.Unknown);
});

test("EvaluationResult is a plain data shape with no UI dependency (Part 5) — every field is a primitive or enum value", () => {
  const result = evaluateTwoStepEligibility([row(1, 2567, 2.0), row(2, 2568, 2.0)], NOW_2569);
  assert.equal(typeof result.status, "string");
  assert.equal(typeof result.reasonCode, "string");
  assert.equal(typeof result.reason, "string");
  assert.equal(typeof result.yearBE, "number");
});

test("the current year's OWN saved value (if any) never affects the evaluation — the question is always hypothetical", () => {
  const rows = [row(1, 2567, 1.0), row(2, 2568, 1.0), row(3, 2569, 0.5)];
  const result = evaluateTwoStepEligibility(rows, NOW_2569);
  // 2569 already has 0.5 saved, but the engine still answers "could 2569 be 2.0" against 2567/2568.
  assert.equal(result.status, EligibilityStatus.Eligible);
  assert.equal(result.yearBE, 2569);
});
