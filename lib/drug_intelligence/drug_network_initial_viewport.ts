/**
 * Presentation-only initial viewport policy for the Network canvas.
 * Does not change hop calculation, relationships, queries, or graph data.
 *
 * Depth-2 PERSON BY-DEPTH entry is readability-first: fit focus + hop 1 +
 * enough ชั้น 2 heading/context to show that intelligence continues below.
 * The toolbar "fit to screen" action remains a full-graph overview.
 */

import { getViewportForBounds } from "@xyflow/react";
import {
  shouldPreserveViewportForPathEmptyState,
  type NetworkDepthCanvasArrangement,
  type NetworkDepthViewMode,
} from "@/lib/drug_intelligence/drug_network_depth_view";
import { pathNodesBounds, type PathFitNode } from "@/lib/drug_intelligence/drug_network_drawer_viewport";

export const READABLE_INITIAL_MIN_ZOOM = 0.2;
export const READABLE_INITIAL_MAX_ZOOM = 1.12;
export const READABLE_INITIAL_PADDING = 0.18;
export const HOP2_HEADING_HALF_WIDTH = 160;
export const HOP2_HEADING_HALF_HEIGHT = 16;
/** Extra bottom pad past the first Hop-2 row so card bottoms are not clipped. */
export const HOP2_CONTINUATION_PEEK_PX = 24;
const FIRST_HOP2_ROW_TOLERANCE_PX = 40;

export type InitialViewportKind =
  | "PRESERVE"
  | "DRAWER_AWARE_PATH"
  | "READABLE_HOP_CONTEXT"
  | "DEPTH1_PERSON_NEIGHBORS"
  | "FULL_GRAPH";

export interface ReadableFitNode extends PathFitNode {
  hopDistance: number;
}

export interface HopBandHeadingPoint {
  hop: 1 | 2;
  x: number;
  y: number;
}

export function resolveInitialViewportKind(args: {
  focusType: string | null | undefined;
  depth: 1 | 2;
  viewMode: NetworkDepthViewMode;
  canvasArrangement: NetworkDepthCanvasArrangement;
  hasSelectedSecondary: boolean;
}): InitialViewportKind {
  if (
    shouldPreserveViewportForPathEmptyState({
      depth: args.depth,
      viewMode: args.viewMode,
      hasSelectedSecondary: args.hasSelectedSecondary,
    })
  ) {
    return "PRESERVE";
  }
  if (args.depth === 2 && args.canvasArrangement === "VERTICAL_PATH" && args.hasSelectedSecondary) {
    return "DRAWER_AWARE_PATH";
  }
  if (args.focusType === "PERSON" && args.depth === 2 && args.canvasArrangement === "GROUP_BY_HOP") {
    return "READABLE_HOP_CONTEXT";
  }
  if (args.focusType === "PERSON" && args.depth === 1) {
    return "DEPTH1_PERSON_NEIGHBORS";
  }
  return "FULL_GRAPH";
}

export function selectReadableHopContextNodes(nodes: ReadableFitNode[]): ReadableFitNode[] {
  const primary = nodes.filter((node) => node.hopDistance <= 1);
  const hop2 = nodes.filter((node) => node.hopDistance >= 2);
  if (hop2.length === 0) return primary;
  const minHop2Y = Math.min(...hop2.map((node) => node.position.y));
  const firstRow = hop2.filter((node) => node.position.y <= minHop2Y + FIRST_HOP2_ROW_TOLERANCE_PX);
  return [...primary, ...firstRow];
}

export function computeReadableHopContextBounds(args: {
  nodes: ReadableFitNode[];
  hopBandHeadings?: HopBandHeadingPoint[];
}): { x: number; y: number; width: number; height: number } | null {
  // Fit Focus + Hop 1 + first Hop-2 row (not the entire Depth-2 graph).
  const contextNodes = selectReadableHopContextNodes(args.nodes);
  const bounds = pathNodesBounds(contextNodes);
  if (!bounds) return null;

  let minX = bounds.x;
  let minY = bounds.y;
  let maxX = bounds.x + bounds.width;
  let maxY = bounds.y + bounds.height;

  for (const heading of args.hopBandHeadings ?? []) {
    minX = Math.min(minX, heading.x - HOP2_HEADING_HALF_WIDTH);
    maxX = Math.max(maxX, heading.x + HOP2_HEADING_HALF_WIDTH);
    minY = Math.min(minY, heading.y - HOP2_HEADING_HALF_HEIGHT);
    if (heading.hop === 2) {
      maxY = Math.max(maxY, heading.y + HOP2_HEADING_HALF_HEIGHT);
    }
  }

  // Small pad so the first Hop-2 card bottoms are not flush-clipped.
  const hop2 = contextNodes.filter((node) => node.hopDistance >= 2);
  if (hop2.length > 0) {
    const hop2Bottom = Math.max(
      ...hop2.map((node) => node.position.y + (node.height ?? (node.isFocus ? 150 : 110))),
    );
    maxY = Math.max(maxY, hop2Bottom + HOP2_CONTINUATION_PEEK_PX);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function computeReadableHopContextViewport(args: {
  nodes: ReadableFitNode[];
  hopBandHeadings?: HopBandHeadingPoint[];
  canvasWidth: number;
  canvasHeight: number;
  minZoom?: number;
  maxZoom?: number;
  padding?: number;
}): { x: number; y: number; zoom: number } | null {
  const bounds = computeReadableHopContextBounds({
    nodes: args.nodes,
    hopBandHeadings: args.hopBandHeadings,
  });
  if (!bounds) return null;
  return getViewportForBounds(
    bounds,
    Math.max(1, args.canvasWidth),
    Math.max(1, args.canvasHeight),
    args.minZoom ?? READABLE_INITIAL_MIN_ZOOM,
    args.maxZoom ?? READABLE_INITIAL_MAX_ZOOM,
    args.padding ?? READABLE_INITIAL_PADDING
  );
}

export function isNodeVisibleInViewport(args: {
  node: ReadableFitNode;
  viewport: { x: number; y: number; zoom: number };
  canvasWidth: number;
  canvasHeight: number;
}): boolean {
  const width = args.node.width ?? (args.node.isFocus ? 240 : 180);
  const height = args.node.height ?? (args.node.isFocus ? 150 : 110);
  const left = args.node.position.x * args.viewport.zoom + args.viewport.x;
  const top = args.node.position.y * args.viewport.zoom + args.viewport.y;
  const right = left + width * args.viewport.zoom;
  const bottom = top + height * args.viewport.zoom;
  return right >= 0 && left <= args.canvasWidth && bottom >= 0 && top <= args.canvasHeight;
}
