/**
 * Promotion rule engine.
 *
 * Executes registered independent rules and aggregates a structured result.
 */

import type { PromotionEvaluationContext } from "@/lib/promotion/context";
import { aggregatePromotionResults } from "@/lib/promotion/result";
import type { PromotionEvaluationResult, PromotionRule } from "@/lib/promotion/types";

export interface PromotionEngineOptions {
  rules: readonly PromotionRule[];
}

export class PromotionEngine {
  constructor(private readonly options: PromotionEngineOptions) {}

  evaluate(context: PromotionEvaluationContext): PromotionEvaluationResult {
    const outcomes = this.options.rules.map((rule) => {
      const outcome = rule.evaluate(context);
      return {
        ...outcome,
        ruleId: outcome.ruleId || rule.id,
        severity: outcome.severity ?? rule.severity ?? "blocking",
        maxScore: outcome.maxScore ?? rule.maxScore ?? 0,
      };
    });

    return aggregatePromotionResults(outcomes);
  }
}

export function evaluatePromotionEligibility(
  context: PromotionEvaluationContext,
  rules: readonly PromotionRule[]
): PromotionEvaluationResult {
  return new PromotionEngine({ rules }).evaluate(context);
}
