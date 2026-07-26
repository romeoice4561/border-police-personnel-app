/**
 * Builds Telegram Inline Keyboards from API actions / pagination (Phase 51.2 / 51.4).
 */

import type { SearchAction } from "@/lib/personnel_search/contracts";
import type { PersonnelSearchResult } from "@/lib/personnel_search/contracts";
import { CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";
import type { TelegramInlineButton, TelegramInlineKeyboard } from "@/lib/personnel_search_telegram/types";

const ACTION_EMOJI: Partial<Record<SearchAction["type"], string>> = {
  view_unit: "👥",
  view_promotion: "📈",
  refine_query: "👴",
  view_training: "🎓",
  view_documents: "📄",
  open_dashboard: "📊",
  open_profile: "👤",
  view_timeline: "🗓️",
  disambiguate: "✅",
  export: "📤",
};

function actionLabel(action: SearchAction): string {
  const emoji = ACTION_EMOJI[action.type] ?? "▪️";
  const th = action.labelTh;
  if (th.includes("กำลังพล") || th.includes("ดูกำลังพล")) return `${emoji} กำลังพล`;
  if (th.includes("พร้อมเลื่อน") || th.includes("เลื่อน")) return `${emoji} Promotion`;
  if (th.includes("เกษียณ")) return `${emoji} Retirement`;
  if (th.includes("หลักสูตร")) return `${emoji} Training`;
  if (th.includes("เอกสาร")) return `${emoji} Documents`;
  if (th.includes("ไทม์ไลน์") || th.toLowerCase().includes("timeline")) return `${emoji} Timeline`;
  if (th.toLowerCase().includes("dashboard") || th.includes("แดชบอร์ด")) return `${emoji} Dashboard`;
  return `${emoji} ${th}`.slice(0, 64);
}

function chunkButtons(buttons: TelegramInlineButton[], perRow = 2): TelegramInlineButton[][] {
  const rows: TelegramInlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(buttons.slice(i, i + perRow));
  }
  return rows;
}

export function buildResultKeyboard(args: {
  result: PersonnelSearchResult;
  nextCursor: string | null;
  hasPrevious: boolean;
}): TelegramInlineKeyboard {
  const rows: TelegramInlineButton[][] = [];

  if (args.result.clarification?.suggestionsTh?.length) {
    const clarifyButtons = args.result.clarification.suggestionsTh.slice(0, 6).map((text, i) => ({
      text: text.slice(0, 64),
      callback_data: CALLBACK.clarify(i),
    }));
    rows.push(...chunkButtons(clarifyButtons, 1));
  }

  if (args.result.resultType === "person_disambiguation") {
    const picks = args.result.items
      .filter((i) => i.kind === "person")
      .slice(0, 8)
      .map((item, i): TelegramInlineButton => ({
        text: `${i + 1}. ${item.rank} ${item.fullName}`.slice(0, 64),
        callback_data: CALLBACK.disambiguate(i),
      }));
    rows.push(...chunkButtons(picks, 1));
  }

  if (args.result.actions.length > 0 && args.result.resultType !== "person_disambiguation") {
    const actionButtons = args.result.actions.slice(0, 8).map((action, i) => ({
      text: actionLabel(action),
      callback_data: CALLBACK.action(i),
    }));
    rows.push(...chunkButtons(actionButtons, 2));
  }

  if (args.result.resultType === "unit_summary") {
    rows.push([{ text: "⭐ บันทึกหน่วยโปรด", callback_data: CALLBACK.FAV_ADD_UNIT }]);
  }
  if (args.result.resultType === "person") {
    rows.push([{ text: "⭐ บันทึกกำลังพลโปรด", callback_data: CALLBACK.FAV_ADD_PERSON }]);
  }

  const nav: TelegramInlineButton[] = [];
  if (args.hasPrevious) nav.push({ text: "⬅️ ก่อนหน้า", callback_data: CALLBACK.PAGE_PREV });
  if (args.nextCursor) nav.push({ text: "ถัดไป ➡️", callback_data: CALLBACK.PAGE_NEXT });
  if (nav.length) rows.push(nav);

  rows.push([
    { text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME },
    { text: "⚡ Quick", callback_data: CALLBACK.MENU_QUICK },
  ]);
  return { inline_keyboard: rows };
}
