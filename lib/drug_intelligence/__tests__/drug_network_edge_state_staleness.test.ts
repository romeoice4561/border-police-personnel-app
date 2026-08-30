/**
 * DI-9.3.1 — regression tests for the View Mode / Board Lock canvas edge-
 * state staleness bug found during DI-9.3 production sign-off.
 *
 * Root cause: the page's graph-build effect computes each FlowEdge's
 * `data.analystMode`/`data.boardLocked` from `effectiveWorkspaceMode`/
 * `boardLocked` at CALL TIME, but the effect's dependency array omitted
 * both — so a pure mode/lock toggle (which changes neither
 * `neighborhood.data` nor `querySignature`) never re-ran the effect,
 * leaving stale `data.analystMode`/`data.boardLocked` baked into every
 * edge. Symptom: switching Analyst -> View after routing an edge left a
 * real, visible, draggable waypoint handle on the canvas.
 *
 * Two layers:
 *   - A genuine BEHAVIORAL test against the pure `buildDrugNetworkFlowGraph`
 *     adapter, reproducing the exact bug mechanism directly (not just
 *     asserting page source text) — this is the primary regression guard.
 *   - A source-level test locking in the effect's dependency-array contract
 *     itself, since the adapter test alone can't prove the PAGE actually
 *     calls the adapter again on a mode/lock change (that requires either a
 *     rendering harness, which this codebase doesn't have, or reading the
 *     effect's own dependency list — the same convention every other
 *     page-wiring test in this suite already uses).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildDrugNetworkFlowGraph, type BuildFlowGraphOptions } from "../drug_network_graph_flow_adapter.js";
import type { DrugGraphNeighborhoodResponse } from "../drug_intelligence_client.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const pageCode = pageSource.replace(/\/\*[\s\S]*?\*\//g, "");

function neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    truncated: false,
    nodes: [
      {
        id: "p1",
        type: "PERSON",
        label: "สมชาย",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 1,
        riskIndicators: [],
      },
      {
        id: "c1",
        type: "CASE",
        label: "CASE-1",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "CASE", caseNumber: "CASE-1", status: "OPEN", arrestDate: null, province: null, reportingUnitText: null },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 1,
        riskIndicators: [],
      },
    ],
    edges: [
      {
        id: "pc:1",
        source: "p1",
        target: "c1",
        relationshipType: "PERSON_CASE",
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: ["c1"],
        explanation: { kind: "DIRECT_ROLE", role: "SUSPECT" },
      },
    ],
  };
}

const BASE_OPTIONS: Omit<BuildFlowGraphOptions, "analystMode" | "boardLocked"> = {
  layoutMode: "PERSON_CENTERED",
  labelMode: "ALL",
  nodeDensity: "STANDARD",
};

// =====================================================================
// A. Genuine behavioral reproduction of the production bug mechanism
// =====================================================================

// --- Scenario A: Analyst + unlocked -> handles allowed ---
test("Scenario A — Analyst Mode unlocked: buildDrugNetworkFlowGraph marks the edge data.analystMode=true, data.boardLocked=false", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", { ...BASE_OPTIONS, analystMode: true, boardLocked: false });
  const edge = flowEdges.find((e) => e.id === "pc:1")!;
  assert.equal(edge.data.analystMode, true);
  assert.equal(edge.data.boardLocked, false);
});

// --- Scenario B: View Mode -> handles MUST disappear ---
// This is the exact production regression: calling the SAME pure adapter
// again with analystMode:false (what happens on a correct View Mode
// switch) must produce edge data that would make DrugNetworkRoutedEdge's
// `showHandles` gate false. The bug was that the PAGE never made this
// second call at all — proven separately in the source-level test below.
test("Scenario B — View Mode: calling the adapter again with analystMode=false produces edge data.analystMode=false (handles must disappear)", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", { ...BASE_OPTIONS, analystMode: false, boardLocked: false });
  const edge = flowEdges.find((e) => e.id === "pc:1")!;
  assert.equal(edge.data.analystMode, false, "data.analystMode must be false so DrugNetworkRoutedEdge's showHandles gate (analystMode && !boardLocked && selected) evaluates to false");
});

// --- Scenario C: Analyst + locked -> handles must not be draggable/rendered ---
test("Scenario C — Analyst Mode + Board Locked: edge data.boardLocked=true (showHandles gate must evaluate false even though analystMode is true)", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", { ...BASE_OPTIONS, analystMode: true, boardLocked: true });
  const edge = flowEdges.find((e) => e.id === "pc:1")!;
  assert.equal(edge.data.analystMode, true);
  assert.equal(edge.data.boardLocked, true, "data.boardLocked must be true so DrugNetworkRoutedEdge's showHandles gate evaluates false");
});

// --- Scenario D: Analyst + unlocked again -> editing restored ---
test("Scenario D — unlocking again: edge data.boardLocked returns to false", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", { ...BASE_OPTIONS, analystMode: true, boardLocked: false });
  const edge = flowEdges.find((e) => e.id === "pc:1")!;
  assert.equal(edge.data.boardLocked, false);
});

// --- Route/selection state is independent of analystMode/boardLocked ---
test("route state (waypoints/mode) on the edge is unaffected by analystMode/boardLocked flips — only the presentation flags change", () => {
  const route = { mode: "STRAIGHT" as const, waypoints: [{ id: "wp-1", x: 10, y: 20 }] };
  const analystResult = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", { ...BASE_OPTIONS, analystMode: true, boardLocked: false, edgeRoutes: { "pc:1": route } });
  const viewResult = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", { ...BASE_OPTIONS, analystMode: false, boardLocked: false, edgeRoutes: { "pc:1": route } });
  const analystEdge = analystResult.flowEdges.find((e) => e.id === "pc:1")!;
  const viewEdge = viewResult.flowEdges.find((e) => e.id === "pc:1")!;
  assert.deepEqual(analystEdge.data.route, route);
  assert.deepEqual(viewEdge.data.route, route, "the route itself (waypoints) must be identical regardless of analystMode — only presentation flags differ");
  assert.equal(analystEdge.type, "drugRoutedEdge");
  assert.equal(viewEdge.type, "drugRoutedEdge", "a routed edge (non-AUTO mode + >=1 waypoint) keeps rendering through the custom component in View Mode too — only its handles hide, the custom PATH stays rendered");
});

// =====================================================================
// B. Source-level: the page's effect actually calls the adapter again
//    on a pure mode/lock change (proves the fix closes the real gap the
//    behavioral tests above can only show is POSSIBLE, not that the page
//    actually does it).
// =====================================================================

function findEffectDeps(source: string, bodyMarker: string): string {
  const bodyIndex = source.indexOf(bodyMarker);
  assert.ok(bodyIndex !== -1, `could not locate effect body containing: ${bodyMarker}`);
  const depsStart = source.indexOf("}, [", bodyIndex);
  assert.ok(depsStart !== -1, "could not locate this effect's dependency array");
  const depsEnd = source.indexOf(");", depsStart);
  return source.slice(depsStart, depsEnd + 2);
}

const buildEffectDeps = findEffectDeps(pageCode, "const built = buildDrugNetworkFlowGraph(");

test("the graph-build effect's dependency array includes effectiveWorkspaceMode — a pure mode toggle must re-run it", () => {
  assert.match(buildEffectDeps, /\beffectiveWorkspaceMode\b/);
});

test("the graph-build effect's dependency array includes boardLocked — a pure lock toggle must re-run it", () => {
  assert.match(buildEffectDeps, /\bboardLocked\b/);
});

test("the graph-build effect passes analystMode/boardLocked into buildDrugNetworkFlowGraph derived from the SAME live values now in its dependency array (not a stale closure)", () => {
  assert.match(pageCode, /analystMode: effectiveWorkspaceMode === "ANALYST",/);
  assert.match(pageCode, /\r?\n\s*boardLocked,\r?\n\s*onWaypointDrag: handleWaypointDrag,/);
});

// --- Section 8/9: no refetch, no URL change, no unnecessary layout reset ---
test("querySignature (which drives node-position reset + fitView) does NOT include effectiveWorkspaceMode or boardLocked — a pure mode/lock toggle must never reset node positions or refetch", () => {
  const querySignatureMatch = pageCode.match(/const querySignature = JSON\.stringify\(\{([\s\S]*?)\}\);/);
  assert.ok(querySignatureMatch, "could not locate querySignature");
  assert.doesNotMatch(querySignatureMatch![1], /effectiveWorkspaceMode/);
  assert.doesNotMatch(querySignatureMatch![1], /boardLocked/);
});

test("on a pure (non-new-query) rebuild, setFlowNodes takes the position-preserving merge path, never the reset/fitView path", () => {
  // isNewQuery is derived solely from querySignature (already proven above to exclude
  // effectiveWorkspaceMode/boardLocked), so a pure mode/lock toggle always takes this branch.
  // DI-9.4 refactored the merge path into a block form (to preserve annotation nodes separately),
  // but the two logical branches are still strictly guarded by isNewQuery.
  // The non-new-query branch calls mergePreservingManualPositions (block form in DI-9.4 to
  // also preserve annotation nodes). The new-query branch triggers fitView.
  assert.match(pageCode, /mergePreservingManualPositions\(built\.flowNodes, current\w*, false\)/);
  assert.match(pageCode, /if \(isNewQuery\) window\.requestAnimationFrame\(\(\) => fitView/);
});
