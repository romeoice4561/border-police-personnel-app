/**
 * DI-8.4 — Explainable Network Path model (presentation + path enumeration).
 *
 * Reuses the loaded neighborhood edge set (same undirected topology as
 * `shortestUndirectedPath`). Does not invent edges, proximity links, or
 * external proof. Labels come from existing relationship short/op keys.
 */

import type {
  DrugGraphEdge,
  DrugGraphNeighborhoodResponse,
  DrugGraphNode,
  DrugGraphNodeType,
  DrugGraphRelationshipType,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import { DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { formatReadablePhoneLabel } from "@/lib/drug_intelligence/drug_network_graph_readability";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const DRUG_NETWORK_EXPLAIN_MAX_PATHS = 3;
export const DRUG_NETWORK_EXPLAIN_ENUM_CAP = 12;

export interface NetworkPathStepExplanation {
  nodeId: string;
  entityType: DrugGraphNodeType;
  label: string;
  secondaryLabel: string | null;
  /** Relationship that reached this step from the previous node; null on origin. */
  viaRelationshipType: DrugGraphRelationshipType | null;
  viaEdgeKind: "DIRECT" | "INFERRED" | null;
  viaEdgeId: string | null;
  viaLabelKey: TranslationKey | null;
  supportingCaseIds: string[];
}

export interface NetworkExplainedPath {
  nodeIds: string[];
  edgeIds: string[];
  hopCount: number;
  steps: NetworkPathStepExplanation[];
  /** Stable signature for dedupe / tests. */
  signature: string;
}

export interface NetworkPathExplanation {
  focusId: string;
  focusLabel: string;
  focusType: DrugGraphNodeType;
  selectedId: string;
  selectedLabel: string;
  selectedType: DrugGraphNodeType;
  paths: NetworkExplainedPath[];
  truncated: boolean;
  isDirect: boolean;
  hopCount: number;
  /** Compact card hint for the selected node, e.g. "ผ่าน DI-TEST-001". */
  viaHint: string | null;
  /** Additional equal-length alternatives beyond the canonical path. */
  alternativeCount: number;
}

function edgeBetween(
  edges: readonly DrugGraphEdge[],
  a: string,
  b: string,
): DrugGraphEdge | null {
  return (
    edges.find(
      (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a),
    ) ?? null
  );
}

function displayLabel(node: DrugGraphNode | undefined, fallback: string): string {
  if (!node) return fallback;
  if (node.type === "PHONE") return formatReadablePhoneLabel(node.label);
  return node.label;
}

/**
 * Directional path-step labels for Inspector. Prefer precise Thai wording
 * when from→to types are known; never invent stronger semantics than the
 * stored relationship type supports. Falls back to canvas short labels.
 */
export function pathStepRelationLabelKey(
  fromType: DrugGraphNodeType,
  toType: DrugGraphNodeType,
  relationshipType: DrugGraphRelationshipType | null,
): TranslationKey | null {
  if (!relationshipType) return null;
  if (relationshipType === "PERSON_CASE") {
    if (fromType === "CASE" && toType === "PERSON") return "di.network.pathRelCasePerson";
    return "di.network.relOpPersonCase";
  }
  if (relationshipType === "PERSON_PHONE") {
    if (fromType === "PHONE" && toType === "PERSON") return "di.network.pathRelPhonePerson";
    return "di.network.relOpPersonPhone";
  }
  if (relationshipType === "PERSON_SIM") return "di.network.relOpPersonSim";
  if (relationshipType === "PERSON_DEVICE") return "di.network.relOpPersonDevice";
  if (relationshipType === "PERSON_VEHICLE") return "di.network.pathRelPersonVehicle";
  if (relationshipType === "CASE_PHONE") return "di.network.pathRelCasePhone";
  if (relationshipType === "CASE_SIM") return "di.network.pathRelCaseSim";
  if (relationshipType === "CASE_DEVICE") return "di.network.pathRelCaseDevice";
  if (relationshipType === "CASE_VEHICLE") return "di.network.pathRelCaseVehicle";
  if (relationshipType === "CASE_LOCATION") return "di.network.relOpFoundAt";
  return DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY[relationshipType] ?? null;
}

function viaLabelKeyFor(
  fromType: DrugGraphNodeType,
  toType: DrugGraphNodeType,
  type: DrugGraphRelationshipType | null,
): TranslationKey | null {
  return pathStepRelationLabelKey(fromType, toType, type);
}

/** True when the path is a classic shared-entity bridge (A → shared → B). */
export function isSharedEntityPath(path: NetworkExplainedPath): boolean {
  if (path.hopCount !== 2 || path.steps.length !== 3) return false;
  const [a, mid, b] = path.steps;
  if (!a || !mid || !b) return false;
  if (a.entityType !== "PERSON" || b.entityType !== "PERSON") return false;
  return mid.entityType === "PHONE"
    || mid.entityType === "SIM"
    || mid.entityType === "DEVICE"
    || mid.entityType === "VEHICLE"
    || mid.entityType === "CASE"
    || mid.viaRelationshipType?.startsWith("SHARED_") === true;
}

function pathSignature(nodeIds: string[], edgeIds: string[]): string {
  return `${nodeIds.join(">")}|${edgeIds.join(",")}`;
}

/**
 * Enumerate bounded undirected simple paths from focus → selected.
 * Prefer shorter paths, then stable edge-relationship signatures.
 */
export function enumerateUndirectedPaths(args: {
  fromId: string;
  toId: string;
  edges: readonly DrugGraphEdge[];
  maxPaths?: number;
  enumCap?: number;
}): { paths: Array<{ nodeIds: string[]; edgeIds: string[] }>; truncated: boolean } {
  const maxPaths = Math.min(Math.max(1, args.maxPaths ?? DRUG_NETWORK_EXPLAIN_MAX_PATHS), DRUG_NETWORK_EXPLAIN_MAX_PATHS);
  const enumCap = Math.max(maxPaths, args.enumCap ?? DRUG_NETWORK_EXPLAIN_ENUM_CAP);
  const { fromId, toId, edges } = args;
  if (fromId === toId) return { paths: [{ nodeIds: [fromId], edgeIds: [] }], truncated: false };

  const adj = new Map<string, Array<{ neighbor: string; edgeId: string; relationshipType: string }>>();
  for (const edge of edges) {
    const a = adj.get(edge.source) ?? [];
    a.push({ neighbor: edge.target, edgeId: edge.id, relationshipType: edge.relationshipType });
    adj.set(edge.source, a);
    const b = adj.get(edge.target) ?? [];
    b.push({ neighbor: edge.source, edgeId: edge.id, relationshipType: edge.relationshipType });
    adj.set(edge.target, b);
  }

  type Trace = { nodeIds: string[]; edgeIds: string[]; relSeq: string[] };
  const found: Trace[] = [];
  let truncated = false;

  const dfs = (nodeId: string, chain: Trace, used: Set<string>) => {
    if (found.length >= enumCap) {
      truncated = true;
      return;
    }
    if (nodeId === toId && chain.nodeIds.length > 1) {
      found.push({
        nodeIds: [...chain.nodeIds],
        edgeIds: [...chain.edgeIds],
        relSeq: [...chain.relSeq],
      });
      return;
    }
    // Soft depth: neighborhood is already bounded; still avoid runaway.
    if (chain.nodeIds.length > 6) return;
    for (const step of adj.get(nodeId) ?? []) {
      if (used.has(step.neighbor)) continue;
      used.add(step.neighbor);
      chain.nodeIds.push(step.neighbor);
      chain.edgeIds.push(step.edgeId);
      chain.relSeq.push(step.relationshipType);
      dfs(step.neighbor, chain, used);
      chain.nodeIds.pop();
      chain.edgeIds.pop();
      chain.relSeq.pop();
      used.delete(step.neighbor);
      if (found.length >= enumCap) {
        truncated = true;
        return;
      }
    }
  };

  dfs(fromId, { nodeIds: [fromId], edgeIds: [], relSeq: [] }, new Set([fromId]));

  found.sort((a, b) => {
    if (a.edgeIds.length !== b.edgeIds.length) return a.edgeIds.length - b.edgeIds.length;
    const sa = a.relSeq.join("|");
    const sb = b.relSeq.join("|");
    if (sa !== sb) return sa.localeCompare(sb);
    return a.nodeIds.join(">").localeCompare(b.nodeIds.join(">"));
  });

  const seen = new Set<string>();
  const unique: Array<{ nodeIds: string[]; edgeIds: string[] }> = [];
  for (const trace of found) {
    const sig = pathSignature(trace.nodeIds, trace.edgeIds);
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push({ nodeIds: trace.nodeIds, edgeIds: trace.edgeIds });
  }

  const selected = unique.slice(0, maxPaths);
  return {
    paths: selected,
    truncated: truncated || unique.length > maxPaths,
  };
}

function hydratePath(
  neighborhood: DrugGraphNeighborhoodResponse,
  raw: { nodeIds: string[]; edgeIds: string[] },
): NetworkExplainedPath {
  const byId = new Map(neighborhood.nodes.map((n) => [n.id, n]));
  const steps: NetworkPathStepExplanation[] = raw.nodeIds.map((nodeId, index) => {
    const node = byId.get(nodeId);
    if (index === 0) {
      return {
        nodeId,
        entityType: node?.type ?? neighborhood.focus.entityType,
        label: displayLabel(node, nodeId),
        secondaryLabel: node?.secondaryLabel ?? null,
        viaRelationshipType: null,
        viaEdgeKind: null,
        viaEdgeId: null,
        viaLabelKey: null,
        supportingCaseIds: [],
      };
    }
    const prevId = raw.nodeIds[index - 1]!;
    const prevNode = byId.get(prevId);
    const edge = edgeBetween(neighborhood.edges, prevId, nodeId);
    const viaType = edge?.relationshipType ?? null;
    const fromType = prevNode?.type ?? neighborhood.focus.entityType;
    const toType = node?.type ?? "CASE";
    return {
      nodeId,
      entityType: toType,
      label: displayLabel(node, nodeId),
      secondaryLabel: node?.secondaryLabel ?? null,
      viaRelationshipType: viaType,
      viaEdgeKind: edge?.edgeKind ?? null,
      viaEdgeId: edge?.id ?? raw.edgeIds[index - 1] ?? null,
      viaLabelKey: viaLabelKeyFor(fromType, toType, viaType),
      supportingCaseIds: edge?.sourceCaseIds ?? [],
    };
  });
  return {
    nodeIds: raw.nodeIds,
    edgeIds: raw.edgeIds,
    hopCount: Math.max(0, raw.nodeIds.length - 1),
    steps,
    signature: pathSignature(raw.nodeIds, raw.edgeIds),
  };
}

/** Intermediate entity used for the tiny "ผ่าน …" card hint. */
export function viaHintFromPath(path: NetworkExplainedPath | null | undefined): string | null {
  if (!path || path.steps.length < 3) return null;
  const mid = path.steps[path.steps.length - 2];
  if (!mid || mid.nodeId === path.steps[0]?.nodeId) return null;
  return mid.label;
}

export function explainFocusToSelectedPaths(
  neighborhood: DrugGraphNeighborhoodResponse,
  selectedNodeId: string,
  options?: { maxPaths?: number },
): NetworkPathExplanation | null {
  const focusId = neighborhood.focus.entityId;
  if (!selectedNodeId || selectedNodeId === focusId) return null;
  const focusNode = neighborhood.nodes.find((n) => n.id === focusId);
  const selectedNode = neighborhood.nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const enumerated = enumerateUndirectedPaths({
    fromId: focusId,
    toId: selectedNodeId,
    edges: neighborhood.edges,
    maxPaths: options?.maxPaths ?? DRUG_NETWORK_EXPLAIN_MAX_PATHS,
  });
  if (enumerated.paths.length === 0) return null;

  const paths = enumerated.paths.map((raw) => hydratePath(neighborhood, raw));
  const canonical = paths[0]!;
  const alternativeCount = Math.max(0, paths.length - 1);

  return {
    focusId,
    focusLabel: displayLabel(focusNode, focusId),
    focusType: focusNode?.type ?? neighborhood.focus.entityType,
    selectedId: selectedNodeId,
    selectedLabel: displayLabel(selectedNode, selectedNodeId),
    selectedType: selectedNode.type,
    paths,
    truncated: enumerated.truncated,
    isDirect: canonical.hopCount === 1,
    hopCount: canonical.hopCount,
    viaHint: viaHintFromPath(canonical),
    alternativeCount,
  };
}

/** Hop-band / badge copy keys — clearer commander wording (display only). */
export function networkHopBandKey(hopDistance: number): TranslationKey {
  if (hopDistance <= 1) return "di.network.hopBandOne";
  if (hopDistance === 2) return "di.network.hopBandTwo";
  return "di.network.hopBandThree";
}

export function networkHopBadgeKey(hopDistance: number): TranslationKey {
  if (hopDistance <= 1) return "di.network.hopBadgeOne";
  if (hopDistance === 2) return "di.network.hopBadgeTwo";
  return "di.network.hopBadgeThree";
}

export function networkPathSummaryKey(
  explanation: NetworkPathExplanation,
  pathIndex = 0,
): TranslationKey {
  const path = explanation.paths[pathIndex] ?? explanation.paths[0];
  if (!path) return "di.network.pathNoPath";
  if (path.hopCount === 1) return "di.network.pathSummaryDirect";
  if (isSharedEntityPath(path)) return "di.network.pathSummaryShared";
  if (viaHintFromPath(path)) return "di.network.pathSummaryIndirectVia";
  return "di.network.pathSummaryIndirect";
}

/** Fill summary template placeholders from path semantics (no hardcoding). */
export function formatNetworkPathSummary(
  explanation: NetworkPathExplanation,
  translate: (key: TranslationKey) => string,
  pathIndex = 0,
): string {
  const path = explanation.paths[pathIndex] ?? explanation.paths[0];
  if (!path) return translate("di.network.pathNoPath");
  const key = networkPathSummaryKey(explanation, pathIndex);
  const via = viaHintFromPath(path);
  const template = translate(key);
  if (key === "di.network.pathSummaryDirect") return template;
  if (key === "di.network.pathSummaryShared") {
    return template.replace("{via}", via ?? path.steps[1]?.label ?? "—");
  }
  if (key === "di.network.pathSummaryIndirectVia") {
    return template
      .replace("{selected}", explanation.selectedLabel)
      .replace("{focus}", explanation.focusLabel)
      .replace("{via}", via ?? "—")
      .replace("{hops}", String(path.hopCount));
  }
  return template
    .replace("{selected}", explanation.selectedLabel)
    .replace("{focus}", explanation.focusLabel)
    .replace("{hops}", String(path.hopCount));
}

/** Compact via hints for every loaded hop≥2 node (shortest path). */
export function viaHintsForNeighborhood(
  neighborhood: DrugGraphNeighborhoodResponse,
): Map<string, string> {
  const focusId = neighborhood.focus.entityId;
  const hints = new Map<string, string>();
  for (const node of neighborhood.nodes) {
    if (node.id === focusId) continue;
    const enumerated = enumerateUndirectedPaths({
      fromId: focusId,
      toId: node.id,
      edges: neighborhood.edges,
      maxPaths: 1,
    });
    const raw = enumerated.paths[0];
    if (!raw || raw.nodeIds.length < 3) continue;
    const path = hydratePath(neighborhood, raw);
    const hint = viaHintFromPath(path);
    if (hint) hints.set(node.id, hint);
  }
  return hints;
}

/** Supporting case ids across one path (deduped, stable order). */
export function supportingCaseIdsFromPath(path: NetworkExplainedPath | null | undefined): string[] {
  if (!path) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const step of path.steps) {
    for (const id of step.supportingCaseIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    if (step.entityType === "CASE" && !seen.has(step.nodeId)) {
      seen.add(step.nodeId);
      out.push(step.nodeId);
    }
  }
  return out;
}

/** Why-this-appears heading uses selected entity type. */
export function networkPathWhyHeadingKey(entityType: DrugGraphNodeType): TranslationKey {
  if (entityType === "PHONE") return "di.network.pathWhyPhone";
  if (entityType === "CASE") return "di.network.pathWhyCase";
  if (entityType === "PERSON") return "di.network.pathWhyPerson";
  if (entityType === "SIM") return "di.network.pathWhySim";
  if (entityType === "DEVICE") return "di.network.pathWhyDevice";
  if (entityType === "VEHICLE") return "di.network.pathWhyVehicle";
  return "di.network.pathWhyGeneric";
}
