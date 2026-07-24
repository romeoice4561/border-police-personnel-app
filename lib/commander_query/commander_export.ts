/**
 * Commander Search export (Phase 43 Workstream A, Task A7).
 *
 * Builds a CSV export of the CURRENTLY-FILTERED result set, using the same
 * revised Thai column names and status labels as the rebuilt results table
 * (16-column order, "รอการแต่งตั้งมาแล้ว" not "เกินกำหนด", Buddhist-Era years).
 * Pure string-building — no I/O, no file writer — so it is unit-testable
 * and reusable from both the "Excel" (CSV, Excel-openable) and future file
 * writers. PDF export is NOT implemented here (documented as future work
 * per Phase 43 scope) — Print uses the browser's native print dialog
 * instead (see components/commander/query/commander_export_bar.tsx).
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderQueryFilters } from "@/components/commander/query/types";
import { overdueOpportunities } from "@/lib/commander_query/promotion_display";
import { UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { PROMOTION_STATUS_DISPLAY_TH } from "@/lib/intelligence/promotion";

export const COMMANDER_EXPORT_COLUMNS_TH = [
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
] as const;

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined || value === "" ? "" : String(value);
  // Escape per RFC 4180: wrap in quotes and double any embedded quote.
  return `"${text.replace(/"/g, '""')}"`;
}

function officerRow(officer: CommanderQueryOfficer): string[] {
  const promotion = officer.promotionIntelligence;
  const missedOpportunities = overdueOpportunities(promotion.overdueYears);
  return [
    `${officer.rank ? `${officer.rank} ` : ""}${officer.displayName}`,
    officer.currentPosition ?? "",
    officer.currentUnit ?? "",
    officer.positionLevel && officer.positionLevel !== UNKNOWN_POSITION_LEVEL ? officer.positionLevel : "",
    officer.displayAgeYearsMonthsTh ?? "",
    officer.positionLevelStartYearBe != null ? String(officer.positionLevelStartYearBe) : "",
    officer.positionLevelYearCount != null ? `${officer.positionLevelYearCount} ปี` : "",
    promotion.targetPosition ?? "",
    promotion.eligibleFiscalYearBe != null ? String(promotion.eligibleFiscalYearBe) : "",
    missedOpportunities != null ? `${missedOpportunities} ปี` : "",
    promotion.displayStatusTh ?? "",
    promotion.eligibleYearOrdinal != null && promotion.eligibleYearOrdinal > 0
      ? String(promotion.eligibleYearOrdinal)
      : "",
    officer.retirementYearBe != null ? `พ.ศ. ${officer.retirementYearBe}` : "",
    officer.displayServiceDurationTh ?? "",
  ];
}

/**
 * Describes the currently-active filters as short Thai phrases, for the
 * export header / print title — reads only the small set of filter fields
 * that already have a reliable, user-facing Thai label. Pure/deterministic;
 * unrecognized or unset fields are simply omitted (never a raw enum).
 */
export function describeFiltersTh(filters: CommanderQueryFilters): string[] {
  const parts: string[] = [];
  if (filters.rank) parts.push(`ยศ: ${filters.rank}`);
  if (filters.positionLevel) parts.push(`ระดับตำแหน่ง: ${filters.positionLevel}`);
  if (filters.promotionEligibilityStatus) parts.push(`สถานะ: ${PROMOTION_STATUS_DISPLAY_TH[filters.promotionEligibilityStatus]}`);
  if (filters.toPositionLevel) parts.push(`เป้าหมาย: ${filters.toPositionLevel}`);
  if (filters.readyForPromotion) parts.push("ครบขึ้นตำแหน่งแล้ว");
  if (filters.retirementWithin) {
    const horizon = filters.retirementWithin === "within-1-year" ? "1 ปี" : filters.retirementWithin === "within-3-years" ? "3 ปี" : "5 ปี";
    parts.push(`เกษียณภายใน ${horizon}`);
  }
  if (filters.eligibleTwoStepOnly) parts.push("มีสิทธิ์ 2 ขั้น");
  if (filters.mustSkipStepOnly) parts.push("ต้องเว้นขั้น");
  if (filters.missingGp7Only) parts.push("ขาด ก.พ.7");
  // Phase 49A: document-intelligence filters.
  if (filters.documentReadiness) parts.push(`ความพร้อมเอกสาร: ${filters.documentReadiness}`);
  if (filters.documentCompleteness) parts.push(`ความครบถ้วน: ${filters.documentCompleteness}`);
  if (filters.expiryStatus) parts.push(`สถานะวันหมดอายุ: ${filters.expiryStatus}`);
  if (filters.pendingOcrReview) parts.push("มีรายการรอตรวจ OCR");
  if (filters.unsupportedDocument) parts.push("มีเอกสารรูปแบบไม่รองรับ");
  if (filters.missingRequiredDocument) parts.push("ขาดเอกสารที่จำเป็น");
  if (filters.qualityWarning) parts.push("มีปัญหาคุณภาพเอกสาร");
  return parts;
}

export interface CommanderExportMeta {
  /** Thai title, e.g. "รายงานผลการค้นหากำลังพล (ผู้บังคับบัญชา)". */
  titleTh: string;
  /** Human-readable Thai description of the filters applied, e.g. "สถานะ: ครบคุณสมบัติปีนี้". Empty array when no filters are active. */
  filtersAppliedTh: string[];
  resultCount: number;
  /** Buddhist-Era generation date, e.g. "สร้างเมื่อ 17 กรกฎาคม 2569". */
  generatedOnTh: string;
  /** e.g. "ปีงบประมาณ 2569". */
  fiscalYearTh: string;
}

/** Builds the full CSV text (UTF-8 BOM + header metadata block + column headers + rows) — Excel-openable, RFC 4180 escaped. */
export function buildCommanderExportCsv(officers: readonly CommanderQueryOfficer[], meta: CommanderExportMeta): string {
  const lines: string[] = [];
  lines.push(csvCell(meta.titleTh));
  lines.push(csvCell(meta.generatedOnTh));
  lines.push(csvCell(meta.fiscalYearTh));
  lines.push(csvCell(`จำนวนผลลัพธ์: ${meta.resultCount.toLocaleString("th-TH")} นาย`));
  if (meta.filtersAppliedTh.length > 0) {
    lines.push(csvCell(`เงื่อนไขที่ใช้: ${meta.filtersAppliedTh.join(", ")}`));
  } else {
    lines.push(csvCell("เงื่อนไขที่ใช้: ไม่มี (แสดงทั้งหมด)"));
  }
  lines.push(""); // blank separator row before the table
  lines.push(COMMANDER_EXPORT_COLUMNS_TH.map(csvCell).join(","));
  for (const officer of officers) {
    lines.push(officerRow(officer).map(csvCell).join(","));
  }
  // UTF-8 BOM so Excel opens Thai text correctly instead of mangling it.
  return `﻿${lines.join("\r\n")}`;
}
