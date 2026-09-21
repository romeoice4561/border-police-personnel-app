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
/** DI-8.4 follow-up: slightly closer fit so short explained paths stay readable. */
export const PATH_FOCUS_MAX_ZOOM = 1.22;
export const PATH_FOCUS_PADDING = 0.22;
export const PATH_FOCUS_FIT_DURATION_MS = 350;
export const MIN_VISIBLE_CANVAS_WIDTH_PX = 160;

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 110;
const DEFAULT_FOCUS_WIDTH = 240;
const DEFAULT_FOCUS_HEIGHT = 150;

export type NetworkPathCameraMode = "SELECTED_PATH" | "FULL_NETWORK";

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

/** Stable camera key: refit when selection OR active path alternative changes. */
export function pathCameraFitKey(args: {
  selectedId: string | null;
  pathSignature: string | null;
}): string | null {
  if (!args.selectedId || !args.pathSignature) return null;
  return `${args.selectedId}|${args.pathSignature}`;
}

/**
 * Path-camera autofit gate (DI-8.4 follow-up).
 * Fires once per (selection, pathSignature) while in SELECTED_PATH mode.
 * Never while dragging; never in FULL_NETWORK mode (manual pan stays free).
 */
export function shouldFitPathCamera(args: {
  selectedId: string | null;
  focusId: string | null;
  pathSignature: string | null;
  lastFittedKey: string | null;
  cameraMode: NetworkPathCameraMode;
  isDragging: boolean;
}): boolean {
  if (args.isDragging) return false;
  if (args.cameraMode !== "SELECTED_PATH") return false;
  if (!args.selectedId || !args.focusId) return false;
  if (args.selectedId === args.focusId) return false;
  const key = pathCameraFitKey({ selectedId: args.selectedId, pathSignature: args.pathSignature });
  if (!key) return false;
  return args.lastFittedKey !== key;
}

/** Map explained path node ids onto live flow positions — never invents coordinates. */
export function collectPathFitNodes(args: {
  pathNodeIds: readonly string[];
  focusId: string | null;
  nodes: ReadonlyArray<{
    id: string;
    position: { x: number; y: number };
    width?: number | null;
    height?: number | null;
    measured?: { width?: number; height?: number } | null;
  }>;
}): PathFitNode[] {
  const byId = new Map(args.nodes.map((node) => [node.id, node]));
  const out: PathFitNode[] = [];
  for (const id of args.pathNodeIds) {
    const node = byId.get(id);
    if (!node) continue;
    out.push({
      id,
      position: node.position,
      width: node.width ?? node.measured?.width ?? undefined,
      height: node.height ?? node.measured?.height ?? undefined,
      isFocus: Boolean(args.focusId && id === args.focusId),
    });
  }
  return out;
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

/** Path-focus camera: same drawer-aware math, tuned padding/maxZoom for readability. */
export function computeSelectedPathFocusViewport(args: {
  nodes: PathFitNode[];
  canvasWidth: number;
  canvasHeight: number;
  canvasRight: number;
  drawerWidth: number;
  viewportWidth: number;
}): { x: number; y: number; zoom: number } | null {
  return computeDrawerAwarePathViewport({
    ...args,
    maxZoom: PATH_FOCUS_MAX_ZOOM,
    padding: PATH_FOCUS_PADDING,
  });
}

export function measureDrawerWidth(drawer: Element | null, viewportWidth: number): number {
  const measured = drawer instanceof HTMLElement ? drawer.getBoundingClientRect().width : 0;
  return measured > 0 ? measured : resolveDrawerPanelMaxWidth(viewportWidth);
}
