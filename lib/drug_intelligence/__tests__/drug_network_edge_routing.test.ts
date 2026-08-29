/**
 * DI-9.3 — Manual edge routing / waypoints: pure logic + geometry tests.
 * No React/@xyflow/react import needed — the module under test has none.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultEdgeRoute,
  addEdgeWaypoint,
  moveEdgeWaypoint,
  removeEdgeWaypoint,
  resetEdgeRoute,
  pruneEdgeRoutes,
  buildStraightPath,
  buildOrthogonalPath,
  buildCurvedPath,
  buildRoutedPath,
  type DrugNetworkEdgeRouteState,
} from "../drug_network_edge_routing.js";

// --- A/E. presentation-only default state ---
test("createDefaultEdgeRoute starts at AUTO mode with no waypoints", () => {
  const route = createDefaultEdgeRoute();
  assert.equal(route.mode, "AUTO");
  assert.deepEqual(route.waypoints, []);
});

// --- I. add waypoint ---
test("addEdgeWaypoint inserts a midpoint on the single (source->target) segment when there are no existing waypoints", () => {
  const route = createDefaultEdgeRoute();
  const next = addEdgeWaypoint(route, { x: 0, y: 0 }, { x: 100, y: 0 });
  assert.equal(next.waypoints.length, 1);
  assert.equal(next.waypoints[0].x, 50);
  assert.equal(next.waypoints[0].y, 0);
});

test("addEdgeWaypoint on an AUTO-mode route commits it to STRAIGHT so the new point is actually rendered", () => {
  const route = createDefaultEdgeRoute();
  const next = addEdgeWaypoint(route, { x: 0, y: 0 }, { x: 10, y: 0 });
  assert.equal(next.mode, "STRAIGHT");
});

test("addEdgeWaypoint preserves a non-AUTO mode instead of overriding the analyst's choice", () => {
  const route: DrugNetworkEdgeRouteState = { mode: "CURVED", waypoints: [] };
  const next = addEdgeWaypoint(route, { x: 0, y: 0 }, { x: 10, y: 0 });
  assert.equal(next.mode, "CURVED");
});

test("addEdgeWaypoint inserts on the LONGEST segment when waypoints already exist", () => {
  // source(0,0) -> wp(10,0) -> target(1000,0): the wp->target segment is by far the longest.
  const route: DrugNetworkEdgeRouteState = { mode: "STRAIGHT", waypoints: [{ id: "wp-1", x: 10, y: 0 }] };
  const next = addEdgeWaypoint(route, { x: 0, y: 0 }, { x: 1000, y: 0 });
  assert.equal(next.waypoints.length, 2);
  // New point must be the midpoint of (10,0)-(1000,0) = (505, 0), inserted AFTER the existing waypoint.
  assert.deepEqual(next.waypoints[0], { id: "wp-1", x: 10, y: 0 });
  assert.equal(next.waypoints[1].x, 505);
  assert.equal(next.waypoints[1].y, 0);
});

test("addEdgeWaypoint never mutates the input route object", () => {
  const route = createDefaultEdgeRoute();
  const originalWaypoints = route.waypoints;
  addEdgeWaypoint(route, { x: 0, y: 0 }, { x: 10, y: 0 });
  assert.equal(route.waypoints, originalWaypoints);
  assert.equal(route.waypoints.length, 0);
});

test("each added waypoint gets a distinct, stable in-session id", () => {
  let route = createDefaultEdgeRoute();
  route = addEdgeWaypoint(route, { x: 0, y: 0 }, { x: 100, y: 0 });
  route = addEdgeWaypoint(route, { x: 0, y: 0 }, { x: 100, y: 0 });
  const ids = route.waypoints.map((wp) => wp.id);
  assert.equal(new Set(ids).size, ids.length);
});

// --- J. move waypoint ---
test("moveEdgeWaypoint updates only the targeted waypoint's coordinates", () => {
  const route: DrugNetworkEdgeRouteState = {
    mode: "STRAIGHT",
    waypoints: [
      { id: "a", x: 1, y: 1 },
      { id: "b", x: 2, y: 2 },
    ],
  };
  const next = moveEdgeWaypoint(route, "b", { x: 99, y: 88 });
  assert.deepEqual(next.waypoints[0], { id: "a", x: 1, y: 1 });
  assert.deepEqual(next.waypoints[1], { id: "b", x: 99, y: 88 });
  assert.equal(next.mode, "STRAIGHT");
});

test("moveEdgeWaypoint on an unknown id is a safe no-op (returns waypoints unchanged in value)", () => {
  const route: DrugNetworkEdgeRouteState = { mode: "STRAIGHT", waypoints: [{ id: "a", x: 1, y: 1 }] };
  const next = moveEdgeWaypoint(route, "does-not-exist", { x: 50, y: 50 });
  assert.deepEqual(next.waypoints, route.waypoints);
});

// --- K. remove waypoint ---
test("removeEdgeWaypoint drops exactly the targeted waypoint and keeps route mode unchanged", () => {
  const route: DrugNetworkEdgeRouteState = {
    mode: "CURVED",
    waypoints: [
      { id: "a", x: 1, y: 1 },
      { id: "b", x: 2, y: 2 },
    ],
  };
  const next = removeEdgeWaypoint(route, "a");
  assert.deepEqual(next.waypoints, [{ id: "b", x: 2, y: 2 }]);
  assert.equal(next.mode, "CURVED");
});

test("removing the final waypoint leaves the route mode as-is (does not silently reset to AUTO)", () => {
  const route: DrugNetworkEdgeRouteState = { mode: "ORTHOGONAL", waypoints: [{ id: "a", x: 1, y: 1 }] };
  const next = removeEdgeWaypoint(route, "a");
  assert.deepEqual(next.waypoints, []);
  assert.equal(next.mode, "ORTHOGONAL", "only resetEdgeRoute() returns to AUTO, not removing the last waypoint");
});

// --- L. reset route ---
test("resetEdgeRoute always returns AUTO mode with an empty waypoint list, regardless of prior state", () => {
  const reset = resetEdgeRoute();
  assert.equal(reset.mode, "AUTO");
  assert.deepEqual(reset.waypoints, []);
});

// --- X. stale route pruning ---
test("pruneEdgeRoutes drops route state for edge ids no longer present and keeps the rest untouched", () => {
  const routes = {
    "edge-1": { mode: "STRAIGHT" as const, waypoints: [] },
    "edge-2": { mode: "CURVED" as const, waypoints: [{ id: "a", x: 1, y: 1 }] },
    "gone": { mode: "AUTO" as const, waypoints: [] },
  };
  const pruned = pruneEdgeRoutes(routes, new Set(["edge-1", "edge-2"]));
  assert.deepEqual(Object.keys(pruned).sort(), ["edge-1", "edge-2"]);
  assert.equal(pruned["edge-2"], routes["edge-2"], "surviving route state must be the SAME object reference, not a copy");
});

test("pruneEdgeRoutes returns the SAME object reference when nothing needs pruning (avoids unnecessary re-renders)", () => {
  const routes = { "edge-1": { mode: "STRAIGHT" as const, waypoints: [] } };
  const pruned = pruneEdgeRoutes(routes, new Set(["edge-1", "edge-2"]));
  assert.equal(pruned, routes);
});

// =====================================================================
// Geometry: STRAIGHT / ORTHOGONAL / CURVED path builders
// =====================================================================

// --- F. STRAIGHT ---
test("buildStraightPath: 0 waypoints (source->target only)", () => {
  const path = buildStraightPath([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
  assert.equal(path, "M 0,0 L 100,50");
});

test("buildStraightPath: multiple waypoints produce one L segment per hop, in order", () => {
  const path = buildStraightPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 10 }]);
  assert.equal(path, "M 0,0 L 10,10 L 20,0 L 30,10");
});

test("buildStraightPath: fewer than 2 points returns an empty string, never a malformed path", () => {
  assert.equal(buildStraightPath([]), "");
  assert.equal(buildStraightPath([{ x: 0, y: 0 }]), "");
});

// --- G. ORTHOGONAL ---
test("buildOrthogonalPath: source->target only produces exactly one right-angle corner", () => {
  const path = buildOrthogonalPath([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
  assert.equal(path, "M 0,0 L 100,0 L 100,50");
});

test("buildOrthogonalPath: every generated segment is horizontal or vertical (no diagonals)", () => {
  const path = buildOrthogonalPath([{ x: 0, y: 0 }, { x: 40, y: 30 }, { x: 90, y: -10 }]);
  const coords = path
    .split(/[ML]\s*/)
    .filter(Boolean)
    .map((pair) => pair.trim().split(",").map(Number));
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    assert.ok(x1 === x2 || y1 === y2, `segment ${i} is diagonal: (${x1},${y1}) -> (${x2},${y2})`);
  }
});

