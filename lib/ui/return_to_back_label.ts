/**
 * Contextual Back label for returnTo destinations (Phase 1B.2.3).
 * Relationship Search return paths must not reuse the Map-only label.
 */

import type { TranslationKey } from "@/lib/i18n/dictionary";

export function returnToBackLabelKey(returnTo: string | null | undefined): TranslationKey {
  if (!returnTo) return "di.map.actionBackToMap";
  const path = returnTo.toLowerCase();
  if (
    path.includes("/drug-intelligence/search") ||
    path.includes("mode=relationship") ||
    path.includes("relrun=1")
  ) {
    return "di.rel.backToSearchResults";
  }
  if (path.includes("/drug-intelligence/map")) {
    return "di.map.actionBackToMap";
  }
  if (path.includes("/drug-intelligence/network")) {
    return "di.rel.backToNetwork";
  }
  if (path.includes("/drug-intelligence/timeline")) {
    return "di.rel.backToTimeline";
  }
  return "di.rel.backGeneric";
}

export function isRelationshipSearchReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo) return false;
  const path = returnTo.toLowerCase();
  return path.includes("/drug-intelligence/search") || path.includes("mode=relationship");
}
