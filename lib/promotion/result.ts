import type { PromotionEvaluationResult, PromotionRuleOutcome } from "@/lib/promotion/types";

export function emptyPromotionResult(): PromotionEvaluationResult {
  return {
    eligible: false,
    score: 0,
    maxScore: 0,
    passedRules: [],
    failedRules: [],
    missingRequirements: [],
    warnings: ["No promotion rules registered."],
    suggestedNextSteps: [{ code: "REGISTER_RULES", label: "Register promotion rules before evaluation." }],
  };
}

export function aggregatePromotionResults(outcomes: readonly PromotionRuleOutcome[]): PromotionEvaluationResult {
  if (outcomes.length === 0) return emptyPromotionResult();

  const passedRules = outcomes.filter((outcome) => outcome.passed);
  const failedRules = outcomes.filter((outcome) => !outcome.passed);
  const blockingFailures = failedRules.filter((outcome) => outcome.severity === "blocking");
  const score = outcomes.reduce((sum, outcome) => sum + Math.max(0, outcome.score), 0);
  const maxScore = outcomes.reduce((sum, outcome) => sum + Math.max(0, outcome.maxScore), 0);

  return {
    eligible: blockingFailures.length === 0,
    score,
    maxScore,
    passedRules,
    failedRules,
    missingRequirements: failedRules.flatMap((outcome) => outcome.missingRequirements),
    warnings: outcomes.flatMap((outcome) => outcome.warnings),
    suggestedNextSteps: failedRules.flatMap((outcome) => outcome.suggestedNextSteps),
  };
}
