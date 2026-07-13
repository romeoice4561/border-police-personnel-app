import type { PromotionRule } from "@/lib/promotion/types";

export interface MinimumRankRuleConfig {
  id?: string;
  allowedRanks: readonly string[];
  score?: number;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function createMinimumRankRule(config: MinimumRankRuleConfig): PromotionRule {
  const score = config.score ?? 10;
  const allowed = new Set(config.allowedRanks.map(normalize));

  return {
    id: config.id ?? "minimum-rank",
    label: "Minimum rank",
    maxScore: score,
    evaluate(context) {
      const passed = allowed.has(normalize(context.currentRank));
      return {
        ruleId: config.id ?? "minimum-rank",
        passed,
        score: passed ? score : 0,
        maxScore: score,
        severity: "blocking",
        reasons: passed
          ? ["Current rank is accepted by the configured policy."]
          : ["Current rank is missing or not accepted by the configured policy."],
        missingRequirements: passed
          ? []
          : [{ code: "MINIMUM_RANK", label: "Required current rank", detail: config.allowedRanks.join(", ") }],
        warnings: [],
        suggestedNextSteps: passed
          ? []
          : [{ code: "VERIFY_RANK", label: "Verify rank or wait for the required rank before promotion review." }],
      };
    },
  };
}
