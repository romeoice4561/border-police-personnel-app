/**
 * Network Intelligence / Link Analysis workspace (Phase DI-5, Sections 7-13,
 * 17, 20).
 *
 * URL-persisted focus (focusType/focusId) so the workspace is bookmarkable
 * and back/forward-friendly, matching every other DI page's convention.
 * Never claims proof of association (Section "mission") — every node/edge
 * label and drawer routes through the neutral wording DI-5's typed
 * contract already enforces structurally (edgeKind, explanation facts).
 *
 * DI-9.1 — Workspace shell: View Mode (default, unchanged experience) vs
 * Analyst Mode. Mode is local component state, never persisted (no
 * localStorage, no DB, no URL param) — it never changes graph factual
 * data, never triggers a refetch, and never resets filters/selection.
 * Analyst Mode requires `drug.edit`, mirroring the exact same permission
 * tier this app already uses everywhere else to gate "can see beyond the
 * read-only view" (e.g. Map's/Case Workspace's own canViewFull checks) —
 * intentionally NOT a new permission string.
 *
 * DI-9.2 — Analyst Mode's first real editing capability: node pinning,
 * whole-board drag lock, and pinned-aware auto-layout. `pinnedNodeIds` is
 * PRESENTATION STATE ONLY (a plain Set<string> in local component state) —
 * never added to DrugGraphNode, never sent to any API, never persisted
 * (reload loses it — by design, saved persistence is DI-9.5). See
 * lib/drug_intelligence/drug_network_graph_pinning.ts for the pure
 * position-merge logic. Board lock (`boardLocked`) is a distinct concept:
 * it temporarily disables xyflow's own node dragging entirely, whereas a
 * pinned node stays draggable and only gets excluded from auto-layout.
 *
 * DI-9.3 — manual edge routing/waypoints. `edgeRoutes` (keyed by factual
 * edge id) is ALSO PRESENTATION STATE ONLY, same rules as pinning: never
 * added to DrugGraphEdge, never sent to any API, never persisted. See
 * lib/drug_intelligence/drug_network_edge_routing.ts for the pure route
 * geometry/state helpers and components/drug_intelligence/
 * drug_network_routed_edge.tsx for the custom xyflow edge renderer used
 * ONLY for an edge that currently has an active non-AUTO route with at
 * least one waypoint — every other edge renders exactly as it did before
 * DI-9.3. Board Lock now also disables route editing (Section 19) —
 * "lock presentation editing of the investigation graph" as a whole.
 *
 * DI-9.4 — Drawing & Annotation Toolkit. Analyst annotations live entirely
 * in xyflow's `flowNodes` state alongside factual nodes, using a distinct
 * id prefix ("ann-") and distinct node types ("annotationShape" /
 * "annotationLine"). They are NEVER added to DrugGraphNode, never sent to
 * any API, never persisted (reload loses them — DI-9.5 will add board
 * persistence), and never affect BFS / neighbourhood / Find Connection /
 * factual node or edge counts. Board Lock extends to annotations: creation,
 * move, resize, delete, and style changes are all blocked when the board is
 * locked. View Mode is read-only — the annotation toolbar is hidden and
 * handles/controls are not rendered. Annotations survive View ↔ Analyst
 * mode switches. They are auto-cleared (with a brief notice) when the
 * graph focus (focusType / focusId) changes to prevent misleading carryover
 * from one investigation subject to another.
 */
"use client";

import { Suspense, useState, useRef, useEffect, useCallback, useMemo, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "@xyflow/react/dist/style.css";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  Network as NetworkIcon,
  RotateCcw,
  Maximize2,
  GitCompare,
  ChevronDown,
  ChevronUp,
  Info,
  LayoutGrid,
  UserCircle,
  Briefcase,
  GitBranch,
  Layers,
  Shrink,
  Route,
  Tags,
  MapPinned,
  Eye,
  Sparkles,
  PinOff,
  Lock,
  Unlock,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { DrugNetworkStatusBar } from "@/components/drug_intelligence/drug_network_status_bar";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Drawer } from "@/components/ui/drawer";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { DrugNetworkGraphNode } from "@/components/drug_intelligence/drug_network_graph_node";
