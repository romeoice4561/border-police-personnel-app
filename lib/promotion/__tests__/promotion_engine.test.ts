import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPromotionContext,
  createMinimumRankRule,
  createMinimumServiceRule,
  createPromotionRuleRegistry,
  createRequiredDocumentsRule,
  createRequiredTrainingRule,
  createRetirementWindowRule,
  evaluatePromotionEligibility,
  type PromotionRule,
} from "@/lib/promotion";
import { utcDate } from "@/lib/personnel_calendar";

test("no rules returns structured not-eligible result with next step", () => {
  const context = buildPromotionContext({ asOf: utcDate(2026, 7, 14) });
  const result = evaluatePromotionEligibility(context, []);

  assert.equal(result.eligible, false);
  assert.equal(result.score, 0);
  assert.equal(result.maxScore, 0);
  assert.deepEqual(result.passedRules, []);
  assert.deepEqual(result.failedRules, []);
  assert.equal(result.warnings[0], "No promotion rules registered.");
  assert.equal(result.suggestedNextSteps[0].code, "REGISTER_RULES");
});

test("single configured minimum service rule can pass", () => {
  const context = buildPromotionContext({
    asOf: utcDate(2026, 7, 14),
    governmentServiceStartDate: utcDate(2010, 4, 1),
  });
  const rule = createMinimumServiceRule({ minimum: { years: 10, months: 0, days: 0 }, score: 25 });
  const result = evaluatePromotionEligibility(context, [rule]);

  assert.equal(result.eligible, true);
  assert.equal(result.score, 25);
  assert.equal(result.maxScore, 25);
  assert.equal(result.passedRules.length, 1);
  assert.equal(result.failedRules.length, 0);
});

test("multiple rules return mixed pass/fail with missing requirements and next steps", () => {
  const context = buildPromotionContext({
    asOf: utcDate(2026, 7, 14),
    currentRank: "Police Captain",
    governmentServiceStartDate: utcDate(2020, 1, 1),
    trainingRecords: [{ code: "LEADERSHIP" }],
    documents: [{ typeCode: "NATIONAL_ID", isActive: true }],
  });
  const rules = [
    createMinimumRankRule({ allowedRanks: ["Police Captain"], score: 10 }),
    createMinimumServiceRule({ minimum: { years: 10, months: 0, days: 0 }, score: 20 }),
    createRequiredTrainingRule({ requiredTrainingCodes: ["LEADERSHIP", "COMMAND"], score: 20 }),
    createRequiredDocumentsRule({ requiredDocumentTypes: ["NATIONAL_ID", "GP7"], score: 15 }),
  ];
  const result = evaluatePromotionEligibility(context, rules);

  assert.equal(result.eligible, false);
  assert.equal(result.score, 10);
  assert.equal(result.maxScore, 65);
  assert.equal(result.passedRules.length, 1);
  assert.equal(result.failedRules.length, 3);
  assert.deepEqual(result.missingRequirements.map((req) => req.code), [
    "MINIMUM_SERVICE",
    "TRAINING_COMMAND",
    "DOCUMENT_GP7",
  ]);
  assert.ok(result.suggestedNextSteps.some((step) => step.code === "UPLOAD_GP7"));
});

test("missing data fails blocking rules without throwing", () => {
  const context = buildPromotionContext({ asOf: utcDate(2026, 7, 14) });
  const result = evaluatePromotionEligibility(context, [
    createMinimumRankRule({ allowedRanks: ["Police Major"] }),
    createRequiredTrainingRule({ requiredTrainingCodes: ["COMMAND"] }),
  ]);

  assert.equal(result.eligible, false);
  assert.equal(result.failedRules.length, 2);
  assert.deepEqual(result.missingRequirements.map((req) => req.code), ["MINIMUM_RANK", "TRAINING_COMMAND"]);
});

test("warning severity retirement rule does not block eligibility but records warning", () => {
  const context = buildPromotionContext({
    asOf: utcDate(2045, 8, 1),
    dateOfBirth: utcDate(1985, 9, 30),
    governmentServiceStartDate: utcDate(2000, 1, 1),
  });
  const result = evaluatePromotionEligibility(context, [
    createMinimumServiceRule({ minimum: { years: 10, months: 0, days: 0 } }),
    createRetirementWindowRule({ minimumRemainingMonths: 24 }),
  ]);

  assert.equal(result.eligible, true);
  assert.equal(result.failedRules.length, 1);
  assert.equal(result.failedRules[0].severity, "warning");
  assert.equal(result.warnings[0], "Officer may be too close to retirement for this promotion path.");
});

test("rule registry registers and lists independent rules", () => {
  const registry = createPromotionRuleRegistry()
    .register(createMinimumRankRule({ id: "rank-a", allowedRanks: ["A"] }))
    .register(createRequiredTrainingRule({ id: "training-a", requiredTrainingCodes: ["T"] }));

  assert.equal(registry.get("rank-a")?.label, "Minimum rank");
  assert.deepEqual(registry.list().map((rule) => rule.id), ["rank-a", "training-a"]);
  assert.throws(() => registry.register(createMinimumRankRule({ id: "rank-a", allowedRanks: ["B"] })));
});

test("custom future rule can plug in without engine changes", () => {
  const customRule: PromotionRule = {
    id: "discipline-clear",
    label: "Disciplinary status",
    evaluate(context) {
      const passed = context.disciplinaryStatus !== "OPEN_CASE";
      return {
        ruleId: "discipline-clear",
        passed,
        score: passed ? 5 : 0,
        maxScore: 5,
        severity: "blocking",
        reasons: passed ? ["No open disciplinary case."] : ["Open disciplinary case."],
        missingRequirements: passed ? [] : [{ code: "DISCIPLINE_CLEARANCE", label: "Disciplinary clearance" }],
        warnings: [],
        suggestedNextSteps: passed ? [] : [{ code: "RESOLVE_DISCIPLINE", label: "Resolve disciplinary case." }],
      };
    },
  };

  const result = evaluatePromotionEligibility(buildPromotionContext({ disciplinaryStatus: "OPEN_CASE" }), [customRule]);
  assert.equal(result.eligible, false);
  assert.equal(result.missingRequirements[0].code, "DISCIPLINE_CLEARANCE");
});
