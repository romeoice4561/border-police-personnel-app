import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateTwoStepEligibility, EligibilityStatus, ReasonCode } from "@/lib/officer_profile/career_salary_engine";
import { draftRowsForSimulation } from "@/components/officer/salary_history_editor";
import type { SalaryHistoryDraftRow } from "@/components/officer/use_officer_workspace";

// Phase 28C — Career Intelligence Live Simulation.
//
// SalaryHistoryEditor's draft rows are string-keyed (Select-bound), so this
// test file exercises the SAME composition the editor renders on every
// change: draftRowsForSimulation(rows) -> evaluateTwoStepEligibility(...).
// No new business logic is introduced here — draftRowsForSimulation only
// adapts string draft fields into the engine's plain SalaryHistoryLike
// shape; the eligibility rule itself is exactly Phase 28B's engine.

const NOW_2569 = new Date(Date.UTC(2026, 6, 12));

function draftRow(key: string, yearBE: string, salaryStep: string, remarks = ""): SalaryHistoryDraftRow {
  return { key, yearBE, salaryStep, remarks };
}

function simulate(rows: SalaryHistoryDraftRow[]) {
  return evaluateTwoStepEligibility(draftRowsForSimulation(rows), NOW_2569);
}

test("draftRowsForSimulation drops rows with no year or no step selected (untouched blank rows are not 'missing years')", () => {
  const rows = [draftRow("a", "2567", "2.0"), draftRow("b", "", ""), draftRow("c", "2568", "")];
  const mapped = draftRowsForSimulation(rows);
  assert.deepEqual(
    mapped.map((r) => r.yearBE),
    [2567]
  );
});

test("changing a row's salary step from 2.0 to 1.0 flips the simulation from NOT_ELIGIBLE to ELIGIBLE", () => {
  const before = [draftRow("a", "2567", "2.0"), draftRow("b", "2568", "2.0")];
  const beforeResult = simulate(before);
  assert.equal(beforeResult.status, EligibilityStatus.NotEligible);
  assert.equal(beforeResult.reasonCode, ReasonCode.ThreeConsecutive);

  const after = [draftRow("a", "2567", "1.0"), draftRow("b", "2568", "2.0")];
  const afterResult = simulate(after);
  assert.equal(afterResult.status, EligibilityStatus.Eligible);
});

test("changing a row's year moves it out of the required 2-year window, flipping the result to UNKNOWN", () => {
  const before = [draftRow("a", "2567", "2.0"), draftRow("b", "2568", "2.0")];
  assert.equal(simulate(before).status, EligibilityStatus.NotEligible);

  // Row "a" moved from 2567 to 2560 — no longer one of the 2 years the
  // current-year (2569) evaluation needs, so 2567 is now missing.
  const after = [draftRow("a", "2560", "2.0"), draftRow("b", "2568", "2.0")];
  const afterResult = simulate(after);
  assert.equal(afterResult.status, EligibilityStatus.Unknown);
  assert.equal(afterResult.reasonCode, ReasonCode.MissingYear);
});

test("deleting a required prior-year row flips the simulation to UNKNOWN", () => {
  const before = [draftRow("a", "2567", "1.0"), draftRow("b", "2568", "2.0")];
  assert.equal(simulate(before).status, EligibilityStatus.Eligible);

  const afterDelete = before.filter((r) => r.key !== "a");
  const afterResult = simulate(afterDelete);
  assert.equal(afterResult.status, EligibilityStatus.Unknown);
  assert.equal(afterResult.reasonCode, ReasonCode.MissingYear);
});

test("adding a missing prior-year row flips the simulation from UNKNOWN to a determined result", () => {
  const before = [draftRow("a", "2568", "2.0")];
  assert.equal(simulate(before).status, EligibilityStatus.Unknown);

  const afterAdd = [...before, draftRow("b", "2567", "2.0")];
  const afterResult = simulate(afterAdd);
  assert.equal(afterResult.status, EligibilityStatus.NotEligible);
  assert.equal(afterResult.reasonCode, ReasonCode.ThreeConsecutive);
});

test("multiple edits in sequence (add, then change step, then change year) each recompute the simulation correctly", () => {
  let rows: SalaryHistoryDraftRow[] = [];
  assert.equal(simulate(rows).status, EligibilityStatus.Unknown);

  rows = [...rows, draftRow("a", "2567", "2.0")];
  assert.equal(simulate(rows).status, EligibilityStatus.Unknown); // 2568 still missing

  rows = [...rows, draftRow("b", "2568", "2.0")];
  assert.equal(simulate(rows).status, EligibilityStatus.NotEligible); // both prior years are 2.0

  rows = rows.map((r) => (r.key === "b" ? { ...r, salaryStep: "1.0" } : r));
  assert.equal(simulate(rows).status, EligibilityStatus.Eligible); // streak broken

  rows = rows.map((r) => (r.key === "a" ? { ...r, yearBE: "2560" } : r));
  assert.equal(simulate(rows).status, EligibilityStatus.Unknown); // 2567 now missing again
});

test("the draft simulation and a hypothetical persisted evaluation of the identical rows produce an identical result (Save makes them converge)", () => {
  const draft = [draftRow("a", "2567", "2.0"), draftRow("b", "2568", "1.0")];
  const draftResult = simulate(draft);

  // Simulates what evaluateTwoStepEligibility sees once these exact rows
  // are persisted (the shape save() sends to the server) — proving the
  // SAME engine call used for both cards converges once Save has run.
  const persistedShape = draft.map((r) => ({ yearBE: Number(r.yearBE), salaryStep: Number(r.salaryStep) }));
  const persistedResult = evaluateTwoStepEligibility(persistedShape, NOW_2569);

  assert.deepEqual(draftResult, persistedResult);
});
