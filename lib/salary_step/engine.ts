import { buildSalaryStepContext } from "@/lib/salary_step/history";
import { aggregateSalaryStepResults } from "@/lib/salary_step/result";
import type { BuildSalaryStepContextInput, SalaryStepEvaluationContext, SalaryStepEvaluationResult, SalaryStepRule } from "@/lib/salary_step/types";

export interface SalaryStepEngineOptions {
  rules: readonly SalaryStepRule[];
}

export class SalaryStepEngine {
  constructor(private readonly options: SalaryStepEngineOptions) {}

  evaluate(context: SalaryStepEvaluationContext): SalaryStepEvaluationResult {
    const outcomes = this.options.rules.map((rule) => {
      const outcome = rule.evaluate(context);
      return {
        ...outcome,
        ruleId: outcome.ruleId || rule.id,
        severity: outcome.severity ?? rule.severity ?? "blocking",
      };
    });
    return aggregateSalaryStepResults(context, outcomes);
  }
}

export function evaluateSalaryStepIntelligence(
  input: BuildSalaryStepContextInput,
  rules: readonly SalaryStepRule[]
): SalaryStepEvaluationResult {
  return new SalaryStepEngine({ rules }).evaluate(buildSalaryStepContext(input));
}