test("buildOrthogonalPath: an already axis-aligned segment does not produce a redundant zero-length corner", () => {
  // source and target share the same y — already horizontal.
  const path = buildOrthogonalPath([{ x: 0, y: 5 }, { x: 100, y: 5 }]);
  assert.equal(path, "M 0,5 L 100,5");
});

test("buildOrthogonalPath: fewer than 2 points returns an empty string", () => {
  assert.equal(buildOrthogonalPath([{ x: 0, y: 0 }]), "");
});

// --- H. CURVED ---
test("buildCurvedPath: 0 waypoints (source->target) is a single valid quadratic Bezier command", () => {
  const path = buildCurvedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  assert.match(path, /^M 0,0 Q 50,0 100,0$/);
});

test("buildCurvedPath: with waypoints, path starts with M and only uses Q/T commands, never diagonal L segments", () => {
  const path = buildCurvedPath([{ x: 0, y: 0 }, { x: 25, y: 40 }, { x: 75, y: -40 }, { x: 100, y: 0 }]);
  assert.match(path, /^M /);
  assert.doesNotMatch(path, /L /, "CURVED must not fall back to straight-line segments");
});

test("buildCurvedPath: never produces NaN or Infinity for any tested waypoint count", () => {
  const cases: Array<{ x: number; y: number }[]> = [
    [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }],
    [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: -5 }, { x: 15, y: 20 }, { x: 20, y: 0 }],
  ];
  for (const points of cases) {
    const path = buildCurvedPath(points);
    assert.doesNotMatch(path, /NaN|Infinity/, `path for ${points.length} points contained NaN/Infinity: ${path}`);
  }
});

