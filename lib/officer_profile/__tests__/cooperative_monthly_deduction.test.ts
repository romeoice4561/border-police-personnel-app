/**
 * Net salary formula tests:
 *   net = base + otherSpecialAllowances - totalExpenses (cooperativeMonthlyDeduction)
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { officerProfileSaveSchema } from "@/lib/officer_profile/officer_profile_api_schemas";
import {
  calculateNetSalary,
  displayNetSalary,
  normalizeMoneyAmount,
  resolveNetSalaryForSave,
} from "@/lib/officer_profile/net_salary";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";
import { DICTIONARY } from "@/lib/i18n/dictionary";
import { COMMANDER_EXPORT_COLUMNS_TH, buildCommanderExportCsv } from "@/lib/commander_query/commander_export";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";

const emptyExisting = {
  currentSalary: null as number | null,
  otherSpecialAllowances: null as number | null,
  cooperativeMonthlyDeduction: null as number | null,
};

// ── Pure calculation ─────────────────────────────────────────────────────

test("1. 48200 + 0 - 8000 = 40200", () => {
  assert.equal(calculateNetSalary({ currentSalary: 48200, otherSpecialAllowances: null, totalExpenses: 8000 }), 40200);
  assert.equal(displayNetSalary({ currentSalary: 48200, totalExpenses: 8000 }), 40200);
});

test("1b. 48200 + 2000 - 8000 = 42200", () => {
  assert.equal(
    calculateNetSalary({ currentSalary: 48200, otherSpecialAllowances: 2000, totalExpenses: 8000 }),
    42200
  );
});

test("2. empty/null allowances and expenses are treated as 0", () => {
  assert.equal(normalizeMoneyAmount(null), 0);
  assert.equal(calculateNetSalary({ currentSalary: 48200, otherSpecialAllowances: null, totalExpenses: null }), 48200);
  assert.equal(calculateNetSalary({ currentSalary: 48200 }), 48200);
});

test("3. expenses greater than income are rejected by schema", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { currentSalary: 48200, otherSpecialAllowances: 0, cooperativeMonthlyDeduction: 50000 },
  });
  assert.equal(result.success, false);
});

test("3b. expenses greater than base alone but within base+allowances are accepted", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { currentSalary: 48200, otherSpecialAllowances: 5000, cooperativeMonthlyDeduction: 50000 },
  });
  assert.equal(result.success, true);
  const resolved = resolveNetSalaryForSave(result.success ? result.data.profile! : {}, emptyExisting);
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.equal(resolved.patch.netSalary, 3200);
});

test("4. negative expenses / allowances are rejected", () => {
  assert.equal(
    officerProfileSaveSchema.safeParse({
      profile: { currentSalary: 48200, otherSpecialAllowances: 0, cooperativeMonthlyDeduction: -1 },
    }).success,
    false
  );
  assert.equal(
    officerProfileSaveSchema.safeParse({
      profile: { currentSalary: 48200, otherSpecialAllowances: -1, cooperativeMonthlyDeduction: 0 },
    }).success,
    false
  );
});

test("5. client-supplied incorrect netSalary is ignored — server formula wins", () => {
  const resolved = resolveNetSalaryForSave(
    { currentSalary: 48200, otherSpecialAllowances: 2000, cooperativeMonthlyDeduction: 8000, netSalary: 99999 },
    emptyExisting
  );
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.patch.netSalary, 42200);
    assert.notEqual(resolved.patch.netSalary, 99999);
  }
});

test("6. existing records with null deduction/allowances still resolve net = base on next save", () => {
  const resolved = resolveNetSalaryForSave(
    { currentSalary: 48200, otherSpecialAllowances: null, cooperativeMonthlyDeduction: null },
    { currentSalary: 48200, otherSpecialAllowances: null, cooperativeMonthlyDeduction: null }
  );
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.equal(resolved.patch.netSalary, 48200);
});

test("displayNetSalary never returns negative (UI clamp while validation error shows)", () => {
  assert.equal(displayNetSalary({ currentSalary: 48200, otherSpecialAllowances: 0, totalExpenses: 90000 }), 0);
});

test("resolveNetSalaryForSave merges omitted fields from existing row", () => {
  const resolved = resolveNetSalaryForSave(
    { currentSalary: 50000 },
    { currentSalary: 48200, otherSpecialAllowances: 2000, cooperativeMonthlyDeduction: 8000 }
  );
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.equal(resolved.patch.netSalary, 44000);
});

test("resolveNetSalaryForSave rejects expenses against existing income when only expenses are patched", () => {
  const resolved = resolveNetSalaryForSave(
    { cooperativeMonthlyDeduction: 60000 },
    { currentSalary: 48200, otherSpecialAllowances: null, cooperativeMonthlyDeduction: null }
  );
  assert.equal(resolved.ok, false);
});

test("resolveNetSalaryForSave strips a lone client netSalary tamper with no salary writes", () => {
  const resolved = resolveNetSalaryForSave(
    { netSalary: 1 },
    { currentSalary: 48200, otherSpecialAllowances: 2000, cooperativeMonthlyDeduction: 8000 }
  );
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.patch.netSalary, undefined);
    assert.equal(resolved.patch.currentSalary, undefined);
  }
});

// ── Labels / copy ────────────────────────────────────────────────────────

test("FIELD_LABELS match the approved Thai formula terms", () => {
  assert.equal(FIELD_LABELS.currentSalary.th, "ฐานเงินเดือน");
  assert.equal(FIELD_LABELS.otherSpecialAllowances.th, "เงินเพิ่ม / ค่าตอบแทนพิเศษ");
  assert.equal(FIELD_LABELS.cooperativeMonthlyDeduction.th, "รายจ่ายรวม");
  assert.equal(FIELD_LABELS.netSalary.th, "เงินเดือนรับจริง");
});

test("netSalary helper text states the full formula", () => {
  assert.equal(
    DICTIONARY["officer.netSalaryHelper"].th,
    "คำนวณจากฐานเงินเดือน + เงินเพิ่ม / ค่าตอบแทนพิเศษ − รายจ่ายรวม"
  );
  assert.equal(DICTIONARY["officer.cooperativeDeductionNone"].th, "ไม่มีรายการหัก");
  assert.equal(DICTIONARY["officer.otherSpecialAllowancesNone"].th, "ไม่มีเงินเพิ่ม / ค่าตอบแทนพิเศษ");
});

// ── Financial fields remain off Commander Search ─────────────────────────

function fakeOfficer(overrides: Partial<CommanderQueryOfficer> = {}): CommanderQueryOfficer {
  const promotion: PromotionSummary = {
    promotionStatus: "AlreadyEligible",
    displayStatusTh: "มีคุณสมบัติครบมาแล้ว",
    targetPosition: "ผู้กำกับการ",
    eligibleFiscalYearBe: 2568,
    overdueYears: 2,
  } as PromotionSummary;
  return {
    officerId: "OFF-1",
    rank: "ร.ต.อ.",
    displayName: "ทดสอบ ระบบ",
    currentPosition: "รอง สว.",
    currentUnit: "กก.1",
    positionLevel: "สารวัตร",
    displayAgeYearsMonthsTh: "40 ปี, 11 เดือน",
    positionLevelStartYearBe: 2564,
    yearsInPositionLevel: 5,
    retirementYearBe: 2588,
    displayServiceDurationTh: "18 ปี 6 เดือน",
    promotionIntelligence: promotion,
    academyClass: 61,
    isGpfMember: true,
    isCooperativeMember: true,
    cooperativeName: "สหกรณ์ทดสอบ",
    ...overrides,
  } as CommanderQueryOfficer;
}

test("7. salary / allowance / expense fields stay off Commander Search export", () => {
  const columnsText = COMMANDER_EXPORT_COLUMNS_TH.join("|");
  assert.ok(!columnsText.includes("รายจ่ายรวม"));
  assert.ok(!columnsText.includes("เงินเพิ่มพิเศษ"));
  assert.ok(!columnsText.includes("ฐานเงินเดือน"));
  assert.ok(!columnsText.includes("เงินเดือนรับจริง"));

  const csv = buildCommanderExportCsv([fakeOfficer()], {
    titleTh: "รายงานทดสอบ",
    filtersAppliedTh: [],
    resultCount: 1,
    generatedOnTh: "สร้างเมื่อ 18 กรกฎาคม 2569",
    fiscalYearTh: "ปีงบประมาณ 2569",
  });
  assert.ok(!csv.includes("48200"));
  assert.ok(!csv.includes("otherSpecialAllowances"));
  assert.ok(!csv.includes("cooperativeMonthlyDeduction"));
});

test("7b. CommanderQueryOfficer has no otherSpecialAllowances / cooperativeMonthlyDeduction", () => {
  const officer = fakeOfficer();
  // @ts-expect-error — intentionally not on CommanderQueryOfficer
  assert.equal(officer.otherSpecialAllowances, undefined);
  // @ts-expect-error — intentionally not on CommanderQueryOfficer
  assert.equal(officer.cooperativeMonthlyDeduction, undefined);
});
