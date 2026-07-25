/**
 * Search execution helpers — calls Personnel Search API only (Phase 51.2 / 51.3).
 */

import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";
import type { PersonnelSearchApiUnitScope } from "@/lib/personnel_search_api/contracts";
import type { PersonnelSearchResult, SearchAction } from "@/lib/personnel_search/contracts";
import { formatApiErrorText, formatPersonnelSearchResultText } from "@/lib/personnel_search_telegram/formatter";
import { buildResultKeyboard } from "@/lib/personnel_search_telegram/keyboard";
import type {
  BoundTelegramApiClient,
  RenderedSearchView,
  TelegramSearchSession,
} from "@/lib/personnel_search_telegram/types";

function unitScopeFromSession(session: TelegramSearchSession): PersonnelSearchApiUnitScope | undefined {
  const org = session.conversationContext.organization;
  if (!org) return undefined;
  if (org.level === "company") return { companyCode: org.publicCode };
  if (org.level === "division") return { divisionCode: org.publicCode };
  if (org.level === "region") return { regionCode: org.publicCode };
  return undefined;
}

function extractUnitContextFromResult(result: PersonnelSearchResult) {
  const unit = result.items.find((i) => i.kind === "unit");
  if (!unit || unit.kind !== "unit" || !unit.publicCode) return null;
  return {
    level: unit.level,
    publicCode: unit.publicCode,
    displayName: unit.labelTh,
  };
}

function disambiguationQueriesFromResult(result: PersonnelSearchResult): string[] {
  return result.items
    .filter((i): i is Extract<typeof i, { kind: "person" }> => i.kind === "person")
    .slice(0, 8)
    .map((i) => i.fullName || i.officerId);
}

function queryForAction(
  action: SearchAction,
  session: TelegramSearchSession
): { query: string; unitScope?: PersonnelSearchApiUnitScope } {
  const publicCode =
    typeof action.payload.publicCode === "string" ? action.payload.publicCode : undefined;
  const intentHint =
    typeof action.payload.intentHint === "string" ? action.payload.intentHint : undefined;
  const queryHint = typeof action.payload.queryHint === "string" ? action.payload.queryHint : undefined;

  const unitScope: PersonnelSearchApiUnitScope | undefined = publicCode
    ? { companyCode: publicCode }
    : unitScopeFromSession(session);

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
  apiClient: BoundTelegramApiClient;
  actor: IntelligenceActor;
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
    args.actor
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
  apiClient: BoundTelegramApiClient;
  actor: IntelligenceActor;
  session: TelegramSearchSession;
  actionIndex: number;
  pageLimit: number;
  appBaseUrl: string | null;
  /** Optional secure handoff URL builder for dashboard/profile. */
  resolveDeepLink?: (href: string) => Promise<string | null>;
}): Promise<RenderedSearchView> {
  const action = args.session.lastActions[args.actionIndex];
  if (!action) {
    return {
      message: { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" },
      sessionPatch: {},
      result: null,
    };
  }

  if (action.type === "open_dashboard" || (action.type === "open_profile" && typeof action.payload.href === "string")) {
    const href =
      action.type === "open_dashboard"
        ? typeof action.payload.href === "string"
          ? action.payload.href
          : "/commander-promotion"
        : (action.payload.href as string);

    if (!href.startsWith("/") || href.startsWith("//") || href.includes("://")) {
      return {
        message: { text: "ลิงก์ไม่ได้รับอนุญาต", parse_mode: "HTML" },
        sessionPatch: {},
        result: null,
      };
    }

    let url: string;
    if (args.resolveDeepLink) {
      const handoff = await args.resolveDeepLink(href);
      url = handoff ?? (args.appBaseUrl ? `${args.appBaseUrl.replace(/\/$/, "")}/login` : "/login");
    } else if (args.appBaseUrl) {
      url = `${args.appBaseUrl.replace(/\/$/, "")}${href}`;
    } else {
      url = href;
    }

    const label = action.type === "open_dashboard" ? "📊 Dashboard" : "👤 โปรไฟล์";
    return {
      message: { text: `${label}\nเปิดในเว็บ: ${url}`, parse_mode: "HTML", disable_web_page_preview: true },
      sessionPatch: {},
      result: null,
    };
  }

  const { query, unitScope } = queryForAction(action, args.session);
  return executePersonnelSearch({
    apiClient: args.apiClient,
    actor: args.actor,
    session: args.session,
    query,
    unitScope,
    pageLimit: args.pageLimit,
  });
}
