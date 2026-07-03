/**
 * Unit tests for repair reporting + statistics (Phase 10C): RepairReport
 * inspectors and the summary builder (repaired images, validation before/
 * after, repair types, top repairs). Pure — hand-built reports.
 *
 * Run with:
 *   npx tsx --test lib/repair/__tests__/repair_statistics.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DefaultRepairStatisticsBuilder } from "@/lib/repair/repair_statistics";
import { recoveredValidation, wasRepaired } from "@/lib/repair/repair_report";
import type { RepairAction, RepairReport } from "@/lib/repair/repair_types";
import type { ValidationResult } from "@/lib/types/vision";

function valid(v: boolean): ValidationResult {
  return { valid: v, errors: v ? [] : [{ field: "x", message: "bad" }], warnings: [] };
}

function report(before: boolean, after: boolean, actions: RepairAction[]): RepairReport {
  return {
    repairsApplied: actions,
    beforeValidation: valid(before),
    afterValidation: valid(after),
    warnings: [],
  };
}

const phoneAction: RepairAction = { type: "phone_reformat", field: "phone", detail: "x" };
const timelineAction: RepairAction = { type: "timeline_remove_empty", field: "timeline[0]", detail: "x" };

test("wasRepaired / recoveredValidation inspectors", () => {
  assert.equal(wasRepaired(report(true, true, [])), false);
  assert.equal(wasRepaired(report(true, true, [phoneAction])), true);
  assert.equal(recoveredValidation(report(false, true, [timelineAction])), true);
  assert.equal(recoveredValidation(report(true, true, [])), false);
  assert.equal(recoveredValidation(report(false, false, [])), false);
});

test("empty builder reports zeroes", () => {
  const s = new DefaultRepairStatisticsBuilder().build();
  assert.equal(s.total_images, 0);
  assert.equal(s.repaired_images, 0);
  assert.equal(s.validation_before, 0);
  assert.equal(s.validation_after, 0);
  assert.deepEqual(s.top_repairs, []);
});

test("counts repaired images, validation before/after, and recovery", () => {
  const b = new DefaultRepairStatisticsBuilder();
  b.add(report(true, true, [])); // valid before & after, no repair
  b.add(report(false, true, [timelineAction])); // recovered by repair
  b.add(report(false, false, [phoneAction])); // repaired but still invalid

  const s = b.build();
  assert.equal(s.total_images, 3);
  assert.equal(s.repaired_images, 2);
  assert.equal(s.validation_before, 1);
  assert.equal(s.validation_after, 2);
  assert.equal(s.validation_recovered, 1);
});

test("tallies repair types and ranks top repairs by total count", () => {
  const b = new DefaultRepairStatisticsBuilder();
  b.add(report(false, true, [phoneAction, timelineAction]));
  b.add(report(false, true, [phoneAction]));
  b.add(report(false, true, [phoneAction]));

  const s = b.build();
  assert.equal(s.repair_types.phone_reformat, 3);
  assert.equal(s.repair_types.timeline_remove_empty, 1);
  assert.equal(s.top_repairs[0].type, "phone_reformat");
  assert.equal(s.top_repairs[0].count, 3);
  assert.equal(s.top_repairs[0].images, 3);
});
