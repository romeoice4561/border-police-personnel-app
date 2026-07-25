/**
 * Telegram update dispatcher (Phase 51.2).
 * Routes messages / callbacks → search flow / home menu. Presentation only.
 */

import { parseCallbackData } from "@/lib/personnel_search_telegram/callback_codes";
import type { TelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import { isTelegramUserAllowed } from "@/lib/personnel_search_telegram/config";
import { buildHomeMessage } from "@/lib/personnel_search_telegram/home_menu";
import {
  createFreshSession,
  modePrompt,
  touchSession,
  type TelegramSessionStore,
} from "@/lib/personnel_search_telegram/session";
import {
  executeActionFollowUp,
  executePersonnelSearch,
} from "@/lib/personnel_search_telegram/search_flow";
import type {
  TelegramApiClient,
  TelegramCallbackAnswerer,
  TelegramSearchSession,
  TelegramSender,
  TelegramUpdate,
} from "@/lib/personnel_search_telegram/types";

export interface TelegramDispatcherDeps {
  config: TelegramPersonnelSearchConfig;
  sessions: TelegramSessionStore;
  apiClient: TelegramApiClient;
  send: TelegramSender;
  answerCallback: TelegramCallbackAnswerer;
}

function authFromConfig(config: TelegramPersonnelSearchConfig) {
  return { username: config.serviceUsername, password: config.servicePassword };
}

export async function dispatchTelegramUpdate(
  update: TelegramUpdate,
  deps: TelegramDispatcherDeps
): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update, deps);
    return;
  }
  if (update.message?.text) {
    await handleMessage(update, deps);
  }
}

async function handleMessage(update: TelegramUpdate, deps: TelegramDispatcherDeps): Promise<void> {
  const message = update.message!;
  const text = message.text?.trim() ?? "";
  const chatId = message.chat.id;
  const userId = message.from?.id ?? chatId;

  if (!isTelegramUserAllowed(userId, deps.config)) {
    await deps.send(chatId, { text: "ไม่มีสิทธิ์ใช้บอทนี้", parse_mode: "HTML" });
    return;
  }

  let session =
    deps.sessions.get(chatId) ??
    createFreshSession(chatId, userId, deps.config.defaultDisclosureLevel);

  if (/^\/start\b/i.test(text) || /^\/menu\b/i.test(text) || text === "เมนู") {
    session = touchSession(session, { mode: "idle" });
    deps.sessions.set(session);
    await deps.send(chatId, buildHomeMessage());
    return;
  }

  if (/^\/help\b/i.test(text) || text === "help" || text === "วิธีใช้งาน") {
    const view = await executePersonnelSearch({
      apiClient: deps.apiClient,
      auth: authFromConfig(deps.config),
      session,
      query: "help",
      pageLimit: deps.config.pageLimit,
    });
    session = touchSession(session, view.sessionPatch);
    deps.sessions.set(session);
    await deps.send(chatId, view.message);
    return;
  }

  const view = await executePersonnelSearch({
    apiClient: deps.apiClient,
    auth: authFromConfig(deps.config),
    session,
    query: text,
    pageLimit: deps.config.pageLimit,
  });
  session = touchSession(session, view.sessionPatch);
  deps.sessions.set(session);
  await deps.send(chatId, view.message);
}

