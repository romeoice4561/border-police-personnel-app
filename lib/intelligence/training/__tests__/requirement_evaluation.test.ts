import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { evaluateRequirement, evaluateRequirements } from "@/lib/intelligence/training/requirement_evaluation";
import type { TrainingRecordEvidence } from "@/lib/intelligence/training/types";

const ASOF = utcDate(2026, 7, 17);

function evidence(overrides: Partial<TrainingRecordEvidence> = {}): TrainingRecordEvidence {
  return {
    recordId: 1,
    courseName: "หลักสูตรทดสอบ",
    normalizedCourseKey: "COURSE_A",
    provider: null,
    completionDate: "2020-01-01",
    expiryDate: null,
    certificateNumber: null,
    verified: null,
    source: null,
    ...overrides,
  };
}

test("3. required course completed and verified -> Completed", () => {
  const result = evaluateRequirement("COURSE_A", [evidence({ verified: true })], ASOF);
  assert.equal(result.status, "Completed");
  assert.equal(result.reasonTh, null);
});

test("4. required course completed but unverified -> Unverified, not silently Completed", () => {
  const result = evaluateRequirement("COURSE_A", [evidence({ verified: false })], ASOF);
  assert.equal(result.status, "Unverified");
  assert.ok(result.reasonTh);
});

test("verification not tracked for this record type (verified: null) -> also Unverified, never a false-confidence Completed", () => {
  const result = evaluateRequirement("COURSE_A", [evidence({ verified: null })], ASOF);
  assert.equal(result.status, "Unverified");
});

test("5. required course missing -> Missing, with a Thai reason", () => {
  const result = evaluateRequirement("COURSE_A", [], ASOF);
  assert.equal(result.status, "Missing");
  assert.equal(result.matchedRecordIds.length, 0);
  assert.ok(result.reasonTh);
});

test("6. multiple required courses, partially complete — each requirement evaluated independently", () => {
  const evidenceRows = [evidence({ recordId: 1, normalizedCourseKey: "COURSE_A", verified: true })];
  const results = evaluateRequirements(["COURSE_A", "COURSE_B"], evidenceRows, ASOF);
  assert.equal(results.length, 2);
  assert.equal(results[0].status, "Completed");
  assert.equal(results[1].status, "Missing");
});

test("a partial/substring name match does NOT count as complete — only exact normalized-key match", () => {
  // A record normalized to a DIFFERENT key must never satisfy this requirement,
  // even if the raw course names look superficially similar.
  const result = evaluateRequirement("COURSE_A", [evidence({ normalizedCourseKey: "COURSE_A_ADVANCED" })], ASOF);
  assert.equal(result.status, "Missing");
});

test("14. expired required qualification -> Expired", () => {
  const result = evaluateRequirement("COURSE_A", [evidence({ expiryDate: "2020-01-01" })], ASOF);
  assert.equal(result.status, "Expired");
});

test("13. expiring soon (within 90 days) -> ExpiringSoon", () => {
  const result = evaluateRequirement("COURSE_A", [evidence({ expiryDate: "2026-08-10" })], ASOF); // ~24 days out
  assert.equal(result.status, "ExpiringSoon");
});

test("valid expiry (more than 90 days out) does not trigger ExpiringSoon/Expired", () => {
  const result = evaluateRequirement("COURSE_A", [evidence({ expiryDate: "2027-06-01", verified: true })], ASOF);
  assert.equal(result.status, "Completed");
});

test("multiple matches for the same course: the most recently completed one is used", () => {
  const rows = [
    evidence({ recordId: 1, completionDate: "2018-01-01", verified: true }),
    evidence({ recordId: 2, completionDate: "2023-01-01", verified: true }),
  ];
  const result = evaluateRequirement("COURSE_A", rows, ASOF);
  assert.equal(result.completionDate, "2023-01-01");
  assert.deepEqual(result.matchedRecordIds.sort(), [1, 2]);
});

test("displayNameTh resolver: falls back to the requirement key when no resolver/display name is supplied", () => {
  const result = evaluateRequirement("COURSE_A", [], ASOF);
  assert.equal(result.displayNameTh, "COURSE_A");
});

test("displayNameTh resolver: uses the supplied resolver when present", () => {
  const result = evaluateRequirement("COURSE_A", [], ASOF, (key) => (key === "COURSE_A" ? "หลักสูตรผู้กำกับการ" : null));
  assert.equal(result.displayNameTh, "หลักสูตรผู้กำกับการ");
});
