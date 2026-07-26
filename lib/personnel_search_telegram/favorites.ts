/**
 * Favorites helpers — session-only (Phase 51.4).
 * Stores safe public refs only (no full personnel payloads).
 */

import type {
  TelegramFavoriteRef,
  TelegramSearchSession,
} from "@/lib/personnel_search_telegram/types";
import { unitLookupQuery } from "@/lib/personnel_search_telegram/commander_queries";

export const MAX_FAVORITES = 20;

export function normalizeFavorites(list: TelegramFavoriteRef[] | undefined): TelegramFavoriteRef[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (f) =>
        f &&
        (f.kind === "company" || f.kind === "division" || f.kind === "region" || f.kind === "officer") &&
        typeof f.labelTh === "string" &&
        f.labelTh.length > 0
    )
    .slice(0, MAX_FAVORITES);
}

export function favoriteKey(fav: TelegramFavoriteRef): string {
  if (fav.kind === "officer") return `officer:${fav.officerId ?? fav.labelTh}`;
  return `${fav.kind}:${fav.publicCode ?? fav.labelTh}`;
}

export function upsertFavorite(
  session: TelegramSearchSession,
  fav: TelegramFavoriteRef
): TelegramFavoriteRef[] {
  const current = normalizeFavorites(session.favorites);
  const key = favoriteKey(fav);
  const next = [{ ...fav, savedAtIso: new Date().toISOString() }, ...current.filter((f) => favoriteKey(f) !== key)];
  return next.slice(0, MAX_FAVORITES);
}

export function removeFavorite(
  session: TelegramSearchSession,
  key: string
): TelegramFavoriteRef[] {
  return normalizeFavorites(session.favorites).filter((f) => favoriteKey(f) !== key);
}

/** Map a favorite to a Personnel Search API query string. */
export function queryForFavorite(fav: TelegramFavoriteRef): string | null {
  if (fav.kind === "officer") {
    return fav.officerId?.trim() || fav.labelTh.trim() || null;
  }
  if (fav.publicCode?.trim()) return unitLookupQuery(fav.publicCode.trim());
  return fav.labelTh.trim() || null;
}
