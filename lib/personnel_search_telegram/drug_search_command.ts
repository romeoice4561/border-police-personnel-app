/**
 * Drug Intelligence Telegram command handler (Phase DI-4, Sections 8, 25,
 * 31).
 *
 * Narrow orchestration only: parse → authenticate (already done by the
 * caller — dispatcher.ts resolves the actor before reaching here) →
 * permission → DrugIntelligenceSearchService → formatter → send. No DB
 * logic here — every query goes through the SAME service DI-3's Web Global
 * Search uses (Section 2/8/35), never a Telegram-only search
 * reimplementation.
 *
 * Section 17 (confirmed with the user): Telegram ALWAYS renders masked
 * values — `canViewFull` is hard-coded `false` here regardless of the
 * actor's `drug.edit` permission, since chat is a higher-risk display
 * channel (screenshots, forwarding, chat backups) than the web app.
 */

import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";
import { hasPermission } from "@/lib/auth/roles";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import type { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import type { DrugSearchEntityType, DrugSearchResult } from "@/lib/drug_intelligence/drug_search_types";
import {
  buildDrugByTypePageMessage,
  buildDrugEmptyQueryMessage,
  buildDrugErrorMessage,
  buildDrugGroupedMessage,
  buildDrugNoResultMessage,
  buildDrugPermissionDeniedMessage,
  buildDrugRateLimitedMessage,
  buildDrugResultDetailMessage,
  flattenDrugGroupedResults,
} from "@/lib/personnel_search_telegram/drug_search_formatter";
import type { TelegramRateLimiter } from "@/lib/telegram_identity/rate_limit";
import type { TelegramOutgoingMessage, TelegramSearchSession } from "@/lib/personnel_search_telegram/types";

/** Section 10: small initial limit — Telegram must not dump huge result sets. */
const PER_GROUP_LIMIT = 5;
const BY_TYPE_PAGE_SIZE = 8;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Mirrors components/drug_intelligence/drug_search_result_card.tsx's entityHref exactly — the same canonical route per entity type. */
function entityPath(entityType: DrugSearchEntityType, entityId: string, canonicalTargetId: string | null): string {
  const id = canonicalTargetId ?? entityId;
  switch (entityType) {
    case "PERSON":
      return `/drug-intelligence/persons/${encodeURIComponent(id)}`;
    case "PHONE":
      return `/drug-intelligence/phones/${encodeURIComponent(entityId)}`;
    case "SIM":
      return `/drug-intelligence/sims/${encodeURIComponent(entityId)}`;
    case "DEVICE":
      return `/drug-intelligence/devices/${encodeURIComponent(entityId)}`;
    case "VEHICLE":
      return `/drug-intelligence/vehicles/${encodeURIComponent(entityId)}`;
    case "CASE":
      return `/drug-intelligence/cases/${encodeURIComponent(entityId)}`;
  }
}

function searchPath(query: string): string {
  return `/drug-intelligence/search?${new URLSearchParams({ q: query }).toString()}`;
}

export interface DrugSearchCommandDeps {
  actor: IntelligenceActor;
  telegramUserId: string;
  appBaseUrl: string | null;
  /** Section 18/DI-4 §13 (handoff): resolves a `/drug-intelligence/...` destination into an authenticated one-time-use Web URL. Returns null when the handoff couldn't be created (e.g. no appBaseUrl) — callers fall back to no button rather than a broken/unauthenticated link. */
  resolveDeepLink: (destination: string) => Promise<string | null>;
  rateLimiter?: TelegramRateLimiter;
  onAudit?: (event: "drug_search_requested" | "drug_permission_denied") => void;
  /** Test seam — defaults to the real production container. Tests inject a service built over InMemoryDatabaseClient instead of hitting the real DB. */
  searchService?: DrugIntelligenceSearchService;
}

async function resolveSearchService(deps: DrugSearchCommandDeps): Promise<DrugIntelligenceSearchService> {
  if (deps.searchService) return deps.searchService;
  const container = await getDrugIntelligenceContainer();
  return container.searchService;
}

/**
 * Section 25/31: the single entry point dispatcher.ts calls for BOTH the
 * mode-driven free-text query and a future `/drug <query>` command — same
 * permission/rate-limit/search/format pipeline either way.
 */
export async function handleDrugSearchQuery(
  deps: DrugSearchCommandDeps,
  session: TelegramSearchSession,
  rawQuery: string
): Promise<{ message: TelegramOutgoingMessage; sessionPatch: Partial<TelegramSearchSession> }> {
  const query = rawQuery.trim();

  if (!hasPermission(deps.actor.permissions, "drug.read")) {
    deps.onAudit?.("drug_permission_denied");
    return { message: buildDrugPermissionDeniedMessage(), sessionPatch: {} };
  }

  if (!query) {
    return { message: buildDrugEmptyQueryMessage(), sessionPatch: {} };
  }

  if (deps.rateLimiter) {
    const decision = await deps.rateLimiter.check(`drug-search:${deps.actor.id}`);
    if (!decision.allowed) {
      return { message: buildDrugRateLimitedMessage(), sessionPatch: {} };
    }
  }

  deps.onAudit?.("drug_search_requested");

  let results;
  try {
    const searchService = await resolveSearchService(deps);
    results = await searchService.searchGrouped(
      { query, perGroupLimit: PER_GROUP_LIMIT },
      { canViewFull: false, actorId: deps.actor.id, actorName: deps.actor.displayName }
    );
  } catch (error) {
    console.error("[telegram-drug-search]", error instanceof Error ? error.message : "search failed");
    return { message: buildDrugErrorMessage(), sessionPatch: {} };
  }

  if (results.totalCount === 0) {
    return { message: buildDrugNoResultMessage(query), sessionPatch: { lastDrugQuery: query, lastDrugResults: [] } };
  }

  const base = deps.appBaseUrl ? stripTrailingSlash(deps.appBaseUrl) : null;
  const webSearchUrl = base ? await deps.resolveDeepLink(searchPath(query)) : null;

  const refs = flattenDrugGroupedResults(results);
  return {
    message: buildDrugGroupedMessage(results, webSearchUrl),
    sessionPatch: { lastDrugQuery: query, lastDrugResults: refs, lastDrugEntityType: null, lastDrugPage: 1 },
  };
}

/** Section 12-16: opens one result by its session-stored index (callback `dg:N`). */
export async function handleDrugResultOpen(
  deps: DrugSearchCommandDeps,
  session: TelegramSearchSession,
  index: number
): Promise<TelegramOutgoingMessage> {
  const ref = session.lastDrugResults[index];
  if (!ref || !session.lastDrugQuery) {
    return { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" };
  }
  if (!hasPermission(deps.actor.permissions, "drug.read")) {
    return buildDrugPermissionDeniedMessage();
  }

  let result: DrugSearchResult | undefined;
  try {
    const searchService = await resolveSearchService(deps);
    const byType = await searchService.searchByType(
      { query: session.lastDrugQuery, entityType: ref.entityType, page: 1, pageSize: 50 },
      { canViewFull: false, actorId: deps.actor.id, actorName: deps.actor.displayName }
    );
    result = byType.rows.find((r) => r.entityId === ref.entityId);
  } catch (error) {
    console.error("[telegram-drug-search]", error instanceof Error ? error.message : "detail lookup failed");
    return buildDrugErrorMessage();
  }

  if (!result) {
    return { text: "ไม่พบข้อมูลนี้แล้ว อาจถูกปรับปรุงหรือรวมข้อมูลไปแล้ว", parse_mode: "HTML" };
  }

  const destination = entityPath(result.entityType, result.entityId, result.canonicalTarget?.entityId ?? null);
  const url = await deps.resolveDeepLink(destination);
  return buildDrugResultDetailMessage(result, url);
}

/** Section 10/24: single-entity-type "ดูทั้งหมด" drill-down, backend-paginated via searchByType — never a client-side slice of an already-fetched full list. */
export async function handleDrugGroupDrillDown(
  deps: DrugSearchCommandDeps,
  session: TelegramSearchSession,
  entityType: DrugSearchEntityType,
  page: number
): Promise<{ message: TelegramOutgoingMessage; sessionPatch: Partial<TelegramSearchSession> }> {
  if (!session.lastDrugQuery) {
    return { message: { text: "รายการนี้หมดอายุแล้ว กรุณาค้นหาใหม่", parse_mode: "HTML" }, sessionPatch: {} };
  }
  if (!hasPermission(deps.actor.permissions, "drug.read")) {
    return { message: buildDrugPermissionDeniedMessage(), sessionPatch: {} };
  }

  let byType;
  try {
    const searchService = await resolveSearchService(deps);
    byType = await searchService.searchByType(
      { query: session.lastDrugQuery, entityType, page, pageSize: BY_TYPE_PAGE_SIZE },
      { canViewFull: false, actorId: deps.actor.id, actorName: deps.actor.displayName }
    );
  } catch (error) {
    console.error("[telegram-drug-search]", error instanceof Error ? error.message : "drill-down failed");
    return { message: buildDrugErrorMessage(), sessionPatch: {} };
  }

  const webSearchUrl = await deps.resolveDeepLink(searchPath(session.lastDrugQuery));
  const startIndex = (page - 1) * BY_TYPE_PAGE_SIZE;
  const refs = byType.rows.map((r) => ({ entityType: r.entityType, entityId: r.entityId }));
  const patchedResults = [...session.lastDrugResults];
  refs.forEach((r, i) => {
    patchedResults[startIndex + i] = r;
  });

  return {
    message: buildDrugByTypePageMessage({
      entityType,
      query: session.lastDrugQuery,
      rows: byType.rows,
      page,
      total: byType.total,
      pageSize: BY_TYPE_PAGE_SIZE,
      webSearchUrl,
    }),
    sessionPatch: { lastDrugEntityType: entityType, lastDrugPage: page, lastDrugResults: patchedResults },
  };
}
