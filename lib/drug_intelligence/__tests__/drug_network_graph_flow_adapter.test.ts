/**
 * Tests for the flow-graph adapter — the pure transform from
 * DrugGraphNeighborhoodResponse into @xyflow/react node/edge shapes
 * (Phase DI-5.1; extended by Phase DI-5.3 with layout-mode dispatch,
 * label-density, node-density, and focus-neighbor-emphasis dimming).
 * Extracted specifically to fix and regression-test the selected-state bug
 * found during DI-5.1 review (clicking a node never actually set xyflow's
 * `selected` flag, so the selected-ring visual never appeared).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFlowEdgeHoverLabels, buildDrugNetworkFlowGraph, mergePreservingManualPositions, type FlowNode, type BuildFlowGraphOptions } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";

const DEFAULT_OPTIONS: BuildFlowGraphOptions = { layoutMode: "PERSON_CENTERED", labelMode: "ALL", nodeDensity: "STANDARD" };

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
        metadata: { type: "CASE", caseNumber: "CASE-1", status: "OPEN", arrestDate: null, arrestTime: null, province: null, reportingUnitText: null },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 1,
        riskIndicators: [],
      },
      {
        id: "ph1",
        type: "PHONE",
        label: "080-000-0000",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "PHONE", carrier: null },
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
      {
        id: "cp:1",
        source: "c1",
        target: "ph1",
        relationshipType: "CASE_PHONE",
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: ["c1"],
        explanation: { kind: "DIRECT_LINK" },
      },
    ],
  };
}

test("the focus node is marked isFocus=true, no other node is", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, DEFAULT_OPTIONS);
  const p1 = flowNodes.find((n) => n.id === "p1")!;
  const c1 = flowNodes.find((n) => n.id === "c1")!;
  assert.equal(p1.data.isFocus, true);
  assert.equal(c1.data.isFocus, false);
});

test("selectedNodeId marks exactly that node's flow representation as selected=true — the DI-5.1 bug fix", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "c1", null, DEFAULT_OPTIONS);
  const p1 = flowNodes.find((n) => n.id === "p1")!;
  const c1 = flowNodes.find((n) => n.id === "c1")!;
  assert.equal(p1.selected, false);
  assert.equal(c1.selected, true);
});

test("no selection means every flow node has selected=false", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, DEFAULT_OPTIONS);
  assert.ok(flowNodes.every((n) => n.selected === false));
});

test("selectedEdgeId marks exactly that edge's flow representation as selected=true", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", DEFAULT_OPTIONS);
  assert.equal(flowEdges[0].selected, true);
});

test("a DIRECT edge gets a solid stroke (no dash array), an INFERRED edge gets a dashed stroke", () => {
  const data = neighborhood();
  data.edges.push({
    id: "inf:1",
    source: "p1",
    target: "c1",
    relationshipType: "SHARED_CASE",
    edgeKind: "INFERRED",
    evidenceCount: 2,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [],
    explanation: { kind: "SHARED_CASES", count: 2 },
  });
  const { flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, null, null, DEFAULT_OPTIONS);
  const direct = flowEdges.find((e) => e.id === "pc:1")!;
  const inferred = flowEdges.find((e) => e.id === "inf:1")!;
  assert.equal(direct.style.strokeDasharray, undefined);
  assert.equal(inferred.style.strokeDasharray, "5 5");
});

test("edge labels use the SHORT label key, not the full relationship label key, to stay canvas-safe", () => {
  const calls: string[] = [];
  buildDrugNetworkFlowGraph(
    neighborhood(),
    (k) => {
      calls.push(k);
      return k;
    },
    null,
    null,
    DEFAULT_OPTIONS
  );
  assert.ok(calls.includes("di.network.relOpPersonCase"), "must translate the operational short label for PERSON_CASE, not the long di.network.relPersonCase key");
  assert.ok(!calls.includes("di.network.relPersonCase"), "must never use the long relationship label on the canvas edge itself");
});

test("node positions are always finite numbers, never NaN, for every node including the focus", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, DEFAULT_OPTIONS);
  for (const node of flowNodes) {
    assert.ok(Number.isFinite(node.position.x));
    assert.ok(Number.isFinite(node.position.y));
  }
});

test("empty neighborhood produces empty node/edge arrays without throwing", () => {
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(
    { focus: { entityType: "PERSON", entityId: "p1" }, nodes: [], edges: [], truncated: false },
    (k) => k,
    null,
    null,
    DEFAULT_OPTIONS
  );
  assert.deepEqual(flowNodes, []);
  assert.deepEqual(flowEdges, []);
});

// ---------------------------------------------------------------------
// Phase DI-5.3, Section 14/17 — edge type per layout mode, and label-mode helpers.

test("edge `type` follows the layout mode's recommended xyflow edge type", () => {
  const { flowEdges: hierEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, { ...DEFAULT_OPTIONS, layoutMode: "HIERARCHICAL" });
  const { flowEdges: personEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, { ...DEFAULT_OPTIONS, layoutMode: "PERSON_CENTERED" });
  assert.equal(hierEdges[0].type, "smoothstep");
  assert.equal(personEdges[0].type, "default");
});

test("labelMode=HIDDEN produces empty labels for every edge, regardless of selection", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1", { ...DEFAULT_OPTIONS, labelMode: "HIDDEN" });
  assert.ok(flowEdges.every((e) => e.label === ""));
});

test("labelMode=ALL: hovering a secondary edge reveals that label without showing other cross-links", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    labelMode: "ALL",
    hoveredEdgeId: "cp:1",
  });
  assert.notEqual(flowEdges.find((e) => e.id === "pc:1")!.label, "");
  assert.notEqual(flowEdges.find((e) => e.id === "cp:1")!.label, "");
});

test("labelMode=SELECTED_ONLY: with no selection and no hover, repetitive DIRECT labels stay hidden", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, { ...DEFAULT_OPTIONS, labelMode: "SELECTED_ONLY" });
  assert.ok(flowEdges.every((e) => e.label === ""));
});

test("labelMode=SELECTED_ONLY: inferred relationship labels stay visible without selection", () => {
  const data = neighborhood();
  data.edges.push({
    id: "inf:1",
    source: "p1",
    target: "c1",
    relationshipType: "SHARED_CASE",
    edgeKind: "INFERRED",
    evidenceCount: 2,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [],
    explanation: { kind: "SHARED_CASES", count: 2 },
  });
  const { flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, null, null, { ...DEFAULT_OPTIONS, labelMode: "SELECTED_ONLY" });
  assert.equal(flowEdges.find((e) => e.id === "pc:1")!.label, "");
  assert.notEqual(flowEdges.find((e) => e.id === "inf:1")!.label, "");
});

test("labelMode=SELECTED_ONLY: hovering an edge reveals only that edge's label", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    labelMode: "SELECTED_ONLY",
    hoveredEdgeId: "pc:1",
  });
  assert.notEqual(flowEdges.find((e) => e.id === "pc:1")!.label, "");
  assert.equal(flowEdges.find((e) => e.id === "cp:1")!.label, "");
});

test("applyFlowEdgeHoverLabels patches labels without changing edge identity, style, or topology", () => {
  const data = neighborhood();
  const { flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, null, null, { ...DEFAULT_OPTIONS, labelMode: "SELECTED_ONLY" });
  const patched = applyFlowEdgeHoverLabels(flowEdges, data, (k) => k, null, null, "SELECTED_ONLY", null, "pc:1");
  assert.notEqual(patched.find((e) => e.id === "pc:1")!.label, "");
  assert.equal(patched.find((e) => e.id === "cp:1")!.label, "");
  assert.equal(patched.length, flowEdges.length);
  assert.deepEqual(
    patched.map((e) => ({ id: e.id, source: e.source, target: e.target, style: e.style })),
    flowEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, style: e.style }))
  );
  const unchanged = applyFlowEdgeHoverLabels(flowEdges, data, (k) => k, null, null, "SELECTED_ONLY", null, null);
  assert.equal(unchanged, flowEdges);
});

test("labelMode=SELECTED_ONLY: with a node selected, only edges touching that node show a label — the unrelated edge is blank", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, { ...DEFAULT_OPTIONS, labelMode: "SELECTED_ONLY" });
  // no selection baseline already covered above; now select p1, which only touches pc:1, not cp:1
  const { flowEdges: withSelection } = buildDrugNetworkFlowGraph(
    neighborhood(),
    (k) => k,
    "p1",
    null,
    { ...DEFAULT_OPTIONS, labelMode: "SELECTED_ONLY" }
  );
  const touching = withSelection.find((e) => e.id === "pc:1")!;
  const untouched = withSelection.find((e) => e.id === "cp:1")!;
  assert.notEqual(touching.label, "");
  assert.equal(untouched.label, "");
  void flowEdges;
});

// ---------------------------------------------------------------------
// Phase DI-5.3.1 — the confirmed real-browser drag-failure root cause: every
// edge unconditionally got zIndex:5 regardless of selection, which put edge
// SVG paths above node DOM elements in stacking order. Any node with several
// edges converging on it (the focus node, hub cases) became unclickable/
// undraggable across most of its visible surface because the edge painted
// on top intercepted the pointer first. Confirmed via Playwright
// elementFromPoint() hit-testing against the live authenticated app.

test("with no selection, every edge has NO elevated zIndex — nodes must stay on top for click/drag to reach them", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, DEFAULT_OPTIONS);
  assert.ok(
    flowEdges.every((e) => e.zIndex === undefined),
    "no edge should have an elevated zIndex when nothing is selected — the DI-5.3.1 regression gave every edge zIndex:5 unconditionally"
  );
});

test("with a node selected, only the edge(s) touching it get an elevated zIndex — unrelated edges stay unelevated", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "p1", null, DEFAULT_OPTIONS);
  const touching = flowEdges.find((e) => e.id === "pc:1")!; // touches p1
  const untouched = flowEdges.find((e) => e.id === "cp:1")!; // does not touch p1
  assert.ok(touching.zIndex! > 0);
  assert.equal(untouched.zIndex, 0);
});

test("the selected edge itself gets the highest zIndex among touching edges", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "p1", "pc:1", DEFAULT_OPTIONS);
  const selected = flowEdges.find((e) => e.id === "pc:1")!;
  assert.equal(selected.zIndex, 10);
});

// ---------------------------------------------------------------------
// Phase DI-5.3, Section 16 — node-density mode is carried through verbatim.

test("nodeDensity is passed through to every node's data.density", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, { ...DEFAULT_OPTIONS, nodeDensity: "COMPACT" });
  assert.ok(flowNodes.every((n) => n.data.density === "COMPACT"));
});

// ---------------------------------------------------------------------
// Phase DI-5.3, Section 17 — focus-neighbor emphasis: selecting a node dims
// (never removes) everything not directly connected to it.

test("selecting the focus node does not dim the rest of the graph", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "p1", null, DEFAULT_OPTIONS);
  assert.ok(flowNodes.every((n) => n.data.dimmed === false));
});

test("selecting a secondary node emphasizes its incident neighborhood and dims unrelated nodes", () => {
  const data = neighborhood();
  data.nodes.push({
    id: "v1",
    type: "VEHICLE",
    label: "1กก-0001",
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "VEHICLE", registrationProvince: null, brand: null, model: null, color: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  });
  data.edges.push({
    id: "pv:1",
    source: "p1",
    target: "v1",
    relationshipType: "PERSON_VEHICLE",
    edgeKind: "DIRECT",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [],
    explanation: { kind: "DIRECT_LINK" },
  });
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, "ph1", null, DEFAULT_OPTIONS);
  assert.equal(flowNodes.find((n) => n.id === "p1")!.data.dimmed, false);
  assert.equal(flowNodes.find((n) => n.id === "ph1")!.data.dimmed, false);
  assert.equal(flowNodes.find((n) => n.id === "c1")!.data.dimmed, false);
  assert.equal(flowNodes.find((n) => n.id === "v1")!.data.dimmed, true);
  const phoneCase = flowEdges.find((e) => e.id === "cp:1")!;
  const personCase = flowEdges.find((e) => e.id === "pc:1")!;
  const personVehicle = flowEdges.find((e) => e.id === "pv:1")!;
  assert.equal(phoneCase.style.opacity, 1);
  assert.equal(phoneCase.style.strokeWidth, 2);
  assert.notEqual(phoneCase.label, "");
  assert.ok((personCase.style.opacity ?? 1) < 1);
  assert.ok((personVehicle.style.opacity ?? 1) < (phoneCase.style.opacity ?? 1));
});

test("isolateSelectedPath still highlights the path from focus and dims off-path nodes", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "c1", null, {
    ...DEFAULT_OPTIONS,
    isolateSelectedPath: true,
  });
  const p1 = flowNodes.find((n) => n.id === "p1")!;
  const c1 = flowNodes.find((n) => n.id === "c1")!;
  const ph1 = flowNodes.find((n) => n.id === "ph1")!;
  assert.equal(p1.data.dimmed, false);
  assert.equal(c1.data.dimmed, false);
  assert.equal(c1.data.onSelectedPath, true);
  assert.equal(ph1.data.dimmed, true);
});

test("with no selection, no node is dimmed", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, DEFAULT_OPTIONS);
  assert.ok(flowNodes.every((n) => n.data.dimmed === false));
});

test("dimming never removes a node — every node id is still present in flowNodes when one is selected", () => {
  const data = neighborhood();
  const { flowNodes } = buildDrugNetworkFlowGraph(data, (k) => k, "c1", null, DEFAULT_OPTIONS);
  assert.deepEqual(
    flowNodes.map((n) => n.id).sort(),
    data.nodes.map((n) => n.id).sort()
  );
});

test("selected-path edges are thicker and fully opaque; off-path edges stay dashed/solid and dimmer", () => {
  const data = neighborhood();
  data.edges.push({
    id: "inf:path",
    source: "p1",
    target: "c1",
    relationshipType: "SHARED_CASE",
    edgeKind: "INFERRED",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [],
    explanation: { kind: "SHARED_CASES", count: 1 },
  });
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, "c1", null, {
    ...DEFAULT_OPTIONS,
    isolateSelectedPath: true,
  });
  const pathEdge = flowEdges.find((e) => e.id === "pc:1")!;
  const inferred = flowEdges.find((e) => e.id === "inf:path")!;
  const offPath = flowEdges.find((e) => e.id === "cp:1")!;
  assert.equal(flowNodes.find((n) => n.id === "c1")!.selected, true);
  assert.equal(flowNodes.find((n) => n.id === "c1")!.data.onSelectedPath, true);
  assert.equal(pathEdge.style.strokeWidth, 3);
  assert.equal(pathEdge.style.opacity, 1);
  assert.equal(pathEdge.style.strokeDasharray, undefined);
  assert.equal(offPath.style.opacity, 0.28);
  assert.ok((offPath.style.strokeWidth ?? 1) < 3);
  assert.equal(inferred.style.strokeDasharray, "5 5");
});

test("edges off the selected path get reduced opacity but are never removed", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "c1", null, {
    ...DEFAULT_OPTIONS,
    isolateSelectedPath: true,
  });
  const onPath = flowEdges.find((e) => e.id === "pc:1")!;
  const offPath = flowEdges.find((e) => e.id === "cp:1")!;
  assert.equal(onPath.style.opacity, 1);
  assert.ok(offPath.style.opacity! < 1);
  assert.equal(flowEdges.length, 2, "no edge is ever removed by selection-driven dimming");
});

// ---------------------------------------------------------------------
// Phase DI-5.3, Section 2 — the manual-drag regression fix. Without this
// helper (wired into the page via useNodesState + onNodesChange), a dragged
// node's position was discarded on the very next re-render because
// buildDrugNetworkFlowGraph is a pure function of server data + selection,
// with no memory of an on-screen drag.
function flowNode(id: string, position: { x: number; y: number }): FlowNode {
  return {
    id,
    type: "drugGraphNode",
    position,
    selected: false,
    data: {
      graphNode: { id, type: "PERSON" } as unknown as FlowNode["data"]["graphNode"],
      isFocus: false,
      density: "STANDARD",
      dimmed: false,
      pinned: false,
      hopDistance: 0,
      isShared: false,
      onSelectedPath: false,
      temporalFocused: false,
      temporalContextDimmed: false,
      showHopBadge: false,
      stronglyDimmed: false,
      pathViaHint: null,
      pathViaMoreCount: 0,
      compareRole: null,
      compareSlot: null,
      compareJunction: false,
      compareInspect: false,
      neighborCounts: { PERSON: 0, PHONE: 0, SIM: 0, DEVICE: 0, VEHICLE: 0, CASE: 0, LOCATION: 0 },
      canExpand: true,
    },
  };
}

test("mergePreservingManualPositions: a dragged node keeps its on-screen position across a same-query re-render (e.g. selecting a node)", () => {
  const current = [flowNode("p1", { x: 999, y: 888 }), flowNode("c1", { x: 0, y: 0 })];
  const next = [flowNode("p1", { x: 10, y: 20 }), flowNode("c1", { x: 30, y: 40 })];
  const merged = mergePreservingManualPositions(next, current, false);
  assert.deepEqual(merged.find((n) => n.id === "p1")!.position, { x: 999, y: 888 });
  assert.deepEqual(merged.find((n) => n.id === "c1")!.position, { x: 0, y: 0 });
});

test("mergePreservingManualPositions: a new query (focus/depth/filter change) resets to the freshly-computed layout, discarding old drag positions", () => {
  const current = [flowNode("p1", { x: 999, y: 888 })];
  const next = [flowNode("p1", { x: 10, y: 20 })];
  const merged = mergePreservingManualPositions(next, current, true);
  assert.deepEqual(merged.find((n) => n.id === "p1")!.position, { x: 10, y: 20 });
});

test("mergePreservingManualPositions: a node newly appearing this render (not in current) gets its freshly-computed position, no crash on missing lookup", () => {
  const current = [flowNode("p1", { x: 999, y: 888 })];
  const next = [flowNode("p1", { x: 10, y: 20 }), flowNode("c1", { x: 50, y: 60 })];
  const merged = mergePreservingManualPositions(next, current, false);
  assert.deepEqual(merged.find((n) => n.id === "c1")!.position, { x: 50, y: 60 });
});

test("mergePreservingManualPositions: preserves every node id from `next` — never drops or duplicates a node", () => {
  const current = [flowNode("p1", { x: 999, y: 888 }), flowNode("stale", { x: 1, y: 1 })];
  const next = [flowNode("p1", { x: 10, y: 20 }), flowNode("c1", { x: 30, y: 40 })];
  const merged = mergePreservingManualPositions(next, current, false);
  assert.deepEqual(
    merged.map((n) => n.id).sort(),
    ["c1", "p1"]
  );
});

test("mergePreservingManualPositions: is deterministic — same inputs always produce the same output", () => {
  const current = [flowNode("p1", { x: 999, y: 888 })];
  const next = [flowNode("p1", { x: 10, y: 20 }), flowNode("c1", { x: 30, y: 40 })];
  const a = mergePreservingManualPositions(next, current, false);
  const b = mergePreservingManualPositions(next, current, false);
  assert.deepEqual(a, b);
});
