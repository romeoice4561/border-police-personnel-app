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
 * Analyst Mode (currently a SCAFFOLD ONLY — a mode badge + a "more tools
 * coming" placeholder card; no drawing/annotation/waypoint/undo/pin/save
 * functionality exists yet, per DI-9 Round A's approved phase sequence).
 * Mode is local component state, never persisted (no localStorage, no DB,
 * no URL param) — it never changes graph factual data, never triggers a
 * refetch, and never resets filters/selection/manual node positions.
 * Analyst Mode requires `drug.edit`, mirroring the exact same permission
 * tier this app already uses everywhere else to gate "can see beyond the
 * read-only view" (e.g. Map's/Case Workspace's own canViewFull checks) —
 * intentionally NOT a new permission string.
 */
"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "@xyflow/react/dist/style.css";
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, useNodesState, useEdgesState, type Edge, type Node } from "@xyflow/react";
import { Network as NetworkIcon, RotateCcw, Maximize2, GitCompare, ChevronDown, ChevronUp, Info, LayoutGrid, UserCircle, Briefcase, GitBranch, Layers, Shrink, Route, Tags, MapPinned, Eye, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { DrugNetworkStatusBar } from "@/components/drug_intelligence/drug_network_status_bar";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Drawer } from "@/components/ui/drawer";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { DrugNetworkGraphNode } from "@/components/drug_intelligence/drug_network_graph_node";
import { DrugNetworkNodeDetail } from "@/components/drug_intelligence/drug_network_node_detail";
import { DrugNetworkEdgeDetail } from "@/components/drug_intelligence/drug_network_edge_detail";
import { DrugNetworkEntityPicker, type DrugNetworkEntitySelection } from "@/components/drug_intelligence/drug_network_entity_picker";
import { DrugNetworkRelationshipFilter } from "@/components/drug_intelligence/drug_network_relationship_filter";
import { DrugNetworkLegend } from "@/components/drug_intelligence/drug_network_legend";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugNetworkNeighborhood, useDrugNetworkPath } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { buildDrugNetworkFlowGraph, mergePreservingManualPositions, type DrugNetworkFlowNodeData, type FlowNode, type FlowEdge, type DrugNetworkLabelMode, type DrugNetworkNodeDensity } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import { resolveAutoLayoutMode, type DrugNetworkLayoutMode } from "@/lib/drug_intelligence/drug_network_graph_layout";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY, DRUG_GRAPH_RELATIONSHIP_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { normalizeThaiPersonnelDateForSave } from "@/lib/officer_profile/thai_personnel_date";
import { getSafeReturnTo } from "@/lib/ui/return_context";
import type { DrugGraphNode, DrugGraphEdge, DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ALL_NODE_TYPES: DrugGraphNodeType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"];
const NODE_TYPES = { drugGraphNode: DrugNetworkGraphNode };
const HARD_MAX_NODES = 150;

/** DI-9.1 Section 3: View Mode is the default, unchanged DI-5 experience. Analyst Mode is currently a scaffold only — see the file's top doc comment. */
type DrugNetworkWorkspaceMode = "VIEW" | "ANALYST";

const LAYOUT_BUTTONS: { mode: DrugNetworkLayoutMode; icon: typeof LayoutGrid; labelKey: TranslationKey }[] = [
  { mode: "AUTO", icon: LayoutGrid, labelKey: "di.network.layoutAuto" },
  { mode: "PERSON_CENTERED", icon: UserCircle, labelKey: "di.network.layoutPersonCentered" },
  { mode: "CASE_CENTERED", icon: Briefcase, labelKey: "di.network.layoutCaseCentered" },
  { mode: "HIERARCHICAL", icon: GitBranch, labelKey: "di.network.layoutHierarchical" },
  { mode: "GROUP_BY_TYPE", icon: Layers, labelKey: "di.network.layoutGroupByType" },
  { mode: "COMPACT", icon: Shrink, labelKey: "di.network.layoutCompact" },
];

// DI-9.1 Section 7/8: the status bar shows the RESOLVED layout mode, which
// (unlike LAYOUT_BUTTONS above) can be "PATH" — the internal-only mode
// Find Connection's "เปิดในผัง" switches to, never shown as its own
// toolbar button. This map covers every value resolveAutoLayoutMode /
// resolvedLayoutMode can actually produce.
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

function DrugNetworkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, can } = useAuth();
  const { t } = useT();
  const { fitView } = useReactFlow();

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
  // Section 5/8 (DI-8.1.1): only shows the "back to map" action when the
  // user actually arrived from Map/Case with a validated returnTo — never
  // fabricated for a normal/direct Network visit.
  const returnTo = getSafeReturnTo(searchParams);

  // DI-9.1: View/Analyst mode — local UI state only (Section 5's explicit
  // instruction: no DB persistence, no localStorage without a strong
  // existing pattern justifying it — none exists for this kind of
  // per-session UI toggle elsewhere in this codebase, so plain useState is
  // correct). Never written to the URL — switching modes must never look
  // like a "new page" to the browser history/back-forward stack, and must
  // never trigger the neighborhood/path queries to refetch.
  const [workspaceMode, setWorkspaceMode] = useState<DrugNetworkWorkspaceMode>("VIEW");

  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showFindConnection, setShowFindConnection] = useState(false);
  const [pathFrom, setPathFrom] = useState<DrugNetworkEntitySelection | null>(null);
  const [pathTo, setPathTo] = useState<DrugNetworkEntitySelection | null>(null);
  const [selectedNode, setSelectedNode] = useState<DrugGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DrugGraphEdge | null>(null);
  const [layoutMode, setLayoutMode] = useState<DrugNetworkLayoutMode>("AUTO");
  const [labelMode, setLabelMode] = useState<DrugNetworkLabelMode>("SELECTED_ONLY");
  const [nodeDensity, setNodeDensity] = useState<DrugNetworkNodeDensity>("STANDARD");
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  /** Section 10/13: an active Path View, set only via "เปิดในผัง" from a found Find Connection result; cleared by "กลับไปดูเครือข่ายทั้งหมด" or any focus/query change. */
  const [pathViewNodeIds, setPathViewNodeIds] = useState<string[] | null>(null);
  /** Bumped by "จัดผังใหม่" (re-arrange current layout) or "กลับไปจุดเริ่มต้น" (back to start) to force a position reset even when the query itself hasn't changed. */
  const [rearrangeToken, setRearrangeToken] = useState(0);
  /**
   * DI-5.3.1 Bug 1 fix: the focus this page FIRST loaded with, captured once
   * on mount — "กลับไปจุดเริ่มต้น" restores exactly this, not just whatever
   * updateParams happens to leave in the URL. Without this, navigating to a
   * different entity then pressing "back to start" only cleared filters on
   * the CURRENT (wrong) focus, never actually returned to the original one.
   */
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

  // Section 4: AUTO resolves deterministically from focus type / composition
  // / whether a Path View is active — never a heuristic that could vary
  // between runs on the same input.
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

  // xyflow needs a controlled nodes/edges state (useNodesState/useEdgesState)
  // plus onNodesChange wired to <ReactFlow> so drag deltas it computes
  // internally have somewhere to land — without this sink, every re-render
  // (selection, filter panel toggling, etc.) recomputes positions fresh from
  // buildDrugNetworkFlowGraph and silently discards any manual drag.
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  // Section 12/13: manual drag positions persist until the query changes, the
  // layout mode changes, Path View toggles, or "จัดผังใหม่" is pressed —
  // any of those bump this signature and force a position reset.
  const querySignature = JSON.stringify({
    focusType,
    focusId,
    depth,
    dateFrom,
    dateTo,
    maxNodes,
    selectedNodeTypes,
    selectedRelationshipTypes,
    resolvedLayoutMode,
    pathViewNodeIds,
    rearrangeToken,
  });
  const lastQuerySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!neighborhood.data) {
      setFlowNodes([]);
      setFlowEdges([]);
      lastQuerySignatureRef.current = null;
      return;
    }
    const built = buildDrugNetworkFlowGraph(neighborhood.data, (key) => t(key), selectedNode?.id ?? null, selectedEdge?.id ?? null, {
      layoutMode: resolvedLayoutMode,
      labelMode,
      nodeDensity,
      pathNodeIdsInOrder: pathViewNodeIds ?? undefined,
    });
    const isNewQuery = lastQuerySignatureRef.current !== querySignature;
    lastQuerySignatureRef.current = querySignature;

    setFlowNodes((current) => mergePreservingManualPositions(built.flowNodes, current, isNewQuery));
    setFlowEdges(built.flowEdges);
    if (isNewQuery) window.requestAnimationFrame(() => fitView({ duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhood.data, querySignature, selectedNode?.id, selectedEdge?.id, labelMode, nodeDensity]);

  function handleNodeClick(_event: unknown, node: Node) {
    const graphNode = (node.data as DrugNetworkFlowNodeData).graphNode;
    setSelectedNode(graphNode);
    setSelectedEdge(null);
  }

  function handleEdgeClick(_event: unknown, edge: Edge) {
    const graphEdge = neighborhood.data?.edges.find((e) => e.id === edge.id) ?? null;
    setSelectedEdge(graphEdge);
    setSelectedNode(null);
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

  /**
   * DI-5.3.1 Bug 1 fix — "กลับไปจุดเริ่มต้น" (Back to start), distinct from
   * "จัดผังใหม่" (Re-arrange, which only re-runs the CURRENT layout mode).
   * Back to start restores: the ORIGINAL focus entity from when this page
   * first loaded, the AUTO layout baseline, clears filters, clears the
   * node/edge selection, exits Path View, and clears any manual drag
   * positions (via the rearrange token, since the query itself may not
   * change if the user never navigated away from the original focus).
   */
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

  const canViewNetwork = can("drug.read");
  // DI-9.1 Section 4: Analyst Mode reuses the SAME permission tier every
  // other DI page already uses to gate "sees more than the plain read-only
  // view" (drug.edit) — never a new permission string. A user without
  // drug.edit can never enter Analyst Mode, even if local state were
  // somehow set to "ANALYST" (defensive: the toggle itself is also hidden
  // for them, see below).
  const canUseAnalystMode = can("drug.edit");
  const effectiveWorkspaceMode: DrugNetworkWorkspaceMode = canUseAnalystMode ? workspaceMode : "VIEW";

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

      {effectiveWorkspaceMode === "ANALYST" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="font-semibold">{t("di.network.modeAnalystBadge")}</span>
          <span className="text-accent/80">{t("di.network.analystToolsComingSoon")}</span>
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

              {/* Section 18: consolidated Layout / View toolbar — "รูปแบบผัง" */}
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

                  {/* Section 20: mobile ~375px — a compact dropdown instead of 6-8 full-width buttons */}
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

              <div className="relative h-[560px] w-full overflow-hidden rounded-xl border border-border bg-surface sm:h-[640px]" aria-describedby="drug-network-canvas-summary">
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  deleteKeyCode={null}
                  nodeTypes={NODE_TYPES}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                  fitView
                  minZoom={0.2}
                  maxZoom={2}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background />
                  <Controls showInteractive={false} />
                  <MiniMap pannable zoomable className="hidden sm:block" />
                </ReactFlow>

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

              <DrugNetworkStatusBar
                nodeCount={neighborhood.data.nodes.length}
                edgeCount={neighborhood.data.edges.length}
                selectedLabel={selectedNode?.label ?? (selectedEdge ? t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[selectedEdge.relationshipType] as TranslationKey) : null)}
                layoutLabel={t(RESOLVED_LAYOUT_LABEL_KEY[resolvedLayoutMode])}
                truncated={neighborhood.data.truncated}
              />

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
        {selectedNode ? <DrugNetworkNodeDetail node={selectedNode} onExpand={() => expandFromNode(selectedNode)} /> : null}
      </Drawer>
      <Drawer open={Boolean(selectedEdge)} onClose={() => setSelectedEdge(null)} titleId="drug-network-edge-detail" title={t("di.network.edgeDetailTitle")}>
        {selectedEdge ? (
          <DrugNetworkEdgeDetail
            edge={selectedEdge}
            sourceNode={neighborhood.data?.nodes.find((n) => n.id === selectedEdge.source) ?? null}
            targetNode={neighborhood.data?.nodes.find((n) => n.id === selectedEdge.target) ?? null}
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
