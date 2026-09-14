/**
 * Presentation-only connection-depth helpers for the Network toolbar.
 * Consumes the EXISTING neighborhood `depth` (1 | 2). Does not invent a
 * deeper traversal, change relationship semantics, or touch the query engine.
 */

import type { LayoutEdgeInput, LayoutNodeInput } from "@/lib/drug_intelligence/drug_network_graph_layout";
import { DRUG_GRAPH_MAX_DEPTH } from "@/lib/drug_intelligence/drug_network_graph_types";
import { hopDistances } from "@/lib/drug_intelligence/drug_network_graph_readability";

export const NETWORK_DEFAULT_CONNECTION_DEPTH = 1 as const;
export const NETWORK_MAX_CONNECTION_DEPTH = DRUG_GRAPH_MAX_DEPTH;

export type NetworkConnectionDepth = 1 | 2;

export function parseNetworkConnectionDepth(value: string | number | null | undefined): NetworkConnectionDepth {
  return Number(value ?? NETWORK_DEFAULT_CONNECTION_DEPTH) === 2 ? 2 : 1;
}

export function connectionDepthQueryValue(depth: NetworkConnectionDepth): string {
  return String(depth);
}

/** Patch that updates only `depth`. Callers must not add focusType/focusId here. */
export function connectionDepthUrlPatch(depth: NetworkConnectionDepth): { depth: string } {
  return { depth: connectionDepthQueryValue(depth) };
}

export function applyConnectionDepthSearchParams(
  current: URLSearchParams,
  depth: NetworkConnectionDepth
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  next.set("depth", connectionDepthQueryValue(depth));
  return next;
}

export function connectionDepthPreservesFocus(
  before: { focusType: string | null; focusId: string | null },
  after: { focusType: string | null; focusId: string | null }
): boolean {
  return before.focusType === after.focusType && before.focusId === after.focusId;
}

export function nextSelectedEntityAfterNeighborhoodChange<T extends { id: string }>(
  selected: T | null,
  presentIds: ReadonlySet<string> | readonly string[]
): T | null {
  if (!selected) return null;
  const ids = presentIds instanceof Set ? presentIds : new Set(presentIds);
  return ids.has(selected.id) ? selected : null;
}

/** Presentation filter: nodes whose undirected hop distance is within the current depth. */
export function nodeIdsWithinConnectionDepth(
  focusId: string,
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[],
  depth: NetworkConnectionDepth
): string[] {
  const hops = hopDistances(focusId, [...nodes], [...edges]);
  return nodes.filter((node) => (hops.get(node.id) ?? Number.POSITIVE_INFINITY) <= depth).map((node) => node.id);
}
