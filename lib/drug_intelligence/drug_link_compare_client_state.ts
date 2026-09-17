/**
 * Link Compare LC-2B — two-box client state (pure).
 *
 * URL identity is type + canonical id only. Labels are presentation cache,
 * never identity. Analyze is explicit; Box C / drag-drop / AI are out of scope.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import { isSafeInternalReturnPath, withReturnTo } from "@/lib/ui/return_context";
import { isLinkCompareReturnTo } from "@/lib/ui/return_to_back_label";
import { drugEntityDetailPath, drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import {
  DRUG_LINK_COMPARE_ENTITY_TYPES,
  type DrugLinkCompareConnectionKind,
  type DrugLinkCompareEntityType,
  type DrugLinkCompareSharedCase,
  type DrugLinkCompareSharedEntity,
  type DrugLinkCompareSlotKey,
} from "@/lib/drug_intelligence/drug_link_compare_types";
import { DRUG_GRAPH_RELATIONSHIP_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphPath, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const LINK_COMPARE_PATH = "/drug-intelligence/network/compare";
export const LINK_COMPARE_NETWORK_PATH = "/drug-intelligence/network";
export const LINK_COMPARE_SHARED_CASE_VISIBLE = 5;
export const LINK_COMPARE_MAX_ID_LENGTH = 500;

export const LINK_COMPARE_PICKER_TYPES: readonly DrugLinkCompareEntityType[] = DRUG_LINK_COMPARE_ENTITY_TYPES;

const ENTITY_TYPE_SET = new Set<string>(DRUG_LINK_COMPARE_ENTITY_TYPES);

export type LinkCompareSlotSelection = {
  entityType: DrugLinkCompareEntityType;
  entityId: string;
  label: string;
  caseCount: number | null;
};

export type LinkCompareTwoBoxState = {
  A: LinkCompareSlotSelection | null;
  B: LinkCompareSlotSelection | null;
};

export type LinkCompareHttpErrorKind = "invalid" | "unauthenticated" | "forbidden" | "not_found" | "retryable";

export function isLinkCompareEntityType(value: string | null | undefined): value is DrugLinkCompareEntityType {
  return Boolean(value && ENTITY_TYPE_SET.has(value));
}

export function canonicalEntityKey(type: DrugLinkCompareEntityType, id: string): string {
  return `${type}:${id}`;
}

export function isSameCanonicalEntity(left: LinkCompareSlotSelection | null, right: LinkCompareSlotSelection | null): boolean {
  if (!left || !right) return false;
  return canonicalEntityKey(left.entityType, left.entityId) === canonicalEntityKey(right.entityType, right.entityId);
}

export function canAnalyzeLinkCompare(state: LinkCompareTwoBoxState): boolean {
  return Boolean(state.A && state.B && !isSameCanonicalEntity(state.A, state.B));
}

export function isAnalyzeDisabled(state: LinkCompareTwoBoxState, loading: boolean): boolean {
  return loading || !canAnalyzeLinkCompare(state);
}

export function pairIdentityKey(state: LinkCompareTwoBoxState): string | null {
  if (!canAnalyzeLinkCompare(state) || !state.A || !state.B) return null;
  return `${canonicalEntityKey(state.A.entityType, state.A.entityId)}|${canonicalEntityKey(state.B.entityType, state.B.entityId)}`;
}

export function selectLinkCompareSlot(
  state: LinkCompareTwoBoxState,
  slot: Exclude<DrugLinkCompareSlotKey, "C">,
  selection: LinkCompareSlotSelection
): { state: LinkCompareTwoBoxState; error: "duplicate" | null } {
  const other = slot === "A" ? state.B : state.A;
  if (isSameCanonicalEntity(selection, other)) {
    return { state, error: "duplicate" };
  }
  return { state: { ...state, [slot]: selection }, error: null };
}

export function clearLinkCompareSlot(
  state: LinkCompareTwoBoxState,
  slot: Exclude<DrugLinkCompareSlotKey, "C">
): LinkCompareTwoBoxState {
  return { ...state, [slot]: null };
}

function readSlot(
  params: URLSearchParams,
  typeKey: string,
  idKey: string
): LinkCompareSlotSelection | null {
  const type = params.get(typeKey)?.trim() ?? "";
  const id = params.get(idKey)?.trim() ?? "";
  if (!type && !id) return null;
  if (!isLinkCompareEntityType(type) || !id || id.length > LINK_COMPARE_MAX_ID_LENGTH) return null;
  return { entityType: type, entityId: id, label: "", caseCount: null };
}

export function parseLinkCompareSearchParams(params: URLSearchParams): LinkCompareTwoBoxState {
  return {
    A: readSlot(params, "aType", "aId"),
    B: readSlot(params, "bType", "bId"),
  };
}

export function serializeLinkCompareSearchParams(
  state: LinkCompareTwoBoxState,
  current?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams();
  const returnTo = current?.get("returnTo");
  if (returnTo) next.set("returnTo", returnTo);
  if (state.A) {
    next.set("aType", state.A.entityType);
    next.set("aId", state.A.entityId);
  }
  if (state.B) {
    next.set("bType", state.B.entityType);
    next.set("bId", state.B.entityId);
  }
  return next;
}

/** Canonical compare URL for Network returnTo — type/id only, never labels or nested returnTo. */
export function buildLinkCompareHref(state: LinkCompareTwoBoxState): string {
  const params = new URLSearchParams();
  if (state.A) {
    params.set("aType", state.A.entityType);
    params.set("aId", state.A.entityId);
  }
  if (state.B) {
    params.set("bType", state.B.entityType);
    params.set("bId", state.B.entityId);
  }
  const qs = params.toString();
  const href = qs ? `${LINK_COMPARE_PATH}?${qs}` : LINK_COMPARE_PATH;
  return isSafeInternalReturnPath(href) ? href : LINK_COMPARE_PATH;
}

