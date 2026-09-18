/**
 * Presentation-only helpers for Network Graph commander readability.
 * Never changes graph semantics, query results, or relationship derivation.
 */

import type { DrugGraphNeighborhoodResponse, DrugGraphNode, DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { LayoutEdgeInput, LayoutNodeInput } from "@/lib/drug_intelligence/drug_network_graph_layout";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const READABLE_TYPE_ORDER: DrugGraphNodeType[] = ["PERSON", "VEHICLE", "CASE", "PHONE", "SIM", "DEVICE", "LOCATION"];

export interface GraphCardNeighborCounts {
  PERSON: number;
  PHONE: number;
  SIM: number;
  DEVICE: number;
  VEHICLE: number;
  CASE: number;
  LOCATION: number;
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function emptyNeighborCounts(): GraphCardNeighborCounts {
  return { PERSON: 0, PHONE: 0, SIM: 0, DEVICE: 0, VEHICLE: 0, CASE: 0, LOCATION: 0 };
}

/** Adjacent entity counts from the already-loaded neighborhood. Never invents records. */
export function neighborCountsForNode(
  nodeId: string,
  nodes: readonly { id: string; type: DrugGraphNodeType }[],
  edges: readonly { source: string; target: string }[],
): GraphCardNeighborCounts {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const counts = emptyNeighborCounts();
  for (const edge of edges) {
    const otherId = edge.source === nodeId ? edge.target : edge.target === nodeId ? edge.source : null;
    if (!otherId) continue;
    const other = byId.get(otherId);
    if (!other) continue;
    counts[other.type] += 1;
  }
  return counts;
}

export function graphCardHidesOpaqueId(value: string): boolean {
  return UUID_LIKE.test(value.trim());
}

export interface GraphReadabilitySummary {
  focusId: string;
  focusType: DrugGraphNodeType;
  focusLabel: string;
  focusSecondaryLabel: string | null;
  directByType: Partial<Record<DrugGraphNodeType, number>>;
  indirectByType: Partial<Record<DrugGraphNodeType, number>>;
  directTotal: number;
  indirectTotal: number;
  inferredEdgeCount: number;
  sharedEntityCount: number;
}

export interface ShortestGraphPath {
  nodeIds: string[];
  edgeIds: string[];
}

export function hopDistances(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  const distance = new Map<string, number>();
  if (!adjacency.has(focusId)) return distance;
  distance.set(focusId, 0);
  const queue = [focusId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distance.get(current)!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, currentDist + 1);
      queue.push(neighbor);
    }
  }
  return distance;
}

export function shortestUndirectedPath(
  fromId: string,
  toId: string,
  edges: Array<{ id: string; source: string; target: string }>,
): ShortestGraphPath | null {
  if (fromId === toId) return { nodeIds: [fromId], edgeIds: [] };
  const adjacency = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
  for (const edge of edges) {
    const a = adjacency.get(edge.source) ?? [];
    a.push({ neighbor: edge.target, edgeId: edge.id });
    adjacency.set(edge.source, a);
    const b = adjacency.get(edge.target) ?? [];
    b.push({ neighbor: edge.source, edgeId: edge.id });
    adjacency.set(edge.target, b);
  }
  const prev = new Map<string, { nodeId: string; edgeId: string }>();
  const seen = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const step of adjacency.get(current) ?? []) {
      if (seen.has(step.neighbor)) continue;
      seen.add(step.neighbor);
      prev.set(step.neighbor, { nodeId: current, edgeId: step.edgeId });
      if (step.neighbor === toId) {
        const nodeIds = [toId];
        const edgeIds: string[] = [];
        let cursor = toId;
        while (cursor !== fromId) {
          const prior = prev.get(cursor)!;
          edgeIds.unshift(prior.edgeId);
          nodeIds.unshift(prior.nodeId);
          cursor = prior.nodeId;
        }
        return { nodeIds, edgeIds };
      }
      queue.push(step.neighbor);
    }
  }
  return null;
}

