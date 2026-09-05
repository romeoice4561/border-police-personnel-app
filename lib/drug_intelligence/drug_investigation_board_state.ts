/**
 * Saved Investigation Board JSON document (DI-9.5B).
 *
 * Analyst workspace overlay only — never a factual Drug Intelligence record.
 * Does not include React Flow runtime objects, callbacks, File/blob URLs,
 * selection, or other ephemeral UI state.
 */

import type { DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_network_graph_types";
import type { DrugNetworkLayoutMode } from "@/lib/drug_intelligence/drug_network_graph_layout";
import type { DrugNetworkAnnotationType, DrugNetworkAnnotationStrokeDash } from "@/lib/drug_intelligence/drug_network_annotations";
import type { DrugNetworkEdgeRouteMode } from "@/lib/drug_intelligence/drug_network_edge_routing";

export const DRUG_INVESTIGATION_BOARD_SCHEMA_VERSION = 1;
export const DRUG_INVESTIGATION_BOARD_STATE_MAX_BYTES = 1_048_576;

export type DrugInvestigationBoardLabelMode = "ALL" | "SELECTED_ONLY" | "HIDDEN";
export type DrugInvestigationBoardNodeDensity = "STANDARD" | "COMPACT";

export interface DrugInvestigationBoardGraphContextV1 {
  focusType: DrugGraphNodeType;
  focusId: string;
  depth: number;
  dateFrom?: string;
  dateTo?: string;
  maxNodes?: number;
  nodeTypes?: DrugGraphNodeType[];
  relationshipTypes?: DrugGraphRelationshipType[];
  pathViewNodeIds?: string[];
}

export interface DrugInvestigationBoardViewportV1 {
  x: number;
  y: number;
  zoom: number;
}

export interface DrugInvestigationBoardPresentationV1 {
  layoutMode: DrugNetworkLayoutMode;
  labelMode: DrugInvestigationBoardLabelMode;
  nodeDensity: DrugInvestigationBoardNodeDensity;
  boardLocked: boolean;
  viewport: DrugInvestigationBoardViewportV1;
}

export interface DrugInvestigationBoardNodeLayoutV1 {
  entityType: DrugGraphNodeType;
  entityId: string;
  x: number;
  y: number;
  pinned: boolean;
}

export interface DrugInvestigationBoardWaypointV1 {
  id: string;
  x: number;
  y: number;
}

export interface DrugInvestigationBoardEdgeRouteV1 {
  edgeId: string;
  mode: DrugNetworkEdgeRouteMode;
  waypoints: DrugInvestigationBoardWaypointV1[];
}

export interface DrugInvestigationBoardAnnotationV1 {
  id: string;
  type: DrugNetworkAnnotationType;
  color: string;
  fillColor: string;
  strokeWidth: number;
  strokeDash?: DrugNetworkAnnotationStrokeDash;
  text?: string;
  fontSize?: number;
  endOffset?: { x: number; y: number };
  position: { x: number; y: number };
  width?: number;
  height?: number;
  caption?: string;
  /** Future DI-9.5D storage id. Never a blob:/data:/http(s) URL. */
  imageId?: string;
}

export interface DrugInvestigationBoardStateV1 {
  schemaVersion: typeof DRUG_INVESTIGATION_BOARD_SCHEMA_VERSION;
  graphContext: DrugInvestigationBoardGraphContextV1;
  presentation: DrugInvestigationBoardPresentationV1;
  nodeLayout: DrugInvestigationBoardNodeLayoutV1[];
  pinnedNodeIds: string[];
  edgeRoutes: DrugInvestigationBoardEdgeRouteV1[];
  annotations: DrugInvestigationBoardAnnotationV1[];
}

/**
 * Serializable snapshot of the current analyst workspace (no React / xyflow).
 * Used by the serializer; 9.5C will build this from page state.
 */
export interface DrugInvestigationBoardWorkspaceSnapshot {
  graphContext: DrugInvestigationBoardGraphContextV1;
  presentation: DrugInvestigationBoardPresentationV1;
  nodes: Array<{
    id: string;
    type: DrugGraphNodeType;
    position: { x: number; y: number };
    pinned?: boolean;
  }>;
  pinnedNodeIds: string[];
  edgeRoutes: Record<string, { mode: DrugNetworkEdgeRouteMode; waypoints: DrugInvestigationBoardWaypointV1[] }>;
  annotations: Array<{
    id: string;
    type: DrugNetworkAnnotationType;
    color: string;
    fillColor: string;
    strokeWidth: number;
    strokeDash?: DrugNetworkAnnotationStrokeDash;
    text?: string;
    fontSize?: number;
    endOffset?: { x: number; y: number };
    caption?: string;
    imageSrc?: string;
    imageId?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
  }>;
}
