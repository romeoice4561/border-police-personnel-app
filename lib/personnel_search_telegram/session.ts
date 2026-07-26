/**
 * Telegram conversation session helpers (Phase 51.2 / 51.3).
 * Durable storage lives in lib/telegram_identity/session_store (Prisma or memory).
 * The sync Map helpers below remain for lightweight unit fixtures only.
 */

import type { TelegramChatMode, TelegramSearchSession } from "@/lib/personnel_search_telegram/types";

export interface TelegramSessionStore {
  get(chatId: number): TelegramSearchSession | null;
  set(session: TelegramSearchSession): void;
  clear(chatId: number): void;
}

export function createMemoryTelegramSessionStore(): TelegramSessionStore {
  const map = new Map<number, TelegramSearchSession>();
  return {
    get(chatId) {
      return map.get(chatId) ?? null;
    },
    set(session) {
      map.set(session.chatId, session);
    },
    clear(chatId) {
      map.delete(chatId);
    },
  };
}

/** Singleton default store for the webhook process. */
let defaultStore: TelegramSessionStore | null = null;

export function getDefaultTelegramSessionStore(): TelegramSessionStore {
  if (!defaultStore) defaultStore = createMemoryTelegramSessionStore();
  return defaultStore;
}

/** Test-only reset. */
export function resetDefaultTelegramSessionStore(): void {
  defaultStore = createMemoryTelegramSessionStore();
}

export function createFreshSession(
  chatId: number,
  telegramUserId: number,
  disclosureLevel: 1 | 2 | 3 = 2
): TelegramSearchSession {
  return {
    chatId,
    telegramUserId,
    mode: "idle",
    lastQuery: null,
    lastCursor: null,
    cursorStack: [],
    lastNextCursor: null,
    lastResultType: null,
    lastActions: [],
    lastClarificationSuggestions: [],
    lastDisambiguationQueries: [],
    conversationContext: {},
    disclosureLevel,
    updatedAtIso: new Date().toISOString(),
    favorites: [],
    recentSearches: [],
    lastUnitSnapshot: null,
    lastPersonOfficerId: null,
    lastPersonLabelTh: null,
  };
}

/** Ensure Phase 51.4 fields exist when loading older session payloads. */
export function normalizeSession(session: TelegramSearchSession): TelegramSearchSession {
  return {
    ...session,
    favorites: Array.isArray(session.favorites) ? session.favorites : [],
    recentSearches: Array.isArray(session.recentSearches) ? session.recentSearches : [],
    lastUnitSnapshot: session.lastUnitSnapshot ?? null,
    lastPersonOfficerId: session.lastPersonOfficerId ?? null,
    lastPersonLabelTh: session.lastPersonLabelTh ?? null,
  };
}

export function touchSession(
  session: TelegramSearchSession,
  patch: Partial<TelegramSearchSession>
): TelegramSearchSession {
  return {
    ...session,
    ...patch,
    updatedAtIso: new Date().toISOString(),
  };
}

export function modePrompt(mode: TelegramChatMode): string | null {
  switch (mode) {
    case "awaiting_free_search":
      return "พิมพ์ชื่อ นามสกุล ยศ+ชื่อ หรือรหัสกำลังพลที่ต้องการค้นหา";
    case "awaiting_unit_search":
      return "พิมพ์รหัสหน่วย เช่น 414, ร้อย414, กก41, ภาค4";
    case "awaiting_promotion_search":
      return "พิมพ์เงื่อนไขเลื่อนตำแหน่ง เช่น พร้อมเลื่อนปีนี้ หรือ ครบคุณสมบัติมาแล้ว";
    case "awaiting_retirement_search":
      return "พิมพ์เงื่อนไขเกษียณ เช่น ใครเกษียณภายใน 3 ปี";
    case "awaiting_training_search":
      return "พิมพ์เงื่อนไขหลักสูตร เช่น ขาดหลักสูตร หรือ หลักสูตรสืบสวน";
    case "awaiting_document_search":
      return "พิมพ์เงื่อนไขเอกสาร เช่น ขาดเอกสาร";
    case "awaiting_quality_search":
      return "พิมพ์เงื่อนไขคุณภาพข้อมูล เช่น ข้อมูลไม่ครบ";
    default:
      return null;
  }
}