test("buildCurvedPath: fewer than 2 points returns an empty string", () => {
  assert.equal(buildCurvedPath([]), "");
});

// --- Defensive: coincident/near-coincident points ---
test("path builders handle a coincident waypoint (same coordinates as source) without NaN/Infinity", () => {
  const points = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 20, y: 20 }];
  for (const build of [buildStraightPath, buildOrthogonalPath, buildCurvedPath]) {
    const path = build(points);
    assert.doesNotMatch(path, /NaN|Infinity/);
    assert.ok(path.length > 0);
  }
});

test("path builders handle a fully coincident source and target (zero-length edge) without NaN/Infinity", () => {
  const points = [{ x: 3, y: 3 }, { x: 3, y: 3 }];
  for (const build of [buildStraightPath, buildOrthogonalPath, buildCurvedPath]) {
    const path = build(points);
    assert.doesNotMatch(path, /NaN|Infinity/);
  }
});

// --- buildRoutedPath dispatch ---
test("buildRoutedPath dispatches to the correct builder per mode", () => {
  const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
  assert.equal(buildRoutedPath("STRAIGHT", points), buildStraightPath(points));
  assert.equal(buildRoutedPath("ORTHOGONAL", points), buildOrthogonalPath(points));
  assert.equal(buildRoutedPath("CURVED", points), buildCurvedPath(points));
});
