/**
 * Recent search helpers — session-only (Phase 51.4).
 */

import type {
  TelegramRecentSearch,
  TelegramSearchSession,
} from "@/lib/personnel_search_telegram/types";

export const MAX_RECENT_SEARCHES = 10;

export function normalizeRecent(list: TelegramRecentSearch[] | undefined): TelegramRecentSearch[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && typeof r.query === "string" && r.query.trim().length > 0)
    .slice(0, MAX_RECENT_SEARCHES);
}

export function pushRecentSearch(
  session: TelegramSearchSession,
  entry: { query: string; labelTh?: string; resultType?: string | null }
): TelegramRecentSearch[] {
  const query = entry.query.trim();
  if (!query || query.toLowerCase() === "help") {
    return normalizeRecent(session.recentSearches);
  }
  const item: TelegramRecentSearch = {
    query,
    labelTh: (entry.labelTh ?? query).slice(0, 64),
    resultType: entry.resultType ?? null,
    atIso: new Date().toISOString(),
  };
  const rest = normalizeRecent(session.recentSearches).filter(
    (r) => r.query.toLowerCase() !== query.toLowerCase()
  );
  return [item, ...rest].slice(0, MAX_RECENT_SEARCHES);
}
