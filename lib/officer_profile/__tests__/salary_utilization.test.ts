/**
 * Salary utilization gauge math — presentation helper shared by edit + read-only.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  computeSalaryUtilization,
  formatUtilizationPercent,
} from "@/lib/officer_profile/salary_utilization";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";
import { DICTIONARY } from "@/lib/i18n/dictionary";

test("1. 48200 + 6000 income, 10000 deductions → 18.5% / 81.5%", () => {
  const u = computeSalaryUtilization({
    baseSalary: 48200,
    specialAllowances: 6000,
    totalDeductions: 10000,
  });
  assert.equal(u.totalMonthlyIncome, 54200);
  assert.equal(u.remainingNetSalary, 44200);
  assert.equal(formatUtilizationPercent(u.expensePercentage), "18.5");
  assert.equal(formatUtilizationPercent(u.remainingPercentage), "81.5");
  assert.equal(u.isEmpty, false);
  assert.equal(u.isInvalid, false);
});

test("1c. 48200 + 4700 − 3773 → 7.1% expense and 92.9% remaining (not 71%)", () => {
  const exact = computeSalaryUtilization({
    baseSalary: 48200,
    specialAllowances: 4700,
    totalDeductions: 3773,
  });
  assert.equal(exact.totalMonthlyIncome, 52900);
  assert.equal(exact.totalMonthlyExpenses, 3773);
  assert.equal(exact.remainingNetSalary, 49127);
  assert.equal(formatUtilizationPercent(exact.expensePercentage), "7.1");
  assert.equal(formatUtilizationPercent(exact.remainingPercentage), "92.9");
  // Guard against a ×10 display bug that would show ~71%.
  assert.notEqual(formatUtilizationPercent(exact.expensePercentage), "71");
  assert.notEqual(formatUtilizationPercent(exact.expensePercentage), "71.3");
  assert.ok(exact.expensePercentage > 7 && exact.expensePercentage < 8);
});

test("2. 48200 income, 0 deductions → 0% expense / 100% remaining", () => {
  const u = computeSalaryUtilization({
    baseSalary: 48200,
    specialAllowances: null,
    totalDeductions: 0,
  });
  assert.equal(u.totalMonthlyIncome, 48200);
  assert.equal(u.remainingNetSalary, 48200);
  assert.equal(formatUtilizationPercent(u.expensePercentage), "0");
  assert.equal(formatUtilizationPercent(u.remainingPercentage), "100");
  assert.equal(u.deductionsAreNull, false);
});

test("3. 0 income / 0 deductions → empty state, no NaN/Infinity", () => {
  const u = computeSalaryUtilization({
    baseSalary: null,
    specialAllowances: null,
    totalDeductions: null,
  });
  assert.equal(u.isEmpty, true);
  assert.equal(Number.isFinite(u.expensePercentage), true);
  assert.equal(Number.isFinite(u.remainingPercentage), true);
  assert.equal(u.expensePercentage, 0);
  assert.equal(u.remainingPercentage, 0);
});

test("4. invalid draft income 50000 / deductions 60000 clamps expense 100% remaining 0%", () => {
  const u = computeSalaryUtilization({
    baseSalary: 50000,
    specialAllowances: 0,
    totalDeductions: 60000,
  });
  assert.equal(u.isInvalid, true);
  assert.equal(u.expensePercentage, 100);
  assert.equal(u.remainingPercentage, 0);
  assert.equal(u.remainingNetSalary, 0);
});

test("5. null special allowances use 0 in income total", () => {
  const u = computeSalaryUtilization({
    baseSalary: 48200,
    specialAllowances: null,
    totalDeductions: 10000,
  });
  assert.equal(u.totalMonthlyIncome, 48200);
  assert.equal(u.allowancesAreNull, true);
  assert.equal(u.remainingNetSalary, 38200);
});

test("6. null deductions preserveไม่มีรายการหัก semantics (deductionsAreNull)", () => {
  const u = computeSalaryUtilization({
    baseSalary: 48200,
    specialAllowances: 6000,
    totalDeductions: null,
  });
  assert.equal(u.deductionsAreNull, true);
  assert.equal(u.totalMonthlyExpenses, 0);
  assert.equal(DICTIONARY["officer.cooperativeDeductionNone"].th, "ไม่มีรายการหัก");
});

test("7. explicit zero deductions → 0 บาท path (not null) and 0%", () => {
  const u = computeSalaryUtilization({
    baseSalary: 48200,
    specialAllowances: 0,
    totalDeductions: 0,
  });
  assert.equal(u.deductionsAreNull, false);
  assert.equal(u.totalMonthlyExpenses, 0);
  assert.equal(formatUtilizationPercent(u.expensePercentage), "0");
});

test("8. edit and read-only sources both import computeSalaryUtilization (same helper)", async () => {
  const root = process.cwd();
  const section = await fs.readFile(path.join(root, "components/officer/membership_financial_section.tsx"), "utf8");
  const gauge = await fs.readFile(path.join(root, "components/officer/salary_utilization_gauge.tsx"), "utf8");
  const editor = await fs.readFile(path.join(root, "components/officer/membership_financial_editor.tsx"), "utf8");
  assert.ok(section.includes("computeSalaryUtilization") || section.includes("SalaryUtilizationGauge"));
  assert.ok(gauge.includes("computeSalaryUtilization"));
  assert.ok(editor.includes("SalaryUtilizationGauge"));
  // Gauge is the single visual; both modes mount it (section full, editor compact).
  assert.ok(section.includes("SalaryUtilizationGauge"));
  assert.ok(editor.includes("compact"));
});

test("formatUtilizationPercent rounds to one decimal when needed", () => {
  assert.equal(formatUtilizationPercent(18.45), "18.5");
  assert.equal(formatUtilizationPercent(20), "20");
  assert.equal(formatUtilizationPercent(0), "0");
  assert.equal(formatUtilizationPercent(100.2), "100");
  assert.equal(formatUtilizationPercent((3773 / 52900) * 100), "7.1");
  assert.equal(formatUtilizationPercent((49127 / 52900) * 100), "92.9");
});

test("UI labels match the refined Thai wording", () => {
  assert.equal(FIELD_LABELS.otherSpecialAllowances.th, "เงินเพิ่ม / ค่าตอบแทนพิเศษ");
  assert.equal(FIELD_LABELS.cooperativeMonthlyDeduction.th, "รายจ่ายรวม");
  assert.equal(FIELD_LABELS.totalMonthlyIncome.th, "รายรับรวม");
  assert.equal(FIELD_LABELS.netSalary.th, "เงินเดือนรับจริง");
  assert.equal(
    DICTIONARY["officer.salaryFormulaHelper"].th,
    "เงินเดือนรับจริง = ฐานเงินเดือน + เงินเพิ่ม / ค่าตอบแทนพิเศษ − รายจ่ายรวม"
  );
  assert.equal(
    DICTIONARY["officer.netSalaryHelper"].th,
    "คำนวณจากฐานเงินเดือน + เงินเพิ่ม / ค่าตอบแทนพิเศษ − รายจ่ายรวม"
  );
  assert.equal(DICTIONARY["officer.otherSpecialAllowancesNone"].th, "ไม่มีเงินเพิ่ม / ค่าตอบแทนพิเศษ");
  assert.equal(
    DICTIONARY["officer.otherSpecialAllowancesHelper"].th,
    "พ.ส.ร. / ต.ป.ป. / ค่าเสี่ยงภัย / เงินเพิ่มและค่าตอบแทนอื่นต่อเดือน"
  );
  assert.equal(
    DICTIONARY["officer.cooperativeDeductionHelper"].th,
    "ภาษี / กบข. / แฟลต / ค่าน้ำไฟ / หนี้สหกรณ์ / รายจ่ายอื่นต่อเดือน"
  );
});
