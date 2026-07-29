/**
 * Reusable Commander intelligence cards (Phase 51.4).
 * Presentation-only — consume PersonnelSearchResult / unit & person items from the API.
 */

import type {
  PersonnelSearchListItem,
  PersonnelSearchPersonItem,
  PersonnelSearchResult,
  PersonnelSearchUnitItem,
} from "@/lib/personnel_search/contracts";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { UnitIntelligenceSnapshot } from "@/lib/personnel_search_telegram/types";

export type { UnitIntelligenceSnapshot };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function countLine(label: string, count: number | null | undefined, icon: string): string {
  if (count == null || !Number.isFinite(count)) return `${icon} ${label}: —`;
  return `${icon} ${label}: <b>${count}</b>`;
}

export function unitSnapshotFromApiItem(unit: PersonnelSearchUnitItem): UnitIntelligenceSnapshot {
  return {
    publicCode: unit.publicCode,
    labelTh: unit.labelTh,
    level: unit.level,
    commanderName: unit.commanderName,
    officerCount: unit.officerCount,
    promotionReadyCount: unit.promotionReadyCount,
    retirementNearCount: unit.retirementNearCount,
    incompleteDataCount: unit.incompleteDataCount,
    capturedAtIso: new Date().toISOString(),
  };
}

export function extractUnitSnapshotFromResult(result: PersonnelSearchResult): UnitIntelligenceSnapshot | null {
  const unit = result.items.find((i): i is PersonnelSearchUnitItem => i.kind === "unit");
  return unit ? unitSnapshotFromApiItem(unit) : null;
}

/** Promotion / retirement / training / documents / data-quality list card header + counts. */
export function formatListIntelligenceCard(result: PersonnelSearchResult): string {
  const total = result.totalCount;
  const shown = result.items.filter((i) => i.kind === "list_entry" || i.kind === "person").length;

  switch (result.resultType) {
    case "promotion_list":
      return [
        "📈 <b>Promotion</b>",
        countLine("Ready / ในคิว", total, "•"),
        `แสดง ${shown} รายการ`,
        "",
        "สถานะที่พบบ่อยจากผลค้นหา:",
        "• Ready this year / Already eligible / Waiting / Missing training",
        "— รายละเอียดอยู่ที่แต่ละรายการด้านล่าง —",
      ].join("\n");
    case "retirement_list":
      return [
        "👴 <b>Retirement</b>",
        countLine("ใกล้เกษียณ", total, "•"),
        `แสดง ${shown} รายการ`,
        "",
        "หน้าต่าง: This year · 1 year · 3 years",
      ].join("\n");
    case "training_list":
      return [
        "🎓 <b>Training</b>",
        countLine("รายการหลักสูตร", total, "•"),
        `แสดง ${shown} รายการ`,
        "",
        "มุมมอง: Required · Expired · Missing",
      ].join("\n");
    case "document_list":
      return [
        "📄 <b>Documents</b>",
        countLine("รายการเอกสาร", total, "•"),
        `แสดง ${shown} รายการ`,
        "",
        "มุมมอง: Expiring · Expired · Incomplete",
      ].join("\n");
    case "data_quality_list":
      return [
        "📋 <b>Data Quality</b>",
        countLine("รายการคุณภาพข้อมูล", total, "•"),
        `แสดง ${shown} รายการ`,
        "",
        "มุมมอง: Missing fields · Unknown position · Missing dates",
      ].join("\n");
    default:
      return "";
  }
}

export function formatUnitIntelligenceCard(unit: PersonnelSearchUnitItem): string {
  return [
    "🏢 <b>Unit Intelligence</b>",
    `<b>${escapeHtml(unit.labelTh)}</b>`,
    `รหัส: <code>${escapeHtml(unit.publicCode)}</code>`,
    unit.commanderName ? `ผู้บังคับหน่วย: ${escapeHtml(unit.commanderName)}` : "ผู้บังคับหน่วย: —",
    countLine("กำลังพล", unit.officerCount, "👥"),
    countLine("พร้อมเลื่อน", unit.promotionReadyCount, "📈"),
    countLine("ใกล้เกษียณ", unit.retirementNearCount, "👴"),
    countLine("ข้อมูลไม่ครบ", unit.incompleteDataCount, "📋"),
  ].join("\n");
}

