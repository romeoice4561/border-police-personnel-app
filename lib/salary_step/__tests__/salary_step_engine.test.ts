import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptAnnualSalaryHistory,
  buildSalaryStepContext,
  createDoubleStepCandidateRule,
  createManualReviewRule,
  createMaximumStepsRule,
  createMissingSalaryHistoryRule,
  createMustSkipRule,
  createSalaryStepRuleRegistry,
  evaluateSalaryStepIntelligence,
  filterSalaryStepEvaluations,
  salaryStepCommanderNotes,
  summarizeSalaryStepDashboard,
  totalSalaryStepsForFiscalYears,
  totalSalaryStepsForRecentCycles,
  type SalaryStepHistoryRecord,
  type SalaryStepRule,
} from "@/lib/salary_step";
import { utcDate } from "@/lib/personnel_calendar";

const history: SalaryStepHistoryRecord[] = [
  { fiscalYear: 2026, reviewCycle: "OCTOBER", stepsAwarded: 1, awardType: "NORMAL" },
  { fiscalYear: 2026, reviewCycle: "APRIL", stepsAwarded: 0.5, awardType: "NORMAL" },
  { fiscalYear: 2025, reviewCycle: "OCTOBER", stepsAwarded: 2, awardType: "DOUBLE_STEP" },
  { fiscalYear: 2025, reviewCycle: "APRIL", stepsAwarded: 1, awardType: "NORMAL" },
];

test("history utilities total configurable periods and recent cycles", () => {
  assert.equal(totalSalaryStepsForFiscalYears(history, [2025]), 3);
  assert.equal(totalSalaryStepsForRecentCycles(history, 2), 1.5);
});

test("annual salary history adapter prepares reusable cycle records", () => {
  const adapted = adaptAnnualSalaryHistory([{ yearBE: 2569, salaryStep: 2, remarks: "excellent" }], {
    reviewCycle: "APRIL",
    awardTypeForStep: (step) => (step === 2 ? "DOUBLE_STEP" : "NORMAL"),
  });

  assert.deepEqual(adapted, [
    { fiscalYear: 2026, reviewCycle: "APRIL", stepsAwarded: 2, awardType: "DOUBLE_STEP", remarks: "excellent" },
  ]);
});

test("no rules returns structured unknown result", () => {
  const result = evaluateSalaryStepIntelligence({ officerId: "A", asOf: utcDate(2026, 7, 14), history: [] }, []);

  assert.equal(result.eligibility, "unknown");
  assert.equal(result.manualReview, true);
  assert.equal(result.missingHistory, true);
  assert.equal(result.suggestedActions[0].code, "REGISTER_SALARY_STEP_RULES");
});

test("missing history rule reports missing fiscal years", () => {
  const result = evaluateSalaryStepIntelligence(
    { officerId: "A", asOf: utcDate(2026, 7, 14), history: [history[0]] },
    [createMissingSalaryHistoryRule({ requiredFiscalYears: [2025, 2026] })]
  );

  assert.equal(result.missingHistory, true);
  assert.equal(result.manualReview, true);
  assert.deepEqual(result.missingRequirements.map((req) => req.code), ["SALARY_HISTORY_2025"]);
});

test("double-step candidate rule is configurable", () => {
  const result = evaluateSalaryStepIntelligence(
    { officerId: "A", asOf: utcDate(2026, 7, 14), history },
    [createDoubleStepCandidateRule({ lookbackCycles: 2, maxStepsInLookback: 1.5 })]
  );

  assert.equal(result.eligibleDoubleStep, true);
  assert.equal(result.eligibility, "eligible_double_step");
});

test("must skip rule uses configured award types", () => {
  const result = evaluateSalaryStepIntelligence(
    {
      officerId: "A",
      asOf: utcDate(2026, 7, 14),
      history: [{ fiscalYear: 2026, reviewCycle: "APRIL", stepsAwarded: 0, awardType: "SKIPPED" }],
    },
    [createMustSkipRule({ lookbackCycles: 1, skipAwardTypes: ["SKIPPED"] })]
  );

  assert.equal(result.mustSkip, true);
  assert.equal(result.eligibility, "must_skip");
});

test("maximum steps rule flags policy limit without hardcoding regulation", () => {
  const result = evaluateSalaryStepIntelligence(
    { officerId: "A", asOf: utcDate(2026, 7, 14), history },
    [createMaximumStepsRule({ lookbackCycles: 4, maximumSteps: 3 })]
  );

  assert.equal(result.policyLimitExceeded, true);
  assert.equal(result.manualReview, true);
  assert.ok(result.warnings[0].includes("exceeds configured limit"));
});

test("manual review rule can consume commander intelligence priority", () => {
  const context = buildSalaryStepContext({
    officerId: "A",
    asOf: utcDate(2026, 7, 14),
    history,
    commanderIntelligence: {
      officerId: "A",
      displayName: "Officer A",
      promotionStatus: "unknown",
      retirementStatus: "unknown",
      profileCompleteness: "low",
      profileCompletenessPercent: 40,
      priority: "critical",
      priorityScore: 90,
      flags: [],
      recommendations: [],
      promotionResult: null,
    },
  });
  const result = evaluateSalaryStepIntelligence(context, [
    createManualReviewRule({ lookbackCycles: 2, reviewWhenCommanderPriorityAtLeast: "high" }),
  ]);

  assert.equal(result.manualReview, true);
  assert.ok(salaryStepCommanderNotes(result).includes("Route to commander review before annual salary-step decision."));
});

test("commander filters and dashboard summary are reusable", () => {
  const eligible = evaluateSalaryStepIntelligence(
    { officerId: "A", asOf: utcDate(2026, 7, 14), history },
    [createDoubleStepCandidateRule({ lookbackCycles: 2, maxStepsInLookback: 2 })]
  );
  const skip = evaluateSalaryStepIntelligence(
    { officerId: "B", asOf: utcDate(2026, 7, 14), history: [{ fiscalYear: 2026, reviewCycle: "APRIL", stepsAwarded: 0, awardType: "SKIPPED" }] },
    [createMustSkipRule({ lookbackCycles: 1, skipAwardTypes: ["SKIPPED"] })]
  );

  assert.deepEqual(filterSalaryStepEvaluations([eligible, skip], { eligibleDoubleStep: true }).map((result) => result.officerId), ["A"]);
  assert.deepEqual(summarizeSalaryStepDashboard([eligible, skip]), {
    totalOfficers: 2,
    eligibleDoubleStep: 1,
    mustSkip: 1,
    manualReview: 1,
    missingRecords: 0,
    averageSalarySteps: 2.25,
  });
});

test("rule registry supports future rules without engine changes", () => {
  const customRule: SalaryStepRule = {
    id: "custom-future-rule",
    label: "Future regulation",
    evaluate() {
      return {
        ruleId: "custom-future-rule",
        passed: false,
        severity: "warning",
        reasons: ["Future regulation requires review."],
        warnings: ["Future warning."],
        missingRequirements: [],
        suggestedActions: [{ code: "FUTURE_ACTION", label: "Handle future regulation." }],
        manualReview: true,
      };
    },
  };

  const registry = createSalaryStepRuleRegistry().register(customRule);
  assert.equal(registry.get("custom-future-rule")?.label, "Future regulation");
  assert.throws(() => registry.register(customRule));
});
