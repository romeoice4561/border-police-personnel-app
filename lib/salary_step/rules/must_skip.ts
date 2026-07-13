import { recentSalaryStepHistory } from "@/lib/salary_step/history";
import type { SalaryStepAwardType, SalaryStepRule } from "@/lib/salary_step/types";

export interface MustSkipRuleConfig {
  id?: string;
  lookbackCycles: number;
  skipAwardTypes: readonly SalaryStepAwardType[];
}

export function createMustSkipRule(config: MustSkipRuleConfig): SalaryStepRule {
  return {
    id: config.id ?? "must-skip",
    label: "Must skip",
    severity: "blocking",
    evaluate(context) {
      const recent = recentSalaryStepHistory(context.history, config.lookbackCycles);
      const matched = recent.filter((record) => config.skipAwardTypes.includes(record.awardType));
      const passed = matched.length === 0;
      return {
        ruleId: config.id ?? "must-skip",
        passed,
        severity: "blocking",
        reasons: passed ? ["No configured skip condition found."] : ["Configured skip condition found in recent salary-step history."],
        warnings: [],
        missingRequirements: passed ? [] : matched.map((record) => ({
          code: `SKIP_CONDITION_${record.fiscalYear}_${record.reviewCycle}`,
          label: "Skip condition",
          detail: record.awardType,
        })),
        suggestedActions: passed ? [] : [{ code: "COMMANDER_SKIP_REVIEW", label: "Review officer for salary-step skip decision." }],
        mustSkip: !passed,
        manualReview: !passed,
      };
    },
  };
}