export function linkCompareNetworkFocusHref(
  entityType: DrugLinkCompareEntityType,
  entityId: string,
  compareHref: string
): string {
  return withReturnTo(drugNetworkFocusPath(entityType, entityId), compareHref);
}

export function linkCompareCaseHref(caseId: string, compareHref: string): string {
  return withReturnTo(drugEntityDetailPath("CASE", caseId), compareHref);
}

export function parseLinkCompareReturnTo(returnTo: string | null | undefined): LinkCompareTwoBoxState | null {
  if (!isSafeInternalReturnPath(returnTo) || !isLinkCompareReturnTo(returnTo)) return null;
  const queryIndex = returnTo.indexOf("?");
  const query = queryIndex >= 0 ? returnTo.slice(queryIndex + 1) : "";
  return parseLinkCompareSearchParams(new URLSearchParams(query));
}

export function mergeHydratedSlots(
  fromUrl: LinkCompareTwoBoxState,
  previous: LinkCompareTwoBoxState
): LinkCompareTwoBoxState {
  const hydrate = (urlSlot: LinkCompareSlotSelection | null, prev: LinkCompareSlotSelection | null) => {
    if (!urlSlot) return null;
    if (prev && canonicalEntityKey(prev.entityType, prev.entityId) === canonicalEntityKey(urlSlot.entityType, urlSlot.entityId)) {
      return prev;
    }
    return urlSlot;
  };
  return {
    A: hydrate(fromUrl.A, previous.A),
    B: hydrate(fromUrl.B, previous.B),
  };
}

export function shouldFetchLinkCompare(submittedKey: string | null, state: LinkCompareTwoBoxState): boolean {
  const identity = pairIdentityKey(state);
  return Boolean(submittedKey && identity && submittedKey === identity);
}

export function classifyLinkCompareHttpError(error: unknown): LinkCompareHttpErrorKind {
  if (error instanceof ApiClientError) {
    if (error.status === 400) return "invalid";
    if (error.status === 401) return "unauthenticated";
    if (error.status === 403) return "forbidden";
    if (error.status === 404) return "not_found";
  }
  return "retryable";
}

export function linkCompareErrorMessageKey(kind: LinkCompareHttpErrorKind): TranslationKey {
  switch (kind) {
    case "invalid":
      return "di.linkCompare.errorInvalid";
    case "unauthenticated":
      return "di.linkCompare.errorUnauthenticated";
    case "forbidden":
      return "di.linkCompare.errorForbidden";
    case "not_found":
      return "di.linkCompare.errorNotFound";
    case "retryable":
      return "di.linkCompare.errorRetry";
  }
}

export function connectionHeadlineKey(kind: DrugLinkCompareConnectionKind): TranslationKey {
  switch (kind) {
    case "DIRECT":
      return "di.linkCompare.direct";
    case "INDIRECT":
      return "di.linkCompare.indirect";
    case "NONE_KNOWN":
      return "di.linkCompare.noneKnown";
  }
}

