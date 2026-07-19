/**
 * Decimal money draft sanitizer / parser — typing intermediate states.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isAcceptableMoneyDraft,
  parseMoneyDraft,
  roundMoney2,
  sanitizeMoneyDraftInput,
} from "@/lib/officer_profile/money_draft";
import { formatMoneyTh } from "@/lib/officer_profile/money_format";
import { calculateNetSalary } from "@/lib/officer_profile/net_salary";
import {
  computeSalaryUtilization,
  formatUtilizationPercent,
} from "@/lib/officer_profile/salary_utilization";

test("sanitize accepts empty and progressive decimal drafts", () => {
  const accepted = ["", "0", "0.", "0.5", "0.50", "3773.", "3773.2", "3773.25", "3", "3773"];
  for (const draft of accepted) {
    assert.equal(sanitizeMoneyDraftInput(draft), draft, `sanitize(${JSON.stringify(draft)})`);
    assert.equal(isAcceptableMoneyDraft(sanitizeMoneyDraftInput(draft)), true);
  }
});

test("sanitize caps to 2 decimal places and one separator", () => {
  assert.equal(sanitizeMoneyDraftInput("3773.256"), "3773.25");
  assert.equal(sanitizeMoneyDraftInput("3..5"), "3.5");
  assert.equal(sanitizeMoneyDraftInput("12.3456"), "12.34");
});

test("sanitize rejects scientific / signed / letters", () => {
  assert.equal(sanitizeMoneyDraftInput("1e3"), "13");
  assert.equal(sanitizeMoneyDraftInput("1E3"), "13");
  assert.equal(sanitizeMoneyDraftInput("-1"), "1");
  assert.equal(sanitizeMoneyDraftInput("1+2"), "12");
  assert.equal(sanitizeMoneyDraftInput("abc"), "");
});

test("optional decimal-comma form normalizes without treating thousands as decimal", () => {
  assert.equal(sanitizeMoneyDraftInput("3773,50"), "3773.50");
  assert.equal(sanitizeMoneyDraftInput("3773,5"), "3773.5");
  // Thousands-style commas are stripped (digits kept), not treated as decimal.
  assert.equal(sanitizeMoneyDraftInput("3,773"), "3773");
});

test("parseMoneyDraft accepted / rejected", () => {
  assert.equal(parseMoneyDraft(""), null);
  assert.equal(parseMoneyDraft("0"), 0);
  assert.equal(parseMoneyDraft("0."), 0);
  assert.equal(parseMoneyDraft("0.5"), 0.5);
  assert.equal(parseMoneyDraft("0.50"), 0.5);
  assert.equal(parseMoneyDraft("3773."), 3773);
  assert.equal(parseMoneyDraft("3773.2"), 3773.2);
  assert.equal(parseMoneyDraft("3773.25"), 3773.25);
  assert.equal(parseMoneyDraft("3773.256"), null);
  assert.equal(parseMoneyDraft("-1"), null);
  assert.equal(parseMoneyDraft("1e3"), null);
  assert.equal(parseMoneyDraft("1+2"), null);
  assert.equal(parseMoneyDraft("abc"), null);
  assert.equal(parseMoneyDraft("3..5"), null);
});

test("decimal net salary: 48200.25 + 4700.50 - 3773.25 = 49127.50", () => {
  const net = calculateNetSalary({
    currentSalary: 48200.25,
    otherSpecialAllowances: 4700.5,
    totalExpenses: 3773.25,
  });
  assert.equal(net, 49127.5);
  assert.equal(roundMoney2(48200.25 + 4700.5 - 3773.25), 49127.5);
});

test("money display policy: whole vs fractional", () => {
  assert.equal(formatMoneyTh(48200), "48,200 บาท");
  assert.equal(formatMoneyTh(48200.5), "48,200.50 บาท");
  assert.equal(formatMoneyTh(3773.25), "3,773.25 บาท");
});

test("percentage regression: 3773 / 52900 → 7.1% / 92.9% (not 71%)", () => {
  const u = computeSalaryUtilization({
    baseSalary: 48200,
    specialAllowances: 4700,
    totalDeductions: 3773,
  });
  assert.equal(u.totalMonthlyIncome, 52900);
  assert.equal(u.totalMonthlyExpenses, 3773);
  assert.equal(u.remainingNetSalary, 49127);
  assert.equal(formatUtilizationPercent(u.expensePercentage), "7.1");
  assert.equal(formatUtilizationPercent(u.remainingPercentage), "92.9");
  assert.notEqual(formatUtilizationPercent(u.expensePercentage), "71");
  assert.ok(u.expensePercentage > 7 && u.expensePercentage < 8);
});
