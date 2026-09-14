/**
 * Presentation-only depth-2 view modes. Does not change neighborhood
 * queries, hop semantics, or relationship derivation.
 */

export type NetworkDepthViewMode = "BY_DEPTH" | "FULL_NETWORK" | "SELECTED_PATH";
export type NetworkDepthCanvasArrangement = "GROUP_BY_HOP" | "VERTICAL_PATH" | "DEFAULT";

export const NETWORK_DEFAULT_DEPTH_VIEW: NetworkDepthViewMode = "BY_DEPTH";

export function parseNetworkDepthViewMode(value: string | null | undefined): NetworkDepthViewMode {
  if (value === "full") return "FULL_NETWORK";
  if (value === "path") return "SELECTED_PATH";
  return NETWORK_DEFAULT_DEPTH_VIEW;
}

export function networkDepthViewQueryValue(mode: NetworkDepthViewMode): string {
  if (mode === "FULL_NETWORK") return "full";
  if (mode === "SELECTED_PATH") return "path";
  return "by-depth";
}

export function depthViewUrlPatch(mode: NetworkDepthViewMode): { view: string } {
  return { view: networkDepthViewQueryValue(mode) };
}

export function shouldShowDepthViewControl(depth: 1 | 2): boolean {
  return depth === 2;
}

export function resolveDepthViewCanvas(args: {
  depth: 1 | 2;
  viewMode: NetworkDepthViewMode;
  hasSelectedSecondary: boolean;
}): NetworkDepthCanvasArrangement {
  if (args.depth !== 2) return "DEFAULT";
  if (args.viewMode === "SELECTED_PATH" && args.hasSelectedSecondary) return "VERTICAL_PATH";
  if (args.viewMode === "FULL_NETWORK") return "DEFAULT";
  return "GROUP_BY_HOP";
}

export function isolateSelectedPathInView(args: {
  depth: 1 | 2;
  viewMode: NetworkDepthViewMode;
  hasSelectedSecondary: boolean;
}): boolean {
  return args.depth === 2 && args.viewMode === "SELECTED_PATH" && args.hasSelectedSecondary;
}

export function isSelectedPathEmptyState(args: {
  depth: 1 | 2;
  viewMode: NetworkDepthViewMode;
  hasSelectedSecondary: boolean;
}): boolean {
  return args.depth === 2 && args.viewMode === "SELECTED_PATH" && !args.hasSelectedSecondary;
}

/**
 * Path mode with no destination must keep the current readable BY-DEPTH
 * viewport. Do not path-fit and do not zoom the full neighborhood out.
 */
export function shouldPreserveViewportForPathEmptyState(args: {
  depth: 1 | 2;
  viewMode: NetworkDepthViewMode;
  hasSelectedSecondary: boolean;
}): boolean {
  return isSelectedPathEmptyState(args);
}
