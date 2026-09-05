/**
 * Pure serializer: analyst workspace snapshot → DrugInvestigationBoardStateV1.
 *
 * Merges annotation style/content with xyflow geometry. Drops ephemeral UI
 * (selection, tools, blob registry, callbacks). Rejects unsavable image
 * sources — ad-hoc Network may still use blob: URLs in memory.
 */

import {
  DRUG_INVESTIGATION_BOARD_SCHEMA_VERSION,
  type DrugInvestigationBoardAnnotationV1,
  type DrugInvestigationBoardStateV1,
  type DrugInvestigationBoardWorkspaceSnapshot,
} from "@/lib/drug_intelligence/drug_investigation_board_state";

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const FORBIDDEN_IMAGE_SRC = /^(blob:|data:|https?:)/i;

export function createPersistedAnnotationId(): string {
  return `ann-${createUuid()}`;
}

export function toStableAnnotationId(id: string): string {
  if (/^ann-[A-Za-z0-9_-]+$/.test(id)) return id;
  return createPersistedAnnotationId();
}

export class BoardImageSourceRejectedError extends Error {
  readonly code = "UNSUPPORTED_IMAGE_SOURCE";
  constructor(public readonly annotationId: string) {
    super("Persisted boards cannot store blob:, data:, or remote image URLs");
    this.name = "BoardImageSourceRejectedError";
  }
}

export function serializeInvestigationBoardState(
  snapshot: DrugInvestigationBoardWorkspaceSnapshot
): DrugInvestigationBoardStateV1 {
  const pinned = new Set(snapshot.pinnedNodeIds);
  const nodeLayout = snapshot.nodes.map((node) => ({
    entityType: node.type,
    entityId: node.id,
    x: node.position.x,
    y: node.position.y,
    pinned: node.pinned === true || pinned.has(node.id),
  }));

  const pinnedNodeIds = [...new Set(nodeLayout.filter((n) => n.pinned).map((n) => n.entityId))];

  const edgeRoutes = Object.entries(snapshot.edgeRoutes).map(([edgeId, route]) => ({
    edgeId,
    mode: route.mode,
    waypoints: route.waypoints.map((wp) => ({ id: wp.id, x: wp.x, y: wp.y })),
  }));

  const annotations: DrugInvestigationBoardAnnotationV1[] = snapshot.annotations.map((ann) => {
    if (ann.imageSrc && FORBIDDEN_IMAGE_SRC.test(ann.imageSrc)) {
      throw new BoardImageSourceRejectedError(ann.id);
    }
    const persisted: DrugInvestigationBoardAnnotationV1 = {
      id: toStableAnnotationId(ann.id),
      type: ann.type,
      color: ann.color,
      fillColor: ann.fillColor,
      strokeWidth: ann.strokeWidth,
      position: { x: ann.position.x, y: ann.position.y },
    };
    if (ann.strokeDash) persisted.strokeDash = ann.strokeDash;
    if (ann.text !== undefined) persisted.text = ann.text;
    if (ann.fontSize !== undefined) persisted.fontSize = ann.fontSize;
    if (ann.endOffset) persisted.endOffset = { x: ann.endOffset.x, y: ann.endOffset.y };
    if (ann.width !== undefined) persisted.width = ann.width;
    if (ann.height !== undefined) persisted.height = ann.height;
    if (ann.caption !== undefined) persisted.caption = ann.caption;
    if (ann.imageId) persisted.imageId = ann.imageId;
    return persisted;
  });

  return {
    schemaVersion: DRUG_INVESTIGATION_BOARD_SCHEMA_VERSION,
    graphContext: { ...snapshot.graphContext },
    presentation: {
      ...snapshot.presentation,
      viewport: { ...snapshot.presentation.viewport },
    },
    nodeLayout,
    pinnedNodeIds,
    edgeRoutes,
    annotations,
  };
}
