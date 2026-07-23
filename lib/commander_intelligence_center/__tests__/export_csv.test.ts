import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCommanderIntelligenceCenterCsv } from "@/lib/commander_intelligence_center/export_csv";
import type { CommanderIntelligenceCenterViewModel, ExecutiveTableRow } from "@/lib/commander_intelligence_center/types";

function fakeRow(overrides: Partial<ExecutiveTableRow> = {}): ExecutiveTableRow {
  return {
    officerId: "OFF-1",
    officialPortraitUrl: null,
    rank: "ร.ต.อ.",
    displayName: "ทดสอบ ระบบ",
    currentUnit: "กก.1",
    currentPosition: "รอง สว.",
    promotionStatus: "AlreadyEligible",
    displayPromotionStatusTh: "มีคุณสมบัติครบมาแล้ว",
    retirementYearBe: 2588,
    readinessLevel: "READY",
    missingDocumentsCount: 0,
    trainingStatusTh: "ไม่มีข้อมูลหลักสูตร",
    priority: "high",
    nextActionTh: "ไม่ต้องดำเนินการ",
    href: "/officers/OFF-1",
    ...overrides,
  };
}

function fakeCenter(rows: ExecutiveTableRow[]): CommanderIntelligenceCenterViewModel {
  return {
    generatedAtIso: "2026-07-23",
    kpis: [],
    priorityMatrix: [],
    actionCenter: [],
    timeline: [],
    executiveTable: rows,
    executiveSummary: { headlineTh: "", bulletsTh: [], urgentOfficerCount: 0 },
  };
}

test("CSV starts with UTF-8 BOM and includes title/date/result-count header lines", () => {
  const csv = buildCommanderIntelligenceCenterCsv(fakeCenter([fakeRow()]), {
    titleTh: "รายงานศูนย์ข่าวกรองผู้บังคับบัญชา",
    generatedOnTh: "สร้างเมื่อ 2026-07-23",
    resultCount: 1,
  });
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /รายงานศูนย์ข่าวกรองผู้บังคับบัญชา/);
  assert.match(csv, /สร้างเมื่อ 2026-07-23/);
  assert.match(csv, /จำนวนกำลังพล: 1 นาย/);
});

test("CSV row includes rank+name, unit, priority label, and next action", () => {
  const csv = buildCommanderIntelligenceCenterCsv(fakeCenter([fakeRow()]), {
    titleTh: "t",
    generatedOnTh: "g",
    resultCount: 1,
  });
  assert.match(csv, /ร\.ต\.อ\. ทดสอบ ระบบ/);
  assert.match(csv, /กก\.1/);
  assert.match(csv, /สูง/); // priority label for "high"
  assert.match(csv, /ไม่ต้องดำเนินการ/);
});

test("empty executive table produces header rows only, never a fabricated row", () => {
  const csv = buildCommanderIntelligenceCenterCsv(fakeCenter([]), {
    titleTh: "t",
    generatedOnTh: "g",
    resultCount: 0,
  });
  const lines = csv.split("\r\n");
  // header metadata (3) + blank + column header = 5 lines, no data rows.
  assert.equal(lines.length, 5);
});
