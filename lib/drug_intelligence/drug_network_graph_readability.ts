/**
 * Presentation-only helpers for Network Graph commander readability.
 * Never changes graph semantics, query results, or relationship derivation.
 */

import type { DrugGraphNeighborhoodResponse, DrugGraphNode, DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { LayoutEdgeInput, LayoutNodeInput } from "@/lib/drug_intelligence/drug_network_graph_layout";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const READABLE_TYPE_ORDER: DrugGraphNodeType[] = ["CASE", "PHONE", "SIM", "DEVICE", "VEHICLE", "PERSON", "LOCATION"];

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

/** Display-only: Thai mobile matching keys 66 + 9 digits become 0XXXXXXXXX. */
export function formatReadablePhoneLabel(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length === 11) return `0${digits.slice(2)}`;
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
    const digits = node.label.replace(/\D/g, "");
    if (digits.length >= 14 && node.secondaryLabel) {
      return { title: node.secondaryLabel, subtitle: `IMEI …${digits.slice(-4)}`, titleTitle: node.label };
    }
    if (digits.length >= 14) {
      return { title: `IMEI …${digits.slice(-4)}`, subtitle: node.secondaryLabel, titleTitle: node.label };
    }
  }
  return { title: node.label, subtitle: node.secondaryLabel, titleTitle: node.label };
}

export function isSharedEntity(node: DrugGraphNode, isFocus: boolean): boolean {
  return !isFocus && node.caseCount >= 2;
}

export function shouldShowEdgeLabel(args: {
  labelMode: "ALL" | "SELECTED_ONLY" | "HIDDEN";
  edgeKind: "DIRECT" | "INFERRED";
  isSelected: boolean;
  touchesSelectedNode: boolean;
  isHovered: boolean;
  touchesHoveredNode: boolean;
  onSelectedPath?: boolean;
}): boolean {
  if (args.labelMode === "HIDDEN") return false;
  if (args.labelMode === "ALL") return true;
  if (args.edgeKind === "INFERRED") return true;
  return args.isSelected || args.touchesSelectedNode || args.isHovered || args.touchesHoveredNode || Boolean(args.onSelectedPath);
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
