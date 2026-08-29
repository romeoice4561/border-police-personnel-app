/**
 * Manual edge routing / waypoints (Phase DI-9.3).
 *
 * Route state is PRESENTATION STATE ONLY — keyed by factual DrugGraphEdge
 * id, stored as a plain Record in the page component's local state, never
 * added to DrugGraphEdge, never sent to any API, never persisted (reload
 * loses it — by design, saved persistence is DI-9.5). Editing a route can
 * NEVER create/delete a DrugRelationship, change relationshipType/edgeKind/
 * evidenceCount/sourceCaseIds/explanation, or change source/target — this
 * module only ever computes SVG path geometry from graph-space points.
 *
 * No React/@xyflow/react import — pure data in, data out, so it's testable
 * without a DOM or provider, matching drug_network_graph_layout.ts and
 * drug_network_graph_pinning.ts's existing convention.
 */

export type DrugNetworkEdgeRouteMode = "AUTO" | "STRAIGHT" | "ORTHOGONAL" | "CURVED";

export interface DrugNetworkWaypoint {
  id: string;
  x: number;
  y: number;
}

export interface DrugNetworkEdgeRouteState {
  mode: DrugNetworkEdgeRouteMode;
  waypoints: DrugNetworkWaypoint[];
}

export type DrugNetworkEdgeRoutes = Record<string, DrugNetworkEdgeRouteState>;

export interface RoutePoint {
  x: number;
  y: number;
}

/** Section 13: the state a freshly-selected, never-routed edge starts from — AUTO mode, no waypoints. */
export function createDefaultEdgeRoute(): DrugNetworkEdgeRouteState {
  return { mode: "AUTO", waypoints: [] };
}

let waypointIdCounter = 0;
/** In-session-unique id generator — no crypto/uuid dependency needed since these ids never leave the browser tab or get persisted. */
function nextWaypointId(): string {
  waypointIdCounter += 1;
  return `wp-${Date.now().toString(36)}-${waypointIdCounter}`;
}

/**
 * Section 10 — reliable-over-clever: inserts a new waypoint at the midpoint
 * of the currently longest segment of the route (source -> waypoints ->
 * target), never at an arbitrary click/double-click coordinate (which is
 * the "safer first implementation" the spec explicitly prefers). Returns a
 * new route object; never mutates the input.
 */
export function addEdgeWaypoint(route: DrugNetworkEdgeRouteState, sourcePoint: RoutePoint, targetPoint: RoutePoint): DrugNetworkEdgeRouteState {
  const chain: RoutePoint[] = [sourcePoint, ...route.waypoints, targetPoint];
  let longestIndex = 0;
  let longestDistance = -1;
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance > longestDistance) {
      longestDistance = distance;
      longestIndex = i;
    }
  }
  const a = chain[longestIndex];
  const b = chain[longestIndex + 1];
  const midpoint: DrugNetworkWaypoint = { id: nextWaypointId(), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  const waypoints = [...route.waypoints];
  waypoints.splice(longestIndex, 0, midpoint);

  return {
    // Section 6: adding a waypoint to an AUTO-mode route commits it to a
    // concrete mode so the new point is actually visible — AUTO alone has
    // no waypoint-aware rendering of its own. STRAIGHT preserves the
    // simplest visual change from whatever the analyst was already seeing.
    mode: route.mode === "AUTO" ? "STRAIGHT" : route.mode,
    waypoints,
  };
}

/** Section 11: moves one waypoint (by id) to a new graph-space position. Never touches any other waypoint or the route mode. */
export function moveEdgeWaypoint(route: DrugNetworkEdgeRouteState, waypointId: string, position: RoutePoint): DrugNetworkEdgeRouteState {
  return {
    mode: route.mode,
    waypoints: route.waypoints.map((wp) => (wp.id === waypointId ? { ...wp, x: position.x, y: position.y } : wp)),
  };
}

/** Section 12: removes one waypoint (by id). The route stays in its current mode even if this empties the waypoint list — only "รีเซ็ตเส้น" (resetEdgeRoute) returns to AUTO. */
export function removeEdgeWaypoint(route: DrugNetworkEdgeRouteState, waypointId: string): DrugNetworkEdgeRouteState {
  return {
    mode: route.mode,
    waypoints: route.waypoints.filter((wp) => wp.id !== waypointId),
  };
}

