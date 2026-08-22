/**
 * Pure adapter: DrugGraphNeighborhoodResponse -> @xyflow/react node/edge
 * shapes (Phase DI-5.1). Extracted out of the page component so it's
 * independently testable and so the selected/focus-state wiring bug found
 * during DI-5.1 review (xyflow's `selected` flag was never actually set on
 * a clicked node, so the "selected" ring never appeared) has a single,
 * verifiable place to be correct. No React import — pure data in, data out.
 */

import { MarkerType, type Node, type Edge } from "@xyflow/react";
import { computeRadialLayout } from "@/lib/drug_intelligence/drug_network_graph_layout";
import { DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNeighborhoodResponse, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export interface DrugNetworkFlowNodeData extends Record<string, unknown> {
  graphNode: DrugGraphNode;
  isFocus: boolean;
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
  label: string;
  style: { stroke: string; strokeDasharray?: string };
  markerEnd: { type: MarkerType };
  labelStyle: { fontSize: number };
}

/**
 * Builds the @xyflow/react node/edge arrays for one neighborhood response.
 * `selectedNodeId`/`selectedEdgeId` mark the currently-open-in-drawer
 * entity so its canvas element renders with a visible selected ring — this
 * is the fix for the DI-5.1-discovered bug where clicking a node never
 * actually set xyflow's own `selected` state.
 */
export function buildDrugNetworkFlowGraph(
  neighborhood: DrugGraphNeighborhoodResponse,
  translateShortLabel: (key: TranslationKey) => string,
  selectedNodeId: string | null,
  selectedEdgeId: string | null
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } {
  const positions = computeRadialLayout(
    neighborhood.focus.entityId,
    neighborhood.nodes.map((n) => ({ id: n.id })),
    neighborhood.edges.map((e) => ({ source: e.source, target: e.target }))
  );

  const flowNodes: FlowNode[] = neighborhood.nodes.map((n) => ({
    id: n.id,
    type: "drugGraphNode",
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    selected: n.id === selectedNodeId,
    data: { graphNode: n, isFocus: n.id === neighborhood.focus.entityId },
  }));

  const flowEdges: FlowEdge[] = neighborhood.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    selected: e.id === selectedEdgeId,
    label: translateShortLabel(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY[e.relationshipType]),
    style: e.edgeKind === "INFERRED" ? { stroke: "var(--color-warning, #b45309)", strokeDasharray: "5 5" } : { stroke: "var(--color-accent, #2563eb)" },
    markerEnd: { type: MarkerType.ArrowClosed },
    labelStyle: { fontSize: 10 },
  }));

  return { flowNodes, flowEdges };
}
