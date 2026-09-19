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
  computeGroupByHopLayout,
  computeLayoutForMode,
  computeVerticalPathLayout,
  edgeTypeForLayoutMode,
  type DrugNetworkLayoutMode,
  type LayoutNodeInput,
} from "@/lib/drug_intelligence/drug_network_graph_layout";
import type { NetworkDepthCanvasArrangement } from "@/lib/drug_intelligence/drug_network_depth_view";
import {
  DRUG_GRAPH_RELATIONSHIP_LABEL_KEY,
  DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY,
} from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { createDefaultEdgeRoute, type DrugNetworkEdgeRouteState, type DrugNetworkEdgeRoutes } from "@/lib/drug_intelligence/drug_network_edge_routing";
import {
  CARD_GRAPH_FOCUS_DIRECT_OPACITY,
  CARD_GRAPH_FOCUS_DIRECT_STROKE,
  CARD_GRAPH_FOCUS_DIRECT_WHEN_OTHER_SELECTED_OPACITY,
  CARD_GRAPH_SECONDARY_OPACITY,
  CARD_GRAPH_SECONDARY_STROKE,
  CARD_GRAPH_SELECTED_INCIDENT_STROKE,
  CARD_GRAPH_UNRELATED_OPACITY,
  EDGE_LABEL_BG_PADDING,
  EDGE_SMOOTHSTEP_BASE_OFFSET,
  edgeLabelCorridorKey,
  edgeLabelOffsetPx,
  edgeSmoothStepPathOffset,
  hopDistances,
  isFocusDirectEdge,
  isSharedEntity,
  neighborCountsForNode,
  shortestUndirectedPath,
  shouldShowEdgeLabel,
  type GraphCardNeighborCounts,
} from "@/lib/drug_intelligence/drug_network_graph_readability";
import type { DrugGraphNeighborhoodResponse, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import {
  COMPARE_HIGHLIGHT_CONTEXT_EDGE_OPACITY,
  COMPARE_HIGHLIGHT_PATH_STROKE_WIDTH,
  classifyCompareHighlightNode,
  compareHighlightGraphNodeIds,
  isFactualComparePathEdge,
  type LinkCompareHighlightContext,
} from "@/lib/drug_intelligence/drug_link_compare_highlight";

export type DrugNetworkLabelMode = "ALL" | "SELECTED_ONLY" | "HIDDEN";
export type DrugNetworkNodeDensity = "STANDARD" | "COMPACT";

export interface DrugNetworkFlowNodeData extends Record<string, unknown> {
  graphNode: DrugGraphNode;
  isFocus: boolean;
  /** Section 16: Compact node display shows icon + short label only — full detail always stays available in the drawer. */
  density: DrugNetworkNodeDensity;
  /** Section 17 / readability: dims (never removes) nodes off the selected path or, when no path exists, off the selected node's neighborhood. Always false when nothing is selected or the focus itself is selected. */
  dimmed: boolean;
  /** DI-9.2 Section 5: presentation-only — true when this node's position is excluded from auto-layout. Never part of DrugGraphNode/the factual DTO. */
  pinned: boolean;
  /** Undirected hop distance from the current focus. Presentation only. */
  hopDistance: number;
  /** True when caseCount >= 2 and the node is not the focus. Uses graph-derived counts only. */
  isShared: boolean;
  /** True when this node sits on the highlighted path from focus to the selected secondary node. */
  onSelectedPath: boolean;
  /** Depth-2 hop chip. Never shown on the focus node. */
  showHopBadge: boolean;
  /** Stronger isolation dimming for selected-path view. */
  stronglyDimmed: boolean;
  /** LC-2C.1 compare-highlight role. Null when Compare Highlight Mode is off. */
  compareRole: "endpoint" | "path" | "context" | null;
  /** A/B/C badge when this node is a compared endpoint. */
  compareSlot: "A" | "B" | "C" | null;
  /** True when this node is connecting evidence on the compared path (e.g. shared Case). */
  compareJunction: boolean;
  /** LC-2C.3: this compared endpoint is the current inspection target. */
  compareInspect: boolean;
  /** Adjacent counts from the loaded neighborhood — presentation only. */
  neighborCounts: GraphCardNeighborCounts;
  /** Show the card expand control using existing focus/depth behavior. */
  canExpand: boolean;
  onExpand?: () => void;
}

export interface FlowNode extends Node {
  id: string;
  type: "drugGraphNode";
  position: { x: number; y: number };
  selected: boolean;
  data: DrugNetworkFlowNodeData;
}

/**
 * DI-9.3 Section 5/6: presentation-only routing data carried alongside a
 * FlowEdge when the analyst has given it a non-AUTO route — never merged
 * into DrugGraphEdge. `analystMode`/`isBoardLocked` are read by the custom
 * edge component purely to decide whether to render draggable waypoint
 * handles (Section 4/19); they never affect the factual edge itself.
 */
export interface DrugNetworkFlowEdgeData extends Record<string, unknown> {
  route: DrugNetworkEdgeRouteState;
  analystMode: boolean;
  boardLocked: boolean;
  /** Section 11/26: called with graph-space coordinates on every waypoint drag move. The page owns `edgeRoutes` (the single source of truth) and applies the update there — never mutates xyflow's own edge array directly. */
  onWaypointDrag: (edgeId: string, waypointId: string, position: { x: number; y: number }) => void;
}

export interface FlowEdge extends Edge {
  id: string;
  source: string;
  target: string;
  selected: boolean;
  /** "drugRoutedEdge" only when this edge has an active non-AUTO route with at least one waypoint (Section 6/13) — every other edge keeps its original xyflow built-in type, completely unaffected by DI-9.3. */
  type: "smoothstep" | "step" | "default" | "drugRoutedEdge";
  label: string;
  style: { stroke: string; strokeDasharray?: string; opacity?: number; strokeWidth?: number };
  markerEnd: { type: MarkerType };
  labelStyle: { fontSize: number; fontWeight?: number | string; fill?: string; color?: string; transform?: string };
  labelBgStyle: { fill?: string; fillOpacity: number; stroke?: string; background?: string; transform?: string };
  labelBgPadding: [number, number];
  labelBgBorderRadius: number;
  zIndex?: number;
  interactionWidth?: number;
  /** xyflow SmoothStepEdge pathOptions — presentation-only route stub clearance. */
  pathOptions?: { offset?: number; borderRadius?: number };
  data: DrugNetworkFlowEdgeData;
}

export interface BuildFlowGraphOptions {
  layoutMode: Exclude<DrugNetworkLayoutMode, "AUTO">;
  labelMode: DrugNetworkLabelMode;
  nodeDensity: DrugNetworkNodeDensity;
  /** Present only for the PATH layout mode — the ordered node ids of the found path (Section 10). */
  pathNodeIdsInOrder?: string[];
  /** DI-9.2 Section 5/13: presentation-only pin state, read here only to mark node data for the badge — never influences computed positions (that happens separately via applyPinnedPositions). Defaults to empty. */
  pinnedNodeIds?: ReadonlySet<string>;
  /** DI-9.3 Section 2: presentation-only manual edge routes, keyed by factual edge id. Defaults to empty (every edge behaves exactly as before DI-9.3). */
  edgeRoutes?: DrugNetworkEdgeRoutes;
  /** DI-9.3 Section 4/19: whether waypoint handles should render at all for the routed edge (Analyst Mode, board unlocked) — read here only to set data flags the custom edge component checks; never affects factual data. */
  analystMode?: boolean;
  boardLocked?: boolean;
  /** DI-9.3 Section 11/26: passed straight through to every edge's data so the custom edge component can report waypoint drags back to the page. A no-op default keeps this optional for any caller/test that doesn't need routing. */
  onWaypointDrag?: (edgeId: string, waypointId: string, position: { x: number; y: number }) => void;
  /** Presentation-only hover — used to reveal edge labels without changing selection or graph data. */
  hoveredNodeId?: string | null;
  hoveredEdgeId?: string | null;
  /** Depth-2 canvas arrangement. DEFAULT keeps the resolved layout mode. */
  canvasArrangement?: NetworkDepthCanvasArrangement;
  /** When true, off-path nodes/edges use isolate opacity. Never removes graph records. */
  isolateSelectedPath?: boolean;
  /** Show ชั้น 1 / ชั้น 2 chips on non-focus nodes. */
  showHopBadges?: boolean;
  /** LC-2C.1 presentation-only compare emphasis. Absent on ordinary Network. */
  compareHighlight?: LinkCompareHighlightContext | null;
  /** When false, compare context is present but visual weights stay normal. */
  compareHighlightEmphasize?: boolean;
  /** LC-2C.3 presentation-only A/B/C inspection inside the stable Compare graph. */
  compareInspectSlot?: "A" | "B" | "C" | null;
  /** Existing neighborhood depth. Used only to decide whether the focus card can still expand. */
  connectionDepth?: 1 | 2;
  onExpandNode?: (nodeId: string) => void;
}

function toLayoutNode(n: DrugGraphNode): LayoutNodeInput {
  return { id: n.id, type: n.type };
}

function cardGraphEdgeAppearance(args: {
  compareHighlight: boolean;
  compareEmphasize: boolean;
  isolatePathVisuals: boolean;
  isolateSelectedPath: boolean;
  onPath: boolean | null;
  edgeDimmed: boolean;
  focusDirect: boolean;
  hasCanvasSelection: boolean;
  incidentEmphasis: boolean;
}): { opacity: number; strokeWidth: number } {
  if (args.compareEmphasize) {
    return {
      opacity: args.edgeDimmed ? COMPARE_HIGHLIGHT_CONTEXT_EDGE_OPACITY : 1,
      strokeWidth: args.onPath ? COMPARE_HIGHLIGHT_PATH_STROKE_WIDTH : 1.25,
    };
  }
  if (args.compareHighlight) {
    return { opacity: 1, strokeWidth: 1.5 };
  }
  if (args.isolatePathVisuals) {
    return {
      opacity: args.edgeDimmed ? (args.isolateSelectedPath ? 0.28 : 0.42) : 1,
      strokeWidth: args.onPath ? COMPARE_HIGHLIGHT_PATH_STROKE_WIDTH : 1.25,
    };
  }
  if (args.hasCanvasSelection) {
    if (args.incidentEmphasis) {
      return { opacity: 1, strokeWidth: CARD_GRAPH_SELECTED_INCIDENT_STROKE };
    }
    if (args.focusDirect) {
      return {
        opacity: CARD_GRAPH_FOCUS_DIRECT_WHEN_OTHER_SELECTED_OPACITY,
        strokeWidth: CARD_GRAPH_FOCUS_DIRECT_STROKE,
      };
    }
    return { opacity: CARD_GRAPH_UNRELATED_OPACITY, strokeWidth: CARD_GRAPH_SECONDARY_STROKE };
  }
  if (args.focusDirect) {
    return { opacity: CARD_GRAPH_FOCUS_DIRECT_OPACITY, strokeWidth: CARD_GRAPH_FOCUS_DIRECT_STROKE };
  }
  return { opacity: CARD_GRAPH_SECONDARY_OPACITY, strokeWidth: CARD_GRAPH_SECONDARY_STROKE };
}

/**
 * Builds the @xyflow/react node/edge arrays for one neighborhood response
 * under a given layout mode + display-density configuration.
 * `selectedNodeId`/`selectedEdgeId` mark the currently-open-in-drawer
 * entity so its canvas element renders with a visible selected ring — this
 * is the fix for the DI-5.1-discovered bug where clicking a node never
 * actually set xyflow's own `selected` state.
 *
 * Default card-graph selection emphasizes edges that touch the selected
 * node (never removes records). Compare Highlight, selected-path isolation,
 * and VERTICAL_PATH keep shortest-path isolation. Hover only reveals
 * labels — it never changes dimming or graph data.
 */
export function buildDrugNetworkFlowGraph(
  neighborhood: DrugGraphNeighborhoodResponse,
  translateShortLabel: (key: TranslationKey) => string,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  options: BuildFlowGraphOptions
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } {
  const layoutEdges = neighborhood.edges.map((e) => ({ source: e.source, target: e.target }));
  const layoutNodes = neighborhood.nodes.map(toLayoutNode);
  const arrangement = options.canvasArrangement ?? "DEFAULT";
  const positions =
    arrangement === "GROUP_BY_HOP"
      ? computeGroupByHopLayout(neighborhood.focus.entityId, layoutNodes, layoutEdges)
      : arrangement === "VERTICAL_PATH"
        ? computeVerticalPathLayout(options.pathNodeIdsInOrder ?? [], layoutNodes)
        : computeLayoutForMode(
            options.layoutMode,
            neighborhood.focus.entityId,
            layoutNodes,
            layoutEdges,
            options.pathNodeIdsInOrder
          );

  const hops = hopDistances(neighborhood.focus.entityId, neighborhood.nodes.map(toLayoutNode), layoutEdges);
  const focusId = neighborhood.focus.entityId;
  const selectedGraphEdge = selectedEdgeId ? neighborhood.edges.find((edge) => edge.id === selectedEdgeId) ?? null : null;
  const selectedIsSecondary = Boolean(selectedNodeId && selectedNodeId !== focusId);
  const compareHighlight = options.compareHighlight ?? null;
  const compareEmphasize = Boolean(compareHighlight && options.compareHighlightEmphasize !== false);
  const compareInspectSlot = options.compareInspectSlot ?? null;
  const arrangementIsolatesPath = arrangement === "VERTICAL_PATH" || Boolean(options.isolateSelectedPath);
  const isolatePathVisuals = Boolean(compareEmphasize || arrangementIsolatesPath || selectedGraphEdge);
  const selectedPath =
    !compareHighlight && selectedIsSecondary && selectedNodeId
      ? shortestUndirectedPath(focusId, selectedNodeId, neighborhood.edges)
      : null;
  const comparePathIds = compareEmphasize && compareHighlight
    ? compareHighlightGraphNodeIds(neighborhood.nodes, compareHighlight).pathIds
    : null;
  const pathNodeIds = comparePathIds
    ? comparePathIds
    : selectedGraphEdge
      ? new Set([selectedGraphEdge.source, selectedGraphEdge.target])
      : isolatePathVisuals && selectedPath
        ? new Set(selectedPath.nodeIds)
        : null;
  const pathEdgeIds = comparePathIds
    ? new Set(
        neighborhood.edges.filter((edge) => isFactualComparePathEdge(edge, comparePathIds)).map((edge) => edge.id)
      )
    : selectedGraphEdge
      ? new Set([selectedGraphEdge.id])
      : isolatePathVisuals && selectedPath
        ? new Set(selectedPath.edgeIds)
        : null;
  const neighborIds =
    !compareHighlight && !isolatePathVisuals && !selectedGraphEdge && selectedIsSecondary && selectedNodeId
      ? connectedNodeIds(selectedNodeId, neighborhood.edges)
      : null;
  const hasCanvasSelection = Boolean(selectedNodeId || selectedEdgeId);

  const flowNodes: FlowNode[] = neighborhood.nodes.map((n) => {
    const isFocus = n.id === focusId;
    const hopDistance = hops.get(n.id) ?? (isFocus ? 0 : 1);
    const inspectClass = compareHighlight ? classifyCompareHighlightNode(n, compareHighlight) : null;
    const compareClass = compareEmphasize ? inspectClass : null;
    const dimmed = compareClass
      ? compareClass.role === "context"
      : pathNodeIds
        ? !pathNodeIds.has(n.id)
        : neighborIds
          ? !neighborIds.has(n.id) && n.id !== focusId
          : false;
    return {
      id: n.id,
      type: "drugGraphNode",
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      selected:
        n.id === selectedNodeId ||
        (selectedGraphEdge != null && (n.id === selectedGraphEdge.source || n.id === selectedGraphEdge.target)),
      data: {
        graphNode: n,
        isFocus,
        density: options.nodeDensity,
        dimmed,
        pinned: options.pinnedNodeIds?.has(n.id) ?? false,
        hopDistance,
        isShared: isSharedEntity(n, isFocus),
        onSelectedPath: pathNodeIds ? pathNodeIds.has(n.id) : Boolean(selectedPath?.nodeIds.includes(n.id)),
        showHopBadge: Boolean(options.showHopBadges) && !isFocus && hopDistance >= 1,
        stronglyDimmed: compareClass ? compareClass.role === "context" : Boolean(options.isolateSelectedPath) && dimmed,
        compareRole: compareClass?.role ?? null,
        compareSlot: compareClass?.slot ?? null,
        compareJunction: compareClass?.junction ?? false,
        compareInspect: Boolean(inspectClass?.slot && inspectClass.slot === compareInspectSlot),
        neighborCounts: neighborCountsForNode(n.id, neighborhood.nodes, neighborhood.edges),
        canExpand: !isFocus || (options.connectionDepth ?? 2) === 1,
        onExpand: options.onExpandNode ? () => options.onExpandNode?.(n.id) : undefined,
      },
    };
  });

  const edgeType =
    arrangement === "GROUP_BY_HOP" || arrangement === "VERTICAL_PATH"
      ? "smoothstep"
      : edgeTypeForLayoutMode(options.layoutMode);
  const hoveredNodeId = options.hoveredNodeId ?? null;
  const hoveredEdgeId = options.hoveredEdgeId ?? null;

  // Pre-assign stagger indices for chips that will render.
  // Focus-direct labels share the vertical mid-band under the focus card, so
  // they use a global midX-ordered index. Secondary chips (e.g. Case↔Phone)
  // stagger within midpoint corridors only.
  const labelPlacementByEdgeId = new Map<string, { offset: { x: number; y: number }; pathOffset: number }>();
  const labeledCandidates = neighborhood.edges
    .map((e) => {
      const isSelected = e.id === selectedEdgeId;
      const touchesSelectedNode = selectedNodeId ? e.source === selectedNodeId || e.target === selectedNodeId : false;
      const isHovered = e.id === hoveredEdgeId;
      const touchesHoveredNode = hoveredNodeId ? e.source === hoveredNodeId || e.target === hoveredNodeId : false;
      const onPath = pathEdgeIds ? pathEdgeIds.has(e.id) : null;
      const focusDirect = isFocusDirectEdge(focusId, e);
      const cardEdgeHierarchy = !compareHighlight;
      const showLabel = shouldShowEdgeLabel({
        labelMode: options.labelMode,
        edgeKind: e.edgeKind,
        isSelected,
        touchesSelectedNode,
        isHovered,
        touchesHoveredNode,
        onSelectedPath: cardEdgeHierarchy ? isolatePathVisuals && onPath === true : onPath === true,
        isFocusDirect: cardEdgeHierarchy ? focusDirect : true,
        hasCanvasSelection: cardEdgeHierarchy ? hasCanvasSelection : false,
      });
      const comparePathEdge = Boolean(comparePathIds && onPath === true);
      const showPathReason = comparePathEdge && isFactualComparePathEdge(e, comparePathIds ?? new Set());
      if (!showPathReason && !showLabel) return null;
      const sourcePos = positions.get(e.source) ?? { x: 0, y: 0 };
      const targetPos = positions.get(e.target) ?? { x: 0, y: 0 };
      return {
        id: e.id,
        focusDirect,
        sourcePos,
        targetPos,
        corridor: edgeLabelCorridorKey(sourcePos, targetPos),
        midX: (sourcePos.x + targetPos.x) / 2,
        midY: (sourcePos.y + targetPos.y) / 2,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  const focusDirectLabeled = labeledCandidates
    .filter((item) => item.focusDirect)
    .sort((a, b) => a.midX - b.midX || a.midY - b.midY || a.id.localeCompare(b.id));
  focusDirectLabeled.forEach((item, indexInCorridor) => {
    labelPlacementByEdgeId.set(item.id, {
      offset: edgeLabelOffsetPx({
        sourcePos: item.sourcePos,
        targetPos: item.targetPos,
        indexInCorridor,
        focusDirect: true,
      }),
      pathOffset: edgeSmoothStepPathOffset(indexInCorridor),
    });
  });

  const secondaryCorridorCounts = new Map<string, number>();
  const secondaryLabeled = labeledCandidates
    .filter((item) => !item.focusDirect)
    .sort((a, b) => a.midX - b.midX || a.midY - b.midY || a.id.localeCompare(b.id));
  for (const item of secondaryLabeled) {
    const indexInCorridor = secondaryCorridorCounts.get(item.corridor) ?? 0;
    secondaryCorridorCounts.set(item.corridor, indexInCorridor + 1);
    labelPlacementByEdgeId.set(item.id, {
      offset: edgeLabelOffsetPx({
        sourcePos: item.sourcePos,
        targetPos: item.targetPos,
        indexInCorridor,
        focusDirect: false,
      }),
      pathOffset: edgeSmoothStepPathOffset(indexInCorridor),
    });
  }

  const flowEdges: FlowEdge[] = neighborhood.edges.map((e) => {
    const isSelected = e.id === selectedEdgeId;
    const touchesSelectedNode = selectedNodeId ? e.source === selectedNodeId || e.target === selectedNodeId : false;
    const isHovered = e.id === hoveredEdgeId;
    const touchesHoveredNode = hoveredNodeId ? e.source === hoveredNodeId || e.target === hoveredNodeId : false;
    const onPath = pathEdgeIds ? pathEdgeIds.has(e.id) : null;
    const focusDirect = isFocusDirectEdge(focusId, e);
    const cardEdgeHierarchy = !compareHighlight;
    const showLabel = shouldShowEdgeLabel({
      labelMode: options.labelMode,
      edgeKind: e.edgeKind,
      isSelected,
      touchesSelectedNode,
      isHovered,
      touchesHoveredNode,
      onSelectedPath: cardEdgeHierarchy ? isolatePathVisuals && onPath === true : onPath === true,
      isFocusDirect: cardEdgeHierarchy ? focusDirect : true,
      hasCanvasSelection: cardEdgeHierarchy ? hasCanvasSelection : false,
    });
    const edgeDimmed = onPath === null ? false : !onPath;
    const comparePathEdge = Boolean(comparePathIds && onPath === true);
    const showPathReason = comparePathEdge && isFactualComparePathEdge(e, comparePathIds ?? new Set());
    const baseColor = e.edgeKind === "INFERRED" ? "var(--color-warning, #b45309)" : "var(--color-accent, #2563eb)";
    const incidentEmphasis = isSelected || touchesSelectedNode || isHovered || touchesHoveredNode;
    const { opacity, strokeWidth } = cardGraphEdgeAppearance({
      compareHighlight: Boolean(compareHighlight),
      compareEmphasize,
      isolatePathVisuals,
      isolateSelectedPath: Boolean(options.isolateSelectedPath),
      onPath,
      edgeDimmed,
      focusDirect,
      hasCanvasSelection,
      incidentEmphasis,
    });
    // DI-9.3 Section 6/13: an edge only ever switches to the custom routed
    // renderer once it has a non-AUTO route WITH at least one waypoint —
    // AUTO (the default for every edge, always) or a route with zero
    // waypoints keeps the exact original built-in edge type, so nothing
    // about pre-DI-9.3 behavior changes unless the analyst has actually
    // added a waypoint to THIS specific edge.
    const route = options.edgeRoutes?.[e.id] ?? createDefaultEdgeRoute();
    const isRouted = route.mode !== "AUTO" && route.waypoints.length > 0;
    const willShowChip = Boolean(showPathReason || showLabel);
    const placement = willShowChip ? labelPlacementByEdgeId.get(e.id) : undefined;
    const labelOffset = placement?.offset ?? { x: 0, y: 0 };
    const labelTransform =
      labelOffset.x !== 0 || labelOffset.y !== 0
        ? `translate(${labelOffset.x}px, ${labelOffset.y}px)`
        : undefined;
    const pathOffset = !isRouted && edgeType === "smoothstep" ? (placement?.pathOffset ?? EDGE_SMOOTHSTEP_BASE_OFFSET) : undefined;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      selected: isSelected,
      type: isRouted ? "drugRoutedEdge" : edgeType,
      label:
        willShowChip
          ? translateShortLabel(
              showPathReason
                ? DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[e.relationshipType]
                : DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY[e.relationshipType]
            )
          : "",
      data: {
        route,
        analystMode: options.analystMode ?? false,
        boardLocked: options.boardLocked ?? false,
        onWaypointDrag: options.onWaypointDrag ?? (() => {}),
      },
      style: {
        stroke: baseColor,
        ...(e.edgeKind === "INFERRED" ? { strokeDasharray: "5 5" } : {}),
        opacity,
        strokeWidth,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
      interactionWidth: 24,
      ...(pathOffset != null ? { pathOptions: { offset: pathOffset, borderRadius: 8 } } : {}),
      labelStyle: {
        fontSize: 11,
        fontWeight: showLabel && focusDirect ? 600 : 500,
        fill: "var(--color-foreground)",
        color: "var(--color-foreground)",
        ...(labelTransform ? { transform: labelTransform } : {}),
      },
      labelBgStyle: {
        fill: "var(--color-neutral-bg)",
        fillOpacity: 1,
        stroke: "var(--color-border)",
        background: "var(--color-neutral-bg)",
        ...(labelTransform ? { transform: labelTransform } : {}),
      },
      labelBgPadding: EDGE_LABEL_BG_PADDING,
      labelBgBorderRadius: 6,
      // Only ever elevate an edge when a node IS selected and this edge
      // touches it — with no selection, every edge must stay at the
      // default stacking level so nodes remain on top and clickable/
      // draggable. Giving every edge zIndex:5 unconditionally (the DI-5.3.1
      // bug) put edge SVG paths above node DOM elements, so any node with
      // several edges converging on it (e.g. the focus node) became
      // unclickable/undraggable at most of its surface — edges intercepted
      // the pointer before it ever reached the node.
      zIndex:
        selectedNodeId || selectedEdgeId || comparePathEdge
          ? isSelected
            ? 10
            : onPath
              ? 6
              : touchesSelectedNode
                ? 5
                : 0
          : undefined,
    };
  });

  return { flowNodes, flowEdges };
}

/**
 * Presentation-only hover labels. Must never recompute layout, path, or
 * node positions — dragging updates coordinates every frame, and feeding
 * hover into the topology rebuild is what made the canvas flicker.
 */
export function applyFlowEdgeHoverLabels(
  edges: FlowEdge[],
  neighborhood: DrugGraphNeighborhoodResponse,
  translateShortLabel: (key: TranslationKey) => string,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  labelMode: DrugNetworkLabelMode,
  hoveredNodeId: string | null,
  hoveredEdgeId: string | null,
  comparePathEdgeIds?: ReadonlySet<string> | null,
  cardEdgeHierarchy = true
): FlowEdge[] {
  const graphEdgeById = new Map(neighborhood.edges.map((edge) => [edge.id, edge]));
  const selectedPath =
    selectedNodeId && selectedNodeId !== neighborhood.focus.entityId
      ? shortestUndirectedPath(neighborhood.focus.entityId, selectedNodeId, neighborhood.edges)
      : null;
  const pathEdgeIds = comparePathEdgeIds
    ? new Set(comparePathEdgeIds)
    : selectedPath
      ? new Set(selectedPath.edgeIds)
      : null;
  let changed = false;
  const next = edges.map((edge) => {
    const graphEdge = graphEdgeById.get(edge.id);
    if (!graphEdge) return edge;
    const showLabel = shouldShowEdgeLabel({
      labelMode,
      edgeKind: graphEdge.edgeKind,
      isSelected: edge.id === selectedEdgeId,
      touchesSelectedNode: selectedNodeId ? edge.source === selectedNodeId || edge.target === selectedNodeId : false,
      isHovered: edge.id === hoveredEdgeId,
      touchesHoveredNode: hoveredNodeId ? edge.source === hoveredNodeId || edge.target === hoveredNodeId : false,
      onSelectedPath: pathEdgeIds?.has(edge.id) ?? false,
      isFocusDirect: cardEdgeHierarchy ? isFocusDirectEdge(neighborhood.focus.entityId, graphEdge) : true,
      hasCanvasSelection: cardEdgeHierarchy ? Boolean(selectedNodeId || selectedEdgeId) : false,
    });
    const comparePathEdge = Boolean(comparePathEdgeIds?.has(edge.id));
    const showPathReason = comparePathEdge && isFactualComparePathEdge(graphEdge, new Set([graphEdge.source, graphEdge.target]));
    const label =
      showPathReason || showLabel
        ? translateShortLabel(
            showPathReason
              ? DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[graphEdge.relationshipType]
              : DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY[graphEdge.relationshipType]
          )
        : "";
    if (label === edge.label) return edge;
    changed = true;
    return { ...edge, label };
  });
  return changed ? next : edges;
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
