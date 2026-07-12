/**
 * salaryHistoryRowSchema / officerProfileSaveSchema's salaryHistory field
 * (Phase 28A — Career Intelligence Foundation).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { salaryHistoryRowSchema, officerProfileSaveSchema } from "@/lib/officer_profile/officer_profile_api_schemas";

test("salaryHistoryRowSchema accepts a well-formed row", () => {
  const result = salaryHistoryRowSchema.safeParse({ yearBE: 2569, salaryStep: 2.0, remarks: "ผลงานดีเด่น" });
  assert.equal(result.success, true);
});

test("salaryHistoryRowSchema accepts every one of the 4 legal salary-step values", () => {
  for (const step of [0.5, 1.0, 1.5, 2.0]) {
    const result = salaryHistoryRowSchema.safeParse({ yearBE: 2569, salaryStep: step, remarks: null });
    assert.equal(result.success, true, `step ${step} should be valid`);
  }
});

test("salaryHistoryRowSchema rejects a salaryStep outside the closed set (e.g. 3.0, 0, 1.25)", () => {
  for (const step of [3.0, 0, 1.25, -0.5]) {
    const result = salaryHistoryRowSchema.safeParse({ yearBE: 2569, salaryStep: step, remarks: null });
    assert.equal(result.success, false, `step ${step} should be rejected`);
  }
});

test("salaryHistoryRowSchema rejects an out-of-range Buddhist-Era year", () => {
  const result = salaryHistoryRowSchema.safeParse({ yearBE: 1000, salaryStep: 1.0, remarks: null });
  assert.equal(result.success, false);
});

test("salaryHistoryRowSchema normalizes blank remarks to null", () => {
  const result = salaryHistoryRowSchema.safeParse({ yearBE: 2569, salaryStep: 1.0, remarks: "  " });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.remarks, null);
});

test("salaryHistoryRowSchema requires yearBE and salaryStep (no defaults, never invented)", () => {
  assert.equal(salaryHistoryRowSchema.safeParse({ salaryStep: 1.0, remarks: null }).success, false);
  assert.equal(salaryHistoryRowSchema.safeParse({ yearBE: 2569, remarks: null }).success, false);
});

test("officerProfileSaveSchema accepts a salaryHistory-only save", () => {
  const result = officerProfileSaveSchema.safeParse({
    salaryHistory: [
      { yearBE: 2569, salaryStep: 2.0, remarks: null },
      { yearBE: 2568, salaryStep: 1.5, remarks: null },
    ],
  });
  assert.equal(result.success, true);
});

test("officerProfileSaveSchema still accepts an empty body when salaryHistory is omitted (every section optional)", () => {
  assert.equal(officerProfileSaveSchema.safeParse({}).success, true);
});

test("officerProfileSaveSchema rejects a batch containing one invalid salaryHistory row", () => {
  const result = officerProfileSaveSchema.safeParse({
    salaryHistory: [
      { yearBE: 2569, salaryStep: 2.0, remarks: null },
      { yearBE: 2568, salaryStep: 99, remarks: null },
    ],
  });
  assert.equal(result.success, false);
});
