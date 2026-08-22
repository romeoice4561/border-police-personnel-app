/**
 * Network Intelligence / Link Analysis workspace (Phase DI-5, Sections 7-13,
 * 17, 20).
 *
 * URL-persisted focus (focusType/focusId) so the workspace is bookmarkable
 * and back/forward-friendly, matching every other DI page's convention.
 * Never claims proof of association (Section "mission") — every node/edge
 * label and drawer routes through the neutral wording DI-5's typed
 * contract already enforces structurally (edgeKind, explanation facts).
 */
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@xyflow/react/dist/style.css";
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, type Edge, type Node } from "@xyflow/react";
import { Network as NetworkIcon, RotateCcw, Maximize2, GitCompare, ChevronDown, ChevronUp, Info } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
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
import { buildDrugNetworkFlowGraph, type DrugNetworkFlowNodeData } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY, DRUG_GRAPH_RELATIONSHIP_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { normalizeThaiPersonnelDateForSave } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugGraphNode, DrugGraphEdge, DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ALL_NODE_TYPES: DrugGraphNodeType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"];
const NODE_TYPES = { drugGraphNode: DrugNetworkGraphNode };
const HARD_MAX_NODES = 150;

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

  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showFindConnection, setShowFindConnection] = useState(false);
  const [pathFrom, setPathFrom] = useState<DrugNetworkEntitySelection | null>(null);
  const [pathTo, setPathTo] = useState<DrugNetworkEntitySelection | null>(null);
  const [selectedNode, setSelectedNode] = useState<DrugGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DrugGraphEdge | null>(null);

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

  const { flowNodes, flowEdges } = neighborhood.data
    ? buildDrugNetworkFlowGraph(neighborhood.data, (key) => t(key), selectedNode?.id ?? null, selectedEdge?.id ?? null)
    : { flowNodes: [] as Node[], flowEdges: [] as Edge[] };

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
  }

  const canViewNetwork = can("drug.read");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.network.title")}
        description={t("di.network.description")}
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowFindConnection((v) => !v)}>
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            {t("di.network.findConnection")}
          </Button>
        }
      />

      {!canViewNetwork ? (
        <ErrorState title={t("di.network.permissionDenied")} />
      ) : (
        <>
          <Card>
            <CardBody className="space-y-2">
              <DrugNetworkEntityPicker
                onSelect={(selection) => updateParams({ focusType: selection.entityType, focusId: selection.entityId, depth: undefined })}
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

              <div className="relative h-[560px] w-full overflow-hidden rounded-xl border border-border bg-surface sm:h-[640px]" aria-describedby="drug-network-canvas-summary">
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
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
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => fitView({ duration: 300 })}>
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  {t("di.network.fitToScreen")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateParams({ depth: undefined, nodeTypes: undefined, relationshipTypes: undefined, dateFrom: undefined, dateTo: undefined, maxNodes: undefined })}
                >
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
        {selectedEdge ? <DrugNetworkEdgeDetail edge={selectedEdge} /> : null}
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
