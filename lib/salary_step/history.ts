import { currentFiscalYear } from "@/lib/personnel_calendar";
import { yearBEToGregorian } from "@/lib/officer_profile/thai_date";
import type { SalaryStepEvaluationContext, SalaryStepHistoryRecord, SalaryStepReviewCycle, BuildSalaryStepContextInput } from "@/lib/salary_step/types";

const DEFAULT_CYCLE_ORDER: readonly SalaryStepReviewCycle[] = ["APRIL", "OCTOBER"];

export interface SalaryStepHistoryLike {
  yearBE: number;
  salaryStep: number;
  remarks?: string | null;
}

export interface AnnualHistoryAdapterOptions {
  reviewCycle?: SalaryStepReviewCycle;
  awardTypeForStep?: (stepsAwarded: number) => SalaryStepHistoryRecord["awardType"];
}

export function buildSalaryStepContext(input: BuildSalaryStepContextInput): SalaryStepEvaluationContext {
  const asOf = input.asOf ?? new Date();
  return {
    ...input,
    asOf,
    fiscalYear: input.fiscalYear ?? currentFiscalYear(asOf),
    history: input.history ?? [],
  };
}

export function adaptAnnualSalaryHistory(
  rows: readonly SalaryStepHistoryLike[],
  options: AnnualHistoryAdapterOptions = {}
): SalaryStepHistoryRecord[] {
  const reviewCycle = options.reviewCycle ?? "OCTOBER";
  const awardTypeForStep = options.awardTypeForStep ?? (() => "NORMAL");
  return rows.map((row) => ({
    fiscalYear: yearBEToGregorian(row.yearBE),
    reviewCycle,
    stepsAwarded: row.salaryStep,
    awardType: awardTypeForStep(row.salaryStep),
    remarks: row.remarks ?? null,
  }));
}

function cycleIndex(cycle: SalaryStepReviewCycle, order: readonly SalaryStepReviewCycle[]): number {
  const index = order.indexOf(cycle);
  return index >= 0 ? index : order.length;
}

export function sortSalaryStepHistory<T extends SalaryStepHistoryRecord>(
  history: readonly T[],
  cycleOrder: readonly SalaryStepReviewCycle[] = DEFAULT_CYCLE_ORDER
): T[] {
  return [...history].sort((a, b) => {
    if (a.fiscalYear !== b.fiscalYear) return b.fiscalYear - a.fiscalYear;
    return cycleIndex(b.reviewCycle, cycleOrder) - cycleIndex(a.reviewCycle, cycleOrder);
  });
}

export function recentSalaryStepHistory<T extends SalaryStepHistoryRecord>(
  history: readonly T[],
  cycleCount: number,
  cycleOrder: readonly SalaryStepReviewCycle[] = DEFAULT_CYCLE_ORDER
): T[] {
  return sortSalaryStepHistory(history, cycleOrder).slice(0, Math.max(0, cycleCount));
}

export function salaryStepHistoryForFiscalYears<T extends SalaryStepHistoryRecord>(
  history: readonly T[],
  fiscalYears: readonly number[]
): T[] {
  const years = new Set(fiscalYears);
  return history.filter((record) => years.has(record.fiscalYear));
}

export function totalSalarySteps(history: readonly SalaryStepHistoryRecord[]): number {
  return Number(history.reduce((sum, record) => sum + record.stepsAwarded, 0).toFixed(2));
}

export function totalSalaryStepsForRecentCycles(
  history: readonly SalaryStepHistoryRecord[],
  cycleCount: number,
  cycleOrder: readonly SalaryStepReviewCycle[] = DEFAULT_CYCLE_ORDER
): number {
  return totalSalarySteps(recentSalaryStepHistory(history, cycleCount, cycleOrder));
}

export function totalSalaryStepsForFiscalYears(
  history: readonly SalaryStepHistoryRecord[],
  fiscalYears: readonly number[]
): number {
  return totalSalarySteps(salaryStepHistoryForFiscalYears(history, fiscalYears));
}

export function missingFiscalYears(history: readonly SalaryStepHistoryRecord[], fiscalYears: readonly number[]): number[] {
  const present = new Set(history.map((record) => record.fiscalYear));
  return fiscalYears.filter((year) => !present.has(year));
}
