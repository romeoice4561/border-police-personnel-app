/**
 * Canonical Web route per Drug Intelligence entity type (Phase DI-5,
 * Section 14/18). Single source of truth for "where does this entity's
 * detail page live" — the same mapping DrugSearchResultCard, the Telegram
 * deep-link builder, and DI-5's node/edge detail panels all need. Never
 * hand-rolled per call site.
 */

import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import {
  PERSON_CASE_CONTEXT_PARAM,
  PERSON_SOURCE_CASE_PARAM,
  sanitizePersonCaseContextId,
} from "@/lib/drug_intelligence/person_case_context";
import { withReturnTo } from "@/lib/ui/return_context";

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

/** Canonical entity path plus a validated navigation-only `returnTo`. Unsafe return paths are omitted. */
export function drugEntityDetailHref(
  entityType: DrugGraphNodeType,
  entityId: string,
  returnTo?: string | null
): string {
  return withReturnTo(drugEntityDetailPath(entityType, entityId), returnTo);
}

/**
 * Person Intelligence Profile path. Investigation origin is URL state only
 * (validated id shape). Canonical writer is `sourceCaseId`; legacy `caseId`
 * may be supplied as input fallback and is still emitted for compatibility.
 * Search / Network / directory must keep using `drugEntityDetailPath` so they
 * do not invent a current case.
 */
export function drugPersonProfilePath(
  personId: string,
  opts?: { caseId?: string | null; sourceCaseId?: string | null },
): string {
  const base = `/drug-intelligence/persons/${encodeURIComponent(personId)}`;
  const origin = sanitizePersonCaseContextId(opts?.sourceCaseId ?? opts?.caseId);
  if (!origin) return base;
  const params = new URLSearchParams();
  params.set(PERSON_SOURCE_CASE_PARAM, origin);
  params.set(PERSON_CASE_CONTEXT_PARAM, origin);
  return `${base}?${params.toString()}`;
}

/**
 * Case Workspace → Person Profile investigation entry.
 * Always writes canonical `sourceCaseId` (+ legacy `caseId`) when caseId is valid,
 * and preserves a safe returnTo back to the case (or caller-supplied path).
 */
export function casePersonInvestigationHref(
  personId: string,
  caseId: string | null | undefined,
  returnTo?: string | null,
): string {
  return withReturnTo(drugPersonProfilePath(personId, { sourceCaseId: caseId }), returnTo);
}
