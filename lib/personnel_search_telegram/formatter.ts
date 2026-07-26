/**
 * Formats PersonnelSearchResult for Telegram (Phase 51.2 / 51.4).
 * Presentation only — does not recompute search fields.
 */

import type {
  PersonnelSearchItem,
  PersonnelSearchPersonItem,
  PersonnelSearchResult,
  PersonnelSearchUnitItem,
} from "@/lib/personnel_search/contracts";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import {
  formatListEntryLine,
  formatListIntelligenceCard,
  formatPersonIntelligenceCard,
  formatUnitIntelligenceCard,
} from "@/lib/personnel_search_telegram/commander_cards";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatItem(item: PersonnelSearchItem, index: number, resultType: string): string {
  if (item.kind === "unit") return formatUnitIntelligenceCard(item);
  if (item.kind === "person") {
    if (resultType === "person") return formatPersonIntelligenceCard(item);
    return formatPersonBrief(item, index);
  }
  if (item.kind === "list_entry") return formatListEntryLine(item, index);
  if (item.kind === "help") return item.linesTh.map((l) => `• ${escapeHtml(l)}`).join("\n");
  return "";
}

function formatPersonBrief(item: PersonnelSearchPersonItem, index: number): string {
  const lines = [
    `${index}. <b>${escapeHtml(item.rank)} ${escapeHtml(item.fullName)}</b>`,
    `   ${escapeHtml(item.unitLabel)}`,
  ];
  if (item.intelligence?.promotionStatusTh) {
    lines.push(`   📈 ${escapeHtml(item.intelligence.promotionStatusTh)}`);
  }
  return lines.join("\n");
}

export function formatPersonnelSearchResultText(result: PersonnelSearchResult): string {
  const listCard = formatListIntelligenceCard(result);
  const parts: string[] = [];

  if (listCard) {
    parts.push(listCard);
  } else {
    parts.push(intentHeader(result));
  }

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
    parts.push(formatItem(item, i + 1, result.resultType));
  });

  if (result.totalCount > result.items.length && result.resultType !== "unit_summary") {
    parts.push("");
    parts.push(`แสดง ${result.items.length} จาก ${result.totalCount}`);
  }

  return parts.join("\n").trim();
}

function intentHeader(result: PersonnelSearchResult): string {
  switch (result.resultType) {
    case "unit_summary":
      return "🏢 <b>Unit Intelligence</b>";
    case "person":
      return "👤 <b>Person Intelligence</b>";
    case "person_disambiguation":
      return "👥 <b>พบหลายรายชื่อ — โปรดเลือก</b>";
    case "promotion_list":
      return "📈 <b>Promotion</b>";
    case "retirement_list":
      return "👴 <b>Retirement</b>";
    case "training_list":
      return "🎓 <b>Training</b>";
    case "document_list":
      return "📄 <b>Documents</b>";
    case "contact_list":
      return "📞 <b>Contacts</b>";
    case "data_quality_list":
      return "📋 <b>Data Quality</b>";
    case "help":
      return "❓ <b>วิธีใช้งาน</b>";
    case "empty":
      return "🔎 <b>ผลการค้นหา</b>";
    case "error":
      return "🚫 <b>ไม่สามารถแสดงผลได้</b>";
    default:
      return "🔎 <b>ผลการค้นหา</b>";
  }
}

export function formatApiErrorText(response: Extract<PersonnelSearchApiResponse, { ok: false }>): string {
  // Friendly Thai — never expose stack traces or internal details beyond a short code.
  const code = response.error.code;
  if (code === "FORBIDDEN" || code === "UNAUTHENTICATED") {
    return "ไม่มีสิทธิ์ดำเนินการนี้";
  }
  if (code === "RATE_LIMITED") {
    return "คำขอมากเกินไป กรุณาลองใหม่ในภายหลัง";
  }
  if (code === "INVALID_REQUEST" || code === "QUERY_TOO_LONG") {
    return "คำค้นไม่ถูกต้อง กรุณาลองใหม่";
  }
  return "ไม่สามารถแสดงผลได้ในขณะนี้ กรุณาลองใหม่";
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
