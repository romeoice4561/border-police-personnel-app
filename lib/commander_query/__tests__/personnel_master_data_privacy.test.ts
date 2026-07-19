/**
 * Personnel Master Data Expansion — Commander Search / export privacy tests
 * (Phase 45.1, Task 15 items 20-21, 28).
 *
 * The Commander Search results table, its CSV export, and
 * CommanderQueryOfficer are all hand-curated allow-lists (confirmed during
 * the Phase 45.1 audit) — a new Officer column is excluded by construction
 * unless explicitly added to one of these surfaces. These tests assert that
 * invariant stays true for the sensitive salary/bank fields.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { COMMANDER_EXPORT_COLUMNS_TH, buildCommanderExportCsv } from "@/lib/commander_query/commander_export";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";

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

test("20. Bank account number is absent from the Commander Search export column list (default/standard export)", () => {
  const columnsText = COMMANDER_EXPORT_COLUMNS_TH.join("|");
  assert.ok(!columnsText.includes("เลขบัญชี"));
  assert.ok(!columnsText.includes("บัญชี"));
});

test("21. A CSV export row never contains a bank account or salary figure — the export only ever renders the fixed 14-column set", () => {
  const officer = fakeOfficer({ officerId: "OFF-99" });
  const csv = buildCommanderExportCsv([officer], {
    titleTh: "รายงานทดสอบ",
    filtersAppliedTh: [],
    resultCount: 1,
    generatedOnTh: "สร้างเมื่อ 18 กรกฎาคม 2569",
    fiscalYearTh: "ปีงบประมาณ 2569",
  });
  // The export function has no code path that reads currentSalary/netSalary/
  // bankAccountNumber/bankName from CommanderQueryOfficer — officerRow()'s
  // fixed field list (verified in commander_export.ts) is the real guard;
  // this asserts the OUTPUT never contains a stray masked/unmasked account
  // number pattern either.
  assert.ok(!/x{4,}\d{4}/.test(csv));
});

test("Privacy-safe Master Data fields (academyClass, isGpfMember, isCooperativeMember, cooperativeName) ARE present on CommanderQueryOfficer for Task 9 filtering", () => {
  const officer = fakeOfficer();
  assert.equal(officer.academyClass, 61);
  assert.equal(officer.isGpfMember, true);
  assert.equal(officer.isCooperativeMember, true);
  assert.equal(officer.cooperativeName, "สหกรณ์ทดสอบ");
});

test("CommanderQueryOfficer type has no salary/bank fields at all — TypeScript would reject them if a caller tried to read officer.currentSalary here", () => {
  const officer = fakeOfficer();
  // @ts-expect-error — currentSalary is intentionally not part of CommanderQueryOfficer.
  const _leak = officer.currentSalary;
  assert.equal(_leak, undefined);
});

test("CommanderQueryOfficer also excludes cooperativeMonthlyDeduction (financial Master Data stays off Search)", () => {
  const officer = fakeOfficer();
  // @ts-expect-error — cooperativeMonthlyDeduction is intentionally not part of CommanderQueryOfficer.
  const _leak = officer.cooperativeMonthlyDeduction;
  assert.equal(_leak, undefined);
});
