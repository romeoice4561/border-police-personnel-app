/**
 * Presentation-only salary utilization math. Pure — no I/O.
 *
 * Returns percentage POINTS (7.1 means 7.1%). Callers must append "%" only —
 * never multiply by 100 again.
 *
 *   expensePercentage   = (totalExpenses / totalIncome) * 100
 *   remainingPercentage = (netSalary / totalIncome) * 100
 */

import { moneyFieldToNumber, roundMoney2 } from "@/lib/officer_profile/money_draft";
import { displayNetSalary, normalizeMoneyAmount } from "@/lib/officer_profile/net_salary";

export interface SalaryUtilizationInput {
  /** number | Prisma Decimal | string | null — coerced via moneyFieldToNumber */
  baseSalary: unknown;
  specialAllowances: unknown;
  totalDeductions: unknown;
  netSalary?: unknown;
}

export interface SalaryUtilization {
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  remainingNetSalary: number;
  /** Percentage points 0–100 (e.g. 7.1). */
  expensePercentage: number;
  /** Percentage points 0–100 (e.g. 92.9). */
  remainingPercentage: number;
  isEmpty: boolean;
  isInvalid: boolean;
  deductionsAreNull: boolean;
  allowancesAreNull: boolean;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Formats percentage POINTS for display (input is already 0–100, NOT 0–1).
 * Always uses ASCII "." for fractional values so "7.1%" cannot be misread as "71%".
 */
export function formatUtilizationPercent(percentagePoints: number): string {
  const clamped = clampPercent(percentagePoints);
  const rounded = Math.round(clamped * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  // toFixed always emits ASCII period — never a locale decimal that might vanish in UI.
  return rounded.toFixed(1);
}

export function computeSalaryUtilization(input: SalaryUtilizationInput): SalaryUtilization {
  const baseSalary = moneyFieldToNumber(input.baseSalary);
  const specialAllowances = moneyFieldToNumber(input.specialAllowances);
  const totalDeductions = moneyFieldToNumber(input.totalDeductions);
  const netSalary = moneyFieldToNumber(input.netSalary);

  const allowancesAreNull = input.specialAllowances == null;
  const deductionsAreNull = input.totalDeductions == null;

  const totalMonthlyIncome = roundMoney2(
    normalizeMoneyAmount(baseSalary) + normalizeMoneyAmount(specialAllowances)
  );
  const totalMonthlyExpenses = roundMoney2(normalizeMoneyAmount(totalDeductions));

  const isEmpty = totalMonthlyIncome <= 0;
  const isInvalid = !isEmpty && totalMonthlyExpenses > totalMonthlyIncome + 1e-9;

  const derivedNet = displayNetSalary({
    currentSalary: baseSalary,
    otherSpecialAllowances: specialAllowances,
    totalExpenses: totalDeductions,
  });

  let remainingNetSalary = roundMoney2(netSalary != null ? netSalary : (derivedNet ?? 0));
  if (isEmpty || isInvalid) remainingNetSalary = 0;

  let expensePercentage = 0;
  let remainingPercentage = 0;

  if (!isEmpty) {
    if (isInvalid) {
      expensePercentage = 100;
      remainingPercentage = 0;
    } else {
      expensePercentage = clampPercent((totalMonthlyExpenses / totalMonthlyIncome) * 100);
      remainingPercentage = clampPercent((remainingNetSalary / totalMonthlyIncome) * 100);
    }
  }

  return {
    totalMonthlyIncome,
    totalMonthlyExpenses,
    remainingNetSalary,
    expensePercentage,
    remainingPercentage,
    isEmpty,
    isInvalid,
    deductionsAreNull,
    allowancesAreNull,
  };
}
