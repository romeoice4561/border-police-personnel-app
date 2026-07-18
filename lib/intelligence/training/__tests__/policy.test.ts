import assert from "node:assert/strict";
import test from "node:test";
import { TRAINING_POLICIES, trainingPoliciesForTargetLevel, hasTrainingPolicyForTargetLevel } from "@/lib/intelligence/training/policy";

test("TRAINING_POLICIES is empty today — no mandatory course is invented", () => {
  assert.deepEqual(TRAINING_POLICIES, []);
});

test("trainingPoliciesForTargetLevel returns an empty array for every level today", () => {
  assert.deepEqual(trainingPoliciesForTargetLevel("รองผู้กำกับการ"), []);
  assert.deepEqual(trainingPoliciesForTargetLevel("ผู้กำกับการ"), []);
});

test("hasTrainingPolicyForTargetLevel is false for every level today", () => {
  assert.equal(hasTrainingPolicyForTargetLevel("รองผู้กำกับการ"), false);
});
