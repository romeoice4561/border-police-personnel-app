/**
 * Telegram update dispatcher (Phase 51.2–51.4).
 * Commander Mobile Intelligence — presentation only.
 */

import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";
import type { TelegramIdentityAuditSink } from "@/lib/telegram_identity/audit";
import { recordTelegramIdentityAudit } from "@/lib/telegram_identity/audit";
import type { ResolveTelegramPrincipalResult } from "@/lib/telegram_identity/principal_resolver";
import type { TelegramSessionStoreV2 } from "@/lib/telegram_identity/session_store";
import { parseCallbackData } from "@/lib/personnel_search_telegram/callback_codes";
import type { TelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import { isTelegramUserAllowed } from "@/lib/personnel_search_telegram/config";
import { COMMANDER_QUERIES, unitLookupQuery } from "@/lib/personnel_search_telegram/commander_queries";
import {
  favoriteKey,
  normalizeFavorites,
  queryForFavorite,
  removeFavorite,
  upsertFavorite,
} from "@/lib/personnel_search_telegram/favorites";
import {
  buildFavoritesMessage,
  buildHomeMessage,
  buildQuickActionsMessage,
  buildRecentMessage,
  buildSettingsMessage,
} from "@/lib/personnel_search_telegram/home_menu";
import {
  createFreshSession,
  modePrompt,
  normalizeSession,
  touchSession,
} from "@/lib/personnel_search_telegram/session";
import {
  executeActionFollowUp,
  executePersonnelSearch,
} from "@/lib/personnel_search_telegram/search_flow";
import { parseCommanderShortcut } from "@/lib/personnel_search_telegram/shortcuts";
import {
  buildBindAdminMessage,
  buildBindHelpMessage,
  buildUnboundMessage,
} from "@/lib/personnel_search_telegram/unbound";
import type {
  BoundTelegramApiClient,
  TelegramCallbackAnswerer,
  TelegramSearchSession,
  TelegramSender,
  TelegramUpdate,
} from "@/lib/personnel_search_telegram/types";

export type CompleteBindingFn = (args: {
  rawToken: string;
  telegramUserId: string;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  replaceExistingAppUserBinding?: boolean;
  auditSink?: TelegramIdentityAuditSink;
}) => Promise<{ appUserId: string }>;

export type CreateHandoffFn = (args: {
  appUserId: string;
  destination: string;
  auditSink?: TelegramIdentityAuditSink;
}) => Promise<{ rawToken: string; expiresAt: string }>;

export interface TelegramDispatcherDeps {
  config: TelegramPersonnelSearchConfig;
  sessions: TelegramSessionStoreV2;
  apiClient: BoundTelegramApiClient;
  send: TelegramSender;
  answerCallback: TelegramCallbackAnswerer;
  resolvePrincipal?: (telegramUserId: string) => Promise<ResolveTelegramPrincipalResult>;
  completeBinding?: CompleteBindingFn;
  createHandoff?: CreateHandoffFn;
  auditSink?: TelegramIdentityAuditSink;
}

async function defaultResolvePrincipal(
  telegramUserId: string
): Promise<ResolveTelegramPrincipalResult> {
  const { resolveTelegramPrincipal } = await import("@/lib/telegram_identity/principal_resolver");
  return resolveTelegramPrincipal(telegramUserId);
}

async function defaultCompleteBinding(
  args: Parameters<CompleteBindingFn>[0]
): Promise<{ appUserId: string }> {
  const { completeBindingFromStartToken } = await import("@/lib/telegram_identity/binding_service");
  return completeBindingFromStartToken(args);
}

async function defaultCreateHandoff(
  args: Parameters<CreateHandoffFn>[0]
): Promise<{ rawToken: string; expiresAt: string }> {
  const { createWebHandoff } = await import("@/lib/telegram_identity/handoff");
  return createWebHandoff(args);
}

async function persistSession(
  deps: TelegramDispatcherDeps,
  session: TelegramSearchSession
): Promise<void> {
  await deps.sessions.set(normalizeSession(session), deps.config.sessionTtlSeconds);
}

async function loadSession(
  deps: TelegramDispatcherDeps,
  chatId: number,
  telegramUserId: number
): Promise<TelegramSearchSession> {
  const existing = await deps.sessions.get(String(telegramUserId));
  if (existing) {
    if (existing.telegramUserId !== telegramUserId) {
      await recordTelegramIdentityAudit(deps.auditSink, {
        type: "callback_rejected",
        telegramUserId: String(telegramUserId),
        reason: "SESSION_USER_MISMATCH",
      });
      return createFreshSession(chatId, telegramUserId, deps.config.defaultDisclosureLevel);
    }
    return normalizeSession({ ...existing, chatId });
  }
  return createFreshSession(chatId, telegramUserId, deps.config.defaultDisclosureLevel);
}

function failureVariant(code: string): "unbound" | "revoked" | "disabled" {
  if (code === "REVOKED") return "revoked";
  if (code === "DISABLED" || code === "USER_INACTIVE") return "disabled";
  return "unbound";
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

async function resolveActor(
  deps: TelegramDispatcherDeps,
  telegramUserId: number
): Promise<ResolveTelegramPrincipalResult> {
  const resolve = deps.resolvePrincipal ?? defaultResolvePrincipal;
  return resolve(String(telegramUserId));
}

async function showHome(
  deps: TelegramDispatcherDeps,
  session: TelegramSearchSession,
  actor: IntelligenceActor,
  chatId: number,
  telegramUserId: number
): Promise<void> {
  let next = touchSession(session, { mode: "idle" });
  // Refresh Today card from unit context with a single API call when possible.
  const org = next.conversationContext.organization;
  if (org?.publicCode) {
    const view = await executePersonnelSearch({
      apiClient: deps.apiClient,
      actor,
      session: next,
      query: unitLookupQuery(org.publicCode),
      pageLimit: deps.config.pageLimit,
      recentLabelTh: org.displayName,
    });
    next = touchSession(next, { ...view.sessionPatch, mode: "idle" });
    await persistSession(deps, next);
    await deps.send(chatId, buildHomeMessage(next, next.lastUnitSnapshot));
    return;
  }
  await persistSession(deps, next);
  await deps.send(chatId, buildHomeMessage(next));
  void telegramUserId;
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

  let session = await loadSession(deps, chatId, userId);

  const startMatch = text.match(/^\/start(?:\s+(.+))?$/i);
  if (startMatch) {
    const token = startMatch[1]?.trim();
    if (token) {
      await handleStartBinding(token, message, deps, chatId, userId);
      return;
    }
    const principal = await resolveActor(deps, userId);
    if (!principal.ok) {
      await recordTelegramIdentityAudit(deps.auditSink, {
        type: "unbound_rejected",
        telegramUserId: String(userId),
      });
      await deps.send(
        chatId,
        buildUnboundMessage({
          appBaseUrl: deps.config.appBaseUrl,
          variant: failureVariant(principal.code),
        })
      );
      return;
    }
    await showHome(deps, session, principal.actor, chatId, userId);
    return;
  }

  const principal = await resolveActor(deps, userId);
  if (!principal.ok) {
    await recordTelegramIdentityAudit(deps.auditSink, {
      type: "unbound_rejected",
      telegramUserId: String(userId),
    });
    await deps.send(
      chatId,
      buildUnboundMessage({
        appBaseUrl: deps.config.appBaseUrl,
        variant: failureVariant(principal.code),
      })
    );
    return;
  }

  if (/^\/menu\b/i.test(text) || text === "เมนู") {
    await showHome(deps, session, principal.actor, chatId, userId);
    return;
  }

  const shortcut = parseCommanderShortcut(text);
  if (shortcut.kind === "home") {
    await showHome(deps, session, principal.actor, chatId, userId);
    return;
  }
  if (shortcut.kind === "dashboard") {
    await handleDashboard(deps, session, principal.actor, chatId);
    return;
  }
  if (shortcut.kind === "favorites") {
    await persistSession(deps, session);
    await deps.send(chatId, buildFavoritesMessage(session));
    return;
  }
  if (shortcut.kind === "recent") {
    await persistSession(deps, session);
    await deps.send(chatId, buildRecentMessage(session));
    return;
  }
  if (shortcut.kind === "settings") {
    await deps.send(chatId, buildSettingsMessage(deps.config.appBaseUrl));
    return;
  }
  if (shortcut.kind === "query") {
    await runSearch(deps, session, principal.actor, chatId, userId, shortcut.query, {
      recentLabelTh: shortcut.labelTh,
    });
    return;
  }

  if (/^\/help\b/i.test(text) || text === "help" || text === "วิธีใช้งาน") {
    await runSearch(deps, session, principal.actor, chatId, userId, COMMANDER_QUERIES.help);
    return;
  }

  await runSearch(deps, session, principal.actor, chatId, userId, text);
}

async function handleStartBinding(
  rawToken: string,
  message: NonNullable<TelegramUpdate["message"]>,
  deps: TelegramDispatcherDeps,
  chatId: number,
  userId: number
): Promise<void> {
  const complete = deps.completeBinding ?? defaultCompleteBinding;
  try {
    await complete({
      rawToken,
      telegramUserId: String(userId),
      telegramUsername: message.from?.username ?? null,
      telegramFirstName: message.from?.first_name ?? null,
      auditSink: deps.auditSink,
    });
    const session = touchSession(
      createFreshSession(chatId, userId, deps.config.defaultDisclosureLevel),
      { mode: "idle" }
    );
    await persistSession(deps, session);
    await deps.send(chatId, {
      text: "เชื่อมต่อบัญชีสำเร็จแล้ว",
      parse_mode: "HTML",
    });
    const principal = await resolveActor(deps, userId);
    if (principal.ok) {
      await showHome(deps, session, principal.actor, chatId, userId);
    } else {
      await deps.send(chatId, buildHomeMessage(session));
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "";
    await deps.send(chatId, {
      text:
        code === "TOKEN_EXPIRED" || code === "TOKEN_USED" || code === "TOKEN_INVALID"
          ? "ลิงก์เชื่อมต่อไม่ถูกต้องหรือหมดอายุแล้ว กรุณาสร้างลิงก์ใหม่จากเว็บแอปพลิเคชัน"
          : code === "CONFLICT_TELEGRAM" || code === "CONFLICT_APP_USER"
            ? "ไม่สามารถเชื่อมต่อได้ — บัญชีนี้ถูกเชื่อมกับผู้ใช้อื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ"
            : "ไม่สามารถเชื่อมต่อบัญชีได้",
      parse_mode: "HTML",
    });
  }
}

async function runSearch(
  deps: TelegramDispatcherDeps,
  session: TelegramSearchSession,
  actor: IntelligenceActor,
  chatId: number,
  telegramUserId: number,
  query: string,
  extra?: { cursor?: string; navigatingNext?: boolean; recentLabelTh?: string }
): Promise<void> {
  await recordTelegramIdentityAudit(deps.auditSink, {
    type: "search_requested",
    appUserId: actor.id,
    telegramUserId: String(telegramUserId),
  });
  const view = await executePersonnelSearch({
    apiClient: deps.apiClient,
    actor,
    session,
    query,
    cursor: extra?.cursor,
    pageLimit: deps.config.pageLimit,
    navigatingNext: extra?.navigatingNext,
    recentLabelTh: extra?.recentLabelTh,
  });
  const next = touchSession(session, view.sessionPatch);
  await persistSession(deps, next);
  await deps.send(chatId, view.message);
}

async function handleDashboard(
  deps: TelegramDispatcherDeps,
  session: TelegramSearchSession,
  actor: IntelligenceActor,
  chatId: number
): Promise<void> {
  const createHandoff = deps.createHandoff ?? defaultCreateHandoff;
  let url: string | null = null;
  try {
    const { rawToken } = await createHandoff({
      appUserId: actor.id,
      destination: "/commander-promotion",
      auditSink: deps.auditSink,
    });
    const base = deps.config.appBaseUrl?.replace(/\/$/, "") ?? "";
    url = base ? `${base}/api/auth/telegram-handoff?token=${encodeURIComponent(rawToken)}` : null;
  } catch {
    url = deps.config.appBaseUrl
      ? `${deps.config.appBaseUrl.replace(/\/$/, "")}/login`
      : "/login";
  }
  await persistSession(deps, touchSession(session, { mode: "idle" }));
  await deps.send(chatId, {
    text: `📊 Dashboard\nเปิดในเว็บ: ${url ?? "/login"}`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
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

  const parsed = parseCallbackData(cb.data);

  if (parsed.kind === "bind") {
    if (parsed.action === "help" || parsed.action === "connect") {
      await deps.send(chatId, buildBindHelpMessage(deps.config.appBaseUrl));
      return;
    }
    await deps.send(chatId, buildBindAdminMessage());
    return;
  }

  const principal = await resolveActor(deps, userId);
  if (!principal.ok) {
    await recordTelegramIdentityAudit(deps.auditSink, {
      type: "callback_rejected",
      telegramUserId: String(userId),
      reason: principal.code,
    });
    await deps.send(
      chatId,
      buildUnboundMessage({
        appBaseUrl: deps.config.appBaseUrl,
        variant: failureVariant(principal.code),
      })
    );
    return;
  }

  let session = await loadSession(deps, chatId, userId);

  if (parsed.kind === "home") {
    await showHome(deps, session, principal.actor, chatId, userId);
    return;
  }

  if (parsed.kind === "menu") {
    await handleMenu(parsed.menu, session, deps, chatId, principal.actor, userId);
    return;
  }

  if (parsed.kind === "quick") {
    await handleQuick(parsed.action, session, deps, chatId, principal.actor, userId);
    return;
  }

  if (parsed.kind === "fav_add") {
    if (parsed.target === "unit") {
      const org = session.conversationContext.organization;
      if (!org) {
        await deps.send(chatId, { text: "ยังไม่มีหน่วยในบริบท — ค้นหาหน่วยก่อน", parse_mode: "HTML" });
        return;
      }
      const favorites = upsertFavorite(session, {
        kind: org.level,
        labelTh: org.displayName,
        publicCode: org.publicCode,
        savedAtIso: new Date().toISOString(),
      });
      session = touchSession(session, { favorites });
      await persistSession(deps, session);
      await deps.send(chatId, { text: `⭐ บันทึกหน่วยโปรดแล้ว: ${org.displayName}`, parse_mode: "HTML" });
      return;
    }
    if (!session.lastPersonOfficerId || !session.lastPersonLabelTh) {
      await deps.send(chatId, { text: "ยังไม่มีกำลังพลในบริบท — ค้นหาบุคคลก่อน", parse_mode: "HTML" });
      return;
    }
    const favorites = upsertFavorite(session, {
      kind: "officer",
      labelTh: session.lastPersonLabelTh,
      officerId: session.lastPersonOfficerId,
      savedAtIso: new Date().toISOString(),
    });
    session = touchSession(session, { favorites });
    await persistSession(deps, session);
    await deps.send(chatId, {
      text: `⭐ บันทึกกำลังพลโปรดแล้ว: ${session.lastPersonLabelTh}`,
      parse_mode: "HTML",
    });
    return;
  }

  if (parsed.kind === "favorite_open") {
    const fav = normalizeFavorites(session.favorites)[parsed.index];
    if (!fav) {
      await deps.send(chatId, { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" });
      return;
    }
    const query = queryForFavorite(fav);
    if (!query) {
      await deps.send(chatId, { text: "ไม่สามารถเปิดรายการโปรดนี้ได้", parse_mode: "HTML" });
      return;
    }
    await runSearch(deps, session, principal.actor, chatId, userId, query, {
      recentLabelTh: fav.labelTh,
    });
    return;
  }

  if (parsed.kind === "favorite_remove") {
    const fav = normalizeFavorites(session.favorites)[parsed.index];
    if (!fav) {
      await deps.send(chatId, { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" });
      return;
    }
    session = touchSession(session, { favorites: removeFavorite(session, favoriteKey(fav)) });
    await persistSession(deps, session);
    await deps.send(chatId, buildFavoritesMessage(session));
    return;
  }

  if (parsed.kind === "recent_open") {
    const item = (session.recentSearches ?? [])[parsed.index];
    if (!item) {
      await deps.send(chatId, { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" });
      return;
    }
    await runSearch(deps, session, principal.actor, chatId, userId, item.query, {
      recentLabelTh: item.labelTh,
    });
    return;
  }

  if (parsed.kind === "page") {
    if (parsed.direction === "next") {
      if (!session.lastNextCursor || !session.lastQuery) {
        await deps.send(chatId, { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" });
        return;
      }
      await runSearch(deps, session, principal.actor, chatId, userId, session.lastQuery, {
        cursor: session.lastNextCursor,
        navigatingNext: true,
      });
      return;
    }
    if (session.cursorStack.length === 0 || !session.lastQuery) {
      await deps.send(chatId, { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" });
      return;
    }
    const stack = [...session.cursorStack];
    const prevCursor = stack.pop()!;
    const patched = touchSession(session, { cursorStack: stack });
    await runSearch(deps, patched, principal.actor, chatId, userId, session.lastQuery, {
      cursor: prevCursor || undefined,
    });
    return;
  }

  if (parsed.kind === "action") {
    const createHandoff = deps.createHandoff ?? defaultCreateHandoff;
    const view = await executeActionFollowUp({
      apiClient: deps.apiClient,
      actor: principal.actor,
      session,
      actionIndex: parsed.index,
      pageLimit: deps.config.pageLimit,
      appBaseUrl: deps.config.appBaseUrl,
      resolveDeepLink: async (href) => {
        try {
          const { rawToken } = await createHandoff({
            appUserId: principal.actor.id,
            destination: href,
            auditSink: deps.auditSink,
          });
          const base = deps.config.appBaseUrl?.replace(/\/$/, "") ?? "";
          return base
            ? `${base}/api/auth/telegram-handoff?token=${encodeURIComponent(rawToken)}`
            : null;
        } catch {
          return null;
        }
      },
    });
    session = touchSession(session, view.sessionPatch);
    await persistSession(deps, session);
    await deps.send(chatId, view.message);
    return;
  }

  if (parsed.kind === "clarify") {
    const suggestion = session.lastClarificationSuggestions[parsed.index];
    if (!suggestion) {
      await deps.send(chatId, { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" });
      return;
    }
    const query = extractSearchableToken(suggestion) ?? suggestion;
    await runSearch(deps, session, principal.actor, chatId, userId, query);
    return;
  }

  if (parsed.kind === "disambiguate") {
    const query = session.lastDisambiguationQueries[parsed.index];
    if (!query) {
      await deps.send(chatId, { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" });
      return;
    }
    await runSearch(deps, session, principal.actor, chatId, userId, query);
    return;
  }

  await recordTelegramIdentityAudit(deps.auditSink, {
    type: "callback_rejected",
    telegramUserId: String(userId),
    reason: "UNKNOWN_CALLBACK",
  });
  await deps.send(chatId, { text: "ไม่เข้าใจคำสั่งปุ่ม", parse_mode: "HTML" });
}

async function handleQuick(
  action:
    | "promotion"
    | "retirement"
    | "training"
    | "documents"
    | "quality"
    | "my_company"
    | "my_division"
    | "my_region",
  session: TelegramSearchSession,
  deps: TelegramDispatcherDeps,
  chatId: number,
  actor: IntelligenceActor,
  telegramUserId: number
): Promise<void> {
  const org = session.conversationContext.organization;
  switch (action) {
    case "promotion":
      await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.promotion, {
        recentLabelTh: "เลื่อนตำแหน่ง",
      });
      return;
    case "retirement":
      await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.retirement, {
        recentLabelTh: "เกษียณ",
      });
      return;
    case "training":
      await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.training, {
        recentLabelTh: "หลักสูตร",
      });
      return;
    case "documents":
      await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.documents, {
        recentLabelTh: "เอกสาร",
      });
      return;
    case "quality":
      await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.dataQuality, {
        recentLabelTh: "คุณภาพข้อมูล",
      });
      return;
    case "my_company":
    case "my_division":
    case "my_region": {
      if (!org?.publicCode) {
        await deps.send(chatId, {
          text: "ยังไม่มีหน่วยในบริบท — ค้นหาหน่วยหรือเลือกจาก Favorites",
          parse_mode: "HTML",
        });
        return;
      }
      await runSearch(deps, session, actor, chatId, telegramUserId, unitLookupQuery(org.publicCode), {
        recentLabelTh: org.displayName,
      });
      return;
    }
  }
}

async function handleMenu(
  menu:
    | "search"
    | "unit"
    | "promotion"
    | "retirement"
    | "training"
    | "documents"
    | "quality"
    | "dashboard"
    | "help"
    | "favorites"
    | "recent"
    | "settings"
    | "quick",
  session: TelegramSearchSession,
  deps: TelegramDispatcherDeps,
  chatId: number,
  actor: IntelligenceActor,
  telegramUserId: number
): Promise<void> {
  if (menu === "dashboard") {
    await handleDashboard(deps, session, actor, chatId);
    return;
  }
  if (menu === "favorites") {
    await persistSession(deps, session);
    await deps.send(chatId, buildFavoritesMessage(session));
    return;
  }
  if (menu === "recent") {
    await persistSession(deps, session);
    await deps.send(chatId, buildRecentMessage(session));
    return;
  }
  if (menu === "settings") {
    await deps.send(chatId, buildSettingsMessage(deps.config.appBaseUrl));
    return;
  }
  if (menu === "quick") {
    await persistSession(deps, session);
    await deps.send(chatId, buildQuickActionsMessage(session));
    return;
  }
  if (menu === "help") {
    await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.help);
    return;
  }
  if (menu === "promotion") {
    await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.promotion, {
      recentLabelTh: "เลื่อนตำแหน่ง",
    });
    return;
  }
  if (menu === "retirement") {
    await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.retirement, {
      recentLabelTh: "เกษียณ",
    });
    return;
  }
  if (menu === "training") {
    await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.training, {
      recentLabelTh: "หลักสูตร",
    });
    return;
  }
  if (menu === "documents") {
    await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.documents, {
      recentLabelTh: "เอกสาร",
    });
    return;
  }
  if (menu === "quality") {
    await runSearch(deps, session, actor, chatId, telegramUserId, COMMANDER_QUERIES.dataQuality, {
      recentLabelTh: "คุณภาพข้อมูล",
    });
    return;
  }

  const modeMap = {
    search: "awaiting_free_search",
    unit: "awaiting_unit_search",
  } as const;

  const mode = modeMap[menu as "search" | "unit"];
  if (mode) {
    await persistSession(deps, touchSession(session, { mode }));
    await deps.send(chatId, { text: modePrompt(mode) ?? "พิมพ์คำค้น", parse_mode: "HTML" });
  }
}

function extractSearchableToken(suggestion: string): string | null {
  const unit = suggestion.match(/(?:ร้อย|ตชด\.?|กก\.?|ภาค)\s*\d{1,4}/i);
  if (unit) return unit[0];
  const digits = suggestion.match(/\b\d{3,4}\b/);
  if (digits) return digits[0];
  return null;
}
