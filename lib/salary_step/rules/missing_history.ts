import { missingFiscalYears } from "@/lib/salary_step/history";
import type { SalaryStepRule } from "@/lib/salary_step/types";

export interface MissingSalaryHistoryRuleConfig {
  id?: string;
  requiredFiscalYears: readonly number[];
}

export function createMissingSalaryHistoryRule(config: MissingSalaryHistoryRuleConfig): SalaryStepRule {
  return {
    id: config.id ?? "missing-salary-history",
    label: "Missing salary history",
    severity: "warning",
    evaluate(context) {
      const missing = missingFiscalYears(context.history, config.requiredFiscalYears);
      const passed = missing.length === 0;
      return {
        ruleId: config.id ?? "missing-salary-history",
        passed,
        severity: "warning",
        reasons: passed ? ["Configured salary history years are present."] : ["Salary-step history is incomplete."],
        warnings: passed ? [] : [`Missing fiscal years: ${missing.join(", ")}`],
        missingRequirements: missing.map((year) => ({ code: `SALARY_HISTORY_${year}`, label: "Salary-step history", detail: String(year) })),
        suggestedActions: missing.map((year) => ({ code: `ADD_SALARY_HISTORY_${year}`, label: "Add salary-step history.", detail: String(year) })),
        missingHistory: !passed,
        manualReview: !passed,
      };
    },
  };
}
