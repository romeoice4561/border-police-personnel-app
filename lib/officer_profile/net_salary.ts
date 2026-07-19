/**
 * Net salary calculation for Membership & Financial. Pure — no I/O.
 *
 * Formula:
 *   netSalary = currentSalary + otherSpecialAllowances - totalExpenses
 *
 * cooperativeMonthlyDeduction is retained as the persisted field name for
 * backward compatibility; its current business meaning is total monthly
 * deductions (รายจ่ายรวม).
 *
 * - null/empty allowances or expenses → 0
 * - net is never negative at display time (callers validate expenses ≤ income before save)
 * - amounts rounded to 2 decimal places (satang)
 */

import { roundMoney2 } from "@/lib/officer_profile/money_draft";

export function normalizeMoneyAmount(amount: number | null | undefined): number {
  return amount == null ? 0 : roundMoney2(amount);
}

/** @deprecated Prefer normalizeMoneyAmount */
export function normalizeCooperativeDeduction(deduction: number | null | undefined): number {
  return normalizeMoneyAmount(deduction);
}

export interface NetSalaryInputs {
  currentSalary?: number | null;
  otherSpecialAllowances?: number | null;
  /** Stored column: cooperativeMonthlyDeduction (รายจ่ายรวม). */
  totalExpenses?: number | null;
}

/**
 * Computes take-home pay.
 * Returns null when there is no income side (no base and no allowances).
 * Does not clamp — use `displayNetSalary` for non-negative UI display.
 */
export function calculateNetSalary(inputs: NetSalaryInputs): number | null {
  const base = inputs.currentSalary;
  const allowancesRaw = inputs.otherSpecialAllowances;
  const expensesRaw = inputs.totalExpenses;
  const allowances = normalizeMoneyAmount(allowancesRaw);
  const expenses = normalizeMoneyAmount(expensesRaw);

  if (base == null && allowancesRaw == null && expensesRaw == null) {
    return null;
  }
  if (base == null && allowancesRaw == null) {
    return expenses > 0 ? roundMoney2(-expenses) : null;
  }

  return roundMoney2((base ?? 0) + allowances - expenses);
}

/** Live/read-only display helper: never returns a negative amount. */
export function displayNetSalary(inputs: NetSalaryInputs): number | null {
  const net = calculateNetSalary(inputs);
  if (net == null) return null;
  return roundMoney2(Math.max(0, net));
}

export function incomeTotal(
  currentSalary: number | null | undefined,
  otherSpecialAllowances: number | null | undefined
): number | null {
  if (currentSalary == null && otherSpecialAllowances == null) return null;
  return roundMoney2((currentSalary ?? 0) + normalizeMoneyAmount(otherSpecialAllowances));
}

export function isExpensesExceedingIncome(inputs: NetSalaryInputs): boolean {
  const expenses = normalizeMoneyAmount(inputs.totalExpenses);
  if (expenses === 0) return false;
  const income = incomeTotal(inputs.currentSalary, inputs.otherSpecialAllowances);
  if (income == null) return expenses > 0;
  return expenses > income + 1e-9;
}

/** Convenience for UI that still passes positional args (allowances optional). */
export function isDeductionExceedingSalary(
  currentSalary: number | null | undefined,
  totalExpenses: number | null | undefined,
  otherSpecialAllowances?: number | null
): boolean {
  return isExpensesExceedingIncome({
    currentSalary,
    otherSpecialAllowances: otherSpecialAllowances ?? null,
    totalExpenses,
  });
}

export interface SalaryPatchFields {
  currentSalary?: number | null;
  otherSpecialAllowances?: number | null;
  cooperativeMonthlyDeduction?: number | null;
  netSalary?: number | null;
}

export interface ExistingSalaryFields {
  currentSalary: number | null;
  otherSpecialAllowances: number | null;
  cooperativeMonthlyDeduction: number | null;
}

export type ResolveNetSalaryResult =
  | { ok: true; patch: SalaryPatchFields }
  | { ok: false; message: string; patch: SalaryPatchFields };

/**
 * Server-side: strip any client-supplied netSalary and, when salary-related
 * fields are being written, persist the formula result. Merges omitted patch
 * keys from the existing officer row so a partial update stays consistent.
 */
export function resolveNetSalaryForSave(patch: SalaryPatchFields, existing: ExistingSalaryFields): ResolveNetSalaryResult {
  const { netSalary: _clientNet, ...withoutClientNet } = patch;
  void _clientNet;

  const touchingSalaryRelated =
    patch.currentSalary !== undefined ||
    patch.otherSpecialAllowances !== undefined ||
    patch.cooperativeMonthlyDeduction !== undefined ||
    patch.netSalary !== undefined;

  if (!touchingSalaryRelated) {
    return { ok: true, patch: withoutClientNet };
  }

  if (
    patch.currentSalary === undefined &&
    patch.otherSpecialAllowances === undefined &&
    patch.cooperativeMonthlyDeduction === undefined
  ) {
    return { ok: true, patch: withoutClientNet };
  }

  const currentSalary = patch.currentSalary !== undefined ? patch.currentSalary : existing.currentSalary;
  const allowancesRaw =
    patch.otherSpecialAllowances !== undefined ? patch.otherSpecialAllowances : existing.otherSpecialAllowances;
  const expensesRaw =
    patch.cooperativeMonthlyDeduction !== undefined
      ? patch.cooperativeMonthlyDeduction
      : existing.cooperativeMonthlyDeduction;

  const allowances = normalizeMoneyAmount(allowancesRaw);
  const expenses = normalizeMoneyAmount(expensesRaw);

  if (currentSalary == null && allowancesRaw == null) {
    if (expenses > 0) {
      return {
        ok: false,
        message: "Total expenses cannot exceed base salary plus special allowances",
        patch: withoutClientNet,
      };
    }
    return { ok: true, patch: { ...withoutClientNet, netSalary: null } };
  }

  const income = roundMoney2((currentSalary ?? 0) + allowances);
  if (expenses > income + 1e-9) {
    return {
      ok: false,
      message: "Total expenses cannot exceed base salary plus special allowances",
      patch: withoutClientNet,
    };
  }

  return {
    ok: true,
    patch: { ...withoutClientNet, netSalary: roundMoney2(income - expenses) },
  };
}
