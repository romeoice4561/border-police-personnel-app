import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainingPriorityList, type TrainingPriorityInput } from "@/lib/intelligence/training/priority";
import type { TrainingSummary } from "@/lib/intelligence/training/types";

function summary(overrides: Partial<TrainingSummary> = {}): TrainingSummary {
  return {
    available: true,
    asOfDate: "2026-07-17",
    totalRecords: 0,
    verifiedRecords: 0,
    unverifiedRecords: 0,
    completedCourseCount: 0,
    missingRequiredCourseCount: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    requiredRequirements: [],
    completedCourses: [],
    missingRequirements: [],
    expiringSoon: [],
    expired: [],
    trainingStatus: "NoData",
    displayStatusTh: "ยังไม่มีข้อมูลการฝึกอบรม",
    recommendationsTh: [],
    dataQualityFlags: [],
    ...overrides,
  };
}

function input(overrides: Partial<TrainingPriorityInput> = {}): TrainingPriorityInput {
  return {
    officerId: "OFF-1",
    displayName: "ทดสอบ ระบบ",
    rank: null,
    position: null,
    unit: null,
    officialPortraitUrl: null,
    training: summary(),
    promotionEligible: false,
    promotionStatusTh: null,
    ...overrides,
  };
}

test("no numerical score is invented — every entry carries only trainingStatus/recommendedActionTh, no score field", () => {
  const list = buildTrainingPriorityList([input({ training: summary({ trainingStatus: "Expired" }) })]);
  assert.equal(Object.prototype.hasOwnProperty.call(list[0], "score"), false);
});

test("tier 1: MissingRequired + promotion-eligible sorts first", () => {
  const list = buildTrainingPriorityList([
    input({ officerId: "A", training: summary({ trainingStatus: "Expired" }) }),
    input({ officerId: "B", training: summary({ trainingStatus: "MissingRequired" }), promotionEligible: true }),
  ]);
  assert.equal(list[0].officerId, "B");
});

test("tier ordering: Expired before ExpiringSoon before Unverified before NoData", () => {
  const list = buildTrainingPriorityList([
    input({ officerId: "unverified", training: summary({ trainingStatus: "Unverified" }) }),
    input({ officerId: "nodata", training: summary({ trainingStatus: "NoData" }) }),
    input({ officerId: "expired", training: summary({ trainingStatus: "Expired" }) }),
    input({ officerId: "expiring", training: summary({ trainingStatus: "ExpiringSoon" }) }),
  ]);
  assert.deepEqual(
    list.map((o) => o.officerId),
    ["expired", "expiring", "unverified", "nodata"]
  );
});

test("MissingRequired WITHOUT promotion eligibility is excluded from the priority list (only tier 1 requires eligibility)", () => {
  const list = buildTrainingPriorityList([input({ training: summary({ trainingStatus: "MissingRequired" }), promotionEligible: false })]);
  assert.equal(list.length, 0);
});

test("Complete/NoPolicy officers are excluded entirely — not a priority", () => {
  const list = buildTrainingPriorityList([
    input({ officerId: "complete", training: summary({ trainingStatus: "Complete" }) }),
    input({ officerId: "nopolicy", training: summary({ trainingStatus: "NoPolicy" }) }),
  ]);
  assert.equal(list.length, 0);
});

test("empty input produces an empty list, no crash", () => {
  assert.deepEqual(buildTrainingPriorityList([]), []);
});

test("missingCourseNames/expiringCourseNames are read from the summary's own requirement lists, never recalculated", () => {
  const list = buildTrainingPriorityList([
    input({
      training: summary({
        trainingStatus: "MissingRequired",
        missingRequirements: [{ requirementKey: "K1", displayNameTh: "หลักสูตรผู้กำกับการ", status: "Missing", matchedRecordIds: [], completionDate: null, expiryDate: null, reasonTh: null }],
      }),
      promotionEligible: true,
    }),
  ]);
  assert.deepEqual(list[0].missingCourseNames, ["หลักสูตรผู้กำกับการ"]);
});
