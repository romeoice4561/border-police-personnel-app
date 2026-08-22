/**
 * Commander Mobile Intelligence home (Phase 51.4).
 * Presentation only — counts come from prior API unit snapshots when available.
 */

import { formatHomeTodayCard } from "@/lib/personnel_search_telegram/commander_cards";
import { CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";
import type {
  TelegramInlineKeyboard,
  TelegramOutgoingMessage,
  TelegramSearchSession,
  UnitIntelligenceSnapshot,
} from "@/lib/personnel_search_telegram/types";

export const HOME_MENU_TITLE = "Personnel Intelligence";

export function buildHomeKeyboard(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "🔍 Search", callback_data: CALLBACK.MENU_SEARCH },
        { text: "📈 Promotion", callback_data: CALLBACK.MENU_PROMOTION },
      ],
      [
        { text: "👴 Retirement", callback_data: CALLBACK.MENU_RETIREMENT },
        { text: "🎓 Training", callback_data: CALLBACK.MENU_TRAINING },
      ],
      [
        { text: "📄 Documents", callback_data: CALLBACK.MENU_DOCUMENTS },
        { text: "📋 Data Quality", callback_data: CALLBACK.MENU_QUALITY },
      ],
      [
        { text: "📊 Dashboard", callback_data: CALLBACK.MENU_DASHBOARD },
        { text: "⭐ Favorites", callback_data: CALLBACK.MENU_FAVORITES },
      ],
      [
        { text: "🕘 Recent", callback_data: CALLBACK.MENU_RECENT },
        { text: "⚙ Settings", callback_data: CALLBACK.MENU_SETTINGS },
      ],
      [
        { text: "🏢 Unit", callback_data: CALLBACK.MENU_UNIT },
        { text: "⚡ Quick", callback_data: CALLBACK.MENU_QUICK },
      ],
      [{ text: "🚨 Drug Intelligence", callback_data: CALLBACK.MENU_DRUG }],
    ],
  };
}

export function buildQuickActionsKeyboard(session: TelegramSearchSession): TelegramInlineKeyboard {
  const org = session.conversationContext.organization;
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [
    [
      { text: "📈 Show Promotion Queue", callback_data: CALLBACK.QUICK_PROMOTION },
      { text: "👴 Near Retirement", callback_data: CALLBACK.QUICK_RETIREMENT },
    ],
    [
      { text: "🎓 Missing Courses", callback_data: CALLBACK.QUICK_TRAINING },
      { text: "📄 Expiring Documents", callback_data: CALLBACK.QUICK_DOCUMENTS },
    ],
    [{ text: "📋 Data Quality", callback_data: CALLBACK.QUICK_QUALITY }],
  ];
  if (org?.level === "company" && org.publicCode) {
    rows.push([{ text: `🏢 My Company (${org.publicCode})`, callback_data: CALLBACK.QUICK_MY_COMPANY }]);
  }
  if (org?.level === "division" || (org?.level === "company" && org.publicCode.length >= 2)) {
    // Prefer explicit division favorite / context when present
  }
  if (org?.level === "division" && org.publicCode) {
    rows.push([{ text: `🏢 My Division (${org.publicCode})`, callback_data: CALLBACK.QUICK_MY_DIVISION }]);
  }
  if (org?.level === "region" && org.publicCode) {
    rows.push([{ text: `🏢 My Region (${org.publicCode})`, callback_data: CALLBACK.QUICK_MY_REGION }]);
  }
  // Also offer company/division/region from favorites
  const favUnits = (session.favorites ?? []).filter((f) => f.kind !== "officer").slice(0, 3);
  for (const fav of favUnits) {
    if (!fav.publicCode) continue;
    const label =
      fav.kind === "company"
        ? `🏢 ${fav.labelTh}`
        : fav.kind === "division"
          ? `🏛 ${fav.labelTh}`
          : `🗺 ${fav.labelTh}`;
    rows.push([
      {
        text: label.slice(0, 64),
        callback_data: CALLBACK.favoriteOpen(favoriteIndex(session, fav)),
      },
    ]);
  }
  rows.push([{ text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME }]);
  return { inline_keyboard: rows };
}

