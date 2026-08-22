/**
 * Pure adapter: DrugGraphNeighborhoodResponse -> @xyflow/react node/edge
 * shapes (Phase DI-5.1; extended by Phase DI-5.3 with layout-mode
 * dispatch, label-density, node-density, and focus-neighbor-emphasis
 * dimming). Extracted out of the page component so it's independently
 * testable and so the selected/focus-state wiring bug found during DI-5.1
 * review (xyflow's `selected` flag was never actually set on a clicked
 * node, so the "selected" ring never appeared) has a single, verifiable
 * place to be correct. No React import — pure data in, data out.
 */

import { MarkerType, type Node, type Edge } from "@xyflow/react";
import {
  computeLayoutForMode,
  edgeTypeForLayoutMode,
  type DrugNetworkLayoutMode,
  type LayoutNodeInput,
} from "@/lib/drug_intelligence/drug_network_graph_layout";
import { DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNeighborhoodResponse, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export type DrugNetworkLabelMode = "ALL" | "SELECTED_ONLY" | "HIDDEN";
export type DrugNetworkNodeDensity = "STANDARD" | "COMPACT";

export interface DrugNetworkFlowNodeData extends Record<string, unknown> {
  graphNode: DrugGraphNode;
  isFocus: boolean;
  /** Section 16: Compact node display shows icon + short label only — full detail always stays available in the drawer. */
  density: DrugNetworkNodeDensity;
  /** Section 17: dims (never removes) nodes not directly connected to the current selection. Always false when nothing is selected. */
  dimmed: boolean;
}

export interface FlowNode extends Node {
  id: string;
  type: "drugGraphNode";
  position: { x: number; y: number };
  selected: boolean;
  data: DrugNetworkFlowNodeData;
}

export interface FlowEdge extends Edge {
  id: string;
  source: string;
  target: string;
  selected: boolean;
  type: "smoothstep" | "step" | "default";
  label: string;
  style: { stroke: string; strokeDasharray?: string; opacity?: number };
  markerEnd: { type: MarkerType };
  labelStyle: { fontSize: number };
  labelBgStyle: { fillOpacity: number };
  labelBgPadding: [number, number];
  labelBgBorderRadius: number;
  zIndex?: number;
}

export interface BuildFlowGraphOptions {
  layoutMode: Exclude<DrugNetworkLayoutMode, "AUTO">;
  labelMode: DrugNetworkLabelMode;
  nodeDensity: DrugNetworkNodeDensity;
  /** Present only for the PATH layout mode — the ordered node ids of the found path (Section 10). */
  pathNodeIdsInOrder?: string[];
}

function toLayoutNode(n: DrugGraphNode): LayoutNodeInput {
  return { id: n.id, type: n.type };
}

/**
 * Builds the @xyflow/react node/edge arrays for one neighborhood response
 * under a given layout mode + display-density configuration.
 * `selectedNodeId`/`selectedEdgeId` mark the currently-open-in-drawer
 * entity so its canvas element renders with a visible selected ring — this
 * is the fix for the DI-5.1-discovered bug where clicking a node never
 * actually set xyflow's own `selected` state.
 *
 * Section 17: when a node is selected, every OTHER node/edge not directly
 * connected to it is dimmed (opacity, never removed or hidden) so the
 * analyst can trace exactly what's connected without losing the rest of
 * the picture.
 */
export function buildDrugNetworkFlowGraph(
  neighborhood: DrugGraphNeighborhoodResponse,
  translateShortLabel: (key: TranslationKey) => string,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  options: BuildFlowGraphOptions
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } {
  const positions = computeLayoutForMode(
    options.layoutMode,
    neighborhood.focus.entityId,
    neighborhood.nodes.map(toLayoutNode),
    neighborhood.edges.map((e) => ({ source: e.source, target: e.target })),
    options.pathNodeIdsInOrder
  );

  const directlyConnectedIds = selectedNodeId ? connectedNodeIds(selectedNodeId, neighborhood.edges) : null;

  const flowNodes: FlowNode[] = neighborhood.nodes.map((n) => ({
    id: n.id,
    type: "drugGraphNode",
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    selected: n.id === selectedNodeId,
    data: {
      graphNode: n,
      isFocus: n.id === neighborhood.focus.entityId,
      density: options.nodeDensity,
      dimmed: directlyConnectedIds ? !directlyConnectedIds.has(n.id) : false,
    },
  }));

  const edgeType = edgeTypeForLayoutMode(options.layoutMode);

  const flowEdges: FlowEdge[] = neighborhood.edges.map((e) => {
    const isSelected = e.id === selectedEdgeId;
    const touchesSelection = selectedNodeId ? e.source === selectedNodeId || e.target === selectedNodeId : true;
    const showLabel = options.labelMode === "ALL" || (options.labelMode === "SELECTED_ONLY" && (isSelected || touchesSelection));
    const baseColor = e.edgeKind === "INFERRED" ? "var(--color-warning, #b45309)" : "var(--color-accent, #2563eb)";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      selected: isSelected,
      type: edgeType,
      label: options.labelMode === "HIDDEN" ? "" : showLabel ? translateShortLabel(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY[e.relationshipType]) : "",
      style: {
        stroke: baseColor,
        ...(e.edgeKind === "INFERRED" ? { strokeDasharray: "5 5" } : {}),
        opacity: touchesSelection ? 1 : 0.25,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
      labelStyle: { fontSize: 10 },
      labelBgStyle: { fillOpacity: 0.85 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 3,
      // Only ever elevate an edge when a node IS selected and this edge
      // touches it — with no selection, every edge must stay at the
      // default stacking level so nodes remain on top and clickable/
      // draggable. Giving every edge zIndex:5 unconditionally (the DI-5.3.1
      // bug) put edge SVG paths above node DOM elements, so any node with
      // several edges converging on it (e.g. the focus node) became
      // unclickable/undraggable at most of its surface — edges intercepted
      // the pointer before it ever reached the node.
      zIndex: selectedNodeId ? (isSelected ? 10 : touchesSelection ? 5 : 0) : undefined,
    };
  });

  return { flowNodes, flowEdges };
}

/** The focus node's own id, plus every node reachable via exactly one edge from it — Section 17's "directly connected" set. */
function connectedNodeIds(nodeId: string, edges: DrugGraphNeighborhoodResponse["edges"]): Set<string> {
  const ids = new Set<string>([nodeId]);
  for (const e of edges) {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  }
  return ids;
}

/**
 * Merges freshly-built node positions with whatever positions are already on
 * screen (Phase DI-5.3, Section 12: manual drag positions must survive a
 * re-render caused by selection/click alone, but must reset when the
 * underlying query — focus/depth/filters, or the layout mode itself —
 * changes). Pure: no xyflow/React import, so it's testable without a DOM or
 * provider.
 */
export function mergePreservingManualPositions(nextNodes: FlowNode[], currentNodes: FlowNode[], resetPositions: boolean): FlowNode[] {
  if (resetPositions) return nextNodes;
  const positionById = new Map(currentNodes.map((n) => [n.id, n.position]));
  return nextNodes.map((n) => {
    const preserved = positionById.get(n.id);
    return preserved ? { ...n, position: preserved } : n;
  });
}
