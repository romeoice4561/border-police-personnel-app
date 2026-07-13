import type { SalaryStepEvaluationResult } from "@/lib/salary_step/types";

export interface SalaryStepDashboardSummary {
  totalOfficers: number;
  eligibleDoubleStep: number;
  mustSkip: number;
  manualReview: number;
  missingRecords: number;
  averageSalarySteps: number;
}

export function summarizeSalaryStepDashboard(results: readonly SalaryStepEvaluationResult[]): SalaryStepDashboardSummary {
  const averageSalarySteps =
    results.length === 0
      ? 0
      : Number((results.reduce((sum, result) => sum + result.totalSteps, 0) / results.length).toFixed(2));

  return {
    totalOfficers: results.length,
    eligibleDoubleStep: results.filter((result) => result.eligibleDoubleStep).length,
    mustSkip: results.filter((result) => result.mustSkip).length,
    manualReview: results.filter((result) => result.manualReview).length,
    missingRecords: results.filter((result) => result.missingHistory).length,
    averageSalarySteps,
  };
}
