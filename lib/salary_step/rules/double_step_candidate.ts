import { totalSalaryStepsForRecentCycles } from "@/lib/salary_step/history";
import type { SalaryStepRule } from "@/lib/salary_step/types";

export interface DoubleStepCandidateRuleConfig {
  id?: string;
  lookbackCycles: number;
  maxStepsInLookback: number;
  requireNoBlockingIntelligenceFlags?: boolean;
}

export function createDoubleStepCandidateRule(config: DoubleStepCandidateRuleConfig): SalaryStepRule {
  return {
    id: config.id ?? "double-step-candidate",
    label: "Double-step candidate",
    severity: "advisory",
    evaluate(context) {
      const total = totalSalaryStepsForRecentCycles(context.history, config.lookbackCycles);
      const hasBlockingFlag = config.requireNoBlockingIntelligenceFlags
        ? (context.commanderIntelligence?.flags ?? []).some((flag) => flag.severity === "critical" || flag.severity === "serious")
        : false;
      const passed = total <= config.maxStepsInLookback && !hasBlockingFlag;

      return {
        ruleId: config.id ?? "double-step-candidate",
        passed,
        severity: "advisory",
        reasons: passed
          ? ["Officer matches the configured double-step candidate rule."]
          : ["Officer does not match the configured double-step candidate rule."],
        warnings: hasBlockingFlag ? ["Commander intelligence flags require review before double-step consideration."] : [],
        missingRequirements: [],
        suggestedActions: passed
          ? []
          : [{ code: "REVIEW_DOUBLE_STEP_CANDIDACY", label: "Review double-step candidacy against configured policy." }],
        eligibleDoubleStep: passed,
        manualReview: hasBlockingFlag,
      };
    },
  };
}
