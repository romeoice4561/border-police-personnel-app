import type { PromotionRule } from "@/lib/promotion/types";

export interface RetirementWindowRuleConfig {
  id?: string;
  minimumRemainingMonths: number;
  score?: number;
}

function totalMonths(duration: { years: number; months: number; days: number } | null | undefined): number | null {
  if (!duration) return null;
  return duration.years * 12 + duration.months + (duration.days > 0 ? 1 : 0);
}

export function createRetirementWindowRule(config: RetirementWindowRuleConfig): PromotionRule {
  const score = config.score ?? 10;

  return {
    id: config.id ?? "retirement-window",
    label: "Retirement window",
    maxScore: score,
    evaluate(context) {
      const monthsRemaining = totalMonths(context.remainingUntilRetirement);
      const passed = monthsRemaining !== null && monthsRemaining >= config.minimumRemainingMonths;

      return {
        ruleId: config.id ?? "retirement-window",
        passed,
        score: passed ? score : 0,
        maxScore: score,
        severity: "warning",
        reasons: passed
          ? ["Remaining service time is within the configured review window."]
          : ["Remaining service time is missing or below the configured window."],
        missingRequirements: [],
        warnings: passed ? [] : ["Officer may be too close to retirement for this promotion path."],
        suggestedNextSteps: passed
          ? []
          : [{ code: "RETIREMENT_REVIEW", label: "Review retirement timing before promotion decision." }],
      };
    },
  };
}
