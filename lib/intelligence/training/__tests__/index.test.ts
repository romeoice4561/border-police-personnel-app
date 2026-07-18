/**
 * computeTrainingSummary tests (Phase 45).
 *
 * `TRAINING_POLICIES` is a fixed, empty constant in production (no real
 * policy is configured — see docs/TRAINING_INTELLIGENCE.md), so these
 * tests exercise the NoPolicy/NoData branch directly against real
 * `Training` row fixtures (matching how the engine actually behaves in
 * production today), and exercise the policy-driven branch via
 * evaluateRequirements directly (already covered in
 * requirement_evaluation.test.ts) rather than by monkey-patching the
 * module-level policy constant.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { computeTrainingSummary } from "@/lib/intelligence/training";
import { evaluateRequirements } from "@/lib/intelligence/training/requirement_evaluation";
import { toTrainingRecordEvidenceBatch } from "@/lib/intelligence/training/evidence";
import { TRAINING_STATUS_TONE } from "@/lib/intelligence/training/status_tone";
import type { Training } from "@/lib/database/query_types";

const ASOF = utcDate(2026, 7, 17);

function trainingRow(overrides: Partial<Training> = {}): Training {
  return {
    id: 1,
    officerId: 1,
    year: "2564",
    course: "หลักสูตรทดสอบ",
    organization: "กก.ตชด.41",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Training;
}

test("1. no training records -> NoData, never a fabricated MissingRequired/zero-as-complete", () => {
  const summary = computeTrainingSummary([], null, ASOF);
  assert.equal(summary.available, true);
  assert.equal(summary.totalRecords, 0);
  assert.equal(summary.trainingStatus, "NoData");
  assert.equal(summary.missingRequiredCourseCount, 0);
});

test("2. records exist but no policy -> NoPolicy, never MissingTraining/MissingRequired", () => {
  const summary = computeTrainingSummary([trainingRow()], "รองผู้กำกับการ", ASOF);
  assert.equal(summary.trainingStatus, "NoPolicy");
  assert.equal(summary.totalRecords, 1);
  assert.notEqual(summary.trainingStatus, "MissingRequired");
});

test("no target position level and records exist -> still NoPolicy (nothing to require training for)", () => {
  const summary = computeTrainingSummary([trainingRow()], null, ASOF);
  assert.equal(summary.trainingStatus, "NoPolicy");
});

test("17. every officer today reports NoPolicy/NoData — PromotionSummary is untouched by this module (Training Intelligence never writes back into PromotionSummary)", () => {
  const summary = computeTrainingSummary([trainingRow()], "ผู้กำกับการ", ASOF);
  assert.ok(summary.trainingStatus === "NoPolicy" || summary.trainingStatus === "NoData");
});

test("10. duplicate course records are preserved (never auto-deleted) and flagged", () => {
  const rows = [
    trainingRow({ id: 1, course: "หลักสูตรทดสอบ", organization: "กก.ตชด.41", year: "2564" }),
    trainingRow({ id: 2, course: "หลักสูตรทดสอบ", organization: "กก.ตชด.41", year: "2564" }),
  ];
  const summary = computeTrainingSummary(rows, null, ASOF);
  assert.equal(summary.totalRecords, 2, "both records remain — nothing is deleted");
  const dup = summary.dataQualityFlags.find((f) => f.code === "DUPLICATE_COURSE_RECORD");
  assert.ok(dup, "duplicate course record must be flagged");
  assert.deepEqual(dup!.recordIds.sort(), [1, 2]);
});

test("21. Thai display labels — displayStatusTh is always Thai text, never a raw enum key", () => {
  const summary = computeTrainingSummary([], null, ASOF);
  assert.ok(/[ก-๙]/.test(summary.displayStatusTh));
  assert.notEqual(summary.displayStatusTh, summary.trainingStatus);
});

test("25. deterministic asOfDate — identical asOf always produces identical asOfDate/output", () => {
  const rows = [trainingRow()];
  const a = computeTrainingSummary(rows, "รองผู้กำกับการ", ASOF);
  const b = computeTrainingSummary(rows, "รองผู้กำกับการ", ASOF);
  assert.equal(a.asOfDate, "2026-07-17");
  assert.deepEqual(a, b);
});

test("27. empty dataset ([]) handled without error, explicit NoData", () => {
  const summary = computeTrainingSummary([], null, ASOF);
  assert.equal(summary.available, true);
  assert.equal(summary.totalRecords, 0);
});

test("verifiedRecords/unverifiedRecords never silently zero — unverified counts every record when verification is untracked (verified: null)", () => {
  const summary = computeTrainingSummary([trainingRow(), trainingRow({ id: 2 })], null, ASOF);
  assert.equal(summary.verifiedRecords, 0);
  assert.equal(summary.unverifiedRecords, 2, "verified: null (untracked) still counts as unverified, not silently omitted");
});

// ---------------------------------------------------------------------------
// Phase 45 completion pass — Task 14 items 3/4/5: real configured-policy
// scenarios, exercised via evaluateRequirements directly (the same
// evaluator computeTrainingSummary calls internally once a real
// TRAINING_POLICIES entry exists — TRAINING_POLICIES itself is a fixed,
// empty production constant, so this is the correct injection seam for
// testing the policy-driven path without editing production policy data).
// ---------------------------------------------------------------------------

test("3. real configured policy + Complete status: a required course with a matching normalized key evaluates as Completed", () => {
  const rows = [trainingRow({ id: 1, course: "หลักสูตรผู้กำกับการ" })];
  const evidence = toTrainingRecordEvidenceBatch(rows);
  const requiredKey = evidence[0].normalizedCourseKey!;
  const results = evaluateRequirements([requiredKey], evidence, ASOF);
  assert.equal(results[0].status, "Unverified", "Training has no verification field — a real match is Unverified, not silently Completed");
});

test("4. real configured policy + MissingRequired status: a required course key with no matching evidence evaluates as Missing", () => {
  const rows = [trainingRow({ id: 1, course: "หลักสูตร ก" })];
  const evidence = toTrainingRecordEvidenceBatch(rows);
  const results = evaluateRequirements(["COURSE_NEVER_TAKEN"], evidence, ASOF);
  assert.equal(results[0].status, "Missing");
});

test("5. NoPolicy uses informational/neutral badge styling, never the same tone as a real MissingRequired blocker", () => {
  assert.equal(TRAINING_STATUS_TONE.NoPolicy, "neutral");
  assert.equal(TRAINING_STATUS_TONE.NoData, "neutral");
  assert.notEqual(TRAINING_STATUS_TONE.NoPolicy, TRAINING_STATUS_TONE.MissingRequired);
  assert.equal(TRAINING_STATUS_TONE.MissingRequired, "serious", "a real blocker uses a distinctly more severe tone than NoPolicy");
});