async function handleCallback(update: TelegramUpdate, deps: TelegramDispatcherDeps): Promise<void> {
  const cb = update.callback_query!;
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const userId = cb.from.id;
  await deps.answerCallback(cb.id);

  if (!isTelegramUserAllowed(userId, deps.config)) {
    await deps.send(chatId, { text: "ไม่มีสิทธิ์ใช้บอทนี้", parse_mode: "HTML" });
    return;
  }

  let session =
    deps.sessions.get(chatId) ??
    createFreshSession(chatId, userId, deps.config.defaultDisclosureLevel);

  const parsed = parseCallbackData(cb.data);

  if (parsed.kind === "home") {
    session = touchSession(session, { mode: "idle" });
    deps.sessions.set(session);
    await deps.send(chatId, buildHomeMessage());
    return;
  }

  if (parsed.kind === "menu") {
    await handleMenu(parsed.menu, session, deps, chatId);
    return;
  }

  if (parsed.kind === "page") {
    if (parsed.direction === "next") {
      if (!session.lastNextCursor || !session.lastQuery) {
        await deps.send(chatId, { text: "ไม่มีหน้าถัดไป", parse_mode: "HTML" });
        return;
      }
      const view = await executePersonnelSearch({
        apiClient: deps.apiClient,
        auth: authFromConfig(deps.config),
        session,
        query: session.lastQuery,
        cursor: session.lastNextCursor,
        pageLimit: deps.config.pageLimit,
        navigatingNext: true,
      });
      session = touchSession(session, view.sessionPatch);
      deps.sessions.set(session);
      await deps.send(chatId, view.message);
      return;
    }

    if (session.cursorStack.length === 0 || !session.lastQuery) {
      await deps.send(chatId, { text: "ไม่มีหน้าก่อนหน้า", parse_mode: "HTML" });
      return;
    }
    const stack = [...session.cursorStack];
    const prevCursor = stack.pop()!;
    const view = await executePersonnelSearch({
      apiClient: deps.apiClient,
      auth: authFromConfig(deps.config),
      session: touchSession(session, { cursorStack: stack }),
      query: session.lastQuery,
      cursor: prevCursor || undefined,
      pageLimit: deps.config.pageLimit,
    });
    session = touchSession(session, { ...view.sessionPatch, cursorStack: stack });
    deps.sessions.set(session);
    await deps.send(chatId, view.message);
    return;
  }

  if (parsed.kind === "action") {
    const view = await executeActionFollowUp({
      apiClient: deps.apiClient,
      auth: authFromConfig(deps.config),
      session,
      actionIndex: parsed.index,
      pageLimit: deps.config.pageLimit,
      appBaseUrl: deps.config.appBaseUrl,
    });
    session = touchSession(session, view.sessionPatch);
    deps.sessions.set(session);
    await deps.send(chatId, view.message);
    return;
  }

  if (parsed.kind === "clarify") {
    const suggestion = session.lastClarificationSuggestions[parsed.index];
    if (!suggestion) {
      await deps.send(chatId, { text: "ตัวเลือกหมดอายุแล้ว", parse_mode: "HTML" });
      return;
    }
    const query = extractSearchableToken(suggestion) ?? suggestion;
    const view = await executePersonnelSearch({
      apiClient: deps.apiClient,
      auth: authFromConfig(deps.config),
      session,
      query,
      pageLimit: deps.config.pageLimit,
    });
    session = touchSession(session, view.sessionPatch);
    deps.sessions.set(session);
    await deps.send(chatId, view.message);
    return;
  }

  if (parsed.kind === "disambiguate") {
    const query = session.lastDisambiguationQueries[parsed.index];
    if (!query) {
      await deps.send(chatId, { text: "ตัวเลือกหมดอายุแล้ว", parse_mode: "HTML" });
      return;
    }
    const view = await executePersonnelSearch({
      apiClient: deps.apiClient,
      auth: authFromConfig(deps.config),
      session,
      query,
      pageLimit: deps.config.pageLimit,
    });
    session = touchSession(session, view.sessionPatch);
    deps.sessions.set(session);
    await deps.send(chatId, view.message);
    return;
  }

  await deps.send(chatId, { text: "ไม่เข้าใจคำสั่งปุ่ม", parse_mode: "HTML" });
}

async function handleMenu(
  menu: "search" | "unit" | "promotion" | "retirement" | "training" | "documents" | "dashboard" | "help",
  session: TelegramSearchSession,
  deps: TelegramDispatcherDeps,
  chatId: number
): Promise<void> {
  const auth = authFromConfig(deps.config);

  if (menu === "dashboard") {
    const url = deps.config.appBaseUrl
      ? `${deps.config.appBaseUrl.replace(/\/$/, "")}/commander-promotion`
      : "/commander-promotion";
    deps.sessions.set(touchSession(session, { mode: "idle" }));
    await deps.send(chatId, { text: `📊 Dashboard\nเปิดในเว็บ: ${url}`, parse_mode: "HTML" });
    return;
  }

  if (menu === "help") {
    const view = await executePersonnelSearch({
      apiClient: deps.apiClient,
      auth,
      session,
      query: "help",
      pageLimit: deps.config.pageLimit,
    });
    deps.sessions.set(touchSession(session, view.sessionPatch));
    await deps.send(chatId, view.message);
    return;
  }

  const modeMap = {
    search: "awaiting_free_search",
    unit: "awaiting_unit_search",
    promotion: "awaiting_promotion_search",
    retirement: "awaiting_retirement_search",
    training: "awaiting_training_search",
    documents: "awaiting_document_search",
  } as const;

  const mode = modeMap[menu];
  deps.sessions.set(touchSession(session, { mode }));
  await deps.send(chatId, { text: modePrompt(mode) ?? "พิมพ์คำค้น", parse_mode: "HTML" });
}

function extractSearchableToken(suggestion: string): string | null {
  const unit = suggestion.match(/(?:ร้อย|ตชด\.?|กก\.?|ภาค)\s*\d{1,4}/i);
  if (unit) return unit[0];
  const digits = suggestion.match(/\b\d{3,4}\b/);
  if (digits) return digits[0];
  return null;
}