/** Section 13: "รีเซ็ตเส้น" — clears all waypoints AND returns to AUTO mode. Never touches factual edge data (this function doesn't even receive any). */
export function resetEdgeRoute(): DrugNetworkEdgeRouteState {
  return createDefaultEdgeRoute();
}

/**
 * Section 17 — when the graph's edge set changes (focus/depth/filter
 * change), drop route state for edge ids no longer present. Route state
 * for ids still present is preserved unchanged (the caller passes the same
 * Record reference through when nothing needs pruning, so this never
 * forces an unnecessary re-render).
 */
export function pruneEdgeRoutes(routes: DrugNetworkEdgeRoutes, currentEdgeIds: ReadonlySet<string>): DrugNetworkEdgeRoutes {
  const staleIds = Object.keys(routes).filter((id) => !currentEdgeIds.has(id));
  if (staleIds.length === 0) return routes;
  const next: DrugNetworkEdgeRoutes = { ...routes };
  for (const id of staleIds) delete next[id];
  return next;
}

// ---------------------------------------------------------------------
// Path builders — pure SVG path-string geometry. Each takes the full
// ordered chain (source -> waypoints -> target) as graph-space points.
// None of these read xyflow state directly; the caller (the custom edge
// component) is responsible for supplying already-transformed points.
// ---------------------------------------------------------------------

/** Section 6 STRAIGHT: source -> waypoint(s) -> target as straight SVG line segments. */
export function buildStraightPath(points: RoutePoint[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  return `M ${first.x},${first.y} ` + rest.map((p) => `L ${p.x},${p.y}`).join(" ");
}

/**
 * Section 6 ORTHOGONAL: horizontal/vertical segments through every route
 * point. Between each consecutive pair, inserts one right-angle corner
 * (horizontal-then-vertical) so the path never draws a diagonal — the
 * defining visual property of "เส้นฉาก" or waypoints could not otherwise
 * force strictly axis-aligned segments through arbitrary click-and-drag
 * placement.
 */
export function buildOrthogonalPath(points: RoutePoint[]): string {
  if (points.length < 2) return "";
  const segments: string[] = [`M ${points[0].x},${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const cornerX = b.x;
    const cornerY = a.y;
    // Skip a degenerate corner exactly on top of either endpoint (already-axis-aligned segment, vertical or horizontal) to avoid a redundant zero-length sub-segment.
    const cornerIsA = cornerX === a.x && cornerY === a.y;
    const cornerIsB = cornerX === b.x && cornerY === b.y;
    if (!cornerIsA && !cornerIsB) segments.push(`L ${cornerX},${cornerY}`);
    segments.push(`L ${b.x},${b.y}`);
  }
  return segments.join(" ");
}

/**
 * Section 6 CURVED: a smooth path through every route point using
 * quadratic Bezier segments, each control point being the route point
 * itself (a standard "smooth through waypoints" construction) — this stays
 * a valid SVG path for 0, 1, or many waypoints and never produces NaN/
 * Infinity since every input coordinate is a finite graph-space number
 * supplied by the caller.
 */
export function buildCurvedPath(points: RoutePoint[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const [a, b] = points;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    return `M ${a.x},${a.y} Q ${midX},${midY} ${b.x},${b.y}`;
  }
  const segments: string[] = [`M ${points[0].x},${points[0].y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i];
    const next = points[i + 1];
    const midX = (control.x + next.x) / 2;
    const midY = (control.y + next.y) / 2;
    segments.push(`Q ${control.x},${control.y} ${midX},${midY}`);
  }
  const last = points[points.length - 1];
  segments.push(`T ${last.x},${last.y}`);
  return segments.join(" ");
}

/** Dispatches to the right path builder for a resolved (non-AUTO) route mode. AUTO never reaches here — the caller renders AUTO edges via the existing xyflow built-in edge types, exactly as before DI-9.3. */
export function buildRoutedPath(mode: Exclude<DrugNetworkEdgeRouteMode, "AUTO">, points: RoutePoint[]): string {
  switch (mode) {
    case "STRAIGHT":
      return buildStraightPath(points);
    case "ORTHOGONAL":
      return buildOrthogonalPath(points);
    case "CURVED":
      return buildCurvedPath(points);
  }
}