export function summarizeNeighborhood(neighborhood: DrugGraphNeighborhoodResponse): GraphReadabilitySummary {
  const hops = hopDistances(
    neighborhood.focus.entityId,
    neighborhood.nodes.map((node) => ({ id: node.id, type: node.type })),
    neighborhood.edges.map((edge) => ({ source: edge.source, target: edge.target })),
  );
  const directByType: Partial<Record<DrugGraphNodeType, number>> = {};
  const indirectByType: Partial<Record<DrugGraphNodeType, number>> = {};
  let indirectTotal = 0;
  for (const node of neighborhood.nodes) {
    const hop = hops.get(node.id);
    if (hop === 1) directByType[node.type] = (directByType[node.type] ?? 0) + 1;
    if (hop !== undefined && hop >= 2) {
      indirectByType[node.type] = (indirectByType[node.type] ?? 0) + 1;
      indirectTotal += 1;
    }
  }
  const focus = neighborhood.nodes.find((node) => node.id === neighborhood.focus.entityId);
  return {
    focusId: neighborhood.focus.entityId,
    focusType: neighborhood.focus.entityType,
    focusLabel: focus?.label ?? neighborhood.focus.entityId,
    focusSecondaryLabel: focus?.secondaryLabel ?? null,
    directByType,
    indirectByType,
    directTotal: Object.values(directByType).reduce((sum, count) => sum + count, 0),
    indirectTotal,
    inferredEdgeCount: neighborhood.edges.filter((edge) => edge.edgeKind === "INFERRED").length,
    sharedEntityCount: neighborhood.nodes.filter((node) => node.id !== neighborhood.focus.entityId && node.caseCount >= 2).length,
  };
}

function groupThaiMobile(national: string): string {
  if (national.length === 10) return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  return national;
}

/** Display-only: Thai mobile matching keys 66 + 9 digits become 0XX-XXX-XXXX. */
export function formatReadablePhoneLabel(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length === 11) return groupThaiMobile(`0${digits.slice(2)}`);
  if (digits.length === 10 && digits.startsWith("0")) return groupThaiMobile(digits);
  return raw;
}

/** Display-only: keep long ICCIDs readable on the card. */
export function formatReadableSimLabel(raw: string): string {
  const compact = raw.replace(/\s/g, "");
  if (compact.length <= 12) return raw;
  return `${compact.slice(0, 4)}…${compact.slice(-4)}`;
}

export function formatGraphNodeCard(node: DrugGraphNode): { title: string; subtitle: string | null; titleTitle: string } {
  if (node.type === "PHONE") {
    const title = formatReadablePhoneLabel(node.label);
    return { title, subtitle: node.secondaryLabel, titleTitle: node.label };
  }
  if (node.type === "SIM") {
    return { title: formatReadableSimLabel(node.label), subtitle: node.secondaryLabel, titleTitle: node.label };
  }
  if (node.type === "DEVICE") {
    const meta = node.metadata.type === "DEVICE" ? node.metadata : null;
    const model = [meta?.brand, meta?.model].filter(Boolean).join(" ");
    const digits = node.label.replace(/\D/g, "");
    const imei = digits.length >= 14 ? `IMEI …${digits.slice(-4)}` : null;
    if (model) return { title: model, subtitle: imei, titleTitle: node.label };
    if (digits.length >= 14 && node.secondaryLabel) {
      return { title: node.secondaryLabel, subtitle: imei, titleTitle: node.label };
    }
    if (imei) return { title: imei, subtitle: node.secondaryLabel, titleTitle: node.label };
  }
  if (node.type === "VEHICLE") {
    const meta = node.metadata.type === "VEHICLE" ? node.metadata : null;
    const detail = [meta?.brand, meta?.model, meta?.color].filter(Boolean).join(" / ");
    return { title: node.label, subtitle: detail || node.secondaryLabel, titleTitle: node.label };
  }
  if (node.type === "CASE") {
    const meta = node.metadata.type === "CASE" ? node.metadata : null;
    return { title: meta?.caseNumber || node.label, subtitle: meta?.province || node.secondaryLabel, titleTitle: node.label };
  }
  if (node.type === "LOCATION") {
    const meta = node.metadata.type === "LOCATION" ? node.metadata : null;
    const place = [meta?.district, meta?.province].filter(Boolean).join(" • ");
    return { title: node.label, subtitle: place || node.secondaryLabel, titleTitle: node.label };
  }
  if (node.type === "PERSON" && graphCardHidesOpaqueId(node.label)) {
    return { title: node.secondaryLabel || "", subtitle: null, titleTitle: node.label };
  }
  return { title: node.label, subtitle: node.secondaryLabel, titleTitle: node.label };
}

