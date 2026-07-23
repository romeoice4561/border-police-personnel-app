/**
 * Commander Intelligence Center CSV export (Phase 49B).
 *
 * Mirrors lib/commander_query/commander_export.ts's pattern exactly (same
 * CSV escaping, same UTF-8 BOM, same RFC 4180 quoting) — a summary-oriented
 * export of the Executive Table rows already computed by
 * build_view_model.ts, not a re-derivation of any figure. No PDF/Excel
 * library exists in this repo (see commander_export.ts's own header
 * comment) — CSV (Excel-openable) is the only export format implemented
 * here, matching the existing convention.
 *
 * Pure — no I/O, no file writer.
 */
import type { ExecutiveTableRow, CommanderIntelligenceCenterViewModel } from "@/lib/commander_intelligence_center/types";

const EXECUTIVE_EXPORT_COLUMNS_TH = [
  "ยศ ชื่อ–สกุล",
  "หน่วย",
  "ตำแหน่งปัจจุบัน",
  "สถานะการเลื่อนตำแหน่ง",
  "ปีเกษียณอายุราชการ",
  "ความพร้อมเอกสาร",
  "เอกสารที่ขาด",
  "สถานะการฝึกอบรม",
  "ระดับความสำคัญ",
  "การดำเนินการถัดไป",
] as const;

const PRIORITY_LABEL_TH: Record<ExecutiveTableRow["priority"], string> = {
  critical: "เร่งด่วน",
  high: "สูง",
  medium: "ปานกลาง",
  low: "ต่ำ",
};

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined || value === "" ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function executiveRow(row: ExecutiveTableRow): string[] {
  return [
    `${row.rank ? `${row.rank} ` : ""}${row.displayName}`,
    row.currentUnit ?? "",
    row.currentPosition ?? "",
    row.displayPromotionStatusTh,
    row.retirementYearBe != null ? `พ.ศ. ${row.retirementYearBe}` : "",
    row.readinessLevel,
    row.missingDocumentsCount > 0 ? String(row.missingDocumentsCount) : "",
    row.trainingStatusTh,
    PRIORITY_LABEL_TH[row.priority],
    row.nextActionTh,
  ];
}

export interface CommanderIntelligenceCenterExportMeta {
  titleTh: string;
  generatedOnTh: string;
  resultCount: number;
}

/** Builds the full CSV text for the Executive Table — UTF-8 BOM + header metadata + column headers + rows, Excel-openable. */
export function buildCommanderIntelligenceCenterCsv(
  center: CommanderIntelligenceCenterViewModel,
  meta: CommanderIntelligenceCenterExportMeta
): string {
  const lines: string[] = [];
  lines.push(csvCell(meta.titleTh));
  lines.push(csvCell(meta.generatedOnTh));
  lines.push(csvCell(`จำนวนกำลังพล: ${meta.resultCount.toLocaleString("th-TH")} นาย`));
  lines.push("");
  lines.push(EXECUTIVE_EXPORT_COLUMNS_TH.map(csvCell).join(","));
  for (const row of center.executiveTable) {
    lines.push(executiveRow(row).map(csvCell).join(","));
  }
  return `﻿${lines.join("\r\n")}`;
}
