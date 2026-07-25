/**
 * Minimal Telegram Bot API sender (Phase 51.2).
 */

import type { TelegramCallbackAnswerer, TelegramOutgoingMessage, TelegramSender } from "@/lib/personnel_search_telegram/types";

export function createTelegramBotSender(botToken: string): TelegramSender {
  const base = `https://api.telegram.org/bot${botToken}`;
  return async (chatId, message) => {
    const res = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.text,
        parse_mode: message.parse_mode ?? "HTML",
        reply_markup: message.reply_markup,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Telegram sendMessage failed: ${res.status} ${body.slice(0, 200)}`);
    }
  };
}

export function createTelegramCallbackAnswerer(botToken: string): TelegramCallbackAnswerer {
  const base = `https://api.telegram.org/bot${botToken}`;
  return async (callbackQueryId, text) => {
    await fetch(`${base}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text?.slice(0, 200),
        show_alert: false,
      }),
    });
  };
}

export function createNoopTelegramSender(): TelegramSender {
  return async () => {
    /* tests */
  };
}

export function createNoopCallbackAnswerer(): TelegramCallbackAnswerer {
  return async () => {
    /* tests */
  };
}
