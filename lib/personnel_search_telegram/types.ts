/**
 * Telegram Commander Experience — shared types (Phase 51.2 / 51.3).
 * Presentation-only; no search / ranking / permission logic.
 */

import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";
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

/** Temporary conversation context — Telegram layer only. */
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
  lastQuery: string | null;
  lastCursor: string | null;
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

export interface TelegramUserRef {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_bot?: boolean;
  language_code?: string;
}

export interface TelegramChatRef {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChatRef;
  from?: TelegramUserRef;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUserRef;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  edited_message?: TelegramMessage;
}

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

/** @deprecated Alias — prefer TelegramInlineButton */
export type TelegramInlineKeyboardButton = TelegramInlineButton;

export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

export interface TelegramOutgoingMessage {
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: TelegramInlineKeyboard;
  disable_web_page_preview?: boolean;
}

export interface TelegramSearchApiCall {
  query: string;
  disclosureLevel?: 1 | 2 | 3;
  cursor?: string;
  limit?: number;
  unitScope?: PersonnelSearchApiUnitScope;
  intentHint?: string;
}

/** Bound principal API client — no shared Basic Auth for human searches. */
export type BoundTelegramApiClient = (
  call: TelegramSearchApiCall,
  actor: IntelligenceActor
) => Promise<PersonnelSearchApiResponse>;

/** @deprecated Alias kept for Phase 51.2 call sites during migration. */
export type TelegramApiClient = BoundTelegramApiClient;

export type TelegramSender = (chatId: number, message: TelegramOutgoingMessage) => Promise<void>;

export type TelegramCallbackAnswerer = (callbackQueryId: string, text?: string) => Promise<void>;

export interface RenderedSearchView {
  message: TelegramOutgoingMessage;
  /** Persist into session after a successful search. */
  sessionPatch: Partial<TelegramSearchSession>;
  result: PersonnelSearchResult | null;
}
