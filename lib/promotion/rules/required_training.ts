import type { PromotionRule } from "@/lib/promotion/types";

export interface RequiredTrainingRuleConfig {
  id?: string;
  requiredTrainingCodes: readonly string[];
  score?: number;
}

export function createRequiredTrainingRule(config: RequiredTrainingRuleConfig): PromotionRule {
  const score = config.score ?? 20;

  return {
    id: config.id ?? "required-training",
    label: "Required training",
    maxScore: score,
    evaluate(context) {
      const completed = new Set((context.trainingRecords ?? []).map((record) => record.code));
      const missing = config.requiredTrainingCodes.filter((code) => !completed.has(code));
      const passed = missing.length === 0;

      return {
        ruleId: config.id ?? "required-training",
        passed,
        score: passed ? score : 0,
        maxScore: score,
        severity: "blocking",
        reasons: passed ? ["All configured training requirements are complete."] : ["Required training is missing."],
        missingRequirements: missing.map((code) => ({ code: `TRAINING_${code}`, label: "Required training", detail: code })),
        warnings: [],
        suggestedNextSteps: missing.map((code) => ({ code: `COMPLETE_TRAINING_${code}`, label: "Complete required training.", detail: code })),
      };
    },
  };
}
