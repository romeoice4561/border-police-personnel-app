import { recentSalaryStepHistory, totalSalarySteps } from "@/lib/salary_step/history";
import type { SalaryStepEvaluationContext, SalaryStepEvaluationResult, SalaryStepRuleOutcome } from "@/lib/salary_step/types";

export function emptySalaryStepResult(context: SalaryStepEvaluationContext): SalaryStepEvaluationResult {
  return {
    officerId: context.officerId,
    fiscalYear: context.fiscalYear,
    eligibility: "unknown",
    eligibleDoubleStep: false,
    mustSkip: false,
    manualReview: true,
    missingHistory: context.history.length === 0,
    policyLimitExceeded: false,
    totalSteps: totalSalarySteps(context.history),
    recentHistory: recentSalaryStepHistory(context.history, 4),
    passedRules: [],
    failedRules: [],
    warnings: ["No salary-step rules registered."],
    missingRequirements: [],
    suggestedActions: [{ code: "REGISTER_SALARY_STEP_RULES", label: "Register salary-step rules before evaluation." }],
    commanderNotes: ["Salary-step intelligence needs configured rules before commander review."],
  };
}

function eligibilityFromOutcomes(outcomes: readonly SalaryStepRuleOutcome[]): SalaryStepEvaluationResult["eligibility"] {
  if (outcomes.some((outcome) => outcome.mustSkip)) return "must_skip";
  if (outcomes.some((outcome) => outcome.manualReview)) return "manual_review";
  if (outcomes.some((outcome) => outcome.eligibleDoubleStep)) return "eligible_double_step";
  if (outcomes.length > 0 && outcomes.every((outcome) => outcome.passed)) return "standard";
  return "unknown";
}

export function aggregateSalaryStepResults(
  context: SalaryStepEvaluationContext,
  outcomes: readonly SalaryStepRuleOutcome[]
): SalaryStepEvaluationResult {
  if (outcomes.length === 0) return emptySalaryStepResult(context);

  const passedRules = outcomes.filter((outcome) => outcome.passed);
  const failedRules = outcomes.filter((outcome) => !outcome.passed);

  return {
    officerId: context.officerId,
    fiscalYear: context.fiscalYear,
    eligibility: eligibilityFromOutcomes(outcomes),
    eligibleDoubleStep: outcomes.some((outcome) => outcome.eligibleDoubleStep),
    mustSkip: outcomes.some((outcome) => outcome.mustSkip),
    manualReview: outcomes.some((outcome) => outcome.manualReview),
    missingHistory: outcomes.some((outcome) => outcome.missingHistory),
    policyLimitExceeded: outcomes.some((outcome) => outcome.policyLimitExceeded),
    totalSteps: totalSalarySteps(context.history),
    recentHistory: recentSalaryStepHistory(context.history, 4),
    passedRules,
    failedRules,
    warnings: outcomes.flatMap((outcome) => outcome.warnings),
    missingRequirements: failedRules.flatMap((outcome) => outcome.missingRequirements),
    suggestedActions: failedRules.flatMap((outcome) => outcome.suggestedActions),
    commanderNotes: outcomes.flatMap((outcome) => outcome.reasons),
  };
}
