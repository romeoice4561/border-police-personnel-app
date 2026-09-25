/**
 * Contextual Back label for returnTo destinations (Phase 1B.2.3).
 * Relationship Search return paths must not reuse the Map-only label.
 */

import type { TranslationKey } from "@/lib/i18n/dictionary";

function returnToPathname(returnTo: string): string {
  return returnTo.split("?")[0].split("#")[0].toLowerCase();
}

export function isLinkCompareReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo) return false;
  return returnToPathname(returnTo) === "/drug-intelligence/network/compare";
}

/**
 * DI-8.7 V1.5B VISUAL HOTFIX (Section 6/7) — true only when returnTo is a
 * Network URL carrying the temporal-focus restoration flag (`tFocus=1`,
 * written by temporalAwareReturnPath in app/drug-intelligence/network/
 * page.tsx). Path-only check, same convention as isLinkCompareReturnTo —
 * never inspects arbitrary query content beyond this one flag.
 */
export function isTemporalFocusReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo) return false;
  if (returnToPathname(returnTo) !== "/drug-intelligence/network") return false;
  const queryIndex = returnTo.indexOf("?");
  if (queryIndex === -1) return false;
  const params = new URLSearchParams(returnTo.slice(queryIndex + 1));
  return params.get("tFocus") === "1";
}

export function returnToBackLabelKey(returnTo: string | null | undefined): TranslationKey {
  if (!returnTo) return "di.map.actionBackToMap";
  if (isTemporalFocusReturnTo(returnTo)) return "di.temporal.backToTemporalFocus";
  if (isLinkCompareReturnTo(returnTo)) return "di.linkCompare.backToCompare";
  const path = returnTo.toLowerCase();
  if (
    path.includes("/drug-intelligence/search") ||
    path.includes("mode=relationship") ||
    path.includes("relrun=1")
  ) {
    return "di.rel.backToSearchResults";
  }
  if (path.includes("/drug-intelligence/persons/")) {
    return "di.profile.backToPerson";
  }
  if (path.includes("/drug-intelligence/cases/")) {
    return "di.rel.backToCase";
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
  if (path.includes("/drug-intelligence/command")) {
    return "di.command.backToDashboard";
  }
  return "di.rel.backGeneric";
}

export function isRelationshipSearchReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo) return false;
  const path = returnTo.toLowerCase();
  return path.includes("/drug-intelligence/search") || path.includes("mode=relationship");
}

export function isCommanderDashboardReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo) return false;
  return returnTo.toLowerCase().startsWith("/drug-intelligence/command");
}

export function isNetworkReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo) return false;
  if (isLinkCompareReturnTo(returnTo)) return false;
  return returnTo.toLowerCase().startsWith("/drug-intelligence/network");
}

/** Back-button copy on Phone/SIM/Device/Vehicle detail pages. */
export function entityDetailBackLabelKey(returnTo: string | null | undefined): TranslationKey {
  if (!returnTo) return "di.entity.backToSearch";
  if (isNetworkReturnTo(returnTo)) return "di.entity.backToNetwork";
  return returnToBackLabelKey(returnTo);
}
