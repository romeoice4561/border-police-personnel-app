import type { DurationYMD } from "@/lib/personnel_calendar";
import type { PromotionRule } from "@/lib/promotion/types";

export interface MinimumServiceRuleConfig {
  id?: string;
  minimum: DurationYMD;
  score?: number;
}

function durationAtLeast(actual: DurationYMD | null | undefined, required: DurationYMD): boolean {
  if (!actual) return false;
  if (actual.years !== required.years) return actual.years > required.years;
  if (actual.months !== required.months) return actual.months > required.months;
  return actual.days >= required.days;
}

export function createMinimumServiceRule(config: MinimumServiceRuleConfig): PromotionRule {
  const score = config.score ?? 20;
  return {
    id: config.id ?? "minimum-service",
    label: "Minimum government service",
    maxScore: score,
    evaluate(context) {
      const passed = durationAtLeast(context.governmentServiceDuration, config.minimum);
      return {
        ruleId: config.id ?? "minimum-service",
        passed,
        score: passed ? score : 0,
        maxScore: score,
        severity: "blocking",
        reasons: passed
          ? ["Government service duration meets the configured minimum."]
          : ["Government service duration is below the configured minimum or missing."],
        missingRequirements: passed
          ? []
          : [{
              code: "MINIMUM_SERVICE",
              label: "Minimum government service duration",
              detail: `${config.minimum.years} years, ${config.minimum.months} months, ${config.minimum.days} days`,
            }],
        warnings: [],
        suggestedNextSteps: passed
          ? []
          : [{ code: "WAIT_SERVICE_TIME", label: "Wait until the minimum service duration is reached." }],
      };
    },
  };
}
