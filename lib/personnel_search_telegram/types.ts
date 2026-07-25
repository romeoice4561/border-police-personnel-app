/**
 * Telegram Commander Experience — shared types (Phase 51.2).
 * Presentation-only; no search / ranking / permission logic.
 */

import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import type { PersonnelSearchResult, SearchAction } from "@/lib/personnel_search/contracts";
import type { PersonnelSearchApiUnitScope } from "@/lib/personnel_search_api/contracts";

export type TelegramChatMode =
  | "idle"
  | "awaiting_free_search"
  | "awaiting_unit_search"
  | "awaiting_promotion_search"
  | "awaiting_retirement_search"
  | "awaiting_training_search"
  | "awaiting_document_search";

/** Temporary conversation context — Telegram layer only, not persisted. */
export interface TelegramConversationContext {
  organization?: {
    level: "region" | "division" | "company";
    publicCode: string;
    displayName: string;
  };
}

export interface TelegramSearchSession {
  chatId: number;
  telegramUserId: number;
  mode: TelegramChatMode;
  /** Last successful search query (for pagination / follow-ups). */
  lastQuery: string | null;
  lastCursor: string | null;
  /** Stack of cursors for Previous navigation (opaque API cursors). */
  cursorStack: string[];
  lastNextCursor: string | null;
  lastResultType: string | null;
  lastActions: SearchAction[];
  lastClarificationSuggestions: string[];
  lastDisambiguationQueries: string[];
  conversationContext: TelegramConversationContext;
  disclosureLevel: 1 | 2 | 3;
  updatedAtIso: string;
}

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

export interface TelegramOutgoingMessage {
  text: string;
  reply_markup?: TelegramInlineKeyboard;
  parse_mode?: "HTML";
}

/** Minimal Telegram Update shapes we handle. */
export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramSearchApiCall {
  query: string;
  disclosureLevel?: 1 | 2 | 3;
  cursor?: string;
  limit?: number;
  unitScope?: PersonnelSearchApiUnitScope;
  intentHint?: string;
}

export type TelegramApiClient = (
  call: TelegramSearchApiCall,
  auth: { username: string; password: string }
) => Promise<PersonnelSearchApiResponse>;

export type TelegramSender = (chatId: number, message: TelegramOutgoingMessage) => Promise<void>;

export type TelegramCallbackAnswerer = (callbackQueryId: string, text?: string) => Promise<void>;

export interface RenderedSearchView {
  message: TelegramOutgoingMessage;
  /** Persist into session after a successful search. */
  sessionPatch: Partial<TelegramSearchSession>;
  result: PersonnelSearchResult | null;
}
