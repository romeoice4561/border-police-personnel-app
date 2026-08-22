/**
 * Canonical Web route per Drug Intelligence entity type (Phase DI-5,
 * Section 14/18). Single source of truth for "where does this entity's
 * detail page live" — the same mapping DrugSearchResultCard, the Telegram
 * deep-link builder, and DI-5's node/edge detail panels all need. Never
 * hand-rolled per call site.
 */

import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";

export function drugEntityDetailPath(entityType: DrugGraphNodeType, entityId: string): string {
  switch (entityType) {
    case "PERSON":
      return `/drug-intelligence/persons/${encodeURIComponent(entityId)}`;
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
    case "LOCATION":
      // No dedicated Location detail page exists (Section 10's scope) — a Location node's
      // detail is shown in-drawer only; this path is never used as a Link href for LOCATION.
      return "/drug-intelligence/network";
  }
}

export function drugNetworkFocusPath(entityType: DrugGraphNodeType, entityId: string): string {
  return `/drug-intelligence/network?${new URLSearchParams({ focusType: entityType, focusId: entityId }).toString()}`;
}
