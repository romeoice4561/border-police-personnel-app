/**
 * Server-boundary financial redaction (Phase 45.1 hardening pass).
 *
 * SECURITY CONTEXT — READ BEFORE CHANGING:
 *
 * This codebase has no server-verifiable session today. `lib/auth/roles.ts`'s
 * permission system (`hasPermission`/`can()`) is evaluated ENTIRELY
 * client-side, against a session object that lives in localStorage/
 * sessionStorage; the one cookie mirrored for a "future middleware" holds
 * only the literal string "1" (presence, not identity — see
 * components/auth/auth_provider.tsx). No request today carries any
 * server-verifiable claim about who the caller is. Because of that, NO
 * Server Component or API route in this codebase can correctly compute
 * "is this specific viewer authorized to see the unmasked bank account
 * number" — there is no trustworthy input to that decision.
 *
 * Given that constraint, this module enforces the only honest policy
 * available: the RAW, unmasked `bankAccountNumber` is NEVER included in a
 * server → client RSC payload. `redactOfficerForClient()` is applied at
 * every page boundary that hands an `OfficerWithRelations` (or similar)
 * to a Client Component, so the value literally never reaches the
 * browser's network payload — not "hidden in React," redacted before
 * serialization. The Officer Profile Workspace's OWN edit flow is
 * unaffected: a user typing a NEW value into the bank account field never
 * round-trips through this redaction (it's local component state until
 * Save), so entering/editing the number still works normally.
 *
 * FUTURE REQUIREMENT (do not remove this comment when closing this gap):
 * once a real, server-verifiable session exists (e.g. a signed cookie /
 * JWT validated in a Server Component or middleware), this function should
 * be extended to accept the resolved viewer and return the FULL value only
 * when a genuine, server-verified `officers.viewFinancial` grant (or
 * verified self-ownership) is present — mirroring the client-side
 * `canViewFinancial` logic in components/officer/officer_workspace.tsx.
 * Until that lands, this function has exactly ONE mode: always redacted.
 *
 * Pure — no I/O, no Prisma import (works over any object shape with a
 * `bankAccountNumber` field).
 */

import { maskBankAccountNumber } from "@/lib/officer_profile/bank_account";
import { moneyFieldToNumber } from "@/lib/officer_profile/money_draft";

export interface HasBankAccountNumber {
  bankAccountNumber?: string | null;
  currentSalary?: unknown;
  otherSpecialAllowances?: unknown;
  cooperativeMonthlyDeduction?: unknown;
  netSalary?: unknown;
}

/**
 * Returns a shallow copy of `officer` with:
 * - `bankAccountNumber` masked
 * - salary Decimal fields coerced to plain numbers for RSC → client JSON
 *
 * Salary/bankName still pass through (Commander Search excludes them by
 * allow-list). Scope stays narrow: never unmask bank accounts.
 */
export function redactOfficerForClient<T extends HasBankAccountNumber>(officer: T): T {
  const next: T = {
    ...officer,
    currentSalary: moneyFieldToNumber(officer.currentSalary) as T["currentSalary"],
    otherSpecialAllowances: moneyFieldToNumber(officer.otherSpecialAllowances) as T["otherSpecialAllowances"],
    cooperativeMonthlyDeduction: moneyFieldToNumber(officer.cooperativeMonthlyDeduction) as T["cooperativeMonthlyDeduction"],
    netSalary: moneyFieldToNumber(officer.netSalary) as T["netSalary"],
  };
  if (!next.bankAccountNumber) return next;
  return { ...next, bankAccountNumber: maskBankAccountNumber(next.bankAccountNumber) };
}
