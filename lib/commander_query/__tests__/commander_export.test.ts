import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCommanderExportCsv, describeFiltersTh, COMMANDER_EXPORT_COLUMNS_TH } from "@/lib/commander_query/commander_export";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";

function fakeOfficer(overrides: Partial<CommanderQueryOfficer> = {}): CommanderQueryOfficer {
  const promotion: PromotionSummary = {
    promotionStatus: "AlreadyEligible",
    displayStatusTh: "มีคุณสมบัติครบมาแล้ว",
    targetPosition: "ผู้กำกับการ",
    eligibleFiscalYearBe: 2568,
    firstEligibleYearBe: 2568,
    overdueYears: 1,
    eligibleYearOrdinal: 2,
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
    ...overrides,
  } as CommanderQueryOfficer;
}

test("export columns match the Phase 43 16-column spec (minus รูป/ดูประวัติ, which are UI-only)", () => {
  assert.deepEqual(COMMANDER_EXPORT_COLUMNS_TH, [
    "ยศ ชื่อ–สกุล",
    "ตำแหน่ง",
    "หน่วย",
    "ระดับตำแหน่ง",
    "อายุ",
    "ดำรงตำแหน่งนี้มาตั้งแต่ปี",
    "จำนวนปีในระดับนี้",
    "ระดับเป้าหมาย",
    "ปีที่ครบครั้งแรก",
    "รอการแต่งตั้งมาแล้ว",
    "สถานะ",
    "ปีนี้เป็นปีที่",
    "ปีเกษียณอายุราชการ",
    "อายุราชการ",
  ]);
});

test("CSV includes UTF-8 BOM, title, generated-on, fiscal year, and result count in the header block", () => {
  const csv = buildCommanderExportCsv([fakeOfficer()], {
    titleTh: "รายงานผลการค้นหากำลังพล (ผู้บังคับบัญชา)",
    filtersAppliedTh: [],
    resultCount: 1,
    generatedOnTh: "สร้างเมื่อ 17 กรกฎาคม 2569",
    fiscalYearTh: "ปีงบประมาณ 2569",
  });
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /รายงานผลการค้นหากำลังพล/);
  assert.match(csv, /สร้างเมื่อ 17 กรกฎาคม 2569/);
  assert.match(csv, /ปีงบประมาณ 2569/);
  assert.match(csv, /จำนวนผลลัพธ์: 1 นาย/);
  assert.match(csv, /เงื่อนไขที่ใช้: ไม่มี \(แสดงทั้งหมด\)/);
});

test("CSV lists active filters when present, joined by comma", () => {
  const csv = buildCommanderExportCsv([], {
    titleTh: "t",
    filtersAppliedTh: ["ยศ: ร.ต.อ.", "สถานะ: มีคุณสมบัติครบมาแล้ว"],
    resultCount: 0,
    generatedOnTh: "g",
    fiscalYearTh: "f",
  });
  assert.match(csv, /เงื่อนไขที่ใช้: ยศ: ร\.ต\.อ\., สถานะ: มีคุณสมบัติครบมาแล้ว/);
});

test("officer row uses completed-waiting overdueYears and eligibleYearOrdinal (no −1 repair)", () => {
  const csv = buildCommanderExportCsv([fakeOfficer()], {
    titleTh: "t",
    filtersAppliedTh: [],
    resultCount: 1,
    generatedOnTh: "g",
    fiscalYearTh: "f",
  });
  const rows = csv.split("\r\n");
  const dataRow = rows[rows.length - 1];
  assert.match(dataRow, /1 ปี/); // overdueYears=1 -> 1 missed opportunity
  assert.match(dataRow, /,"2",/); // eligibleYearOrdinal column
  assert.match(dataRow, /พ\.ศ\. 2588/);
  assert.match(dataRow, /ร\.ต\.อ\. ทดสอบ ระบบ/);
});

test("embedded double-quotes in a field are RFC 4180 escaped", () => {
  const csv = buildCommanderExportCsv(
    [fakeOfficer({ currentPosition: 'ตำแหน่ง "พิเศษ"' })],
    { titleTh: "t", filtersAppliedTh: [], resultCount: 1, generatedOnTh: "g", fiscalYearTh: "f" }
  );
  assert.match(csv, /ตำแหน่ง ""พิเศษ""/);
});

test("describeFiltersTh returns an empty array when no filters are active", () => {
  assert.deepEqual(describeFiltersTh({}), []);
});

test("describeFiltersTh describes rank, promotion status, and retirement horizon with reliable Thai labels", () => {
  const parts = describeFiltersTh({
    rank: "ร.ต.อ.",
    promotionEligibilityStatus: "AlreadyEligible",
    retirementWithin: "within-3-years",
  });
  assert.deepEqual(parts, ["ยศ: ร.ต.อ.", "สถานะ: มีคุณสมบัติครบมาแล้ว", "เกษียณภายใน 3 ปี"]);
});