export function isSharedEntity(node: DrugGraphNode, isFocus: boolean): boolean {
  return !isFocus && node.caseCount >= 2;
}

/** True when the edge touches the current focus entity. Presentation only. */
export function isFocusDirectEdge(focusId: string, edge: { source: string; target: string }): boolean {
  return edge.source === focusId || edge.target === focusId;
}

export const CARD_GRAPH_FOCUS_DIRECT_STROKE = 1.7;
export const CARD_GRAPH_FOCUS_DIRECT_OPACITY = 0.92;
export const CARD_GRAPH_SECONDARY_STROKE = 1;
export const CARD_GRAPH_SECONDARY_OPACITY = 0.28;
export const CARD_GRAPH_SELECTED_INCIDENT_STROKE = 2;
export const CARD_GRAPH_UNRELATED_OPACITY = 0.16;
export const CARD_GRAPH_FOCUS_DIRECT_WHEN_OTHER_SELECTED_OPACITY = 0.34;

export function shouldShowEdgeLabel(args: {
  labelMode: "ALL" | "SELECTED_ONLY" | "HIDDEN";
  edgeKind: "DIRECT" | "INFERRED";
  isSelected: boolean;
  touchesSelectedNode: boolean;
  isHovered: boolean;
  touchesHoveredNode: boolean;
  onSelectedPath?: boolean;
  /** When false, ALL mode hides the label until hover/selection. Omitted keeps legacy ALL=always. */
  isFocusDirect?: boolean;
  /** When true, ALL mode shows labels only for the active selection/hover, not every focus-direct edge. */
  hasCanvasSelection?: boolean;
}): boolean {
  if (args.labelMode === "HIDDEN") return false;
  const contextual =
    args.isSelected || args.touchesSelectedNode || args.isHovered || args.touchesHoveredNode || Boolean(args.onSelectedPath);
  if (args.labelMode === "ALL") {
    if (args.hasCanvasSelection) return contextual;
    if (args.isFocusDirect === false) return contextual;
    return true;
  }
  if (args.edgeKind === "INFERRED") return true;
  return contextual;
}

export function appearanceReasonKey(args: {
  isFocus: boolean;
  hopDistance: number | undefined;
  relationshipTypes: readonly DrugGraphRelationshipType[];
}): TranslationKey {
  if (args.isFocus || args.hopDistance === 0) return "di.network.reasonFocus";
  if (args.hopDistance === 1) return "di.network.reasonDirect";
  if (args.relationshipTypes.includes("SHARED_SIM")) return "di.network.reasonSharedSim";
  if (args.relationshipTypes.includes("SHARED_PHONE")) return "di.network.reasonSharedPhone";
  if (args.relationshipTypes.includes("SHARED_VEHICLE")) return "di.network.reasonSharedVehicle";
  if (args.relationshipTypes.includes("SHARED_DEVICE")) return "di.network.reasonSharedDevice";
  if (args.relationshipTypes.includes("SHARED_CASE")) return "di.network.reasonSharedCase";
  if (args.relationshipTypes.includes("CASE_LOCATION")) return "di.network.reasonSharedLocation";
  return "di.network.reasonIndirect";
}

export function connectingRelationshipTypes(
  nodeId: string,
  edges: DrugGraphNeighborhoodResponse["edges"],
): DrugGraphRelationshipType[] {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId).map((edge) => edge.relationshipType);
}

export interface SelectedPathStep {
  id: string;
  label: string;
  type: DrugGraphNodeType;
}

/** Entity sequence along the existing undirected selected path. Labels come from the loaded neighborhood only. */
export function selectedPathSteps(
  neighborhood: DrugGraphNeighborhoodResponse,
  selectedNodeId: string | null,
): SelectedPathStep[] {
  if (!selectedNodeId || selectedNodeId === neighborhood.focus.entityId) return [];
  const path = shortestUndirectedPath(neighborhood.focus.entityId, selectedNodeId, neighborhood.edges);
  if (!path) return [];
  return path.nodeIds.map((id) => {
    const node = neighborhood.nodes.find((item) => item.id === id);
    return {
      id,
      label: node?.label ?? id,
      type: node?.type ?? neighborhood.focus.entityType,
    };
  });
}
