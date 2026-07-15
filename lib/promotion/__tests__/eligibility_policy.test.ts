import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateLevelEligibility,
  evaluateWithPolicy as evaluateLevelEligibilityWithPolicy,
  evaluateNextLevelEligibility,
  policyForTargetLevel,
  PROMOTION_TARGET_LEVELS,
  PROMOTION_POLICIES,
  type EligibilityOfficer,
  type PromotionPolicy,
} from "@/lib/promotion/eligibility_policy";

const ASOF = new Date(Date.UTC(2026, 6, 14));

function officer(ov: Partial<EligibilityOfficer> = {}): EligibilityOfficer {
  return {
    currentRank: "ร.ต.อ.",
    positionLevel: "รองสารวัตร",
    yearsInPositionLevel: null,
    yearsInRank: 5,
    governmentServiceYears: 12,
    retirementRemainingMonths: 240,
    trainingCodes: [],
    documentCodes: [],
    twoStepCount: 0,
    appointmentCycle: 2565,
    ...ov,
  };
}

test("PROMOTION_TARGET_LEVELS lists the configured targets, lowest → highest, excluding Unknown/รองสารวัตร", () => {
  assert.deepEqual(PROMOTION_TARGET_LEVELS, [
    "สารวัตร",
    "รองผู้กำกับการ",
    "ผู้กำกับการ",
    "รองผู้บังคับการ",
    "ผู้บังคับการ",
    "รองผู้บัญชาการ",
  ]);
});

test("eligible_now: appointment cycle meets required cycles for next level", () => {
  const result = evaluateLevelEligibility(officer({ appointmentCycle: 2565, yearsInRank: 4 }), "สารวัตร", ASOF);
  assert.equal(result.status, "eligible_now");
  assert.equal(result.eligibleNow, true);
  assert.equal(result.monthsUntilEligible, 0);
  assert.equal(result.overdueYears, 1);
  assert.deepEqual(result.missingRequirements, []);
});

test("overdue: eligible and past the first eligible cycle", () => {
  const result = evaluateLevelEligibility(officer({ appointmentCycle: 2564, yearsInRank: 7 }), "สารวัตร", ASOF);
  assert.equal(result.status, "overdue");
  assert.equal(result.eligibleNow, true);
  assert.equal(result.overdueYears, 2);
});

test("appointment cycle drives police promotion eligibility independently from years in rank", () => {
  const result = evaluateLevelEligibility(
    officer({
      positionLevel: "รองผู้กำกับการ",
      yearsInRank: 5,
      appointmentCycle: 2564,
    }),
    "ผู้กำกับการ",
    ASOF
  );

  assert.equal(result.promotionCycle?.appointmentCycle, 2564);
  assert.equal(result.promotionCycle?.eligibleCycle, 2568);
  assert.equal(result.promotionCycle?.overdueCycles, 2);
  assert.equal(result.promotionCycle?.eligibleNow, true);
  assert.equal(result.status, "overdue");
  assert.equal(result.overdueYears, 2);
});

test("eligible_soon: one appointment cycle short of eligibility", () => {
  const result = evaluateLevelEligibility(officer({ appointmentCycle: 2566, yearsInRank: 5 }), "สารวัตร", ASOF);
  assert.equal(result.status, "eligible_soon");
  assert.equal(result.eligibleNow, false);
  assert.equal(result.monthsUntilEligible, 12);
});

test("not_eligible: far short of required cycles", () => {
  const result = evaluateLevelEligibility(officer({ appointmentCycle: 2568, yearsInRank: 1 }), "สารวัตร", ASOF);
  assert.equal(result.status, "not_eligible");
  assert.equal(result.eligibleNow, false);
  assert.equal(result.monthsUntilEligible, 36);
  assert.ok(result.missingRequirements.some((r) => r.code === "MIN_CYCLES_IN_LEVEL"));
  assert.ok(result.missingRequirements.some((r) => r.code === "MIN_YEARS_IN_RANK"));
});

