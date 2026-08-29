/**
 * DI-9.3 — page/component wiring tests for manual edge routing. Source-
 * level checks (no React rendering harness exists in this codebase — see
 * drug_network_workspace_mode.test.ts / drug_network_pinning.test.ts for
 * the established pattern this file follows).
 *
 * Pure geometry/state-transition tests for the routing helpers themselves
 * live in drug_network_edge_routing.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const pageCode = pageSource.replace(/\/\*[\s\S]*?\*\//g, "");
const edgeDetailSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_edge_detail.tsx"), "utf8");
const routedEdgeSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_routed_edge.tsx"), "utf8");
const flowAdapterSource = readFileSync(path.join(dir, "..", "drug_network_graph_flow_adapter.ts"), "utf8");

function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start !== -1, `could not locate function: ${signature}`);
  // The function BODY's opening brace is the first "{" at or after the
  // end of `signature` itself — signature always ends with the closing
  // ")" of the parameter list, so any "{" inside a parameter's type
  // annotation (e.g. `position: { x: number; y: number }`) is already
  // behind us and never mistaken for the body's own opening brace.
  let depth = 0;
  let i = source.indexOf("{", start + signature.length);
  const bodyStart = i;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(bodyStart, i + 1);
}

// --- A/B. route state is presentation-only, DrugGraphEdge unchanged ---
test("edgeRoutes state lives in the page component, never merged into DrugGraphEdge", () => {
  assert.match(pageCode, /useState<DrugNetworkEdgeRoutes>\(\{\}\)/);
});

test("DrugNetworkFlowEdgeData (presentation) carries route state, never DrugGraphEdge (factual) itself", () => {
  assert.match(flowAdapterSource, /route: DrugNetworkEdgeRouteState;/);
  assert.doesNotMatch(flowAdapterSource, /interface DrugGraphEdge[\s\S]{0,200}route/);
});

// --- C/D. DIRECT/INFERRED semantics preserved ---
test("the custom routed edge component passes style/label/markerEnd straight through unchanged — no new semantic styling logic", () => {
  assert.match(routedEdgeSource, /style=\{style\}/);
  assert.match(routedEdgeSource, /markerEnd=\{markerEnd\}/);
  assert.match(routedEdgeSource, /label=\{label\}/);
  assert.doesNotMatch(routedEdgeSource, /edgeKind/, "routing must never re-derive DIRECT/INFERRED styling itself — that stays the flow adapter's job");
});

test("an edge only switches to the routed renderer type when it has a non-AUTO route WITH waypoints — every other edge keeps its original built-in edge type", () => {
  assert.match(flowAdapterSource, /const isRouted = route\.mode !== "AUTO" && route\.waypoints\.length > 0;/);
  assert.match(flowAdapterSource, /type: isRouted \? "drugRoutedEdge" : edgeType,/);
});

// --- E-H. route modes ---
test("all four route modes (AUTO/STRAIGHT/ORTHOGONAL/CURVED) are offered in the Edge Inspector", () => {
  for (const mode of ["AUTO", "STRAIGHT", "ORTHOGONAL", "CURVED"]) {
    assert.match(edgeDetailSource, new RegExp(mode));
  }
});

// --- I. add waypoint ---
test("handleAddWaypoint uses the SELECTED edge's live node positions (flowNodes), never a click/double-click coordinate", () => {
  const fn = extractFunctionBody(pageCode, "function handleAddWaypoint(edge: DrugGraphEdge)");
  assert.match(fn, /flowNodes\.find/);
  assert.match(fn, /addEdgeWaypoint\(/);
});

test("handleAddWaypoint is a no-op while the board is locked", () => {
  const fn = extractFunctionBody(pageCode, "function handleAddWaypoint(edge: DrugGraphEdge)");
  assert.match(fn, /if \(boardLocked\) return;/);
});

// --- J. move waypoint ---
test("handleWaypointDrag updates edgeRoutes (the single source of truth), never xyflow's own setEdges directly", () => {
  const fn = extractFunctionBody(pageCode, "function handleWaypointDrag(edgeId: string, waypointId: string, position: { x: number; y: number })");
  assert.match(fn, /setEdgeRoutes/);
  assert.match(fn, /moveEdgeWaypoint\(/);
  assert.doesNotMatch(fn, /setEdges\(/);
});

test("handleWaypointDrag is a no-op while the board is locked", () => {
  const fn = extractFunctionBody(pageCode, "function handleWaypointDrag(edgeId: string, waypointId: string, position: { x: number; y: number })");
  assert.match(fn, /if \(boardLocked\) return;/);
});

test("the custom routed edge component's pointer handler is gated on analystMode and !boardLocked before starting a drag", () => {
  assert.match(routedEdgeSource, /if \(!data\.analystMode \|\| data\.boardLocked\) return;/);
});

// --- K. remove waypoint ---
test("handleRemoveWaypoint removes exactly the targeted waypoint via the pure removeEdgeWaypoint helper", () => {
  const fn = extractFunctionBody(pageCode, "function handleRemoveWaypoint(edgeId: string, waypointId: string)");
  assert.match(fn, /removeEdgeWaypoint\(/);
  assert.match(fn, /if \(boardLocked\) return;/);
});

// --- L. reset route ---
test("handleResetRoute calls the pure resetEdgeRoute helper (always returns to AUTO with no waypoints)", () => {
  const fn = extractFunctionBody(pageCode, "function handleResetRoute(edgeId: string)");
  assert.match(fn, /resetEdgeRoute\(\)/);
});

// --- M. source/target unchanged after route edits ---
test("route-editing handlers never write to edge.source or edge.target — only edgeRoutes state", () => {
  for (const signature of [
    "function handleWaypointDrag(edgeId: string, waypointId: string, position: { x: number; y: number })",
    "function handleAddWaypoint(edge: DrugGraphEdge)",
    "function handleRemoveWaypoint(edgeId: string, waypointId: string)",
    "function handleResetRoute(edgeId: string)",
    "function handleRouteModeChange(edgeId: string, mode: DrugNetworkEdgeRouteMode)",
  ]) {
    const fn = extractFunctionBody(pageCode, signature);
    assert.doesNotMatch(fn, /\.source\s*=|\.target\s*=/, `${signature} must never assign edge.source/target`);
  }
});

// --- N. evidenceCount / O. sourceCaseIds / P. explanation unchanged ---
test("route-editing handlers never touch evidenceCount, sourceCaseIds, or explanation", () => {
  for (const signature of [
    "function handleWaypointDrag(edgeId: string, waypointId: string, position: { x: number; y: number })",
    "function handleAddWaypoint(edge: DrugGraphEdge)",
    "function handleRemoveWaypoint(edgeId: string, waypointId: string)",
    "function handleResetRoute(edgeId: string)",
  ]) {
    const fn = extractFunctionBody(pageCode, signature);
    assert.doesNotMatch(fn, /evidenceCount|sourceCaseIds|explanation/);
  }
});

// --- Q. no API call from route edit ---
test("no route-editing handler calls fetch, a hook mutation, or any network-prefixed API helper", () => {
  for (const signature of [
    "function handleWaypointDrag(edgeId: string, waypointId: string, position: { x: number; y: number })",
    "function handleAddWaypoint(edge: DrugGraphEdge)",
    "function handleRemoveWaypoint(edgeId: string, waypointId: string)",
    "function handleResetRoute(edgeId: string)",
    "function handleRouteModeChange(edgeId: string, mode: DrugNetworkEdgeRouteMode)",
  ]) {
    const fn = extractFunctionBody(pageCode, signature);
    assert.doesNotMatch(fn, /fetch\(|useMutation|apiClient\.|await /);
  }
});

// --- R. no URL change from route edit ---
test("no route-editing handler calls updateParams (the only URL-writing helper on this page)", () => {
  for (const signature of [
    "function handleWaypointDrag(edgeId: string, waypointId: string, position: { x: number; y: number })",
    "function handleAddWaypoint(edge: DrugGraphEdge)",
    "function handleRemoveWaypoint(edgeId: string, waypointId: string)",
    "function handleResetRoute(edgeId: string)",
    "function handleRouteModeChange(edgeId: string, mode: DrugNetworkEdgeRouteMode)",
  ]) {
    const fn = extractFunctionBody(pageCode, signature);
    assert.doesNotMatch(fn, /updateParams/);
  }
});

// --- S/T. View Mode hides handles, Analyst Mode shows them for the selected routed edge ---
test("routeEdit prop is only ever passed to the Edge Inspector when effectiveWorkspaceMode is ANALYST, never unconditionally", () => {
  assert.match(pageCode, /routeEdit=\{\s*effectiveWorkspaceMode === "ANALYST"/);
});

test("DrugNetworkEdgeDetail renders the routing section only when routeEdit is provided (View Mode passes none)", () => {
  assert.match(edgeDetailSource, /\{routeEdit \? <DrugNetworkEdgeRouteSection/);
});

test("waypoint handles on the canvas render only when analystMode && !boardLocked && selected — never for every edge at once", () => {
  assert.match(routedEdgeSource, /const showHandles = data\.analystMode && !data\.boardLocked && selected;/);
});

// --- Section 8: selection/Drawer decoupling (anti DI-9.2-backdrop-trap) ---
// Selection alone renders waypoint handles; the Edge Inspector Drawer's
// full-screen modal backdrop would otherwise sit on top of those very
// handles while open and block them entirely. Closing the drawer must
// NOT clear selectedEdge, or the handles would also vanish the moment the
// analyst tries to reach them — repeating the exact DI-9.2 toolbar
// mistake Section 8 explicitly calls out to avoid.
test("the Edge Inspector Drawer's open state is gated on a SEPARATE boolean, not selectedEdge alone", () => {
  assert.match(pageCode, /<Drawer open=\{Boolean\(selectedEdge\) && edgeDrawerOpen\}/);
});

test("closing the Edge Inspector Drawer clears edgeDrawerOpen, never selectedEdge — selection (and waypoint handles) must survive", () => {
  assert.match(pageCode, /onClose=\{\(\) => setEdgeDrawerOpen\(false\)\}/);
  assert.doesNotMatch(pageCode, /onClose=\{\(\) => setSelectedEdge\(null\)\}/, "the edge drawer's onClose must never clear selectedEdge directly");
});

test("selecting an edge (handleEdgeClick) always reopens the drawer via edgeDrawerOpen", () => {
  const fn = extractFunctionBody(pageCode, "function handleEdgeClick(_event: unknown, edge: Edge)");
  assert.match(fn, /setEdgeDrawerOpen\(true\)/);
});

// --- U. Board Lock prevents route editing ---
test("route mode buttons, add-waypoint, remove-waypoint, and reset-route are all disabled when boardLocked", () => {
  assert.match(edgeDetailSource, /disabled=\{boardLocked\}/);
  // Remove-waypoint has an additional condition (must also have a waypoint selected) but must still respect boardLocked.
  assert.match(edgeDetailSource, /disabled=\{boardLocked \|\| !effectiveSelectedWaypointId\}/);
});

test("<ReactFlow> nodesDraggable already ties into boardLocked (DI-9.2); DI-9.3 adds no separate node-lock path that could diverge", () => {
  assert.match(pageCode, /nodesDraggable=\{!boardLocked\}/);
});

// --- V/W. node move + layout/rearrange preserve waypoints ---
test("waypoint coordinates are never recomputed from node positions on every render — only stored in edgeRoutes and read as-is by the routed edge component", () => {
  assert.doesNotMatch(routedEdgeSource, /waypoints\.map\(\(wp\) => \(\{[\s\S]{0,80}sourceX/, "a waypoint must never be silently repositioned relative to a moved node");
});

test("neither handleRearrange nor handleLayoutSelect touches edgeRoutes — a layout/rearrange must never silently reset a manual route", () => {
  const rearrangeFn = extractFunctionBody(pageCode, "function handleRearrange()");
  const layoutFn = extractFunctionBody(pageCode, "function handleLayoutSelect(mode: DrugNetworkLayoutMode)");
  assert.doesNotMatch(rearrangeFn, /setEdgeRoutes/);
  assert.doesNotMatch(layoutFn, /setEdgeRoutes/);
});

// --- X. stale route state pruned safely ---
test("a dedicated effect prunes edgeRoutes against the freshly-fetched edge id set, mirroring the existing pin-pruning pattern", () => {
  assert.match(pageCode, /pruneEdgeRoutes\(current, currentEdgeIds\)/);
});

// --- Y. mode switch preserves route state ---
test("edgeRoutes is declared once at the page level, never reset by the mode toggle", () => {
  const edgeRoutesDeclarations = pageCode.match(/useState<DrugNetworkEdgeRoutes>\(\{\}\)/g) ?? [];
  assert.equal(edgeRoutesDeclarations.length, 1);
  assert.doesNotMatch(pageCode, /setWorkspaceMode[\s\S]{0,80}setEdgeRoutes/, "switching mode must never clear route state");
});

// --- Z. factual edge cannot be deleted/reconnected ---
test("factual edge delete-key deletion remains disabled (deleteKeyCode={null}, pre-existing) and edges are explicitly non-reconnectable", () => {
  assert.match(pageCode, /deleteKeyCode=\{null\}/);
  assert.match(pageCode, /edgesReconnectable=\{false\}/);
  assert.doesNotMatch(pageCode, /onReconnect=/, "no onReconnect handler must ever be wired for factual edges");
  assert.doesNotMatch(pageCode, /onEdgesDelete=/, "no onEdgesDelete handler must ever be wired to remove factual relationships");
});

// --- Section 21: routing microcopy present ---
test("the routing section shows the required 'presentation only, never changes recorded data' microcopy", () => {
  assert.match(edgeDetailSource, /routeSectionMicrocopy/);
});

// --- Section 25: pure helpers imported, not reimplemented inline ---
test("the page imports the pure route helpers rather than reimplementing waypoint/geometry logic inline", () => {
  assert.match(pageCode, /import \{[\s\S]{0,300}addEdgeWaypoint[\s\S]{0,300}\} from "@\/lib\/drug_intelligence\/drug_network_edge_routing"/);
});
