import { recentSalaryStepHistory } from "@/lib/salary_step/history";
import type { SalaryStepAwardType, SalaryStepRule } from "@/lib/salary_step/types";

export interface ManualReviewRuleConfig {
  id?: string;
  lookbackCycles: number;
  reviewAwardTypes?: readonly SalaryStepAwardType[];
  reviewWhenCommanderPriorityAtLeast?: "high" | "critical";
}

const PRIORITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

export function createManualReviewRule(config: ManualReviewRuleConfig): SalaryStepRule {
  return {
    id: config.id ?? "manual-review",
    label: "Manual review",
    severity: "warning",
    evaluate(context) {
      const recent = recentSalaryStepHistory(context.history, config.lookbackCycles);
      const reviewTypes = config.reviewAwardTypes ?? ["COMMANDER_OVERRIDE"];
      const hasReviewType = recent.some((record) => reviewTypes.includes(record.awardType));
      const priority = context.commanderIntelligence?.priority;
      const priorityThreshold = config.reviewWhenCommanderPriorityAtLeast;
      const highPriority = Boolean(priority && priorityThreshold && PRIORITY_RANK[priority] >= PRIORITY_RANK[priorityThreshold]);
      const needsReview = hasReviewType || highPriority;

      return {
        ruleId: config.id ?? "manual-review",
        passed: !needsReview,
        severity: "warning",
        reasons: needsReview ? ["Configured manual-review signal found."] : ["No configured manual-review signal found."],
        warnings: needsReview ? ["Commander review is recommended before salary-step decision."] : [],
        missingRequirements: [],
        suggestedActions: needsReview ? [{ code: "COMMANDER_MANUAL_REVIEW", label: "Perform commander salary-step review." }] : [],
        manualReview: needsReview,
      };
    },
  };
}