test("not_eligible when target is not exactly one level above current (no level-skipping)", () => {
  const result = evaluateLevelEligibility(officer({ positionLevel: "รองสารวัตร" }), "ผู้กำกับการ", ASOF);
  assert.equal(result.status, "not_eligible");
  assert.ok(result.missingRequirements.some((r) => r.code === "CURRENT_LEVEL"));
});

test("Unknown current level is never auto-eligible for anything", () => {
  const result = evaluateLevelEligibility(officer({ positionLevel: "Unknown" }), "สารวัตร", ASOF);
  assert.equal(result.status, "not_eligible");
});

test("missing appointment cycle blocks eligibility", () => {
  const result = evaluateLevelEligibility(officer({ appointmentCycle: null }), "สารวัตร", ASOF);
  assert.equal(result.eligibleNow, false);
  assert.equal(result.monthsUntilEligible, null);
  assert.ok(result.missingRequirements.some((r) => r.code === "MISSING_APPOINTMENT_CYCLE"));
});

test("evaluateNextLevelEligibility targets the level immediately above the officer's current one", () => {
  const result = evaluateNextLevelEligibility(officer({ positionLevel: "สารวัตร", appointmentCycle: 2565, yearsInRank: 4 }), ASOF);
  assert.ok(result);
  assert.equal(result.targetLevel, "รองผู้กำกับการ");
  assert.equal(result.status, "eligible_now");
});

test("evaluateNextLevelEligibility returns null at Unknown or the top of scope", () => {
  assert.equal(evaluateNextLevelEligibility(officer({ positionLevel: "Unknown" }), ASOF), null);
  assert.equal(evaluateNextLevelEligibility(officer({ positionLevel: "รองผู้บัญชาการ" }), ASOF), null);
});

// ── Policy is DATA: a new requirement is honored WITHOUT changing the engine ──

test("a custom policy with a required training code is enforced purely from config (engine unchanged)", () => {
  const custom: PromotionPolicy = {
    targetLevel: "สารวัตร",
    minYearsInPositionLevel: 4,
    minYearsInRank: 4,
    requiredTrainingCodes: ["SWAT"],
  };
  const withoutTraining = evaluateLevelEligibilityWithPolicy(officer({ appointmentCycle: 2565, yearsInRank: 4 }), custom);
  assert.equal(withoutTraining.eligibleNow, false);
  assert.ok(withoutTraining.missingRequirements.some((r) => r.code === "REQUIRED_TRAINING" || r.label.includes("training") || r.detail === "SWAT" || r.code.includes("TRAINING")));

  const withTraining = evaluateLevelEligibilityWithPolicy(
    officer({ appointmentCycle: 2565, yearsInRank: 4, trainingCodes: ["SWAT"] }),
    custom
  );
  assert.equal(withTraining.eligibleNow, true);
});

test("a custom salary-step requirement (minTwoStepCount) is enforced from config", () => {
  const custom: PromotionPolicy = {
    targetLevel: "สารวัตร",
    minYearsInPositionLevel: 4,
    minYearsInRank: 4,
    minTwoStepCount: 2,
  };
  const short = evaluateLevelEligibilityWithPolicy(officer({ appointmentCycle: 2565, yearsInRank: 4, twoStepCount: 1 }), custom);
  assert.equal(short.eligibleNow, false);
  assert.ok(short.missingRequirements.some((r) => r.code === "MIN_TWO_STEP"));

  const ok = evaluateLevelEligibilityWithPolicy(officer({ appointmentCycle: 2565, yearsInRank: 4, twoStepCount: 2 }), custom);
  assert.equal(ok.eligibleNow, true);
});

test("every default policy targets a real level and configures at least one requirement", () => {
  for (const policy of PROMOTION_POLICIES) {
    assert.ok(policyForTargetLevel(policy.targetLevel), `policy for ${policy.targetLevel} is resolvable`);
    const hasRequirement =
      policy.minYearsInPositionLevel != null ||
      policy.minYearsInRank != null ||
      policy.minGovernmentServiceYears != null ||
      (policy.requiredTrainingCodes?.length ?? 0) > 0 ||
      (policy.requiredDocumentCodes?.length ?? 0) > 0;
    assert.ok(hasRequirement, `policy for ${policy.targetLevel} has a requirement`);
  }
});
