/**
 * DI-9.5C — Saved Investigation Board workspace helpers.
 *
 * Pure snapshot / dirty / URL / image-block utilities used by the Network
 * page. Never writes factual Drug Intelligence records.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import { isAnnotationId, type DrugNetworkAnnotation } from "@/lib/drug_intelligence/drug_network_annotations";
import { drugInvestigationBoardStateV1Schema } from "@/lib/drug_intelligence/drug_investigation_board_api_schemas";
import type { BoardReconciliationResult } from "@/lib/drug_intelligence/drug_investigation_board_hydrate";
import type {
  DrugInvestigationBoardAnnotationV1,
  DrugInvestigationBoardEdgeRouteV1,
  DrugInvestigationBoardGraphContextV1,
  DrugInvestigationBoardNodeLayoutV1,
  DrugInvestigationBoardStateV1,
  DrugInvestigationBoardViewportV1,
  DrugInvestigationBoardWorkspaceSnapshot,
} from "@/lib/drug_intelligence/drug_investigation_board_state";
import type { DrugNetworkEdgeRoutes } from "@/lib/drug_intelligence/drug_network_edge_routing";
import type { DrugNetworkLayoutMode } from "@/lib/drug_intelligence/drug_network_graph_layout";
import type { DrugNetworkLabelMode, DrugNetworkNodeDensity } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_network_graph_types";
import { toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";

const UNPERSISTABLE_IMAGE_SRC = /^(blob:|data:|https?:)/i;

export type InvestigationBoardWorkspaceFlowNode = {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  data?: unknown;
};

export function boardHasUnpersistableImages(
  annotations: Array<{ imageSrc?: string | null; imageId?: string | null }>
): boolean {
  return annotations.some((ann) => {
    if (ann.imageId) return false;
    return typeof ann.imageSrc === "string" && UNPERSISTABLE_IMAGE_SRC.test(ann.imageSrc);
  });
}

export function snapshotWithoutLocalImageSources(
  snapshot: DrugInvestigationBoardWorkspaceSnapshot
): DrugInvestigationBoardWorkspaceSnapshot {
  return {
    ...snapshot,
    annotations: snapshot.annotations.map((ann) => {
      if (ann.imageId || !ann.imageSrc || !UNPERSISTABLE_IMAGE_SRC.test(ann.imageSrc)) return ann;
      const { imageSrc: _imageSrc, ...rest } = ann;
      void _imageSrc;
      return rest;
    }),
  };
}

export function annotationsNeedingImageUpload(
  annotations: Array<{ id: string; imageSrc?: string | null; imageId?: string | null }>
): Array<{ id: string; imageSrc: string }> {
  return annotations
    .filter((ann): ann is { id: string; imageSrc: string; imageId?: string | null } =>
      !ann.imageId && typeof ann.imageSrc === "string" && /^blob:/i.test(ann.imageSrc)
    )
    .map((ann) => ({ id: ann.id, imageSrc: ann.imageSrc }));
}

export function defaultInvestigationBoardTitle(focusLabel?: string | null): string {
  const trimmed = focusLabel?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "";
}

export function parseInvestigationBoardState(raw: unknown): DrugInvestigationBoardStateV1 | null {
  const parsed = drugInvestigationBoardStateV1Schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function isInvestigationBoardConflictError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 409;
}

export function buildInvestigationBoardGraphContext(input: {
  focusType: DrugGraphNodeType;
  focusId: string;
  depth: number;
  dateFrom?: string;
  dateTo?: string;
  maxNodes?: number;
  nodeTypes?: DrugGraphNodeType[];
  relationshipTypes?: DrugGraphRelationshipType[];
  pathViewNodeIds?: string[] | null;
}): DrugInvestigationBoardGraphContextV1 {
  const context: DrugInvestigationBoardGraphContextV1 = {
    focusType: input.focusType,
    focusId: input.focusId,
    depth: input.depth === 2 ? 2 : 1,
  };
  if (input.dateFrom) context.dateFrom = input.dateFrom;
  if (input.dateTo) context.dateTo = input.dateTo;
  if (input.maxNodes !== undefined) context.maxNodes = input.maxNodes;
  if (input.nodeTypes && input.nodeTypes.length > 0) context.nodeTypes = [...input.nodeTypes];
  if (input.relationshipTypes && input.relationshipTypes.length > 0) {
    context.relationshipTypes = [...input.relationshipTypes];
  }
  if (input.pathViewNodeIds && input.pathViewNodeIds.length > 0) {
    context.pathViewNodeIds = [...input.pathViewNodeIds];
  }
  return context;
}

export function applyInvestigationBoardGraphContextPatch(
  current: DrugInvestigationBoardGraphContextV1,
  patch: Record<string, string | undefined>
): DrugInvestigationBoardGraphContextV1 {
  const next: DrugInvestigationBoardGraphContextV1 = { ...current };
  if ("focusType" in patch && patch.focusType) {
    next.focusType = patch.focusType as DrugGraphNodeType;
  }
  if ("focusId" in patch && patch.focusId) {
    next.focusId = patch.focusId;
  }
  if ("depth" in patch) {
    next.depth = patch.depth === "2" ? 2 : 1;
  }
  if ("dateFrom" in patch) {
    const iso = patch.dateFrom ? toGregorianDateInputValue(patch.dateFrom) ?? undefined : undefined;
    if (iso) next.dateFrom = iso;
    else delete next.dateFrom;
  }
  if ("dateTo" in patch) {
    const iso = patch.dateTo ? toGregorianDateInputValue(patch.dateTo) ?? undefined : undefined;
    if (iso) next.dateTo = iso;
    else delete next.dateTo;
  }
  if ("maxNodes" in patch) {
    if (!patch.maxNodes) delete next.maxNodes;
    else {
      const parsed = Number(patch.maxNodes);
      if (Number.isFinite(parsed) && parsed > 0) next.maxNodes = parsed;
      else delete next.maxNodes;
    }
  }
  if ("nodeTypes" in patch) {
    if (!patch.nodeTypes) delete next.nodeTypes;
    else next.nodeTypes = patch.nodeTypes.split(",") as DrugGraphNodeType[];
  }
  if ("relationshipTypes" in patch) {
    if (!patch.relationshipTypes) delete next.relationshipTypes;
    else next.relationshipTypes = patch.relationshipTypes.split(",") as DrugGraphRelationshipType[];
  }
  return next;
}

export function buildInvestigationBoardWorkspaceSnapshot(input: {
  graphContext: DrugInvestigationBoardGraphContextV1;
  layoutMode: DrugNetworkLayoutMode;
  labelMode: DrugNetworkLabelMode;
  nodeDensity: DrugNetworkNodeDensity;
  boardLocked: boolean;
  viewport: DrugInvestigationBoardViewportV1;
  flowNodes: InvestigationBoardWorkspaceFlowNode[];
  pinnedNodeIds: Iterable<string>;
  edgeRoutes: DrugNetworkEdgeRoutes;
  annotations: DrugNetworkAnnotation[];
}): DrugInvestigationBoardWorkspaceSnapshot {
  const pinned = new Set(input.pinnedNodeIds);
  const nodes: DrugInvestigationBoardWorkspaceSnapshot["nodes"] = [];

  for (const node of input.flowNodes) {
    if (isAnnotationId(node.id)) continue;
    const data = node.data as { graphNode?: { type?: DrugGraphNodeType } } | undefined;
    const type = data?.graphNode?.type;
    if (!type) continue;
    nodes.push({
      id: node.id,
      type,
      position: { x: node.position.x, y: node.position.y },
      pinned: pinned.has(node.id),
    });
  }

  const annotations = input.annotations.map((ann) => {
    const node = input.flowNodes.find((n) => n.id === ann.id);
    const nodeData = node?.data as { annotation?: DrugNetworkAnnotation } | undefined;
    const endOffset = nodeData?.annotation?.endOffset ?? ann.endOffset;
    const imageSrc = nodeData?.annotation?.imageSrc ?? ann.imageSrc;
    const imageId = nodeData?.annotation?.imageId ?? ann.imageId;
    const persisted: DrugInvestigationBoardWorkspaceSnapshot["annotations"][number] = {
      id: ann.id,
      type: ann.type,
      color: ann.color,
      fillColor: ann.fillColor,
      strokeWidth: ann.strokeWidth,
      position: node?.position ?? { x: 0, y: 0 },
    };
    if (ann.strokeDash) persisted.strokeDash = ann.strokeDash;
    if (ann.text !== undefined) persisted.text = ann.text;
    if (ann.fontSize !== undefined) persisted.fontSize = ann.fontSize;
    if (endOffset) persisted.endOffset = { x: endOffset.x, y: endOffset.y };
    if (ann.caption !== undefined) persisted.caption = ann.caption;
    if (imageSrc) persisted.imageSrc = imageSrc;
    if (imageId) persisted.imageId = imageId;
    if (node?.width != null) persisted.width = Number(node.width);
    if (node?.height != null) persisted.height = Number(node.height);
    return persisted;
  });

  return {
    graphContext: { ...input.graphContext },
    presentation: {
      layoutMode: input.layoutMode,
      labelMode: input.labelMode,
      nodeDensity: input.nodeDensity,
      boardLocked: input.boardLocked,
      viewport: { ...input.viewport },
    },
    nodes,
    pinnedNodeIds: [...pinned],
    edgeRoutes: { ...input.edgeRoutes },
    annotations,
  };
}

export function investigationBoardDirtySignature(
  snapshot: DrugInvestigationBoardWorkspaceSnapshot
): string {
  const presentation = {
    layoutMode: snapshot.presentation.layoutMode,
    labelMode: snapshot.presentation.labelMode,
    nodeDensity: snapshot.presentation.nodeDensity,
    boardLocked: snapshot.presentation.boardLocked,
  };
  return JSON.stringify({
    graphContext: canonicalize(snapshot.graphContext),
    presentation: canonicalize(presentation),
    nodes: [...snapshot.nodes]
      .map((node) => ({
        id: node.id,
        type: node.type,
        x: node.position.x,
        y: node.position.y,
        pinned: node.pinned === true,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    pinnedNodeIds: [...new Set(snapshot.pinnedNodeIds)].sort(),
    edgeRoutes: Object.entries(snapshot.edgeRoutes)
      .map(([edgeId, route]) => ({
        edgeId,
        mode: route.mode,
        waypoints: route.waypoints.map((wp) => ({ id: wp.id, x: wp.x, y: wp.y })),
      }))
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId)),
    annotations: [...snapshot.annotations]
      .map((ann) => ({
        id: ann.id,
        type: ann.type,
        color: ann.color,
        fillColor: ann.fillColor,
        strokeWidth: ann.strokeWidth,
        strokeDash: ann.strokeDash ?? null,
        text: ann.text ?? null,
        fontSize: ann.fontSize ?? null,
        endOffset: ann.endOffset ?? null,
        caption: ann.caption ?? null,
        imageSrc: ann.imageSrc ?? null,
        imageId: ann.imageId ?? null,
        x: ann.position.x,
        y: ann.position.y,
        width: ann.width ?? null,
        height: ann.height ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function investigationBoardIsDirty(
  baseline: string | null,
  current: DrugInvestigationBoardWorkspaceSnapshot
): boolean {
  if (!baseline) return false;
  return baseline !== investigationBoardDirtySignature(current);
}

export function shouldConfirmLeaveSavedBoard(isDirty: boolean): boolean {
  return isDirty;
}

export function shouldBlockDuplicateWhileDirty(isDirty: boolean): boolean {
  return isDirty;
}

export function edgeRoutesFromPersisted(
  routes: DrugInvestigationBoardEdgeRouteV1[]
): DrugNetworkEdgeRoutes {
  const next: DrugNetworkEdgeRoutes = {};
  for (const route of routes) {
    next[route.edgeId] = {
      mode: route.mode,
      waypoints: route.waypoints.map((wp) => ({ id: wp.id, x: wp.x, y: wp.y })),
    };
  }
  return next;
}

export function annotationsFromPersisted(
  annotations: DrugInvestigationBoardAnnotationV1[]
): DrugNetworkAnnotation[] {
  return annotations.map((ann) => {
    const next: DrugNetworkAnnotation = {
      id: ann.id,
      type: ann.type,
      color: ann.color,
      fillColor: ann.fillColor,
      strokeWidth: ann.strokeWidth,
    };
    if (ann.strokeDash) next.strokeDash = ann.strokeDash;
    if (ann.text !== undefined) next.text = ann.text;
    if (ann.fontSize !== undefined) next.fontSize = ann.fontSize;
    if (ann.endOffset) next.endOffset = { x: ann.endOffset.x, y: ann.endOffset.y };
    if (ann.caption !== undefined) next.caption = ann.caption;
    if (ann.imageId) next.imageId = ann.imageId;
    return next;
  });
}

export function applyHydratedNodePositions<T extends { id: string; position: { x: number; y: number } }>(
  nodes: T[],
  layout: DrugInvestigationBoardNodeLayoutV1[]
): T[] {
  const byId = new Map(layout.map((item) => [item.entityId, item]));
  return nodes.map((node) => {
    const saved = byId.get(node.id);
    return saved ? { ...node, position: { x: saved.x, y: saved.y } } : node;
  });
}

export function investigationBoardReconciliationCounts(result: BoardReconciliationResult): {
  orphanCount: number;
  droppedRouteCount: number;
} {
  return {
    orphanCount: result.orphanedNodeRefs.length,
    droppedRouteCount: result.droppedEdgeRoutes.length,
  };
}

export function buildSavedBoardNetworkHref(boardId: string, returnTo?: string | null): string {
  const params = new URLSearchParams();
  params.set("boardId", boardId);
  if (returnTo) params.set("returnTo", returnTo);
  return `/drug-intelligence/network?${params.toString()}`;
}

export function buildAdHocNetworkHref(input?: {
  graphContext?: DrugInvestigationBoardGraphContextV1 | null;
  returnTo?: string | null;
}): string {
  const params = new URLSearchParams();
  const ctx = input?.graphContext;
  if (ctx?.focusType && ctx.focusId) {
    params.set("focusType", ctx.focusType);
    params.set("focusId", ctx.focusId);
    if (ctx.depth === 2) params.set("depth", "2");
    if (ctx.dateFrom) params.set("dateFrom", ctx.dateFrom);
    if (ctx.dateTo) params.set("dateTo", ctx.dateTo);
    if (ctx.maxNodes !== undefined) params.set("maxNodes", String(ctx.maxNodes));
    if (ctx.nodeTypes?.length) params.set("nodeTypes", ctx.nodeTypes.join(","));
    if (ctx.relationshipTypes?.length) params.set("relationshipTypes", ctx.relationshipTypes.join(","));
  }
  if (input?.returnTo) params.set("returnTo", input.returnTo);
  const query = params.toString();
  return query ? `/drug-intelligence/network?${query}` : "/drug-intelligence/network";
}

export function snapshotFromPersistedBoardState(
  state: DrugInvestigationBoardStateV1
): DrugInvestigationBoardWorkspaceSnapshot {
  return {
    graphContext: { ...state.graphContext },
    presentation: {
      ...state.presentation,
      viewport: { ...state.presentation.viewport },
    },
    nodes: state.nodeLayout.map((node) => ({
      id: node.entityId,
      type: node.entityType,
      position: { x: node.x, y: node.y },
      pinned: node.pinned,
    })),
    pinnedNodeIds: [...state.pinnedNodeIds],
    edgeRoutes: edgeRoutesFromPersisted(state.edgeRoutes),
    annotations: state.annotations.map((ann) => ({
      id: ann.id,
      type: ann.type,
      color: ann.color,
      fillColor: ann.fillColor,
      strokeWidth: ann.strokeWidth,
      strokeDash: ann.strokeDash,
      text: ann.text,
      fontSize: ann.fontSize,
      endOffset: ann.endOffset,
      caption: ann.caption,
      imageId: ann.imageId,
      position: { ...ann.position },
      width: ann.width,
      height: ann.height,
    })),
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}
