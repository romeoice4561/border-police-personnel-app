/**
 * Telegram Home Menu (Phase 51.2) — presentation only.
 */

import type { TelegramInlineKeyboard, TelegramOutgoingMessage } from "@/lib/personnel_search_telegram/types";
import { CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";

export const HOME_MENU_TITLE =
  "ตำรวจตระเวนชายแดน — ผู้ช่วยค้นหากำลังพล\nเลือกเมนู หรือพิมพ์คำค้นโดยตรง";

export function buildHomeKeyboard(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "🔍 ค้นหากำลังพล", callback_data: CALLBACK.MENU_SEARCH },
        { text: "🏢 ค้นหาหน่วย", callback_data: CALLBACK.MENU_UNIT },
      ],
      [
        { text: "📈 การเลื่อนตำแหน่ง", callback_data: CALLBACK.MENU_PROMOTION },
        { text: "👴 การเกษียณ", callback_data: CALLBACK.MENU_RETIREMENT },
      ],
      [
        { text: "🎓 หลักสูตร", callback_data: CALLBACK.MENU_TRAINING },
        { text: "📄 เอกสาร", callback_data: CALLBACK.MENU_DOCUMENTS },
      ],
      [
        { text: "📊 Dashboard", callback_data: CALLBACK.MENU_DASHBOARD },
        { text: "❓ วิธีใช้งาน", callback_data: CALLBACK.MENU_HELP },
      ],
    ],
  };
}

export function buildHomeMessage(): TelegramOutgoingMessage {
  return {
    text: HOME_MENU_TITLE,
    reply_markup: buildHomeKeyboard(),
  };
}