function favoriteIndex(
  session: TelegramSearchSession,
  fav: { kind: string; publicCode?: string; officerId?: string; labelTh: string }
): number {
  const list = session.favorites ?? [];
  return Math.max(
    0,
    list.findIndex(
      (f) =>
        f.kind === fav.kind &&
        f.publicCode === fav.publicCode &&
        f.officerId === fav.officerId &&
        f.labelTh === fav.labelTh
    )
  );
}

export function buildHomeMessage(
  session?: TelegramSearchSession,
  snapshot?: UnitIntelligenceSnapshot | null
): TelegramOutgoingMessage {
  const today = formatHomeTodayCard(snapshot ?? session?.lastUnitSnapshot ?? null);
  return {
    text: today,
    parse_mode: "HTML",
    reply_markup: buildHomeKeyboard(),
    disable_web_page_preview: true,
  };
}

export function buildFavoritesMessage(session: TelegramSearchSession): TelegramOutgoingMessage {
  const favs = session.favorites ?? [];
  if (favs.length === 0) {
    return {
      text: "⭐ <b>Favorites</b>\nยังไม่มีรายการโปรด\nบันทึกได้จากหน้าหน่วยหรือกำลังพล",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME }]],
      },
    };
  }
  const lines = ["⭐ <b>Favorites</b>", ""];
  const buttons: TelegramInlineKeyboard["inline_keyboard"] = [];
  favs.forEach((f, i) => {
    const icon = f.kind === "officer" ? "👤" : "🏢";
    lines.push(`${i + 1}. ${icon} ${f.labelTh}`);
    buttons.push([
      { text: `เปิด ${i + 1}`, callback_data: CALLBACK.favoriteOpen(i) },
      { text: "ลบ", callback_data: CALLBACK.favoriteRemove(i) },
    ]);
  });
  buttons.push([{ text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME }]);
  return {
    text: lines.join("\n"),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  };
}

export function buildRecentMessage(session: TelegramSearchSession): TelegramOutgoingMessage {
  const recent = session.recentSearches ?? [];
  if (recent.length === 0) {
    return {
      text: "🕘 <b>Recent</b>\nยังไม่มีประวัติการค้นหา",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME }]],
      },
    };
  }
  const lines = ["🕘 <b>Recent</b> (สูงสุด 10)", ""];
  const buttons: TelegramInlineKeyboard["inline_keyboard"] = [];
  recent.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.labelTh}`);
    buttons.push([{ text: `เปิด ${i + 1}. ${r.labelTh}`.slice(0, 64), callback_data: CALLBACK.recentOpen(i) }]);
  });
  buttons.push([{ text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME }]);
  return {
    text: lines.join("\n"),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  };
}

export function buildSettingsMessage(appBaseUrl: string | null): TelegramOutgoingMessage {
  const url = appBaseUrl
    ? `${appBaseUrl.replace(/\/$/, "")}/settings/integrations/telegram`
    : "/settings/integrations/telegram";
  return {
    text: [
      "⚙ <b>Settings</b>",
      "",
      "• เชื่อมต่อ / ยกเลิก Telegram จากเว็บแอป",
      "• รายการโปรดและ Recent เก็บในเซสชันบอท",
      "",
      `หน้าตั้งค่า: ${url}`,
    ].join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        appBaseUrl
          ? [{ text: "เปิดการเชื่อมต่อ Telegram", url }]
          : [{ text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME }],
        [{ text: "🏠 เมนูหลัก", callback_data: CALLBACK.HOME }],
      ],
    },
  };
}

export function buildQuickActionsMessage(session: TelegramSearchSession): TelegramOutgoingMessage {
  return {
    text: "⚡ <b>Quick Actions</b>\nแตะเพื่อเรียก Personnel Search API",
    parse_mode: "HTML",
    reply_markup: buildQuickActionsKeyboard(session),
  };
}