export function formatPersonIntelligenceCard(person: PersonnelSearchPersonItem): string {
  const intel = person.intelligence;
  const dash = "—";

  const positionLevel =
    intel?.positionLevel != null && String(intel.positionLevel).trim() !== ""
      ? String(intel.positionLevel)
      : dash;
  const yearsInLevel =
    intel?.positionLevelYearCount != null && Number.isFinite(intel.positionLevelYearCount)
      ? `${intel.positionLevelYearCount} ปี`
      : dash;
  const sinceYear =
    intel?.positionLevelStartYearBe != null && Number.isFinite(intel.positionLevelStartYearBe)
      ? String(intel.positionLevelStartYearBe)
      : dash;
  const appointmentStatus =
    intel?.promotionStatusTh != null && String(intel.promotionStatusTh).trim() !== ""
      ? String(intel.promotionStatusTh)
      : dash;
  const qualification =
    intel?.promotionStatus === "EligibleThisYear" || intel?.promotionStatus === "AlreadyEligible"
      ? "ครบขึ้น ผกก."
      : dash;
  const firstEligibleTh = formatFirstEligibleDateTh(intel?.firstEligibleDate ?? null);
  const cycleLabel =
    intel?.promotionCyclesPassed == null || !Number.isFinite(intel.promotionCyclesPassed)
      ? dash
      : `ปีที่ ${intel.promotionCyclesPassed + 1}`;

  const lines = [
    "👤 <b>Person Intelligence</b>",
    `<b>${escapeHtml(person.rank)} ${escapeHtml(person.fullName)}</b>`,
    person.nickname ? `ชื่อเล่น: ${escapeHtml(person.nickname)}` : null,
    person.currentPosition ? `ตำแหน่ง: ${escapeHtml(person.currentPosition)}` : "ตำแหน่ง: —",
    `หน่วย: ${escapeHtml(person.unitLabel)}`,
    `รหัส: <code>${escapeHtml(person.officerIdDisplay)}</code>`,
    "",
    "📈 <b>สถานะตำแหน่งและการแต่งตั้ง</b>",
    `ระดับตำแหน่ง : ${escapeHtml(positionLevel)}`,
    `ดำรงระดับนี้ : ${escapeHtml(yearsInLevel)}`,
    `ดำรงระดับนี้ตั้งแต่ปี : ${escapeHtml(sinceYear)}`,
    `คุณสมบัติ : ${escapeHtml(qualification)}`,
    `สถานะการแต่งตั้ง : ${escapeHtml(appointmentStatus)}`,
    `วันที่ครบครั้งแรก : ${escapeHtml(firstEligibleTh)}`,
    `รอบการแต่งตั้ง : ${escapeHtml(cycleLabel)}`,
    "",
    "👴 เกษียณ: " +
      escapeHtml(
        intel?.retirementYearBe != null
          ? `พ.ศ. ${intel.retirementYearBe}${intel.retirementStatus ? ` (${intel.retirementStatus})` : ""}`
          : "—"
      ),
    "🎓 หลักสูตร: " + escapeHtml(intel?.trainingStatusTh ?? "—"),
    "📄 เอกสาร: " + escapeHtml(intel?.documentReadinessTh ?? "—"),
  ];
  if (intel?.dataQualityNotesTh?.length) {
    lines.push("📋 คุณภาพข้อมูล:");
    for (const note of intel.dataQualityNotesTh.slice(0, 4)) {
      lines.push(`• ${escapeHtml(note)}`);
    }
  }
  return lines.filter((l) => l != null).join("\n");
}

/** Presentation-only: ISO date from API → short Thai Buddhist-Era label. */
function formatFirstEligibleDateTh(isoDate: string | null | undefined): string {
  if (isoDate == null || String(isoDate).trim() === "") return "—";
  const parsed = new Date(`${String(isoDate).trim()}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatShortThaiDateTh(parsed);
}

export function formatHomeTodayCard(snapshot: UnitIntelligenceSnapshot | null | undefined): string {
  if (!snapshot) {
    return [
      "<b>Personnel Intelligence</b>",
      "<b>Today</b>",
      "• Promotion Ready: —",
      "• Retirement: —",
      "• Training Missing: —",
      "• Documents Expiring: —",
      "• Data Quality: —",
      "",
      "<i>เลือกหน่วยหรือรายการโปรดเพื่อดูตัวเลขจากระบบ</i>",
    ].join("\n");
  }
  return [
    "<b>Personnel Intelligence</b>",
    "<b>Today</b>",
    `<i>${escapeHtml(snapshot.labelTh)}</i>`,
    countLine("Promotion Ready", snapshot.promotionReadyCount, "•"),
    countLine("Retirement", snapshot.retirementNearCount, "•"),
    "• Training Missing: ดูปุ่ม 🎓",
    "• Documents Expiring: ดูปุ่ม 📄",
    countLine("Data Quality", snapshot.incompleteDataCount, "•"),
  ].join("\n");
}

export function formatListEntryLine(item: PersonnelSearchListItem, index: number): string {
  return [
    `${index}. <b>${escapeHtml(item.rank)} ${escapeHtml(item.fullName)}</b>`,
    `   ${escapeHtml(item.summaryTh)}`,
    `   ${escapeHtml(item.unitLabel)} · <code>${escapeHtml(item.officerIdDisplay)}</code>`,
  ].join("\n");
}
