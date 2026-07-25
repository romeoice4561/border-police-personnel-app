/**
 * Unbound / revoked Telegram UX (Phase 51.3).
 * Never reveals whether a searched person exists.
 */

import { CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";
import type { TelegramOutgoingMessage } from "@/lib/personnel_search_telegram/types";

export const UNBOUND_MESSAGE_TH =
  "บัญชี Telegram นี้ยังไม่ได้เชื่อมต่อกับระบบกำลังพล";

export const REVOKED_MESSAGE_TH =
  "การเชื่อมต่อบัญชีถูกยกเลิกแล้ว กรุณาเชื่อมต่อใหม่จากเว็บแอปพลิเคชัน";

export function buildUnboundMessage(args: {
  appBaseUrl: string | null;
  variant?: "unbound" | "revoked" | "disabled";
}): TelegramOutgoingMessage {
  const text =
    args.variant === "revoked"
      ? REVOKED_MESSAGE_TH
      : args.variant === "disabled"
        ? "บัญชีนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ"
        : UNBOUND_MESSAGE_TH;

  const settingsPath = "/settings/integrations/telegram";
  const connectUrl = args.appBaseUrl
    ? `${args.appBaseUrl.replace(/\/$/, "")}${settingsPath}`
    : undefined;

  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
    [
      connectUrl
        ? { text: "เชื่อมต่อบัญชี", url: connectUrl }
        : { text: "เชื่อมต่อบัญชี", callback_data: CALLBACK.BIND_CONNECT },
      { text: "วิธีเชื่อมต่อ", callback_data: CALLBACK.BIND_HELP },
    ],
    [{ text: "ติดต่อผู้ดูแลระบบ", callback_data: CALLBACK.BIND_ADMIN }],
  ];

  return {
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
    disable_web_page_preview: true,
  };
}

export function buildBindHelpMessage(appBaseUrl: string | null): TelegramOutgoingMessage {
  const url = appBaseUrl
    ? `${appBaseUrl.replace(/\/$/, "")}/settings/integrations/telegram`
    : "/settings/integrations/telegram";
  return {
    text:
      "วิธีเชื่อมต่อบัญชี\n" +
      "1) เข้าสู่ระบบเว็บแอปพลิเคชัน\n" +
      "2) เปิดเมนู เชื่อมต่อ Telegram\n" +
      "3) กดปุ่มเชื่อมต่อ แล้วเปิดลิงก์ใน Telegram\n\n" +
      `หน้าตั้งค่า: ${url}`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
}

export function buildBindAdminMessage(): TelegramOutgoingMessage {
  return {
    text: "กรุณาติดต่อผู้ดูแลระบบของหน่วยเพื่อขอสิทธิ์เข้าใช้งาน",
    parse_mode: "HTML",
  };
}
