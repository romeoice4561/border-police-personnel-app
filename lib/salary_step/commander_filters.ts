import type { SalaryStepEvaluationResult } from "@/lib/salary_step/types";

export interface SalaryStepCommanderFilters {
  eligibleDoubleStep?: boolean;
  mustSkip?: boolean;
  manualReview?: boolean;
  missingSalaryHistory?: boolean;
  lessThanSteps?: { steps: number; recentCycleCount?: number };
  moreThanSteps?: { steps: number; recentCycleCount?: number };
}

function scopedTotal(result: SalaryStepEvaluationResult, recentCycleCount: number | undefined): number {
  const history = recentCycleCount == null ? result.recentHistory : result.recentHistory.slice(0, recentCycleCount);
  return Number(history.reduce((sum, record) => sum + record.stepsAwarded, 0).toFixed(2));
}

export function matchesSalaryStepCommanderFilters(
  result: SalaryStepEvaluationResult,
  filters: SalaryStepCommanderFilters
): boolean {
  if (filters.eligibleDoubleStep === true && !result.eligibleDoubleStep) return false;
  if (filters.mustSkip === true && !result.mustSkip) return false;
  if (filters.manualReview === true && !result.manualReview) return false;
  if (filters.missingSalaryHistory === true && !result.missingHistory) return false;
  if (filters.lessThanSteps && scopedTotal(result, filters.lessThanSteps.recentCycleCount) >= filters.lessThanSteps.steps) return false;
  if (filters.moreThanSteps && scopedTotal(result, filters.moreThanSteps.recentCycleCount) <= filters.moreThanSteps.steps) return false;
  return true;
}

export function filterSalaryStepEvaluations(
  results: readonly SalaryStepEvaluationResult[],
  filters: SalaryStepCommanderFilters
): SalaryStepEvaluationResult[] {
  return results.filter((result) => matchesSalaryStepCommanderFilters(result, filters));
}