import { DrugNetworkRoutedEdge } from "@/components/drug_intelligence/drug_network_routed_edge";
import { DrugNetworkNodeDetail } from "@/components/drug_intelligence/drug_network_node_detail";
import { DrugNetworkEdgeDetail } from "@/components/drug_intelligence/drug_network_edge_detail";
import { DrugNetworkEntityPicker, type DrugNetworkEntitySelection } from "@/components/drug_intelligence/drug_network_entity_picker";
import { DrugNetworkRelationshipFilter } from "@/components/drug_intelligence/drug_network_relationship_filter";
import { DrugNetworkLegend } from "@/components/drug_intelligence/drug_network_legend";
import { DrugNetworkAnalystToolbar } from "@/components/drug_intelligence/drug_network_analyst_toolbar";
import {
  DrugNetworkAnnotationShapeNode,
  DrugNetworkAnnotationLineNode,
} from "@/components/drug_intelligence/drug_network_annotation_node";
import { DrugNetworkAnnotationInspector } from "@/components/drug_intelligence/drug_network_annotation_inspector";
import { DrugNetworkAnnotationFloatingBar } from "@/components/drug_intelligence/drug_network_annotation_floating_bar";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugNetworkNeighborhood, useDrugNetworkPath } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import {
  buildDrugNetworkFlowGraph,
  mergePreservingManualPositions,
  type DrugNetworkFlowNodeData,
  type FlowNode,
  type FlowEdge,
  type DrugNetworkLabelMode,
  type DrugNetworkNodeDensity,
} from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import { resolveAutoLayoutMode, type DrugNetworkLayoutMode } from "@/lib/drug_intelligence/drug_network_graph_layout";
import { applyPinnedPositions, prunePinnedNodeIds } from "@/lib/drug_intelligence/drug_network_graph_pinning";
import {
  createDefaultEdgeRoute,
  addEdgeWaypoint,
  moveEdgeWaypoint,
  removeEdgeWaypoint,
  resetEdgeRoute,
  pruneEdgeRoutes,
  type DrugNetworkEdgeRouteMode,
  type DrugNetworkEdgeRoutes,
} from "@/lib/drug_intelligence/drug_network_edge_routing";
import {
  nextAnnotationId,
  isAnnotationId,
  annotationFlowNodeType,
  createRectangleAnnotation,
  createEllipseAnnotation,
  createTextAnnotation,
  createLineAnnotation,
  createArrowAnnotation,
  createImageAnnotation,
  updateAnnotation,
  removeAnnotation,
  buildDuplicateAnnotation,
  lineAnnotationNodeDimensions,
  validateImageAnnotationFile,
  computeImageAnnotationInitialSize,
  imageAnnotationCenteredPosition,
  retainBlobUrl,
  releaseBlobUrl,
  ANNOTATION_DEFAULT_SIZES,
  ANNOTATION_DEFAULTS,
  IMAGE_ANNOTATION_ALLOWED_MIME,
  type DrugNetworkAnnotation,
  type DrugNetworkAnalystTool,
} from "@/lib/drug_intelligence/drug_network_annotations";
import type { DrugNetworkAnnotationNodeData } from "@/components/drug_intelligence/drug_network_annotation_node";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY, DRUG_GRAPH_RELATIONSHIP_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { normalizeThaiPersonnelDateForSave } from "@/lib/officer_profile/thai_personnel_date";
import { getSafeReturnTo } from "@/lib/ui/return_context";
import type { DrugGraphNode, DrugGraphEdge, DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ALL_NODE_TYPES: DrugGraphNodeType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"];

// DI-9.4: NODE_TYPES must not overlap — annotation types use distinct keys
// so xyflow can never confuse an annotation node with a factual graph node.
const NODE_TYPES = {
  drugGraphNode: DrugNetworkGraphNode,
  annotationShape: DrugNetworkAnnotationShapeNode,
  annotationLine: DrugNetworkAnnotationLineNode,
} as const;

const EDGE_TYPES = { drugRoutedEdge: DrugNetworkRoutedEdge };
const HARD_MAX_NODES = 150;

/** DI-9.1 Section 3: View Mode is the default, unchanged DI-5 experience. */
type DrugNetworkWorkspaceMode = "VIEW" | "ANALYST";

const LAYOUT_BUTTONS: { mode: DrugNetworkLayoutMode; icon: typeof LayoutGrid; labelKey: TranslationKey }[] = [
  { mode: "AUTO", icon: LayoutGrid, labelKey: "di.network.layoutAuto" },
  { mode: "PERSON_CENTERED", icon: UserCircle, labelKey: "di.network.layoutPersonCentered" },
  { mode: "CASE_CENTERED", icon: Briefcase, labelKey: "di.network.layoutCaseCentered" },
  { mode: "HIERARCHICAL", icon: GitBranch, labelKey: "di.network.layoutHierarchical" },
  { mode: "GROUP_BY_TYPE", icon: Layers, labelKey: "di.network.layoutGroupByType" },
  { mode: "COMPACT", icon: Shrink, labelKey: "di.network.layoutCompact" },
];

const RESOLVED_LAYOUT_LABEL_KEY: Record<Exclude<DrugNetworkLayoutMode, "AUTO">, TranslationKey> = {
  PERSON_CENTERED: "di.network.layoutPersonCentered",
  CASE_CENTERED: "di.network.layoutCaseCentered",
  HIERARCHICAL: "di.network.layoutHierarchical",
  GROUP_BY_TYPE: "di.network.layoutGroupByType",
  COMPACT: "di.network.layoutCompact",
  PATH: "di.network.layoutPath",
};

const LABEL_MODE_OPTIONS: { value: DrugNetworkLabelMode; labelKey: TranslationKey }[] = [
  { value: "ALL", labelKey: "di.network.labelModeAll" },
  { value: "SELECTED_ONLY", labelKey: "di.network.labelModeSelectedOnly" },
  { value: "HIDDEN", labelKey: "di.network.labelModeHidden" },
];

export default function DrugNetworkPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ReactFlowProvider>
        <DrugNetworkContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

function toIsoDate(thaiDate: string): string | undefined {
  if (!thaiDate) return undefined;
  return normalizeThaiPersonnelDateForSave(thaiDate) ?? undefined;
}

// ─── Annotation ↔ FlowNode helpers ───────────────────────────────────────────

/**
 * Converts an annotation data object + xyflow position/size into a xyflow
 * Node. The resulting node has no `graphNode` property, no `edgeKind`, and no
 * factual intelligence fields — it is purely a presentation element.
 *
 * `draggable` is false in View Mode and when the board is locked, matching
 * DI-9.4 Section 20/36 move-lock semantics.
 */
interface AnnotationFlowNodeExtra {
  autoFocus?: boolean;
  screenToFlowPosition?: (pos: { x: number; y: number }) => { x: number; y: number };
  onEndpointDrag?: (id: string, endpoint: "start" | "end", newGraphPos: { x: number; y: number }) => void;
}

function annotationToFlowNode(
  ann: DrugNetworkAnnotation,
  position: { x: number; y: number },
  size: { width: number; height: number } | undefined,
  selectedAnnotationId: string | null,
  boardLocked: boolean,
  analystMode: boolean,
  onTextChange: (id: string, text: string) => void,
  extra?: AnnotationFlowNodeExtra
): Node {
  const isLine = ann.type === "LINE" || ann.type === "ARROW";
  const endOffset = ann.endOffset ?? { x: 80, y: 0 };
  const lineDims = lineAnnotationNodeDimensions(endOffset, ann.strokeWidth);

  const nodeData: DrugNetworkAnnotationNodeData = {
    annotation: ann,
    boardLocked,
    analystMode,
    onTextChange,
    autoFocus: extra?.autoFocus,
    screenToFlowPosition: extra?.screenToFlowPosition,
    onEndpointDrag: extra?.onEndpointDrag,
  };

  return {
    id: ann.id,
    type: annotationFlowNodeType(ann.type),
    position,
    width: isLine ? lineDims.width : (size?.width ?? ANNOTATION_DEFAULT_SIZES[ann.type as keyof typeof ANNOTATION_DEFAULT_SIZES]?.width ?? 200),
    height: isLine ? lineDims.height : (size?.height ?? ANNOTATION_DEFAULT_SIZES[ann.type as keyof typeof ANNOTATION_DEFAULT_SIZES]?.height ?? 120),
    selected: selectedAnnotationId === ann.id,
    selectable: true,
    draggable: analystMode && !boardLocked,
    deletable: false,
    data: nodeData,
    zIndex: isLine || ann.type === "TEXT" ? 2 : 1,
  };
}

// ─── Drawing preview overlay (pointer-drag create UX) ────────────────────────

interface DrawingPreviewState {
  type: DrugNetworkAnalystTool;
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  fillColor: string;
}

function DrawingPreviewOverlay({ preview }: { preview: DrawingPreviewState }) {
  const { type, x1, y1, x2, y2, color, fillColor } = preview;
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  const fill = fillColor === "transparent" ? "none" : fillColor;
  const markerId = "drawing-preview-arrow";

  return (
    <svg
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9998 }}
      aria-hidden
    >
      {type === "ARROW" ? (
        <defs>
          <marker id={markerId} markerWidth={10} markerHeight={7} refX={9} refY={3.5} orient="auto">
            <polygon points="0 0,10 3.5,0 7" fill={color} opacity={0.7} />
          </marker>
        </defs>
      ) : null}
      {type === "RECTANGLE" ? (
        <rect
          x={minX} y={minY} width={Math.max(1, w)} height={Math.max(1, h)}
          rx={6} ry={6}
          stroke={color} strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.9}
          fill={fill} fillOpacity={0.15}
        />
      ) : type === "ELLIPSE" ? (
        <ellipse
          cx={minX + w / 2} cy={minY + h / 2} rx={Math.max(1, w / 2)} ry={Math.max(1, h / 2)}
          stroke={color} strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.9}
          fill={fill} fillOpacity={0.15}
        />
      ) : type === "LINE" || type === "ARROW" ? (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color} strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.9}
          strokeLinecap="round"
          markerEnd={type === "ARROW" ? `url(#${markerId})` : undefined}
        />
      ) : null}
    </svg>
  );
}

/**
 * Returns the annotation data embedded in a flow node's `data.annotation`,
 * or null if the node is a factual graph node.
 */
function getAnnotationFromNode(node: Node): DrugNetworkAnnotation | null {
  if (!isAnnotationId(node.id)) return null;
  const data = node.data as DrugNetworkAnnotationNodeData;
  return data?.annotation ?? null;
}

// ─── Main component ───────────────────────────────────────────────────────────

function DrugNetworkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, can } = useAuth();
  const { t } = useT();
  const { fitView, screenToFlowPosition } = useReactFlow();

  const focusType = (searchParams.get("focusType") as DrugGraphNodeType | null) ?? null;
  const focusId = searchParams.get("focusId") ?? null;
  const depth = (Number(searchParams.get("depth") ?? "1") === 2 ? 2 : 1) as 1 | 2;
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const maxNodesParam = searchParams.get("maxNodes");
  const maxNodes = maxNodesParam ? Math.min(Math.max(Number(maxNodesParam), 1), HARD_MAX_NODES) : undefined;
  const nodeTypesParam = searchParams.get("nodeTypes");
  const selectedNodeTypes = nodeTypesParam ? (nodeTypesParam.split(",") as DrugGraphNodeType[]) : undefined;
  const relationshipTypesParam = searchParams.get("relationshipTypes");
  const selectedRelationshipTypes = relationshipTypesParam ? (relationshipTypesParam.split(",") as DrugGraphRelationshipType[]) : undefined;
  const returnTo = getSafeReturnTo(searchParams);

  // DI-9.1: View/Analyst mode
  const [workspaceMode, setWorkspaceMode] = useState<DrugNetworkWorkspaceMode>("VIEW");

  const canViewNetwork = can("drug.read");
  const canUseAnalystMode = can("drug.edit");
  const effectiveWorkspaceMode: DrugNetworkWorkspaceMode = canUseAnalystMode ? workspaceMode : "VIEW";

  // DI-9.2: pinning + board lock
  const [pinnedNodeIds, setPinnedNodeIds] = useState<Set<string>>(new Set());
  const [boardLocked, setBoardLocked] = useState(false);

  // DI-9.3: edge routes
  const [edgeRoutes, setEdgeRoutes] = useState<DrugNetworkEdgeRoutes>({});

  // ── DI-9.4: annotation state ────────────────────────────────────────────────
  //
  // Annotations live in `flowNodes` (via useNodesState) alongside factual
  // nodes. `annotations` is a PARALLEL ARRAY that stores the non-spatial data
  // (type, color, text, etc.) for each annotation. xyflow owns the position and
  // size (via its internal node state); `annotations` owns everything else.
  //
  // Separation invariant (Section 40 A-H):
  //   - Annotation ids all start with "ann-"
  //   - `neighborhood.data.nodes` and `neighborhood.data.edges` never contain
  //     annotation ids
  //   - nodeCount and edgeCount in the status bar come from neighborhood.data
  //     (factual counts) — annotations never inflate them
  //   - BFS / Find Connection / relationship filters never see annotation nodes
  //   - Annotation nodes carry no `graphNode`, no `edgeKind`, no `evidence`

  const [annotations, setAnnotations] = useState<DrugNetworkAnnotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrugNetworkAnalystTool>("SELECT");
  /** Transient notice when annotations are auto-cleared on focus change. */
  const [annotationsClearedNotice, setAnnotationsClearedNotice] = useState(false);
  /** Transient Thai notice for invalid/oversized Image tool selections. */
  const [imageErrorNotice, setImageErrorNotice] = useState<"mime" | "size" | null>(null);
  /** Current annotation defaults: color, strokeWidth, fillColor, fontSize. */
  const [annotationDefaults, setAnnotationDefaults] = useState(ANNOTATION_DEFAULTS);

  // DI-9.4.1: blob URL ref-counts so duplicate IMAGE annotations share safely
  const blobUrlRegistryRef = useRef<Map<string, number>>(new Map());
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── DI-9.4.1: drag-to-create state ──────────────────────────────────────────
  const drawingStateRef = useRef<{
    type: DrugNetworkAnalystTool;
    startScreen: { x: number; y: number };
    startGraph: { x: number; y: number };
    pointerId: number;
  } | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<DrawingPreviewState | null>(null);
  /** Set to true when a drag-draw just completed so handlePaneClick ignores the trailing click. */
  const justDrewRef = useRef(false);

  // ── Refs for always-fresh values inside stable callbacks ─────────────────────
  // NOTE: latestFlowNodesRef.current is updated BELOW after flowNodes is declared
  const latestFlowNodesRef = useRef<FlowNode[]>([]);
  const boardLockedRef = useRef(boardLocked);
  boardLockedRef.current = boardLocked;
  const annotationDefaultsRef = useRef(annotationDefaults);
  annotationDefaultsRef.current = annotationDefaults;
  // handleEndpointDrag / handleEndpointDragRef are declared BELOW after flowNodes/setFlowNodes

  // Ref to stabilise the text-change callback across renders (avoids rebuilding
  // annotation flow nodes unnecessarily just because the callback reference changed).
  const handleAnnotationTextChangeRef = useRef<(id: string, text: string) => void>(() => {});

  // ── Focus-change annotation clear (Section 34) ──────────────────────────────
  // Annotations are graph-session-local. When the analyst navigates to a
  // completely different entity (focusId changes), the previous annotations
  // would be visually misleading on an unrelated graph — so auto-clear with a
  // brief notice. A "same session" filter change (date, depth, nodeType) is
  // NOT a focus change and preserves annotations in place.
  const prevFocusRef = useRef<{ focusType: string | null; focusId: string | null } | null>(null);
  useEffect(() => {
    if (prevFocusRef.current === null) {
      prevFocusRef.current = { focusType, focusId };
      return;
    }
    const prev = prevFocusRef.current;
    if (prev.focusId !== focusId || prev.focusType !== focusType) {
      prevFocusRef.current = { focusType, focusId };
      if (annotationsRef.current.length > 0) {
        for (const ann of annotationsRef.current) {
          releaseBlobUrl(blobUrlRegistryRef.current, ann.imageSrc);
        }
        startTransition(() => {
          setAnnotations([]);
          setSelectedAnnotationId(null);
          setAnnotationsClearedNotice(true);
        });
        setTimeout(() => setAnnotationsClearedNotice(false), 4000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusType]);

  // ── Escape key: cancel creation / return to SELECT ─────────────────────────
  // DI-9.4 Section 30: Esc while not focused in an input cancels the pending
  // line-start or returns to Select — never closes unrelated Drawers.
  // Section 31: V → Select, H → Pan (non-destructive shortcuts only).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable ||
        (e.target as HTMLElement)?.getAttribute?.("role") === "combobox";
      if (isEditable) return;

      if (e.key === "Escape") {
        // Cancel in-progress drag-draw
        if (drawingStateRef.current) {
          drawingStateRef.current = null;
          setDrawingPreview(null);
        }
        if (activeTool !== "SELECT") {
          setActiveTool("SELECT");
        }
        return;
      }
      if (effectiveWorkspaceMode !== "ANALYST" || boardLocked) return;
      if (e.key === "v" || e.key === "V") setActiveTool("SELECT");
      if (e.key === "h" || e.key === "H") setActiveTool("PAN");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, effectiveWorkspaceMode, boardLocked]);

  // ── Cursor style for canvas based on active tool ─────────────────────────────
  const canvasCursor = useMemo(() => {
    if (effectiveWorkspaceMode !== "ANALYST") return "default";
    switch (activeTool) {
      case "PAN": return "grab";
      case "SELECT": return "default";
      case "TEXT": return "text";
      default: return "crosshair"; // drawing tools
    }
  }, [activeTool, effectiveWorkspaceMode]);

  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showFindConnection, setShowFindConnection] = useState(false);
  const [pathFrom, setPathFrom] = useState<DrugNetworkEntitySelection | null>(null);
  const [pathTo, setPathTo] = useState<DrugNetworkEntitySelection | null>(null);
  const [selectedNode, setSelectedNode] = useState<DrugGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DrugGraphEdge | null>(null);
  const [edgeDrawerOpen, setEdgeDrawerOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<DrugNetworkLayoutMode>("AUTO");
  const [labelMode, setLabelMode] = useState<DrugNetworkLabelMode>("SELECTED_ONLY");
  const [nodeDensity, setNodeDensity] = useState<DrugNetworkNodeDensity>("STANDARD");
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [pathViewNodeIds, setPathViewNodeIds] = useState<string[] | null>(null);
  const [rearrangeToken, setRearrangeToken] = useState(0);

  const originalFocusRef = useRef<{ focusType: DrugGraphNodeType | null; focusId: string | null } | null>(null);
  if (originalFocusRef.current === null) {
    originalFocusRef.current = { focusType: searchParams.get("focusType") as DrugGraphNodeType | null, focusId: searchParams.get("focusId") };
  }

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/drug-intelligence/network?${next.toString()}`);
  }

  const neighborhood = useDrugNetworkNeighborhood(user?.id ?? null, {
    entityType: focusType ?? "PERSON",
    entityId: focusId ?? "",
    depth,
    nodeTypes: selectedNodeTypes,
    relationshipTypes: selectedRelationshipTypes,
    dateFrom: toIsoDate(dateFrom),
    dateTo: toIsoDate(dateTo),
    maxNodes,
  });

  const pathQuery = pathFrom && pathTo ? { fromType: pathFrom.entityType, fromId: pathFrom.entityId, toType: pathTo.entityType, toId: pathTo.entityId } : null;
  const path = useDrugNetworkPath(user?.id ?? null, pathQuery);

  const resolvedLayoutMode =
    layoutMode === "AUTO"
      ? resolveAutoLayoutMode({
          focusType: focusType ?? "PERSON",
          isPathResult: pathViewNodeIds !== null,
          nodeCount: neighborhood.data?.nodes.length ?? 0,
        })
      : pathViewNodeIds !== null
        ? "PATH"
        : layoutMode;

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // Always-fresh refs for stable callbacks (updated synchronously on every render)
  latestFlowNodesRef.current = flowNodes;

  // ── Stable endpoint-drag callback (declared here so setFlowNodes is in scope) ─
  const handleEndpointDrag = useCallback((
    id: string,
    endpoint: "start" | "end",
    newGraphPos: { x: number; y: number }
  ) => {
    if (boardLockedRef.current) return;
    const nodes = latestFlowNodesRef.current;
    const nodeIdx = nodes.findIndex((n) => n.id === id);
    if (nodeIdx < 0) return;
    const node = nodes[nodeIdx];
    const ann = (node.data as unknown as DrugNetworkAnnotationNodeData).annotation;
    const eo = ann.endOffset ?? { x: 80, y: 0 };

    let newPosition: { x: number; y: number };
    let newEndOffset: { x: number; y: number };

    if (endpoint === "end") {
      newPosition = node.position;
      newEndOffset = { x: newGraphPos.x - node.position.x, y: newGraphPos.y - node.position.y };
    } else {
      newPosition = newGraphPos;
      newEndOffset = { x: node.position.x + eo.x - newGraphPos.x, y: node.position.y + eo.y - newGraphPos.y };
    }

    const updatedAnn: DrugNetworkAnnotation = { ...ann, endOffset: newEndOffset };

    setFlowNodes((prev) => {
      const result = [...prev] as FlowNode[];
      const idx = result.findIndex((n) => n.id === id);
      if (idx < 0) return prev;
      result[idx] = {
        ...result[idx],
        position: newPosition,
        data: { ...result[idx].data, annotation: updatedAnn },
      } as unknown as FlowNode;
      return result;
    });
    setAnnotations((prev) => updateAnnotation(prev, id, { endOffset: newEndOffset }));
  }, [setFlowNodes, setAnnotations]);
  const handleEndpointDragRef = useRef(handleEndpointDrag);
  useEffect(() => { handleEndpointDragRef.current = handleEndpointDrag; }, [handleEndpointDrag]);

  const querySignature = JSON.stringify({
    focusType, focusId, depth, dateFrom, dateTo,
    maxNodes, selectedNodeTypes, selectedRelationshipTypes,
    resolvedLayoutMode, pathViewNodeIds, rearrangeToken,
  });
  const lastQuerySignatureRef = useRef<string | null>(null);

  function handleWaypointDrag(edgeId: string, waypointId: string, position: { x: number; y: number }) {
    if (boardLocked) return;
    setEdgeRoutes((current) => ({
      ...current,
      [edgeId]: moveEdgeWaypoint(current[edgeId] ?? createDefaultEdgeRoute(), waypointId, position),
    }));
  }

  // ── Pin / edge-route pruning effects (DI-9.2 / DI-9.3) ───────────────────────
  useEffect(() => {
    if (!neighborhood.data) return;
    const currentNodeIds = new Set(neighborhood.data.nodes.map((n) => n.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinnedNodeIds((current) => {
      const pruned = prunePinnedNodeIds(current, currentNodeIds);
      return pruned.size === current.size ? current : pruned;
    });
  }, [neighborhood.data]);

  useEffect(() => {
    if (!neighborhood.data) return;
    const currentEdgeIds = new Set(neighborhood.data.edges.map((e) => e.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdgeRoutes((current) => pruneEdgeRoutes(current, currentEdgeIds));
  }, [neighborhood.data]);

  // ── Main build effect ─────────────────────────────────────────────────────────
  // Builds the factual flow nodes from the API response, then APPENDS any
  // currently-live annotation nodes (preserving their xyflow positions). This
  // means auto-layout (จัดผังใหม่) only moves factual nodes — annotation nodes
  // are untouched (DI-9.4 Section 33).
  useEffect(() => {
    if (!neighborhood.data) {
      setFlowNodes([]);
      setFlowEdges([]);
      lastQuerySignatureRef.current = null;
      return;
    }
    const currentNodeIds = new Set(neighborhood.data.nodes.map((n) => n.id));
    const effectivePinnedNodeIds = prunePinnedNodeIds(pinnedNodeIds, currentNodeIds);

    const built = buildDrugNetworkFlowGraph(neighborhood.data, (key) => t(key), selectedNode?.id ?? null, selectedEdge?.id ?? null, {
      layoutMode: resolvedLayoutMode,
      labelMode,
      nodeDensity,
      pathNodeIdsInOrder: pathViewNodeIds ?? undefined,
      pinnedNodeIds: effectivePinnedNodeIds,
      edgeRoutes,
      analystMode: effectiveWorkspaceMode === "ANALYST",
      boardLocked,
      onWaypointDrag: handleWaypointDrag,
    });

    const isNewQuery = lastQuerySignatureRef.current !== querySignature;
    lastQuerySignatureRef.current = querySignature;

    setFlowNodes((current) => {
      // DI-9.4 Section 33: preserve annotation nodes through layout rebuilds.
      // Factual auto-layout (จัดผังใหม่) must never move annotation nodes.
      const currentAnnotationNodes = current.filter((n) => isAnnotationId(n.id));
      const currentFactual = current.filter((n) => !isAnnotationId(n.id));

      let newFactualNodes: FlowNode[];
      if (!isNewQuery) {
        newFactualNodes = mergePreservingManualPositions(built.flowNodes, currentFactual, false) as FlowNode[];
      } else {
        const computedPositions = new Map(built.flowNodes.map((n) => [n.id, n.position]));
        const currentPositions = new Map(currentFactual.map((n) => [n.id, n.position]));
        const merged = applyPinnedPositions(computedPositions, currentPositions, effectivePinnedNodeIds);
        newFactualNodes = built.flowNodes.map((n) => ({ ...n, position: merged.get(n.id) ?? n.position }));
      }

      // Re-attach annotation nodes with updated callbacks and board-lock state
      const updatedAnnotationNodes = currentAnnotationNodes.map((n) => {
        const ann = getAnnotationFromNode(n);
        if (!ann) return n;
        return {
          ...n,
          draggable: effectiveWorkspaceMode === "ANALYST" && !boardLocked,
          data: {
            ...n.data,
            boardLocked,
            analystMode: effectiveWorkspaceMode === "ANALYST",
            onTextChange: handleAnnotationTextChangeRef.current,
            screenToFlowPosition,
            onEndpointDrag: handleEndpointDragRef.current,
          } as unknown as DrugNetworkAnnotationNodeData,
        };
      });

      return [...newFactualNodes, ...updatedAnnotationNodes] as FlowNode[];
    });

    setFlowEdges(built.flowEdges);
    if (isNewQuery) window.requestAnimationFrame(() => fitView({ duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhood.data, querySignature, selectedNode?.id, selectedEdge?.id, labelMode, nodeDensity, pinnedNodeIds, edgeRoutes, effectiveWorkspaceMode, boardLocked]);

  // ── Text change callback (stable via ref) ─────────────────────────────────────
  // Stored in a ref so it never forces the build effect to re-run (it's not
  // a dep), but the latest version is always called.
  const stableTextChange = useCallback((id: string, text: string) => {
    setAnnotations((prev) => updateAnnotation(prev, id, { text }));
    setFlowNodes((prev) =>
      prev.map((n) =>
        n.id === id && isAnnotationId(n.id)
          ? { ...n, data: { ...n.data, annotation: { ...(n.data as unknown as DrugNetworkAnnotationNodeData).annotation, text } } as unknown as DrugNetworkAnnotationNodeData }
          : n
      ) as FlowNode[]
    );
  }, []);
  useEffect(() => {
    handleAnnotationTextChangeRef.current = stableTextChange;
  }, [stableTextChange]);

  // ── onNodesChange: intercept annotation position / resize ─────────────────────
  // xyflow calls onNodesChange with position/dimensions changes for ALL nodes.
  // For annotation nodes:
  //   - position changes → sync back to `annotations` (source of truth for data)
  //     and also to flowNodes so xyflow-managed position stays live
  //   - dimension (NodeResizer) changes → sync back to `annotations`
  // For factual nodes → pass through to the standard onNodesChange handler.
  function handleNodesChange(changes: NodeChange[]) {
    const annotationSizeChanges: { id: string; width: number; height: number }[] = [];
    const annotationPositionCommits: { id: string; x: number; y: number }[] = [];

    for (const change of changes) {
      const id = (change as { id?: string }).id ?? "";
      if (!isAnnotationId(id)) continue;
      if (change.type === "dimensions") {
        const c = change as { id: string; dimensions?: { width: number; height: number } };
        if (c.dimensions) annotationSizeChanges.push({ id, width: c.dimensions.width, height: c.dimensions.height });
      }
      if (change.type === "position") {
        const c = change as { id: string; dragging?: boolean; position?: { x: number; y: number } };
        if (!c.dragging && c.position) {
          annotationPositionCommits.push({ id, x: c.position.x, y: c.position.y });
        }
      }
    }

    if (annotationSizeChanges.length > 0 || annotationPositionCommits.length > 0) {
      setAnnotations((prev) => {
        let result = prev;
        for (const { id, width, height } of annotationSizeChanges) {
          result = updateAnnotation(result, id, { /* position unchanged; size captured separately */ });
          // Size is tracked in flowNodes; annotations state doesn't store size separately.
          void id; void width; void height; // sizes managed by xyflow, not annotations state
        }
        return result;
      });
    }

    // Pass ALL changes through to xyflow so dragging and resize handles work.
    onNodesChange(changes as NodeChange<FlowNode>[]);
  }

  // ── Canvas pane click: TEXT annotation creation ──────────────────────────────
  // DI-9.4.1: RECTANGLE/ELLIPSE/LINE/ARROW are created via drag (pointer events).
  // TEXT is still created by a single click since it has no natural drag dimensions.
  function handlePaneClick(event: React.MouseEvent) {
    if (effectiveWorkspaceMode !== "ANALYST" || boardLocked) return;
    if (activeTool !== "TEXT") return;

    const graphPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const ann = createTextAnnotation(annotationDefaults);
    const pos = {
      x: graphPos.x - 90,
      y: graphPos.y - 30,
    };
    addAnnotationToCanvas(ann, pos, undefined, true /* autoFocus: enter edit immediately */);
    setActiveTool("SELECT");
  }

  // ── Drag-to-create: pointer event handlers (DI-9.4.1 Section 2-8) ────────────
  const DRAG_THRESHOLD_PX = 6;
  const DRAG_TOOLS = new Set<DrugNetworkAnalystTool>(["RECTANGLE", "ELLIPSE", "LINE", "ARROW"]);

  /** Returns true if the pointer event target is on empty canvas (not a node/toolbar). */
  function isOnCanvasPane(target: EventTarget | null): boolean {
    if (!target) return false;
    const el = target as HTMLElement;
    return (
      !el.closest(".react-flow__node") &&
      !el.closest(".react-flow__edge") &&
      !el.closest(".react-flow__controls") &&
      !el.closest(".react-flow__minimap") &&
      !el.closest('[data-testid="analyst-toolbar"]') &&
      !el.closest('[data-testid="annotation-floating-bar"]')
    );
  }

  function handleDrawPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (effectiveWorkspaceMode !== "ANALYST" || boardLocked) return;
    if (!DRAG_TOOLS.has(activeTool)) return;
    if (!isOnCanvasPane(e.target)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const graphPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    drawingStateRef.current = {
      type: activeTool,
      startScreen: { x: e.clientX, y: e.clientY },
      startGraph: graphPos,
      pointerId: e.pointerId,
    };
  }

  function handleDrawPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const ds = drawingStateRef.current;
    if (!ds) return;

    const dx = e.clientX - ds.startScreen.x;
    const dy = e.clientY - ds.startScreen.y;
    if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;

    setDrawingPreview({
      type: ds.type,
      x1: ds.startScreen.x, y1: ds.startScreen.y,
      x2: e.clientX, y2: e.clientY,
      color: annotationDefaultsRef.current.color,
      fillColor: annotationDefaultsRef.current.fillColor,
    });
  }

  function handleDrawPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const ds = drawingStateRef.current;
    if (!ds) return;

    drawingStateRef.current = null;
    setDrawingPreview(null);

    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const dx = e.clientX - ds.startScreen.x;
    const dy = e.clientY - ds.startScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < DRAG_THRESHOLD_PX) {
      // Too small — treat as a missed click, don't create anything
      return;
    }

    justDrewRef.current = true;

    const endGraph = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const { startGraph, type } = ds;
    const defaults = annotationDefaultsRef.current;

    if (type === "LINE" || type === "ARROW") {
      const endOffset = { x: endGraph.x - startGraph.x, y: endGraph.y - startGraph.y };
      const ann = type === "LINE"
        ? createLineAnnotation(endOffset, defaults)
        : createArrowAnnotation(endOffset, defaults);
      addAnnotationToCanvas(ann, startGraph);
    } else {
      // RECTANGLE or ELLIPSE
      const minX = Math.min(startGraph.x, endGraph.x);
      const minY = Math.min(startGraph.y, endGraph.y);
      const width = Math.max(20, Math.abs(endGraph.x - startGraph.x));
      const height = Math.max(20, Math.abs(endGraph.y - startGraph.y));
      const ann = type === "RECTANGLE"
        ? createRectangleAnnotation(defaults)
        : createEllipseAnnotation(defaults);
      addAnnotationToCanvas(ann, { x: minX, y: minY }, { width, height });
    }
    setActiveTool("SELECT");
  }

  function handleDrawPointerCancel() {
    drawingStateRef.current = null;
    setDrawingPreview(null);
  }

  function addAnnotationToCanvas(
    ann: DrugNetworkAnnotation,
    position: { x: number; y: number },
    size?: { width: number; height: number },
    autoFocus = false
  ) {
    setAnnotations((prev) => [...prev, ann]);
    const flowNode = annotationToFlowNode(
      ann, position, size,
      ann.id, boardLocked, effectiveWorkspaceMode === "ANALYST",
      handleAnnotationTextChangeRef.current,
      { autoFocus, screenToFlowPosition, onEndpointDrag: handleEndpointDragRef.current }
    );
    const selectedFlowNode = { ...flowNode, selected: true };
    setFlowNodes((prev) => [...prev as FlowNode[], selectedFlowNode as FlowNode]);
    setSelectedAnnotationId(ann.id);
    setSelectedNode(null);
    setSelectedEdge(null);
  }

  // ── Image annotation: PowerPoint-style immediate file picker ────────────────
  // Root cause of Human QA defect: handleImageToolClick previously checked
  // `activeTool === "IMAGE"` AFTER setActiveTool("IMAGE"), so React still saw
  // the previous tool and the file input never opened.
  function openImageFilePicker() {
    if (boardLocked || effectiveWorkspaceMode !== "ANALYST") return;
    // Image is a one-shot action — never leave IMAGE sticky. Cancel naturally
    // returns to SELECT because we never stay on IMAGE waiting for a canvas click.
    setActiveTool("SELECT");
    const input = imageInputRef.current;
    if (!input) return;
    // Reset so selecting the same file twice still fires onChange
    input.value = "";
    input.click();
  }

  function getVisibleViewportCenterFlow(): { x: number; y: number } {
    const el = canvasContainerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }

  function loadImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () =>
        resolve({
          width: Math.max(1, img.naturalWidth || 1),
          height: Math.max(1, img.naturalHeight || 1),
        });
      img.onerror = () => reject(new Error("image-load-failed"));
      img.src = src;
    });
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always reset so same-file reselect works; cancel does not fire onChange
    e.target.value = "";
    setActiveTool("SELECT");
    if (!file) return;
    if (boardLocked || effectiveWorkspaceMode !== "ANALYST") return;

    const validation = validateImageAnnotationFile(file);
    if (!validation.ok) {
      setImageErrorNotice(validation.reason);
      setTimeout(() => setImageErrorNotice(null), 4000);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    retainBlobUrl(blobUrlRegistryRef.current, objectUrl);

    let size = ANNOTATION_DEFAULT_SIZES.IMAGE;
    try {
      const natural = await loadImageNaturalSize(objectUrl);
      size = computeImageAnnotationInitialSize(natural.width, natural.height);
    } catch {
      // Keep default size if natural dimensions cannot be read
    }

    const ann = createImageAnnotation(objectUrl);
    const center = getVisibleViewportCenterFlow();
    const pos = imageAnnotationCenteredPosition(center, size);
    addAnnotationToCanvas(ann, pos, size);
  }

  // ── Annotation update (color, strokeWidth, etc.) ──────────────────────────────
  const updateAnnotationData = useCallback((id: string, patch: Partial<DrugNetworkAnnotation>) => {
    setAnnotations((prev) => updateAnnotation(prev, id, patch));
    setFlowNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id || !isAnnotationId(n.id)) return n;
        const current = (n.data as unknown as DrugNetworkAnnotationNodeData).annotation;
        return {
          ...n,
          data: {
            ...n.data,
            annotation: { ...current, ...patch },
          } as unknown as DrugNetworkAnnotationNodeData,
        };
      }) as FlowNode[]
    );
    // Update defaults to match the last-used STYLE (not geometry) so new
    // annotations inherit the style the analyst was last using.
    const { endOffset: _eo, text: _t, imageSrc: _i, caption: _c, ...stylePatch } = patch;
    if (Object.keys(stylePatch).length > 0) {
      setAnnotationDefaults((d) => ({ ...d, ...stylePatch }));
    }
  }, []);

  // ── Annotation deletion ───────────────────────────────────────────────────────
  // Factual node/edge deletion is strictly forbidden (DI-9.4 Section 21).
  // This guard: only ids starting with "ann-" are ever removed.
  const deleteAnnotation = useCallback((id: string) => {
    if (!isAnnotationId(id)) return; // safety guard — never remove factual nodes
    if (boardLocked) return;
    // Release object URL for IMAGE annotations (ref-counted — safe with duplicates)
    const ann = annotations.find((a) => a.id === id);
    releaseBlobUrl(blobUrlRegistryRef.current, ann?.imageSrc);
    setAnnotations((prev) => removeAnnotation(prev, id));
    setFlowNodes((prev) => prev.filter((n) => n.id !== id) as FlowNode[]);
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  }, [annotations, boardLocked, selectedAnnotationId]);

  // ── Cleanup: revoke remaining blob URLs on unmount ──────────────────────────
  useEffect(() => {
    return () => {
      for (const ann of annotationsRef.current) {
        releaseBlobUrl(blobUrlRegistryRef.current, ann.imageSrc);
      }
    };
  }, []);

  // ── Annotation duplication ────────────────────────────────────────────────────
  const duplicateAnnotation = useCallback((id: string) => {
    if (!isAnnotationId(id)) return;
    if (boardLocked) return;
    const existingNode = flowNodes.find((n) => n.id === id);
    const existingAnn = annotations.find((a) => a.id === id);
    if (!existingNode || !existingAnn) return;
    const dupAnn = buildDuplicateAnnotation(existingAnn);
    // Shared object URL: retain so deleting one copy does not break the other
    retainBlobUrl(blobUrlRegistryRef.current, dupAnn.imageSrc);
    const dupPos = { x: existingNode.position.x + 20, y: existingNode.position.y + 20 };
    const size =
      existingNode.width != null && existingNode.height != null
        ? { width: existingNode.width, height: existingNode.height }
        : undefined;
    addAnnotationToCanvas(dupAnn, dupPos, size);
  }, [annotations, flowNodes, boardLocked]);

  // ── Node click handler (factual + annotation) ─────────────────────────────────
  // DI-9.4 Section 6: selection-state collisions are prevented by clearing the
  // other type's selection whenever one type is clicked. Annotation selection
  // clears factual selection (and vice versa) but they use separate state vars.
  function handleNodeClick(_event: unknown, node: Node) {
    if (isAnnotationId(node.id)) {
      // Annotation selected
      setSelectedAnnotationId(node.id);
      setSelectedNode(null);
      setSelectedEdge(null);
      setEdgeDrawerOpen(false);
      return;
    }
    // Factual node selected
    const graphNode = (node.data as DrugNetworkFlowNodeData).graphNode;
    setSelectedNode(graphNode);
    setSelectedEdge(null);
    setSelectedAnnotationId(null);
  }

  function handleEdgeClick(_event: unknown, edge: Edge) {
    const graphEdge = neighborhood.data?.edges.find((e) => e.id === edge.id) ?? null;
    setSelectedEdge(graphEdge);
    setSelectedNode(null);
    setSelectedAnnotationId(null);
    setEdgeDrawerOpen(true);
  }

  // Clicking the canvas background (pane) deselects everything (plus triggers creation)
  function handlePaneClickWrapper(event: React.MouseEvent) {
    // If a drag-draw just completed, skip this trailing click
    if (justDrewRef.current) {
      justDrewRef.current = false;
      return;
    }
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedAnnotationId(null);
    handlePaneClick(event);
  }

  function expandFromNode(node: DrugGraphNode) {
    updateParams({ focusType: node.type, focusId: node.id, depth: undefined });
    setSelectedNode(null);
    setPathViewNodeIds(null);
  }

  function handleLayoutSelect(mode: DrugNetworkLayoutMode) {
    setLayoutMode(mode);
    setShowLayoutMenu(false);
  }

  function handleRearrange() {
    setRearrangeToken((v) => v + 1);
  }

  function togglePinNode(nodeId: string) {
    setPinnedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function clearAllPins() {
    setPinnedNodeIds(new Set());
  }

  function handleAddWaypoint(edge: DrugGraphEdge) {
    if (boardLocked) return;
    const sourceNode = flowNodes.find((n) => n.id === edge.source);
    const targetNode = flowNodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return;
    setEdgeRoutes((current) => ({
      ...current,
      [edge.id]: addEdgeWaypoint(current[edge.id] ?? createDefaultEdgeRoute(), sourceNode.position, targetNode.position),
    }));
  }

  function handleRemoveWaypoint(edgeId: string, waypointId: string) {
    if (boardLocked) return;
    setEdgeRoutes((current) => {
      const route = current[edgeId];
      if (!route) return current;
      return { ...current, [edgeId]: removeEdgeWaypoint(route, waypointId) };
    });
  }

  function handleResetRoute(edgeId: string) {
    if (boardLocked) return;
    setEdgeRoutes((current) => ({ ...current, [edgeId]: resetEdgeRoute() }));
  }

  function handleRouteModeChange(edgeId: string, mode: DrugNetworkEdgeRouteMode) {
    if (boardLocked) return;
    setEdgeRoutes((current) => ({
      ...current,
      [edgeId]: { mode, waypoints: (current[edgeId] ?? createDefaultEdgeRoute()).waypoints },
    }));
  }

  function handleBackToStart() {
    const original = originalFocusRef.current;
    updateParams({
      focusType: original?.focusType ?? undefined,
      focusId: original?.focusId ?? undefined,
      depth: undefined,
      nodeTypes: undefined,
      relationshipTypes: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      maxNodes: undefined,
    });
    setLayoutMode("AUTO");
    setSelectedNode(null);
    setSelectedEdge(null);
    setPathViewNodeIds(null);
    setRearrangeToken((v) => v + 1);
  }

  function exitPathView() {
    setPathViewNodeIds(null);
  }

  // ── Currently-selected annotation (for inspector) ─────────────────────────────
  const selectedAnnotation = useMemo(
    () => selectedAnnotationId ? annotations.find((a) => a.id === selectedAnnotationId) ?? null : null,
    [annotations, selectedAnnotationId]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.network.title")}
        description={t("di.network.description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {returnTo ? (
              <Button asChild variant="outline" size="sm">
                <Link href={returnTo}>
                  <MapPinned className="h-4 w-4" aria-hidden="true" />
                  {t("di.map.actionBackToMap")}
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setShowFindConnection((v) => !v)}>
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              {t("di.network.findConnection")}
            </Button>
            {canViewNetwork && canUseAnalystMode ? (
              <div role="group" aria-label={t("di.network.modeSwitcherLabel")} className="flex rounded-lg border border-border bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => setWorkspaceMode("VIEW")}
                  aria-pressed={effectiveWorkspaceMode === "VIEW"}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${effectiveWorkspaceMode === "VIEW" ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg"}`}
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  {t("di.network.modeView")}
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode("ANALYST")}
                  aria-pressed={effectiveWorkspaceMode === "ANALYST"}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${effectiveWorkspaceMode === "ANALYST" ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg"}`}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {t("di.network.modeAnalyst")}
                </button>
              </div>
            ) : null}
          </div>
        }
      />

      {/* DI-9.4: annotation-cleared notice (shown briefly after focus change) */}
      {annotationsClearedNotice ? (
        <p role="status" className="flex items-center gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("di.network.annotationsClearedOnFocusChange")}
        </p>
      ) : null}

      {/* DI-9.4.1: Image tool validation feedback */}
      {imageErrorNotice ? (
        <p role="status" className="flex items-center gap-1.5 rounded-lg bg-critical-bg px-3 py-2 text-xs text-critical" data-testid="image-annotation-error">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {imageErrorNotice === "mime"
            ? t("di.network.imageInvalidType")
            : t("di.network.imageTooLarge")}
        </p>
      ) : null}

      {/* DI-9.4: Analyst Mode banner (replaced "coming soon" with drawing hint) */}
      {effectiveWorkspaceMode === "ANALYST" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="font-semibold">{t("di.network.modeAnalystBadge")}</span>
          <span className="text-accent/80">
            {activeTool !== "SELECT" && activeTool !== "PAN"
              ? t("di.network.drawingHintClick")
              : null}
          </span>
        </div>
      ) : null}

      {!canViewNetwork ? (
        <ErrorState title={t("di.network.permissionDenied")} />
      ) : (
        <>
          <Card>
            <CardBody className="space-y-2">
              <DrugNetworkEntityPicker
                onSelect={(selection) => {
                  updateParams({ focusType: selection.entityType, focusId: selection.entityId, depth: undefined });
                  setPathViewNodeIds(null);
                }}
                placeholder={t("di.network.searchToFocus")}
              />
            </CardBody>
          </Card>

          {showFindConnection ? (
            <Card>
              <CardBody className="space-y-3">
                <p className="text-sm font-semibold text-foreground">{t("di.network.findConnection")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.network.findConnectionFrom")}</label>
                    <DrugNetworkEntityPicker onSelect={setPathFrom} />
                    {pathFrom ? <p className="mt-1 text-xs text-accent">{pathFrom.label}</p> : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.network.findConnectionTo")}</label>
                    <DrugNetworkEntityPicker onSelect={setPathTo} />
                    {pathTo ? <p className="mt-1 text-xs text-accent">{pathTo.label}</p> : null}
                  </div>
                </div>

                {pathQuery && path.isPending ? <LoadingState rows={2} /> : null}
                {pathQuery && path.isError ? <ErrorState message={t("di.network.errorLoad")} /> : null}
                {pathQuery && path.data && !path.data.found ? <EmptyState title={t("di.network.pathNotFound")} /> : null}
                {pathQuery && path.data?.found ? (
                  <div className="space-y-2 rounded-lg border border-border bg-neutral-bg/40 p-3">
                    <p className="text-sm font-semibold text-foreground">{t("di.network.pathResultTitle")}</p>
                    <p className="text-xs text-muted">
                      {t("di.network.pathHopCount")}: {path.data.paths[0]?.hopCount}
                    </p>
                    <ol className="space-y-1.5">
                      {path.data.paths[0]?.steps.map((step, i) => (
                        <li key={`${step.node.id}-${i}`} className="text-sm text-foreground">
                          {i > 0 && step.viaEdge ? (
                            <span className="text-xs text-muted">
                              → {t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[step.viaEdge.relationshipType] as TranslationKey)} →{" "}
                            </span>
                          ) : null}
                          <span className="font-medium">{step.node.label}</span>
                        </li>
                      ))}
                    </ol>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (pathFrom) updateParams({ focusType: pathFrom.entityType, focusId: pathFrom.entityId, depth: "2" });
                        setPathViewNodeIds(path.data!.paths[0]!.steps.map((s) => s.node.id));
                        setLayoutMode("PATH");
                        setShowFindConnection(false);
                      }}
                    >
                      {t("di.network.openInNetwork")}
                    </Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-3">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-controls="drug-network-filters-panel"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                {showFilters ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                {t("di.network.filters")}
              </button>
              {showFilters ? (
                <div id="drug-network-filters-panel" className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <label htmlFor="drug-network-filter-depth" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.network.filterDepth")}
                      </label>
                      <Select
                        id="drug-network-filter-depth"
                        options={[
                          { value: "1", label: "1" },
                          { value: "2", label: "2" },
                        ]}
                        value={String(depth)}
                        onChange={(e) => updateParams({ depth: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="drug-network-filter-node-types" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.network.filterNodeTypes")}
                      </label>
                      <Select
                        id="drug-network-filter-node-types"
                        options={ALL_NODE_TYPES.map((nt) => ({ value: nt, label: t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[nt] as TranslationKey) }))}
                        placeholder={t("common.all")}
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return updateParams({ nodeTypes: undefined });
                          const current = selectedNodeTypes ?? [];
                          const next = current.includes(e.target.value as DrugGraphNodeType) ? current : [...current, e.target.value as DrugGraphNodeType];
                          updateParams({ nodeTypes: next.join(",") });
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor="drug-network-filter-date-from" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.network.filterDateFrom")}
                      </label>
                      <ThaiDatePicker value={dateFrom} onChange={(v) => updateParams({ dateFrom: v || undefined })} placeholder="DD/MM/YYYY" />
                    </div>
                    <div>
                      <label htmlFor="drug-network-filter-date-to" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.network.filterDateTo")}
                      </label>
                      <ThaiDatePicker value={dateTo} onChange={(v) => updateParams({ dateTo: v || undefined })} placeholder="DD/MM/YYYY" />
                    </div>
                    <div>
                      <label htmlFor="drug-network-filter-max-nodes" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.network.filterMaxNodes")}
                      </label>
                      <input
                        id="drug-network-filter-max-nodes"
                        type="number"
                        min={1}
                        max={HARD_MAX_NODES}
                        value={maxNodesParam ?? ""}
                        placeholder={t("di.network.filterMaxNodesPlaceholder")}
                        onChange={(e) => updateParams({ maxNodes: e.target.value || undefined })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 block text-xs font-medium text-muted">{t("di.network.filterRelationshipTypes")}</p>
                    <DrugNetworkRelationshipFilter
                      selected={selectedRelationshipTypes}
                      onChange={(next) => updateParams({ relationshipTypes: next ? next.join(",") : undefined })}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateParams({ nodeTypes: undefined, relationshipTypes: undefined, dateFrom: undefined, dateTo: undefined, maxNodes: undefined })}
                  >
                    {t("di.network.clearFilters")}
                  </Button>
                </div>
              ) : null}
              {selectedNodeTypes && selectedNodeTypes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedNodeTypes.map((nt) => (
                    <button
                      key={nt}
                      type="button"
                      onClick={() => updateParams({ nodeTypes: selectedNodeTypes.filter((x) => x !== nt).join(",") || undefined })}
                      className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent hover:bg-accent/20"
                    >
                      {t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[nt] as TranslationKey)} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          {!focusType || !focusId ? (
            <EmptyState title={t("di.network.noFocus")} icon={<NetworkIcon className="h-8 w-8" />} />
          ) : neighborhood.isPending ? (
            <LoadingState rows={10} label={t("di.network.loading")} />
          ) : neighborhood.isError ? (
            <ErrorState message={t("di.network.errorLoad")} onRetry={() => neighborhood.refetch()} />
          ) : neighborhood.data.nodes.length === 0 ? (
            <EmptyState title={t("di.network.empty")} icon={<NetworkIcon className="h-8 w-8" />} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <SummaryTile label={t("di.network.summaryNodes")} value={neighborhood.data.nodes.length} />
                <SummaryTile label={t("di.network.summaryPersons")} value={neighborhood.data.nodes.filter((n) => n.type === "PERSON").length} />
                <SummaryTile label={t("di.network.summaryPhonesSims")} value={neighborhood.data.nodes.filter((n) => n.type === "PHONE" || n.type === "SIM").length} />
                <SummaryTile label={t("di.network.summaryDevices")} value={neighborhood.data.nodes.filter((n) => n.type === "DEVICE").length} />
                <SummaryTile label={t("di.network.summaryVehicles")} value={neighborhood.data.nodes.filter((n) => n.type === "VEHICLE").length} />
                <SummaryTile label={t("di.network.summaryCases")} value={neighborhood.data.nodes.filter((n) => n.type === "CASE").length} />
                <SummaryTile label={t("di.network.summaryInferred")} value={neighborhood.data.edges.filter((e) => e.edgeKind === "INFERRED").length} />
              </div>

              {neighborhood.data.truncated ? (
                <p role="status" className="flex items-center gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("di.network.truncatedNotice")}
                </p>
              ) : null}

              <p className="sr-only" id="drug-network-canvas-summary">
                {t("di.network.graphSummaryFallback")}
              </p>

              {pathViewNodeIds ? (
                <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
                  <Route className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("di.network.pathViewActive")}
                  <button type="button" onClick={exitPathView} className="ml-auto underline hover:no-underline">
                    {t("di.network.backToFullNetwork")}
                  </button>
                </p>
              ) : null}

              {/* Layout / View toolbar */}
              <Card>
                <CardBody className="space-y-3 py-3">
                  <div className="hidden flex-wrap items-center gap-3 sm:flex">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs font-medium text-muted">{t("di.network.layoutToolbarLabel")}</span>
                      {LAYOUT_BUTTONS.map(({ mode, icon: Icon, labelKey }) => (
                        <Button
                          key={mode}
                          size="sm"
                          variant={layoutMode === mode ? "accent" : "outline"}
                          onClick={() => handleLayoutSelect(mode)}
                          aria-pressed={layoutMode === mode}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {t(labelKey)}
                        </Button>
                      ))}
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => fitView({ duration: 300 })}>
                        <Maximize2 className="h-4 w-4" aria-hidden="true" />
                        {t("di.network.fitToScreen")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleRearrange}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        {t("di.network.rearrange")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNodeDensity((d) => (d === "STANDARD" ? "COMPACT" : "STANDARD"))}
                        aria-pressed={nodeDensity === "COMPACT"}
                      >
                        {nodeDensity === "COMPACT" ? t("di.network.nodeDensityCompact") : t("di.network.nodeDensityStandard")}
                      </Button>
                      <div className="relative">
                        <Button variant="outline" size="sm" onClick={() => setShowLabelMenu((v) => !v)} aria-expanded={showLabelMenu} aria-controls="drug-network-label-menu">
                          <Tags className="h-4 w-4" aria-hidden="true" />
                          {t("di.network.relationshipLabels")}
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        {showLabelMenu ? (
                          <div id="drug-network-label-menu" className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-surface p-1 shadow-lg">
                            {LABEL_MODE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setLabelMode(opt.value);
                                  setShowLabelMenu(false);
                                }}
                                className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-neutral-bg/60 ${labelMode === opt.value ? "font-semibold text-accent" : "text-foreground"}`}
                              >
                                {t(opt.labelKey)}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Mobile layout dropdown */}
                  <div className="flex flex-wrap items-center gap-2 sm:hidden">
                    <div className="relative">
                      <Button variant="outline" size="sm" onClick={() => setShowLayoutMenu((v) => !v)} aria-expanded={showLayoutMenu} aria-controls="drug-network-layout-menu-mobile">
                        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                        {t("di.network.layoutToolbarLabel")}
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      {showLayoutMenu ? (
                        <div id="drug-network-layout-menu-mobile" className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg">
                          {LAYOUT_BUTTONS.map(({ mode, icon: Icon, labelKey }) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleLayoutSelect(mode)}
                              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-neutral-bg/60 ${layoutMode === mode ? "font-semibold text-accent" : "text-foreground"}`}
                            >
                              <Icon className="h-4 w-4" aria-hidden="true" />
                              {t(labelKey)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => fitView({ duration: 300 })}>
                      <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRearrange}>
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {effectiveWorkspaceMode === "ANALYST" ? (
                <Card>
                  <CardBody className="py-3">
                    <div role="group" aria-label={t("di.network.analystControlsLabel")} className="flex flex-wrap items-center gap-1.5">
                      <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBoardLocked((v) => !v)}
                        aria-pressed={boardLocked}
                      >
                        {boardLocked ? <Unlock className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                        {boardLocked ? t("di.network.unlockBoard") : t("di.network.lockBoard")}
                      </Button>
                      {pinnedNodeIds.size > 0 ? (
                        <Button variant="ghost" size="sm" onClick={clearAllPins}>
                          <PinOff className="h-4 w-4" aria-hidden="true" />
                          {t("di.network.clearAllPins")}
                        </Button>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {/* ── Canvas ─────────────────────────────────────────────────────── */}
              <div
                ref={canvasContainerRef}
                className="relative h-[560px] w-full overflow-hidden rounded-xl border border-border bg-surface sm:h-[640px]"
                aria-describedby="drug-network-canvas-summary"
                onPointerDown={handleDrawPointerDown}
                onPointerMove={handleDrawPointerMove}
                onPointerUp={handleDrawPointerUp}
                onPointerCancel={handleDrawPointerCancel}
              >
                {/* DI-9.4 Section 3: vertical toolbar — always left of canvas in Analyst Mode */}
                {effectiveWorkspaceMode === "ANALYST" ? (
                  <DrugNetworkAnalystToolbar
                    activeTool={activeTool}
                    onToolSelect={(tool) => {
                      // IMAGE: open OS file picker immediately (no canvas click required)
                      if (tool === "IMAGE") {
                        if (drawingStateRef.current) {
                          drawingStateRef.current = null;
                          setDrawingPreview(null);
                        }
                        openImageFilePicker();
                        return;
                      }
                      setActiveTool(tool);
                      // Cancel any in-progress drag-draw when switching tools
                      if (drawingStateRef.current) {
                        drawingStateRef.current = null;
                        setDrawingPreview(null);
                      }
                    }}
                    boardLocked={boardLocked}
                  />
                ) : null}

                {/* ── DI-9.4.1: Floating annotation property bar ──────────── */}
                {selectedAnnotation && effectiveWorkspaceMode === "ANALYST" ? (
                  <div
                    className="absolute left-14 right-20 top-2 z-10 sm:left-14"
                    data-testid="annotation-floating-bar"
                  >
                    <DrugNetworkAnnotationFloatingBar
                      annotation={selectedAnnotation}
                      boardLocked={boardLocked}
                      onChange={updateAnnotationData}
                      onDelete={deleteAnnotation}
                      onDuplicate={duplicateAnnotation}
                    />
                  </div>
                ) : null}

                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={onEdgesChange}
                  deleteKeyCode={null}
                  nodeTypes={NODE_TYPES}
                  edgeTypes={EDGE_TYPES}
                  edgesReconnectable={false}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                  onPaneClick={handlePaneClickWrapper}
                  fitView
                  minZoom={0.2}
                  maxZoom={2}
                  nodesDraggable={!boardLocked}
                  panOnDrag={activeTool === "PAN" || activeTool === "SELECT" || effectiveWorkspaceMode === "VIEW"}
                  style={{ cursor: canvasCursor }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background />
                  <Controls showInteractive={false} />
                  <MiniMap pannable zoomable className="hidden sm:block" />
                </ReactFlow>

                {/* DI-9.4.1: Live drawing preview overlay */}
                {drawingPreview ? <DrawingPreviewOverlay preview={drawingPreview} /> : null}

                {/* Legend button — top-right */}
                <div className="absolute right-2 top-2 z-10">
                  <Button variant="outline" size="sm" onClick={() => setShowLegend((v) => !v)} aria-expanded={showLegend} aria-controls="drug-network-legend-panel">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    {showLegend ? t("di.network.legendHide") : t("di.network.legendShow")}
                  </Button>
                  {showLegend ? (
                    <div id="drug-network-legend-panel" className="mt-2 max-w-65 rounded-xl border border-border bg-surface p-3 shadow-lg">
                      <DrugNetworkLegend />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Hidden file input for Image annotation — opened immediately by Image tool */}
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_ANNOTATION_ALLOWED_MIME.join(",")}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                data-testid="annotation-image-file-input"
                onChange={handleImageFileChange}
              />

              <DrugNetworkStatusBar
                nodeCount={neighborhood.data.nodes.length}
                edgeCount={neighborhood.data.edges.length}
                selectedLabel={
                  selectedAnnotationId
                    ? null // annotation "selected" is shown in the inspector below, not the status bar
                    : selectedNode?.label ?? (selectedEdge ? t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[selectedEdge.relationshipType] as TranslationKey) : null)
                }
                layoutLabel={t(RESOLVED_LAYOUT_LABEL_KEY[resolvedLayoutMode])}
                truncated={neighborhood.data.truncated}
                pinnedCount={effectiveWorkspaceMode === "ANALYST" ? pinnedNodeIds.size : undefined}
                boardLocked={effectiveWorkspaceMode === "ANALYST" ? boardLocked : undefined}
                annotationCount={effectiveWorkspaceMode === "ANALYST" ? annotations.length : undefined}
              />

              {/* DI-9.4: Annotation inspector (non-modal, inline — avoids backdrop conflict) */}
              {selectedAnnotation && effectiveWorkspaceMode === "ANALYST" ? (
                <DrugNetworkAnnotationInspector
                  annotation={selectedAnnotation}
                  boardLocked={boardLocked}
                  onChange={updateAnnotationData}
                  onDelete={deleteAnnotation}
                  onDuplicate={duplicateAnnotation}
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={handleBackToStart}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {t("di.network.resetToFocus")}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <Drawer open={Boolean(selectedNode)} onClose={() => setSelectedNode(null)} titleId="drug-network-node-detail" title={t("di.network.nodeDetailTitle")}>
        {selectedNode ? (
          <DrugNetworkNodeDetail
            node={selectedNode}
            onExpand={() => expandFromNode(selectedNode)}
            pinned={pinnedNodeIds.has(selectedNode.id)}
            onTogglePin={effectiveWorkspaceMode === "ANALYST" ? () => togglePinNode(selectedNode.id) : undefined}
          />
        ) : null}
      </Drawer>
      <Drawer open={Boolean(selectedEdge) && edgeDrawerOpen} onClose={() => setEdgeDrawerOpen(false)} titleId="drug-network-edge-detail" title={t("di.network.edgeDetailTitle")}>
        {selectedEdge ? (
          <DrugNetworkEdgeDetail
            edge={selectedEdge}
            sourceNode={neighborhood.data?.nodes.find((n) => n.id === selectedEdge.source) ?? null}
            targetNode={neighborhood.data?.nodes.find((n) => n.id === selectedEdge.target) ?? null}
            routeEdit={
              effectiveWorkspaceMode === "ANALYST"
                ? {
                    route: edgeRoutes[selectedEdge.id] ?? createDefaultEdgeRoute(),
                    boardLocked,
                    onModeChange: (mode) => handleRouteModeChange(selectedEdge.id, mode),
                    onAddWaypoint: () => handleAddWaypoint(selectedEdge),
                    onRemoveWaypoint: (waypointId) => handleRemoveWaypoint(selectedEdge.id, waypointId),
                    onResetRoute: () => handleResetRoute(selectedEdge.id),
                  }
                : undefined
            }
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value.toLocaleString()}</p>
    </div>
  );
}
