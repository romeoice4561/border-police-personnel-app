/**
 * Formats PersonnelSearchResult for Telegram messages (Phase 51.2).
 * Presentation only — does not recompute search fields.
 */

import type {
  PersonnelSearchItem,
  PersonnelSearchPersonItem,
  PersonnelSearchResult,
  PersonnelSearchUnitItem,
} from "@/lib/personnel_search/contracts";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatUnit(item: PersonnelSearchUnitItem): string {
  const lines = [
    `<b>${escapeHtml(item.labelTh)}</b>`,
    `รหัสหน่วย: <code>${escapeHtml(item.publicCode)}</code>`,
    `กำลังพล: ${item.officerCount} นาย (นายตำรวจ ${item.policeCount})`,
  ];
  if (item.commanderName) lines.push(`ผู้บังคับหน่วย: ${escapeHtml(item.commanderName)}`);
  if (item.deputyNames.length > 0) {
    lines.push(`รอง: ${item.deputyNames.map(escapeHtml).join(", ")}`);
  }
  lines.push(`พร้อมเลื่อน: ${item.promotionReadyCount}`);
  lines.push(`ใกล้เกษียณ: ${item.retirementNearCount}`);
  lines.push(`ข้อมูลไม่ครบ: ${item.incompleteDataCount}`);
  return lines.join("\n");
}

function formatPerson(item: PersonnelSearchPersonItem, index?: number): string {
  const prefix = index != null ? `${index}. ` : "";
  const lines = [
    `${prefix}<b>${escapeHtml(item.rank)} ${escapeHtml(item.fullName)}</b>`,
    item.nickname ? `ชื่อเล่น: ${escapeHtml(item.nickname)}` : null,
    item.currentPosition ? `ตำแหน่ง: ${escapeHtml(item.currentPosition)}` : null,
    `หน่วย: ${escapeHtml(item.unitLabel)}`,
    `รหัส: <code>${escapeHtml(item.officerIdDisplay)}</code>`,
  ];
  if (item.intelligence?.promotionStatusTh) {
    lines.push(`เลื่อนระดับ: ${escapeHtml(item.intelligence.promotionStatusTh)}`);
  }
  return lines.filter(Boolean).join("\n");
}

function formatListEntry(item: Extract<PersonnelSearchItem, { kind: "list_entry" }>, index: number): string {
  return [
    `${index}. <b>${escapeHtml(item.rank)} ${escapeHtml(item.fullName)}</b>`,
    `หน่วย: ${escapeHtml(item.unitLabel)}`,
    escapeHtml(item.summaryTh),
    `รหัส: <code>${escapeHtml(item.officerIdDisplay)}</code>`,
  ].join("\n");
}

function formatItem(item: PersonnelSearchItem, index: number): string {
  if (item.kind === "unit") return formatUnit(item);
  if (item.kind === "person") return formatPerson(item, index);
  if (item.kind === "list_entry") return formatListEntry(item, index);
  if (item.kind === "help") return item.linesTh.map(escapeHtml).join("\n");
  return "";
}

export function formatPersonnelSearchResultText(result: PersonnelSearchResult): string {
  const header = intentHeader(result);
  const parts: string[] = [header];

  if (result.clarification) {
    parts.push("");
    parts.push(`⚠️ ${escapeHtml(result.clarification.reasonTh)}`);
  }

  if (result.items.length === 0 && !result.clarification) {
    parts.push("");
    parts.push("ไม่พบผลลัพธ์");
  }

  result.items.forEach((item, i) => {
    parts.push("");
    parts.push(formatItem(item, i + 1));
  });

  if (result.totalCount > result.items.length) {
    parts.push("");
    parts.push(`แสดง ${result.items.length} จาก ${result.totalCount} รายการ`);
  }

  return parts.join("\n").trim();
}

function intentHeader(result: PersonnelSearchResult): string {
  switch (result.resultType) {
    case "unit_summary":
      return "🏢 <b>สรุปหน่วย</b>";
    case "person":
      return "👤 <b>ข้อมูลกำลังพล</b>";
    case "person_disambiguation":
      return "👥 <b>พบหลายรายชื่อ — โปรดเลือก</b>";
    case "promotion_list":
      return "📈 <b>การเลื่อนตำแหน่ง</b>";
    case "retirement_list":
      return "👴 <b>การเกษียณ</b>";
    case "training_list":
      return "🎓 <b>หลักสูตร</b>";
    case "document_list":
      return "📄 <b>เอกสาร</b>";
    case "contact_list":
      return "📞 <b>ผู้ติดต่อ</b>";
    case "data_quality_list":
      return "📋 <b>คุณภาพข้อมูล</b>";
    case "help":
      return "❓ <b>วิธีใช้งาน</b>";
    case "empty":
      return "🔎 <b>ผลการค้นหา</b>";
    case "error":
      return "🚫 <b>ไม่สามารถค้นหาได้</b>";
    default:
      return "🔎 <b>ผลการค้นหา</b>";
  }
}

export function formatApiErrorText(response: Extract<PersonnelSearchApiResponse, { ok: false }>): string {
  return `ไม่สามารถค้นหาได้ (${escapeHtml(response.error.code)})\n${escapeHtml(response.error.message)}`;
}

export function extractUnitContextFromResult(
  result: PersonnelSearchResult
): { level: "region" | "division" | "company"; publicCode: string; displayName: string } | null {
  const unit = result.items.find((i): i is PersonnelSearchUnitItem => i.kind === "unit");
  if (!unit?.publicCode) return null;
  return {
    level: unit.level,
    publicCode: unit.publicCode,
    displayName: unit.labelTh,
  };
}

export function disambiguationQueriesFromResult(result: PersonnelSearchResult): string[] {
  return result.items
    .filter((i): i is PersonnelSearchPersonItem => i.kind === "person")
    .map((i) => `${i.rank} ${i.fullName}`.trim());
}
