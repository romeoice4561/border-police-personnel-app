import { test } from "node:test";
import assert from "node:assert/strict";

import { sortHistory, latestHistory, countTwoStep, historyMap } from "@/lib/officer_profile/career_salary_engine";

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

test("This phase does NOT determine eligibility — sortHistory/latestHistory/countTwoStep/historyMap are the only exports (foundation only, Part 5)", () => {
  const engine: Record<string, unknown> = { sortHistory, latestHistory, countTwoStep, historyMap };
  assert.deepEqual(Object.keys(engine).sort(), ["countTwoStep", "historyMap", "latestHistory", "sortHistory"]);
});
