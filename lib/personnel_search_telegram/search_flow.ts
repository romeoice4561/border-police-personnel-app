/**
 * Search flow — maps Telegram intents to Personnel Search API calls (Phase 51.2).
 */

import type { PersonnelSearchApiUnitScope } from "@/lib/personnel_search_api/contracts";
import type { SearchAction } from "@/lib/personnel_search/contracts";
import {
  disambiguationQueriesFromResult,
  extractUnitContextFromResult,
  formatApiErrorText,
  formatPersonnelSearchResultText,
} from "@/lib/personnel_search_telegram/formatter";
import { buildResultKeyboard } from "@/lib/personnel_search_telegram/keyboard";
import type {
  RenderedSearchView,
  TelegramApiClient,
  TelegramSearchSession,
} from "@/lib/personnel_search_telegram/types";

function unitScopeFromSession(session: TelegramSearchSession): PersonnelSearchApiUnitScope | undefined {
  const org = session.conversationContext.organization;
  if (!org) return undefined;
  if (org.level === "company") return { companyCode: org.publicCode };
  if (org.level === "division") return { divisionCode: org.publicCode };
  return { regionCode: org.publicCode };
}

function queryForAction(action: SearchAction, session: TelegramSearchSession): {
  query: string;
  unitScope?: PersonnelSearchApiUnitScope;
} {
  const publicCode =
    (typeof action.payload.publicCode === "string" && action.payload.publicCode) ||
    session.conversationContext.organization?.publicCode ||
    "";

  const unitScope: PersonnelSearchApiUnitScope | undefined = publicCode
    ? action.payload.unitKey?.toString().startsWith("division:")
      ? { divisionCode: publicCode }
      : action.payload.unitKey?.toString().startsWith("region:")
        ? { regionCode: publicCode }
        : { companyCode: publicCode }
    : unitScopeFromSession(session);

  const intentHint = typeof action.payload.intentHint === "string" ? action.payload.intentHint : "";
  const queryHint = typeof action.payload.queryHint === "string" ? action.payload.queryHint : "";

  if (action.type === "open_dashboard") {
    return { query: "help", unitScope };
  }

  if (queryHint) return { query: queryHint, unitScope };

  switch (intentHint) {
    case "PROMOTION_SEARCH":
      return { query: "ครบคุณสมบัติมาแล้ว", unitScope };
    case "RETIREMENT_SEARCH":
      return { query: "ใกล้เกษียณ", unitScope };
    case "TRAINING_SEARCH":
      return { query: "ขาดหลักสูตร", unitScope };
    case "DOCUMENT_SEARCH":
      return { query: "ขาดเอกสาร", unitScope };
    case "UNIT_LOOKUP":
      return { query: publicCode ? `ร้อย${publicCode}` : session.lastQuery ?? "help", unitScope };
    default:
      return { query: action.labelTh, unitScope };
  }
}

export async function executePersonnelSearch(args: {
  apiClient: TelegramApiClient;
  auth: { username: string; password: string };
  session: TelegramSearchSession;
  query: string;
  cursor?: string;
  unitScope?: PersonnelSearchApiUnitScope;
  pageLimit: number;
  /** When true, push current cursor onto stack before navigating next. */
  navigatingNext?: boolean;
}): Promise<RenderedSearchView> {
  const unitScope = args.unitScope ?? unitScopeFromSession(args.session);
  const response = await args.apiClient(
    {
      query: args.query,
      disclosureLevel: args.session.disclosureLevel,
      cursor: args.cursor,
      limit: args.pageLimit,
      unitScope,
    },
    args.auth
  );

  if (!response.ok) {
    return {
      message: { text: formatApiErrorText(response), parse_mode: "HTML" },
      sessionPatch: { mode: "idle" },
      result: null,
    };
  }

  const { result, meta } = response;
  const unitCtx = extractUnitContextFromResult(result);
  const text = formatPersonnelSearchResultText(result);

  let cursorStack = args.session.cursorStack;
  if (args.navigatingNext) {
    // Push the cursor we navigated FROM (previous page marker).
    const fromCursor = args.session.lastCursor;
    cursorStack = fromCursor != null ? [...args.session.cursorStack, fromCursor] : [...args.session.cursorStack, ""];
  } else if (!args.cursor) {
    cursorStack = [];
  }

  const keyboard = buildResultKeyboard({
    result,
    nextCursor: meta.nextCursor,
    hasPrevious: cursorStack.length > 0,
  });

  return {
    message: {
      text,
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
    sessionPatch: {
      mode: "idle",
      lastQuery: args.query,
      lastCursor: args.cursor ?? null,
      cursorStack,
      lastNextCursor: meta.nextCursor,
      lastResultType: result.resultType,
      lastActions: result.actions,
      lastClarificationSuggestions: result.clarification?.suggestionsTh ?? [],
      lastDisambiguationQueries: disambiguationQueriesFromResult(result),
      conversationContext: unitCtx
        ? { organization: unitCtx }
        : args.session.conversationContext,
    },
    result,
  };
}

export async function executeActionFollowUp(args: {
  apiClient: TelegramApiClient;
  auth: { username: string; password: string };
  session: TelegramSearchSession;
  actionIndex: number;
  pageLimit: number;
  appBaseUrl: string | null;
}): Promise<RenderedSearchView> {
  const action = args.session.lastActions[args.actionIndex];
  if (!action) {
    return {
      message: { text: "ปุ่มนี้หมดอายุแล้ว — กดเมนูหลักแล้วค้นหาใหม่", parse_mode: "HTML" },
      sessionPatch: {},
      result: null,
    };
  }

  if (action.type === "open_dashboard") {
    const href = typeof action.payload.href === "string" ? action.payload.href : "/commander-promotion";
    const url = args.appBaseUrl ? `${args.appBaseUrl.replace(/\/$/, "")}${href}` : href;
    return {
      message: {
        text: `📊 Dashboard\nเปิดในเว็บ: ${url}`,
        parse_mode: "HTML",
      },
      sessionPatch: {},
      result: null,
    };
  }

  if (action.type === "open_profile" && typeof action.payload.href === "string") {
    const href = action.payload.href;
    const url = args.appBaseUrl ? `${args.appBaseUrl.replace(/\/$/, "")}${href}` : href;
    return {
      message: { text: `👤 โปรไฟล์\n${url}`, parse_mode: "HTML" },
      sessionPatch: {},
      result: null,
    };
  }

  const { query, unitScope } = queryForAction(action, args.session);
  return executePersonnelSearch({
    apiClient: args.apiClient,
    auth: args.auth,
    session: args.session,
    query,
    unitScope,
    pageLimit: args.pageLimit,
  });
}
