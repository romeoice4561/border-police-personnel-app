/**
 * Presentation-only viewport helper: fit a selected path into the canvas
 * region that remains visible after the right-hand detail drawer opens.
 * Never changes graph topology or relationship semantics.
 */

import { getViewportForBounds } from "@xyflow/react";

/** Mirrors Drawer panel classes `max-w-md` / `sm:max-w-lg` / `sm`. */
export const DRAWER_PANEL_MAX_WIDTH_PX = 448;
export const DRAWER_PANEL_MAX_WIDTH_SM_PX = 512;
export const DRAWER_PANEL_SM_MIN_VIEWPORT_PX = 640;

export function resolveDrawerPanelMaxWidth(viewportWidth: number): number {
  return viewportWidth >= DRAWER_PANEL_SM_MIN_VIEWPORT_PX ? DRAWER_PANEL_MAX_WIDTH_SM_PX : DRAWER_PANEL_MAX_WIDTH_PX;
}

export const PATH_FIT_MAX_ZOOM = 1.08;
export const PATH_FIT_MIN_ZOOM = 0.2;
export const PATH_FIT_PADDING = 0.28;
export const MIN_VISIBLE_CANVAS_WIDTH_PX = 160;

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 110;
const DEFAULT_FOCUS_WIDTH = 240;
const DEFAULT_FOCUS_HEIGHT = 150;

export interface PathFitNode {
  id: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
  isFocus?: boolean;
}

export function shouldFitSelectedPath(args: {
  selectedId: string | null;
  focusId: string | null;
  lastFittedSelectionId: string | null;
  isDragging: boolean;
}): boolean {
  if (args.isDragging) return false;
  if (!args.selectedId || !args.focusId) return false;
  if (args.selectedId === args.focusId) return false;
  return args.lastFittedSelectionId !== args.selectedId;
}

export function visibleCanvasWidthLeftOfDrawer(args: {
  canvasWidth: number;
  canvasRight: number;
  drawerWidth: number;
  viewportWidth: number;
}): number {
  const drawerLeft = args.viewportWidth - args.drawerWidth;
  const overlap = Math.max(0, Math.min(args.canvasWidth, args.canvasRight - drawerLeft));
  return Math.max(MIN_VISIBLE_CANVAS_WIDTH_PX, args.canvasWidth - overlap);
}

export function pathNodesBounds(nodes: PathFitNode[]): { x: number; y: number; width: number; height: number } | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const width = node.width ?? node.measured?.width ?? (node.isFocus ? DEFAULT_FOCUS_WIDTH : DEFAULT_NODE_WIDTH);
    const height = node.height ?? node.measured?.height ?? (node.isFocus ? DEFAULT_FOCUS_HEIGHT : DEFAULT_NODE_HEIGHT);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function computeDrawerAwarePathViewport(args: {
  nodes: PathFitNode[];
  canvasWidth: number;
  canvasHeight: number;
  canvasRight: number;
  drawerWidth: number;
  viewportWidth: number;
  maxZoom?: number;
  minZoom?: number;
  padding?: number;
}): { x: number; y: number; zoom: number } | null {
  const bounds = pathNodesBounds(args.nodes);
  if (!bounds) return null;
  const visibleWidth = visibleCanvasWidthLeftOfDrawer({
    canvasWidth: args.canvasWidth,
    canvasRight: args.canvasRight,
    drawerWidth: args.drawerWidth,
    viewportWidth: args.viewportWidth,
  });
  const height = Math.max(1, args.canvasHeight);
  return getViewportForBounds(
    bounds,
    visibleWidth,
    height,
    args.minZoom ?? PATH_FIT_MIN_ZOOM,
    args.maxZoom ?? PATH_FIT_MAX_ZOOM,
    args.padding ?? PATH_FIT_PADDING
  );
}

export function measureDrawerWidth(drawer: Element | null, viewportWidth: number): number {
  const measured = drawer instanceof HTMLElement ? drawer.getBoundingClientRect().width : 0;
  return measured > 0 ? measured : resolveDrawerPanelMaxWidth(viewportWidth);
}
