import assert from "node:assert/strict";
import test from "node:test";
import { detectDataQualityFlags } from "@/lib/intelligence/training/data_quality";
import type { TrainingRecordEvidence } from "@/lib/intelligence/training/types";

function evidence(overrides: Partial<TrainingRecordEvidence> = {}): TrainingRecordEvidence {
  return {
    recordId: 1,
    courseName: "หลักสูตรทดสอบ",
    normalizedCourseKey: "COURSE_A",
    provider: null,
    completionDate: null,
    expiryDate: null,
    certificateNumber: null,
    verified: null,
    source: null,
    ...overrides,
  };
}

test("missing course name is flagged", () => {
  const flags = detectDataQualityFlags([evidence({ courseName: "" })]);
  assert.ok(flags.some((f) => f.code === "MISSING_COURSE_NAME"));
});

test("11. invalid date is flagged", () => {
  const flags = detectDataQualityFlags([evidence({ completionDate: "not-a-date" })]);
  assert.ok(flags.some((f) => f.code === "INVALID_DATE"));
});

test("completion date after expiry date is flagged", () => {
  const flags = detectDataQualityFlags([evidence({ completionDate: "2027-01-01", expiryDate: "2026-01-01" })]);
  assert.ok(flags.some((f) => f.code === "COMPLETION_AFTER_EXPIRY"));
});

test("duplicate certificate number across records is flagged", () => {
  const rows = [
    evidence({ recordId: 1, certificateNumber: "CERT-001" }),
    evidence({ recordId: 2, certificateNumber: "CERT-001" }),
  ];
  const flags = detectDataQualityFlags(rows);
  const dup = flags.find((f) => f.code === "DUPLICATE_CERTIFICATE_NUMBER");
  assert.ok(dup);
  assert.deepEqual(dup!.recordIds.sort(), [1, 2]);
});

test("unverified record (verified: false) is flagged distinctly from untracked (verified: null)", () => {
  const flagged = detectDataQualityFlags([evidence({ verified: false })]);
  assert.ok(flagged.some((f) => f.code === "UNVERIFIED_RECORD"));

  const untracked = detectDataQualityFlags([evidence({ verified: null })]);
  assert.ok(!untracked.some((f) => f.code === "UNVERIFIED_RECORD"), "verified: null (untracked) is not the same as verified: false (explicitly failed)");
});

test("clean evidence produces zero flags", () => {
  const flags = detectDataQualityFlags([evidence({ verified: true, completionDate: "2020-01-01" })]);
  assert.deepEqual(flags, []);
});

test("empty evidence array produces zero flags, no crash", () => {
  assert.deepEqual(detectDataQualityFlags([]), []);
});
