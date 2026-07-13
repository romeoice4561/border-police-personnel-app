import { totalSalaryStepsForRecentCycles } from "@/lib/salary_step/history";
import type { SalaryStepRule } from "@/lib/salary_step/types";

export interface MaximumStepsRuleConfig {
  id?: string;
  lookbackCycles: number;
  maximumSteps: number;
  severity?: "blocking" | "warning";
}

export function createMaximumStepsRule(config: MaximumStepsRuleConfig): SalaryStepRule {
  const severity = config.severity ?? "warning";
  return {
    id: config.id ?? "maximum-steps",
    label: "Maximum salary steps",
    severity,
    evaluate(context) {
      const total = totalSalaryStepsForRecentCycles(context.history, config.lookbackCycles);
      const passed = total <= config.maximumSteps;
      return {
        ruleId: config.id ?? "maximum-steps",
        passed,
        severity,
        reasons: passed ? ["Salary-step total is within configured limit."] : ["Salary-step total exceeds configured limit."],
        warnings: passed ? [] : [`Recent salary-step total ${total} exceeds configured limit ${config.maximumSteps}.`],
        missingRequirements: [],
        suggestedActions: passed ? [] : [{ code: "REVIEW_POLICY_LIMIT", label: "Review salary-step policy limit." }],
        policyLimitExceeded: !passed,
        manualReview: !passed,
      };
    },
  };
}
