/**
 * LC-2C.1 — bounded Compare Highlight navigation state.
 *
 * Presentation only: type+id identities from the existing compare DTO.
 * Never labels, never graph payloads, never database writes.
 */

import { DRUG_LINK_COMPARE_ENTITY_TYPES, type DrugLinkCompareEntityType } from "@/lib/drug_intelligence/drug_link_compare_types";
import type {
  DrugGraphEdge,
  DrugGraphNode,
  DrugGraphNodeType,
  DrugLinkComparePairDto,
  DrugLinkCompareResponse,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

type CompareHighlightSlotInput = {
  entityType: DrugLinkCompareEntityType;
  entityId: string;
};

type CompareHighlightSlotsInput = {
  A: CompareHighlightSlotInput | null;
  B: CompareHighlightSlotInput | null;
  C?: CompareHighlightSlotInput | null;
};

export const COMPARE_HIGHLIGHT_A_PARAM = "cmpA";
export const COMPARE_HIGHLIGHT_B_PARAM = "cmpB";
export const COMPARE_HIGHLIGHT_C_PARAM = "cmpC";
export const COMPARE_HIGHLIGHT_PATH_PARAM = "cmpP";
export const COMPARE_HIGHLIGHT_KIND_PARAM = "cmpK";
export const COMPARE_HIGHLIGHT_HOP_PARAM = "cmpH";
export const COMPARE_HIGHLIGHT_VIA_PARAM = "cmpV";
export const COMPARE_INSPECT_PARAM = "cmpInspect";

export const COMPARE_HIGHLIGHT_MAX_ID_LENGTH = 200;
export const COMPARE_HIGHLIGHT_MAX_PATH_NODES = 20;
export const COMPARE_HIGHLIGHT_CONTEXT_NODE_OPACITY = 0.32;
export const COMPARE_HIGHLIGHT_CONTEXT_EDGE_OPACITY = 0.28;
export const COMPARE_HIGHLIGHT_PATH_STROKE_WIDTH = 3;

export type CompareHighlightSlot = "A" | "B" | "C";
export type CompareHighlightNodeRole = "endpoint" | "path" | "context";
export type CompareHighlightConnectionKind = "DIRECT" | "INDIRECT" | "NONE_KNOWN";

export type CompareHighlightEntity = {
  entityType: DrugGraphNodeType;
  entityId: string;
};

export type CompareHighlightPairFact = {
  left: CompareHighlightSlot;
  right: CompareHighlightSlot;
  connectionKind: CompareHighlightConnectionKind;
  hopCount: number | null;
  via: CompareHighlightEntity[];
};

export type LinkCompareHighlightContext = {
  A: CompareHighlightEntity;
  B: CompareHighlightEntity;
  C: CompareHighlightEntity | null;
  pathNodes: CompareHighlightEntity[];
  pairs: CompareHighlightPairFact[];
};

const ENDPOINT_TYPE_SET = new Set<string>(DRUG_LINK_COMPARE_ENTITY_TYPES);
const GRAPH_NODE_TYPES: readonly DrugGraphNodeType[] = [
  "PERSON",
  "CASE",
  "PHONE",
  "SIM",
  "DEVICE",
  "VEHICLE",
  "LOCATION",
];
const GRAPH_NODE_TYPE_SET = new Set<string>(GRAPH_NODE_TYPES);

function isEndpointType(value: string): value is DrugLinkCompareEntityType {
  return ENDPOINT_TYPE_SET.has(value);
}

function isGraphNodeType(value: string): value is DrugGraphNodeType {
  return GRAPH_NODE_TYPE_SET.has(value);
}

export function compareHighlightEntityKey(entity: CompareHighlightEntity): string {
  return `${entity.entityType}:${entity.entityId}`;
}

function parseEntityToken(raw: string | null | undefined, endpoint: boolean): CompareHighlightEntity | null {
  const token = raw?.trim() ?? "";
  if (!token) return null;
  const split = token.indexOf(":");
  if (split <= 0 || split === token.length - 1) return null;
  const entityType = token.slice(0, split);
  const entityId = token.slice(split + 1).trim();
  if (!entityId || entityId.length > COMPARE_HIGHLIGHT_MAX_ID_LENGTH) return null;
  if (endpoint) {
    if (!isEndpointType(entityType)) return null;
    return { entityType, entityId };
  }
  if (!isGraphNodeType(entityType)) return null;
  return { entityType, entityId };
}

function encodeEntity(entity: CompareHighlightEntity): string {
  return `${entity.entityType}:${entity.entityId}`;
}

function sameEntity(left: CompareHighlightEntity, right: CompareHighlightEntity): boolean {
  return compareHighlightEntityKey(left) === compareHighlightEntityKey(right);
}

function fromSlot(slot: CompareHighlightSlotInput): CompareHighlightEntity {
  return { entityType: slot.entityType, entityId: slot.entityId };
}

function pairSlots(hasC: boolean): Array<[CompareHighlightSlot, CompareHighlightSlot]> {
  return hasC
    ? [
        ["A", "B"],
        ["A", "C"],
        ["B", "C"],
      ]
    : [["A", "B"]];
}

function findResultPair(
  pairs: DrugLinkComparePairDto[],
  left: CompareHighlightSlot,
  right: CompareHighlightSlot
): DrugLinkComparePairDto | undefined {
  return pairs.find(
    (pair) => (pair.left === left && pair.right === right) || (pair.left === right && pair.right === left)
  );
}

function pairFactFromDto(
  left: CompareHighlightSlot,
  right: CompareHighlightSlot,
  dto: DrugLinkComparePairDto | undefined
): CompareHighlightPairFact {
  if (!dto) {
    return { left, right, connectionKind: "NONE_KNOWN", hopCount: null, via: [] };
  }
  const via: CompareHighlightEntity[] = [];
  const steps = dto.shortestPath?.steps ?? [];
  for (const step of steps.slice(1, Math.max(1, steps.length - 1))) {
    via.push({ entityType: step.node.type, entityId: step.node.id });
  }
  return {
    left,
    right,
    connectionKind: dto.connectionKind,
    hopCount: dto.connectionKind === "NONE_KNOWN" ? null : dto.hopCount,
    via,
  };
}

function encodeKind(kind: CompareHighlightConnectionKind): string {
  if (kind === "DIRECT") return "D";
  if (kind === "INDIRECT") return "I";
  return "N";
}

function parseKind(token: string): CompareHighlightConnectionKind | null {
  if (token === "D") return "DIRECT";
  if (token === "I") return "INDIRECT";
  if (token === "N") return "NONE_KNOWN";
  return null;
}

export function buildCompareHighlightFromResult(
  slots: CompareHighlightSlotsInput,
  result: DrugLinkCompareResponse
): LinkCompareHighlightContext | null {
  if (!slots.A || !slots.B) return null;
  const A = fromSlot(slots.A);
  const B = fromSlot(slots.B);
  const cSlot = slots.C ?? null;
  const C = cSlot ? fromSlot(cSlot) : null;
  if (sameEntity(A, B) || (C && (sameEntity(A, C) || sameEntity(B, C)))) return null;

  const byKey = new Map<string, CompareHighlightEntity>();
  const add = (entity: CompareHighlightEntity) => {
    const key = compareHighlightEntityKey(entity);
    if (!byKey.has(key)) byKey.set(key, entity);
  };
  add(A);
  add(B);
  if (C) add(C);
  const pairs = pairSlots(Boolean(C)).map(([left, right]) => pairFactFromDto(left, right, findResultPair(result.pairs, left, right)));
  for (const pair of pairs) {
    for (const via of pair.via) add(via);
  }
  for (const pair of result.pairs) {
    for (const step of pair.shortestPath?.steps ?? []) {
      add({ entityType: step.node.type, entityId: step.node.id });
    }
  }
  for (const row of result.tripleIntersection?.cases ?? []) {
    add({ entityType: "CASE", entityId: row.caseId });
  }
  if (byKey.size > COMPARE_HIGHLIGHT_MAX_PATH_NODES) return null;
  return { A, B, C, pathNodes: [...byKey.values()], pairs };
}

function pairFacts(context: LinkCompareHighlightContext): CompareHighlightPairFact[] {
  return context.pairs ?? [];
}

export function serializeCompareHighlightSearchParams(
  context: LinkCompareHighlightContext | null,
  current?: URLSearchParams
): URLSearchParams {
  const next = current ? new URLSearchParams(current.toString()) : new URLSearchParams();
  next.delete(COMPARE_HIGHLIGHT_A_PARAM);
  next.delete(COMPARE_HIGHLIGHT_B_PARAM);
  next.delete(COMPARE_HIGHLIGHT_C_PARAM);
  next.delete(COMPARE_HIGHLIGHT_PATH_PARAM);
  next.delete(COMPARE_HIGHLIGHT_KIND_PARAM);
  next.delete(COMPARE_HIGHLIGHT_HOP_PARAM);
  next.delete(COMPARE_HIGHLIGHT_VIA_PARAM);
  if (!context) return next;
  next.set(COMPARE_HIGHLIGHT_A_PARAM, encodeEntity(context.A));
  next.set(COMPARE_HIGHLIGHT_B_PARAM, encodeEntity(context.B));
  if (context.C) next.set(COMPARE_HIGHLIGHT_C_PARAM, encodeEntity(context.C));
  const extras = (context.pathNodes ?? []).filter(
    (node) => !sameEntity(node, context.A) && !sameEntity(node, context.B) && (!context.C || !sameEntity(node, context.C))
  );
  if (extras.length > 0) {
    next.set(COMPARE_HIGHLIGHT_PATH_PARAM, extras.map(encodeEntity).join(","));
  }
  const facts = pairFacts(context);
  if (facts.length > 0) {
    next.set(COMPARE_HIGHLIGHT_KIND_PARAM, facts.map((pair) => encodeKind(pair.connectionKind)).join(","));
    next.set(COMPARE_HIGHLIGHT_HOP_PARAM, facts.map((pair) => String(pair.hopCount ?? 0)).join(","));
    next.set(
      COMPARE_HIGHLIGHT_VIA_PARAM,
      facts.map((pair) => ((pair.via ?? []).length > 0 ? pair.via.map(encodeEntity).join("+") : "-")).join(",")
    );
  }
  return next;
}

export function parseCompareHighlightSearchParams(params: URLSearchParams): LinkCompareHighlightContext | null {
  const hasAny =
    params.has(COMPARE_HIGHLIGHT_A_PARAM) ||
    params.has(COMPARE_HIGHLIGHT_B_PARAM) ||
    params.has(COMPARE_HIGHLIGHT_C_PARAM) ||
    params.has(COMPARE_HIGHLIGHT_PATH_PARAM);
  if (!hasAny) return null;

  const A = parseEntityToken(params.get(COMPARE_HIGHLIGHT_A_PARAM), true);
  const B = parseEntityToken(params.get(COMPARE_HIGHLIGHT_B_PARAM), true);
  if (!A || !B || sameEntity(A, B)) return null;

  const rawC = params.get(COMPARE_HIGHLIGHT_C_PARAM);
  let C: CompareHighlightEntity | null = null;
  if (rawC != null && rawC.trim() !== "") {
    C = parseEntityToken(rawC, true);
    if (!C || sameEntity(A, C) || sameEntity(B, C)) return null;
  }

  const byKey = new Map<string, CompareHighlightEntity>();
  const add = (entity: CompareHighlightEntity) => {
    const key = compareHighlightEntityKey(entity);
    if (!byKey.has(key)) byKey.set(key, entity);
  };
  add(A);
  add(B);
  if (C) add(C);

  const rawPath = params.get(COMPARE_HIGHLIGHT_PATH_PARAM);
  if (rawPath != null && rawPath.trim() !== "") {
    for (const token of rawPath.split(",")) {
      const entity = parseEntityToken(token, false);
      if (!entity) return null;
      add(entity);
    }
  }
  const pairs = parsePairFacts(params, Boolean(C), add);
  if (byKey.size > COMPARE_HIGHLIGHT_MAX_PATH_NODES) return null;
  return { A, B, C, pathNodes: [...byKey.values()], pairs };
}

function parsePairFacts(
  params: URLSearchParams,
  hasC: boolean,
  add: (entity: CompareHighlightEntity) => void
): CompareHighlightPairFact[] {
  const slots = pairSlots(hasC);
  const kinds = (params.get(COMPARE_HIGHLIGHT_KIND_PARAM) ?? "").split(",").filter(Boolean);
  if (kinds.length !== slots.length) return [];
  const hops = (params.get(COMPARE_HIGHLIGHT_HOP_PARAM) ?? "").split(",");
  const vias = (params.get(COMPARE_HIGHLIGHT_VIA_PARAM) ?? "").split(",");
  const pairs: CompareHighlightPairFact[] = [];
  for (let i = 0; i < slots.length; i += 1) {
    const connectionKind = parseKind(kinds[i] ?? "");
    if (!connectionKind) return [];
    const hopRaw = hops[i]?.trim() ?? "";
    const parsedHop = hopRaw === "" ? null : Number(hopRaw);
    if (hopRaw !== "") {
      if (parsedHop == null || !Number.isInteger(parsedHop) || parsedHop < 0 || parsedHop > 3) return [];
    }
    const hopCount =
      connectionKind === "NONE_KNOWN"
        ? null
        : parsedHop ?? (connectionKind === "DIRECT" ? 1 : 2);
    const via: CompareHighlightEntity[] = [];
    const viaToken = vias[i]?.trim() ?? "";
    if (viaToken && viaToken !== "-") {
      for (const token of viaToken.split("+")) {
        const entity = parseEntityToken(token, false);
        if (!entity) return [];
        add(entity);
        via.push(entity);
      }
    }
    pairs.push({
      left: slots[i]![0],
      right: slots[i]![1],
      connectionKind,
      hopCount: connectionKind === "NONE_KNOWN" ? null : hopCount,
      via,
    });
  }
  return pairs;
}

export function withCompareHighlightParams(href: string, context: LinkCompareHighlightContext | null): string {
  if (!context) return href;
  const queryIndex = href.indexOf("?");
  const path = queryIndex >= 0 ? href.slice(0, queryIndex) : href;
  const current = new URLSearchParams(queryIndex >= 0 ? href.slice(queryIndex + 1) : "");
  const next = serializeCompareHighlightSearchParams(context, current);
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

export function parseCompareInspectSlot(
  params: URLSearchParams,
  context: LinkCompareHighlightContext | null
): CompareHighlightSlot | null {
  if (!context) return null;
  const raw = (params.get(COMPARE_INSPECT_PARAM) ?? "").trim().toUpperCase();
  if (raw === "A") return "A";
  if (raw === "B") return "B";
  if (raw === "C") return context.C ? "C" : null;
  return null;
}

export function withCompareInspectParam(href: string, slot: CompareHighlightSlot | null): string {
  const queryIndex = href.indexOf("?");
  const path = queryIndex >= 0 ? href.slice(0, queryIndex) : href;
  const params = new URLSearchParams(queryIndex >= 0 ? href.slice(queryIndex + 1) : "");
  params.delete(COMPARE_INSPECT_PARAM);
  if (slot) params.set(COMPARE_INSPECT_PARAM, slot);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function compareInspectEntity(
  context: LinkCompareHighlightContext,
  slot: CompareHighlightSlot | null
): CompareHighlightEntity | null {
  if (slot === "A") return context.A;
  if (slot === "B") return context.B;
  if (slot === "C") return context.C;
  return null;
}

export function compareInspectGraphNodeId(
  nodes: Array<Pick<DrugGraphNode, "id" | "type">>,
  context: LinkCompareHighlightContext,
  slot: CompareHighlightSlot | null
): string | null {
  const entity = compareInspectEntity(context, slot);
  if (!entity) return null;
  const typed = nodes.find((node) => node.id === entity.entityId && node.type === entity.entityType);
  if (typed) return typed.id;
  return nodes.find((node) => node.id === entity.entityId)?.id ?? null;
}

export function compareHighlightIdentityKey(context: LinkCompareHighlightContext | null): string {
  if (!context) return "";
  return serializeCompareHighlightSearchParams(context).toString();
}

export function compareHighlightHasC(context: LinkCompareHighlightContext): boolean {
  return Boolean(context.C);
}

function entityByKey(context: LinkCompareHighlightContext): Map<string, CompareHighlightSlot> {
  const map = new Map<string, CompareHighlightSlot>();
  map.set(compareHighlightEntityKey(context.A), "A");
  map.set(compareHighlightEntityKey(context.B), "B");
  if (context.C) map.set(compareHighlightEntityKey(context.C), "C");
  return map;
}

function pathKeySet(context: LinkCompareHighlightContext): Set<string> {
  return new Set((context.pathNodes ?? []).map(compareHighlightEntityKey));
}

export function compareJunctionKeys(context: LinkCompareHighlightContext): Set<string> {
  const keys = new Set<string>();
  for (const pair of pairFacts(context)) {
    for (const via of pair.via ?? []) {
      if (via.entityType === "CASE") keys.add(compareHighlightEntityKey(via));
    }
  }
  if (keys.size === 0) {
    const endpoints = entityByKey(context);
    for (const node of context.pathNodes ?? []) {
      const key = compareHighlightEntityKey(node);
      if (node.entityType === "CASE" && !endpoints.has(key)) keys.add(key);
    }
  }
  return keys;
}

export function classifyCompareHighlightNode(
  node: Pick<DrugGraphNode, "id" | "type">,
  context: LinkCompareHighlightContext
): { role: CompareHighlightNodeRole; slot: CompareHighlightSlot | null; junction: boolean } {
  const key = `${node.type}:${node.id}`;
  const slot = entityByKey(context).get(key) ?? null;
  if (slot) return { role: "endpoint", slot, junction: false };
  if (pathKeySet(context).has(key)) return { role: "path", slot: null, junction: compareJunctionKeys(context).has(key) };
  return { role: "context", slot: null, junction: false };
}

export function compareHighlightGraphNodeIds(
  nodes: Array<Pick<DrugGraphNode, "id" | "type">>,
  context: LinkCompareHighlightContext
): { endpointIds: Set<string>; pathIds: Set<string> } {
  const endpointKeys = entityByKey(context);
  const pathKeys = pathKeySet(context);
  const endpointIds = new Set<string>();
  const pathIds = new Set<string>();
  for (const node of nodes) {
    const key = `${node.type}:${node.id}`;
    if (endpointKeys.has(key)) {
      endpointIds.add(node.id);
      pathIds.add(node.id);
    } else if (pathKeys.has(key)) {
      pathIds.add(node.id);
    }
  }
  return { endpointIds, pathIds };
}

export function isFactualComparePathEdge(
  edge: Pick<DrugGraphEdge, "source" | "target" | "edgeKind" | "relationshipType">,
  pathNodeIds: Set<string>
): boolean {
  if (edge.edgeKind !== "DIRECT") return false;
  if (edge.relationshipType.startsWith("SHARED_")) return false;
  return pathNodeIds.has(edge.source) && pathNodeIds.has(edge.target);
}

export function compareHighlightPathEdgeIds(
  edges: Array<Pick<DrugGraphEdge, "id" | "source" | "target" | "edgeKind" | "relationshipType">>,
  nodes: Array<Pick<DrugGraphNode, "id" | "type">>,
  context: LinkCompareHighlightContext
): Set<string> {
  const { pathIds } = compareHighlightGraphNodeIds(nodes, context);
  const ids = new Set<string>();
  for (const edge of edges) {
    if (isFactualComparePathEdge(edge, pathIds)) ids.add(edge.id);
  }
  return ids;
}

export function comparePairSlotLabel(left: CompareHighlightSlot, right: CompareHighlightSlot): string {
  return `${left} ↔ ${right}`;
}

export function compareIntermediaryCount(
  kind: CompareHighlightConnectionKind,
  hopCount: number | null
): number {
  if (kind !== "INDIRECT") return 0;
  return Math.max(1, (hopCount ?? 2) - 1);
}

export function compareHopExplanationKey(
  kind: CompareHighlightConnectionKind,
  hopCount: number | null
): TranslationKey {
  if (kind === "NONE_KNOWN") return "di.network.compareHopNone";
  if (kind === "DIRECT") return "di.network.compareHopDirect";
  const via = compareIntermediaryCount(kind, hopCount);
  if (via <= 1) return "di.network.compareHopViaOne";
  if (via === 2) return "di.network.compareHopViaTwo";
  return "di.network.compareHopViaCount";
}

export function compareGraphNodeLabel(node: DrugGraphNode): string {
  if (node.metadata.type === "CASE" && node.metadata.caseNumber) return node.metadata.caseNumber;
  return node.label;
}

export type ComparePathPairExplanation = {
  left: CompareHighlightSlot;
  right: CompareHighlightSlot;
  connectionKind: CompareHighlightConnectionKind;
  hopCount: number | null;
  intermediaryCount: number;
  hopKey: TranslationKey;
  viaLabels: string[];
};

export type ComparePathExplanation = {
  slotCount: 2 | 3;
  endpoints: Array<{ slot: CompareHighlightSlot; entityType: DrugGraphNodeType; entityId: string; label: string }>;
  connectingCases: Array<{ entityId: string; label: string }>;
  pairs: ComparePathPairExplanation[];
  bothInConnectingCase: boolean;
  allThreeInConnectingCase: boolean;
};

export function buildComparePathExplanation(
  context: LinkCompareHighlightContext,
  nodes: DrugGraphNode[] | null | undefined = [],
  edges: Array<Pick<DrugGraphEdge, "source" | "target" | "edgeKind" | "relationshipType">> | null | undefined = []
): ComparePathExplanation {
  const byKey = new Map((nodes ?? []).map((node) => [`${node.type}:${node.id}`, node]));
  const graphEdges = edges ?? [];
  const labelFor = (entity: CompareHighlightEntity): string => {
    const node = byKey.get(compareHighlightEntityKey(entity));
    return node ? compareGraphNodeLabel(node) : "";
  };
  const endpoints: ComparePathExplanation["endpoints"] = [
    { slot: "A", entityType: context.A.entityType, entityId: context.A.entityId, label: labelFor(context.A) },
    { slot: "B", entityType: context.B.entityType, entityId: context.B.entityId, label: labelFor(context.B) },
  ];
  if (context.C) {
    endpoints.push({
      slot: "C",
      entityType: context.C.entityType,
      entityId: context.C.entityId,
      label: labelFor(context.C),
    });
  }
  const connectingCases: Array<{ entityId: string; label: string }> = [];
  const seenCase = new Set<string>();
  const addCase = (entity: CompareHighlightEntity) => {
    if (entity.entityType !== "CASE" || seenCase.has(entity.entityId)) return;
    seenCase.add(entity.entityId);
    connectingCases.push({ entityId: entity.entityId, label: labelFor(entity) });
  };
  for (const key of compareJunctionKeys(context)) {
    const split = key.indexOf(":");
    addCase({ entityType: key.slice(0, split) as DrugGraphNodeType, entityId: key.slice(split + 1) });
  }
  const pairs = pairFacts(context).map((pair) => ({
    left: pair.left,
    right: pair.right,
    connectionKind: pair.connectionKind,
    hopCount: pair.hopCount,
    intermediaryCount: compareIntermediaryCount(pair.connectionKind, pair.hopCount),
    hopKey: compareHopExplanationKey(pair.connectionKind, pair.hopCount),
    viaLabels: (pair.via ?? []).map(labelFor).filter(Boolean),
  }));
  const sharedCaseMembership = connectingCases.filter((row) =>
    endpoints.every((endpoint) => {
      if (endpoint.entityId === row.entityId) return true;
      return graphEdges.some((edge) => isFactualComparePathEdge(edge, new Set([row.entityId, endpoint.entityId])));
    })
  );

  return {
    slotCount: context.C ? 3 : 2,
    endpoints,
    connectingCases,
    pairs,
    bothInConnectingCase: !context.C && sharedCaseMembership.length > 0,
    allThreeInConnectingCase: Boolean(context.C && sharedCaseMembership.length > 0),
  };
}

export function formatCompareHopLine(
  pair: ComparePathPairExplanation,
  t: (key: TranslationKey) => string
): string {
  const hop = t(pair.hopKey).replace("{count}", String(pair.intermediaryCount));
  if (pair.connectionKind === "NONE_KNOWN" || pair.viaLabels.length === 0) return hop;
  return `${hop}: ${pair.viaLabels.join(", ")}`;
}

export function formatCompareConnectingSummary(
  explanation: ComparePathExplanation,
  t: (key: TranslationKey) => string
): string[] {
  const lines: string[] = [];
  if (explanation.connectingCases.length === 1) {
    const caseLabel = explanation.connectingCases[0]!.label || explanation.connectingCases[0]!.entityId;
    lines.push(t("di.network.compareConnectingCase").replace("{case}", caseLabel));
    if (explanation.allThreeInConnectingCase) {
      lines.push(t("di.network.compareFoundThreeInCase").replace("{case}", caseLabel));
    } else if (explanation.bothInConnectingCase) {
      lines.push(t("di.network.compareFoundTwoInCase").replace("{case}", caseLabel));
    }
  } else if (explanation.connectingCases.length > 1) {
    const cases = explanation.connectingCases.map((row) => row.label || row.entityId).join(", ");
    lines.push(
      t("di.network.compareConnectingCases")
        .replace("{count}", String(explanation.connectingCases.length))
        .replace("{cases}", cases)
    );
  }
  return lines;
}
