/**
 * Telegram update dispatcher (Phase 51.2 / 51.3).
 * Routes messages / callbacks → binding / search flow / home menu.
 * Presentation only — no permission or search logic.
 */

import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";
import type { TelegramIdentityAuditSink } from "@/lib/telegram_identity/audit";
import { recordTelegramIdentityAudit } from "@/lib/telegram_identity/audit";
import type { ResolveTelegramPrincipalResult } from "@/lib/telegram_identity/principal_resolver";
import type { TelegramSessionStoreV2 } from "@/lib/telegram_identity/session_store";
import { parseCallbackData } from "@/lib/personnel_search_telegram/callback_codes";
import type { TelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import { isTelegramUserAllowed } from "@/lib/personnel_search_telegram/config";
import { buildHomeMessage } from "@/lib/personnel_search_telegram/home_menu";
import {
  createFreshSession,
  modePrompt,
  touchSession,
} from "@/lib/personnel_search_telegram/session";
import {
  executeActionFollowUp,
  executePersonnelSearch,
} from "@/lib/personnel_search_telegram/search_flow";
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
  await deps.sessions.set(session, deps.config.sessionTtlSeconds);
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
    return { ...existing, chatId };
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
    session = touchSession(session, { mode: "idle" });
    await persistSession(deps, session);
    await deps.send(chatId, buildHomeMessage());
    return;
  }

  if (/^\/menu\b/i.test(text) || text === "เมนู") {
    const principal = await resolveActor(deps, userId);
    if (!principal.ok) {
      await deps.send(
        chatId,
        buildUnboundMessage({
          appBaseUrl: deps.config.appBaseUrl,
          variant: failureVariant(principal.code),
        })
      );
      return;
    }
    session = touchSession(session, { mode: "idle" });
    await persistSession(deps, session);
    await deps.send(chatId, buildHomeMessage());
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

  if (/^\/help\b/i.test(text) || text === "help" || text === "วิธีใช้งาน") {
    await runSearch(deps, session, principal.actor, chatId, userId, "help");
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
      text: "เชื่อมต่อบัญชีสำเร็จแล้ว\nคุณสามารถค้นหากำลังพลได้ตามสิทธิ์ของบัญชีในระบบ",
      parse_mode: "HTML",
      reply_markup: buildHomeMessage().reply_markup,
    });
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
  extra?: { cursor?: string; navigatingNext?: boolean }
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
  });
  const next = touchSession(session, view.sessionPatch);
  await persistSession(deps, next);
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
    session = touchSession(session, { mode: "idle" });
    await persistSession(deps, session);
    await deps.send(chatId, buildHomeMessage());
    return;
  }

  if (parsed.kind === "menu") {
    await handleMenu(parsed.menu, session, deps, chatId, principal.actor, userId);
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

async function handleMenu(
  menu: "search" | "unit" | "promotion" | "retirement" | "training" | "documents" | "dashboard" | "help",
  session: TelegramSearchSession,
  deps: TelegramDispatcherDeps,
  chatId: number,
  actor: IntelligenceActor,
  telegramUserId: number
): Promise<void> {
  if (menu === "dashboard") {
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
    return;
  }

  if (menu === "help") {
    await runSearch(deps, session, actor, chatId, telegramUserId, "help");
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
  await persistSession(deps, touchSession(session, { mode }));
  await deps.send(chatId, { text: modePrompt(mode) ?? "พิมพ์คำค้น", parse_mode: "HTML" });
}

function extractSearchableToken(suggestion: string): string | null {
  const unit = suggestion.match(/(?:ร้อย|ตชด\.?|กก\.?|ภาค)\s*\d{1,4}/i);
  if (unit) return unit[0];
  const digits = suggestion.match(/\b\d{3,4}\b/);
  if (digits) return digits[0];
  return null;
}