export function relationshipWordingKey(relationshipType: string | null | undefined): TranslationKey | null {
  if (!relationshipType) return null;
  if (relationshipType in DRUG_GRAPH_RELATIONSHIP_LABEL_KEY) {
    return DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[relationshipType as DrugGraphRelationshipType];
  }
  return null;
}

export function slotDisplayLabel(slot: LinkCompareSlotSelection | null): string {
  if (!slot) return "";
  return slot.label.trim() || slot.entityId;
}

export type LinkCompareExplanationPart =
  | { kind: "direct"; a: string; b: string }
  | { kind: "indirect"; intermediateCount: number; viaCaseLabels: string[] }
  | { kind: "none" }
  | { kind: "extraSharedCases"; count: number };

export function buildLinkCompareExplanationParts(
  pair: {
    connectionKind: DrugLinkCompareConnectionKind;
    hopCount: number | null;
    shortestPath: { hopCount: number; steps: Array<{ node: { type: string; label: string } }> } | null;
    sharedCases: DrugLinkCompareSharedCase[];
  },
  slots: LinkCompareTwoBoxState
): LinkCompareExplanationPart[] {
  if (pair.connectionKind === "NONE_KNOWN") return [{ kind: "none" }];
  const parts: LinkCompareExplanationPart[] = [];
  if (pair.connectionKind === "DIRECT") {
    parts.push({ kind: "direct", a: slotDisplayLabel(slots.A), b: slotDisplayLabel(slots.B) });
  } else {
    const hopCount = pair.hopCount ?? pair.shortestPath?.hopCount ?? 0;
    const viaCaseLabels = (pair.shortestPath?.steps ?? [])
      .filter((step) => step.node.type === "CASE")
      .map((step) => step.node.label)
      .filter(Boolean);
    parts.push({
      kind: "indirect",
      intermediateCount: Math.max(hopCount - 1, 1),
      viaCaseLabels,
    });
  }
  if (pair.sharedCases.length >= 2) {
    parts.push({ kind: "extraSharedCases", count: pair.sharedCases.length });
  }
  return parts;
}

export function visibleSharedCases(
  cases: DrugLinkCompareSharedCase[],
  expanded: boolean,
  limit = LINK_COMPARE_SHARED_CASE_VISIBLE
): { items: DrugLinkCompareSharedCase[]; hidden: number } {
  if (expanded || cases.length <= limit) return { items: cases, hidden: 0 };
  return { items: cases.slice(0, limit), hidden: cases.length - limit };
}

/** Shared cases that are not already shown as CASE nodes on the shortest path. */
export function supportingSharedCases(
  cases: DrugLinkCompareSharedCase[],
  path: { steps: Array<{ node: { type: string; id?: string } }> } | null | undefined
): DrugLinkCompareSharedCase[] {
  const onPath = new Set(
    (path?.steps ?? [])
      .filter((step) => step.node.type === "CASE" && step.node.id)
      .map((step) => step.node.id as string)
  );
  if (onPath.size === 0) return cases;
  return cases.filter((row) => !onPath.has(row.caseId));
}

export function sharedJunctionHeading(
  count: number,
  t: (key: TranslationKey) => string
): string {
  if (count <= 1) return t("di.linkCompare.junctionPoints");
  return t("di.linkCompare.junctionPointsCount").replace("{count}", String(count));
}

const SHARED_ENTITY_ORDER: DrugLinkCompareSharedEntity["entityType"][] = ["PHONE", "SIM", "DEVICE", "VEHICLE"];

export function groupSharedEntities(
  entities: DrugLinkCompareSharedEntity[]
): Array<{ entityType: DrugLinkCompareSharedEntity["entityType"]; items: DrugLinkCompareSharedEntity[] }> {
  return SHARED_ENTITY_ORDER.flatMap((entityType) => {
    const items = entities.filter((row) => row.entityType === entityType);
    return items.length ? [{ entityType, items }] : [];
  });
}

export function pathNodeLabels(path: DrugGraphPath | null | undefined): string[] {
  return path?.steps.map((step) => step.node.label) ?? [];
}

export function sharedEntityTypeLabelKey(
  entityType: DrugLinkCompareSharedEntity["entityType"]
): TranslationKey {
  switch (entityType) {
    case "PHONE":
      return "di.network.groupPhone";
    case "SIM":
      return "di.network.groupSim";
    case "DEVICE":
      return "di.network.groupDevice";
    case "VEHICLE":
      return "di.network.groupVehicle";
  }
}
