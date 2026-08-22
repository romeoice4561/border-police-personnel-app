/**
 * DrugTelegramSearchFormatter (Phase DI-4, Sections 11-16, 28-30).
 *
 * Transforms DrugIntelligenceSearchService's typed domain results into
 * Telegram messages/keyboards. Presentation only — never recomputes
 * classification, ranking, or masking; those are already applied by the
 * search service before this module ever sees a result (Section 30:
 * "Do not put Telegram formatting into DI-3 Search Service").
 *
 * Every entity label goes through escapeHtml() before being placed in an
 * HTML parse_mode message — result text (person names, case titles) is
 * officer-entered free text and must never be able to break Telegram's
 * markup (Section 29).
 */

import { CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";
import type { TelegramInlineKeyboard, TelegramOutgoingMessage } from "@/lib/personnel_search_telegram/types";
import type { DrugSearchGroupedResults, DrugSearchResult, DrugSearchEntityType } from "@/lib/drug_intelligence/drug_search_types";

/** Telegram's real outbound text limit; DI-4 stays well under it by design (small per-group limits), but truncate defensively rather than let a send fail. */
const TELEGRAM_MESSAGE_MAX_CHARS = 4000;

const ENTITY_ICON: Record<DrugSearchEntityType, string> = {
  PERSON: "👤",
  PHONE: "📞",
  SIM: "💳",
  DEVICE: "📱",
  VEHICLE: "🚗",
  CASE: "🚨",
};

const ENTITY_LABEL_TH: Record<DrugSearchEntityType, string> = {
  PERSON: "บุคคล",
  PHONE: "เบอร์โทรศัพท์",
  SIM: "SIM",
  DEVICE: "อุปกรณ์",
  VEHICLE: "ยานพาหนะ",
  CASE: "คดี",
};

export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncateForTelegram(text: string): string {
  if (text.length <= TELEGRAM_MESSAGE_MAX_CHARS) return text;
  return `${text.slice(0, TELEGRAM_MESSAGE_MAX_CHARS - 20)}\n… (ตัดข้อความ)`;
}

function formatDateTh(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

/** Section 5's mode-entry prompt — sent once when the user picks "🚨 Drug Intelligence" from the home menu. */
export const DRUG_MODE_PROMPT_TH =
  "พิมพ์ข้อมูลที่ต้องการค้นหา เช่น ชื่อ เบอร์โทร IMEI ทะเบียน หรือเลขคดี\n\nพิมพ์ \"เมนูหลัก\" หรือ \"ยกเลิก\" เพื่อออกจากโหมดนี้";

export function buildDrugModeKeyboard(): TelegramInlineKeyboard {
  return { inline_keyboard: [[{ text: "🏠 กลับเมนูหลัก", callback_data: CALLBACK.HOME }]] };
}

/** Section 6: generic denial — never reveals whether an entity exists. */
export function buildDrugPermissionDeniedMessage(): TelegramOutgoingMessage {
  return {
    text: "บัญชีของคุณไม่มีสิทธิ์เข้าถึง Drug Intelligence",
    parse_mode: "HTML",
    reply_markup: buildDrugModeKeyboard(),
  };
}

/** Section 23: no-result UX — never implies the entity doesn't exist in reality, only that no matching record was found. */
export function buildDrugNoResultMessage(query: string): TelegramOutgoingMessage {
  return {
    text: `🔎 <b>Drug Intelligence</b>\nคำค้น: <code>${escapeTelegramHtml(query)}</code>\n\nไม่พบข้อมูลที่ตรงกับคำค้น`,
    parse_mode: "HTML",
    reply_markup: buildDrugModeKeyboard(),
  };
}

/** Section 27: an empty/whitespace query is never a valid search — no wildcard "dump all". */
export function buildDrugEmptyQueryMessage(): TelegramOutgoingMessage {
  return {
    text: "กรุณาพิมพ์คำค้น เช่น ชื่อ เบอร์โทร IMEI ทะเบียน หรือเลขคดี",
    parse_mode: "HTML",
    reply_markup: buildDrugModeKeyboard(),
  };
}

/** Section 24: generic Telegram-safe error — never a stack trace or Prisma/API internal. */
export function buildDrugErrorMessage(): TelegramOutgoingMessage {
  return {
    text: "เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง",
    parse_mode: "HTML",
    reply_markup: buildDrugModeKeyboard(),
  };
}

/** Section 26: a rate-limited actor gets a polite, generic Thai message — never an HTTP status code. */
export function buildDrugRateLimitedMessage(): TelegramOutgoingMessage {
  return {
    text: "คุณค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
    parse_mode: "HTML",
    reply_markup: buildDrugModeKeyboard(),
  };
}

function formatResultLine(result: DrugSearchResult, index: number): string {
  const icon = ENTITY_ICON[result.entityType];
  const label = escapeTelegramHtml(result.primaryLabel);
  const secondary = result.secondaryLabel ? ` — ${escapeTelegramHtml(result.secondaryLabel)}` : "";
  return `${icon} ${index}. <b>${label}</b>${secondary}`;
}

/**
 * Section 11's grouped summary — counts per entity type, then the top
 * results per group (already limited by the service's perGroupLimit). Never
 * reproduces a full Person Profile in chat (Section 11's explicit
 * instruction) — one line per result, "เปิดรายละเอียด" leads to the rest.
 */
export function formatDrugGroupedResultText(results: DrugSearchGroupedResults): string {
  const parts: string[] = [
    "🔎 <b>Drug Intelligence</b>",
    `คำค้น: <code>${escapeTelegramHtml(results.query)}</code>`,
    "",
    `พบ ${results.totalCount.toLocaleString("th-TH")} รายการ`,
    "",
  ];
  for (const group of results.groups) {
    parts.push(`${ENTITY_ICON[group.entityType]} ${ENTITY_LABEL_TH[group.entityType]} ${group.count}`);
  }
  parts.push("");

  let runningIndex = 0;
  const refs: Array<{ entityType: DrugSearchEntityType; entityId: string }> = [];
  for (const group of results.groups) {
    if (group.results.length === 0) continue;
    parts.push(`<b>${ENTITY_ICON[group.entityType]} ${ENTITY_LABEL_TH[group.entityType]}</b>`);
    for (const result of group.results) {
      runningIndex += 1;
      refs.push({ entityType: result.entityType, entityId: result.entityId });
      parts.push(formatResultLine(result, runningIndex));
    }
    parts.push("");
  }

  return truncateForTelegram(parts.join("\n").trimEnd());
}

/** Builds the flat, indexable result-ref list matching formatDrugGroupedResultText's numbering — for session storage so callback buttons can resolve by index (Section 19/20). */
export function flattenDrugGroupedResults(results: DrugSearchGroupedResults): Array<{ entityType: DrugSearchEntityType; entityId: string }> {
  const refs: Array<{ entityType: DrugSearchEntityType; entityId: string }> = [];
  for (const group of results.groups) {
    for (const result of group.results) {
      refs.push({ entityType: result.entityType, entityId: result.entityId });
    }
  }
  return refs;
}

/** Section 10: buttons to open each numbered result, plus a "ดูทั้งหมด" per group when the group has more than shown, plus a link to the full Web Global Search for anything beyond the small Telegram-safe limit. */
export function buildDrugGroupedKeyboard(results: DrugSearchGroupedResults, webSearchUrl: string | null): TelegramInlineKeyboard {
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];

  let runningIndex = 0;
  for (const group of results.groups) {
    if (group.results.length === 0) continue;
    const openButtons = group.results.map(() => {
      runningIndex += 1;
      const idx = runningIndex - 1;
      return { text: `${ENTITY_ICON[group.entityType]} ${runningIndex}`, callback_data: CALLBACK.drugOpen(idx) };
    });
    for (let i = 0; i < openButtons.length; i += 4) {
      rows.push(openButtons.slice(i, i + 4));
    }
    if (group.count > group.results.length) {
      rows.push([{ text: `ดูทั้งหมด ${ENTITY_LABEL_TH[group.entityType]} (${group.count})`, callback_data: CALLBACK.drugGroup(group.entityType) }]);
    }
  }

  if (webSearchUrl) {
    rows.push([{ text: "🌐 เปิดผลลัพธ์ทั้งหมดในระบบ", url: webSearchUrl }]);
  }
  rows.push([{ text: "🏠 กลับเมนูหลัก", callback_data: CALLBACK.HOME }]);
  return { inline_keyboard: rows };
}

export function buildDrugGroupedMessage(results: DrugSearchGroupedResults, webSearchUrl: string | null): TelegramOutgoingMessage {
  return {
    text: formatDrugGroupedResultText(results),
    parse_mode: "HTML",
    reply_markup: buildDrugGroupedKeyboard(results, webSearchUrl),
    disable_web_page_preview: true,
  };
}

/**
 * Phase DI-6, Section 16: minimal, safe repeat-intelligence flag —
 * `caseCount` was already computed and displayed by every formatter below
 * (DI-4), so this is presentation-only, no new data plumbing. Deliberately
 * NOT the full alert history (never exposed in Telegram) — just a nudge to
 * open the Web app for detail. Threshold matches drug_intelligence_alert_
 * severity.ts's own "more than one prior case" NOTICE/HIGH boundary.
 */
function repeatIntelligenceLine(result: DrugSearchResult): string | null {
  return result.caseCount > 1 ? "⚠ พบข้อมูลนี้ในหลายคดี" : null;
}

/** Section 12: Person result detail card — case/phone/device counts, last seen, never a full profile dump. */
export function formatDrugPersonDetailText(result: DrugSearchResult): string {
  const lines = [`👤 <b>${escapeTelegramHtml(result.primaryLabel)}</b>`, `พบใน ${result.caseCount} คดี`, `ล่าสุด: ${formatDateTh(result.lastSeen)}`];
  const repeatLine = repeatIntelligenceLine(result);
  if (repeatLine) lines.push(repeatLine);
  if (result.hasPotentialDuplicate) lines.push("⚠️ พบข้อมูลที่อาจซ้ำกับบุคคลอื่น");
  if (result.canonicalTarget) lines.push(`ℹ️ รายการนี้ถูกรวมเข้ากับ: ${escapeTelegramHtml(result.canonicalTarget.primaryLabel)}`);
  return truncateForTelegram(lines.join("\n"));
}

/** Section 13: Phone result — neutral "พบเกี่ยวข้องกับ" wording, never ownership. */
export function formatDrugPhoneDetailText(result: DrugSearchResult): string {
  const lines = [
    `📞 <b>${escapeTelegramHtml(result.primaryLabel)}</b>`,
    `พบเกี่ยวข้องกับบุคคล — พบใน ${result.caseCount} คดี`,
    `First Seen: ${formatDateTh(result.firstSeen)}`,
    `Last Seen: ${formatDateTh(result.lastSeen)}`,
  ];
  const repeatLine = repeatIntelligenceLine(result);
  if (repeatLine) lines.push(repeatLine);
  return truncateForTelegram(lines.join("\n"));
}

/** Section 14: Device/IMEI result. */
export function formatDrugDeviceDetailText(result: DrugSearchResult): string {
  const lines = [`📱 <b>${escapeTelegramHtml(result.primaryLabel)}</b>`];
  if (result.secondaryLabel) lines.push(escapeTelegramHtml(result.secondaryLabel));
  lines.push(`พบใน ${result.caseCount} คดี`);
  const repeatLine = repeatIntelligenceLine(result);
  if (repeatLine) lines.push(repeatLine);
  return truncateForTelegram(lines.join("\n"));
}

/** Section 15: Vehicle result — never labeled as a "criminal-network vehicle". */
export function formatDrugVehicleDetailText(result: DrugSearchResult): string {
  const lines = [`🚗 <b>${escapeTelegramHtml(result.primaryLabel)}</b>`];
  if (result.secondaryLabel) lines.push(escapeTelegramHtml(result.secondaryLabel));
  lines.push(`พบใน ${result.caseCount} คดี`);
  const repeatLine = repeatIntelligenceLine(result);
  if (repeatLine) lines.push(repeatLine);
  return truncateForTelegram(lines.join("\n"));
}

/** Section 16: Case result. */
export function formatDrugCaseDetailText(result: DrugSearchResult): string {
  const lines = [`🚨 <b>${escapeTelegramHtml(result.primaryLabel)}</b>`];
  if (result.secondaryLabel) lines.push(escapeTelegramHtml(result.secondaryLabel));
  return truncateForTelegram(lines.join("\n"));
}

/** Section 14: SIM result. */
export function formatDrugSimDetailText(result: DrugSearchResult): string {
  const lines = [`💳 <b>${escapeTelegramHtml(result.primaryLabel)}</b>`, `พบใน ${result.caseCount} คดี`];
  const repeatLine = repeatIntelligenceLine(result);
  if (repeatLine) lines.push(repeatLine);
  return truncateForTelegram(lines.join("\n"));
}

function detailTextFor(result: DrugSearchResult): string {
  switch (result.entityType) {
    case "PERSON":
      return formatDrugPersonDetailText(result);
    case "PHONE":
      return formatDrugPhoneDetailText(result);
    case "SIM":
      return formatDrugSimDetailText(result);
    case "DEVICE":
      return formatDrugDeviceDetailText(result);
    case "VEHICLE":
      return formatDrugVehicleDetailText(result);
    case "CASE":
      return formatDrugCaseDetailText(result);
  }
}

/** One result opened via its numbered button — "ดูรายละเอียด"/"เปิดในระบบ" per Sections 12-16. */
export function buildDrugResultDetailMessage(result: DrugSearchResult, webEntityUrl: string | null): TelegramOutgoingMessage {
  const actionLabel = result.entityType === "CASE" ? "เปิดคดี" : result.entityType === "PERSON" ? "ดูโปรไฟล์" : "เปิดในระบบ";
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  if (webEntityUrl) rows.push([{ text: actionLabel, url: webEntityUrl }]);
  rows.push([{ text: "🏠 กลับเมนูหลัก", callback_data: CALLBACK.HOME }]);
  return {
    text: detailTextFor(result),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
    disable_web_page_preview: true,
  };
}

/** Section 10: single-entity-type paginated drill-down ("ดูทั้งหมด" destination). */
export function buildDrugByTypePageMessage(args: {
  entityType: DrugSearchEntityType;
  query: string;
  rows: DrugSearchResult[];
  page: number;
  total: number;
  pageSize: number;
  webSearchUrl: string | null;
}): TelegramOutgoingMessage {
  const totalPages = Math.max(1, Math.ceil(args.total / args.pageSize));
  const parts = [
    `${ENTITY_ICON[args.entityType]} <b>${ENTITY_LABEL_TH[args.entityType]}</b> — <code>${escapeTelegramHtml(args.query)}</code>`,
    `หน้า ${args.page}/${totalPages} (ทั้งหมด ${args.total.toLocaleString("th-TH")} รายการ)`,
    "",
  ];
  const startIndex = (args.page - 1) * args.pageSize;
  args.rows.forEach((r, i) => parts.push(formatResultLine(r, startIndex + i + 1)));

  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  const openButtons = args.rows.map((_, i) => ({ text: String(startIndex + i + 1), callback_data: CALLBACK.drugOpen(startIndex + i) }));
  for (let i = 0; i < openButtons.length; i += 4) rows.push(openButtons.slice(i, i + 4));

  const pager: TelegramInlineKeyboard["inline_keyboard"][number] = [];
  if (args.page > 1) pager.push({ text: "◀ ก่อนหน้า", callback_data: CALLBACK.drugPage("prev") });
  if (args.page < totalPages) pager.push({ text: "ถัดไป ▶", callback_data: CALLBACK.drugPage("next") });
  if (pager.length > 0) rows.push(pager);

  if (args.webSearchUrl) rows.push([{ text: "🌐 เปิดผลลัพธ์ทั้งหมดในระบบ", url: args.webSearchUrl }]);
  rows.push([{ text: "🏠 กลับเมนูหลัก", callback_data: CALLBACK.HOME }]);

  return {
    text: truncateForTelegram(parts.join("\n")),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
    disable_web_page_preview: true,
  };
}
