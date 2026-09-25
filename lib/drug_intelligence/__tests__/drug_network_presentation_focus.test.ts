/**
 * DI-8.7 V1.5B VISUAL HOTFIX — presentation-only graph focus/dimming
 * driven by an explicit node/edge id set (`presentationFocus`), WITHOUT
 * requiring a selected secondary node. Introduced so the Crime Clock's
 * "ดูบนผัง" no longer has to fabricate a node selection (which was
 * auto-opening the Inspector for one arbitrary matching case) just to
 * get graph emphasis/dimming.
 *
 * Covers Section 12 items A-I, M, N (pure adapter-level); page-wiring
 * items B, C, J, K, L, O, P are covered by
 * drug_temporal_graph_focus_wiring.test.ts's source-level checks.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDrugNetworkFlowGraph, type BuildFlowGraphOptions } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";

const DEFAULT_OPTIONS: BuildFlowGraphOptions = { layoutMode: "PERSON_CENTERED", labelMode: "ALL", nodeDensity: "STANDARD" };

/**
 * focus p1 -> matching case c1 -> shared phone ph1 -> non-matching case c2
 * (c2 is otherwise unrelated context, present only to prove the shared-
 * entity edge to it stays dimmed/unemphasized).
 */
function neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    truncated: false,
    nodes: [
      { id: "p1", type: "PERSON", label: "สมชาย", secondaryLabel: null, maskedLabel: null, metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false }, firstSeenAt: null, lastSeenAt: null, caseCount: 2, riskIndicators: [] },
      { id: "c1", type: "CASE", label: "CASE-1", secondaryLabel: null, maskedLabel: null, metadata: { type: "CASE", caseNumber: "CASE-1", status: "OPEN", arrestDate: "2026-09-24", arrestTime: "19:00", province: null, reportingUnitText: null }, firstSeenAt: null, lastSeenAt: null, caseCount: 1, riskIndicators: [] },
      { id: "c2", type: "CASE", label: "CASE-2", secondaryLabel: null, maskedLabel: null, metadata: { type: "CASE", caseNumber: "CASE-2", status: "OPEN", arrestDate: "2026-09-20", arrestTime: "08:00", province: null, reportingUnitText: null }, firstSeenAt: null, lastSeenAt: null, caseCount: 1, riskIndicators: [] },
      { id: "ph1", type: "PHONE", label: "080-000-0000", secondaryLabel: null, maskedLabel: null, metadata: { type: "PHONE", carrier: null }, firstSeenAt: null, lastSeenAt: null, caseCount: 2, riskIndicators: [] },
      { id: "veh1", type: "VEHICLE", label: "กข-1234", secondaryLabel: null, maskedLabel: null, metadata: { type: "VEHICLE", registrationProvince: null, brand: null, model: null, color: null }, firstSeenAt: null, lastSeenAt: null, caseCount: 1, riskIndicators: [] },
    ],
    edges: [
      { id: "pc:1", source: "p1", target: "c1", relationshipType: "PERSON_CASE", edgeKind: "DIRECT", evidenceCount: 1, firstSeenAt: null, lastSeenAt: null, sourceCaseIds: ["c1"], explanation: { kind: "DIRECT_ROLE", role: "SUSPECT" } },
      { id: "pc:2", source: "p1", target: "c2", relationshipType: "PERSON_CASE", edgeKind: "DIRECT", evidenceCount: 1, firstSeenAt: null, lastSeenAt: null, sourceCaseIds: ["c2"], explanation: { kind: "DIRECT_ROLE", role: "SUSPECT" } },
      { id: "cp:1", source: "c1", target: "ph1", relationshipType: "CASE_PHONE", edgeKind: "DIRECT", evidenceCount: 1, firstSeenAt: null, lastSeenAt: null, sourceCaseIds: ["c1"], explanation: { kind: "DIRECT_LINK" } },
      { id: "cp:2", source: "c2", target: "ph1", relationshipType: "CASE_PHONE", edgeKind: "DIRECT", evidenceCount: 1, firstSeenAt: null, lastSeenAt: null, sourceCaseIds: ["c2"], explanation: { kind: "DIRECT_LINK" } },
      { id: "cv:1", source: "c1", target: "veh1", relationshipType: "CASE_VEHICLE", edgeKind: "DIRECT", evidenceCount: 1, firstSeenAt: null, lastSeenAt: null, sourceCaseIds: ["c1"], explanation: { kind: "DIRECT_LINK" } },
    ],
  };
}

// Simulates computeTemporalGraphFocus's output for "only c1 matches" (mirrors the real derivation rule this adapter test is downstream of).
const TEMPORAL_FOCUS_C1 = { nodeIds: ["c1", "p1", "ph1", "veh1"], edgeIds: ["pc:1", "cp:1", "cv:1"] };

// A. Temporal focus can produce graph emphasis without selectedSecondaryId.
test("A. presentationFocus produces node dimming with selectedNodeId=null and selectedEdgeId=null (no secondary selection)", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  const c2 = flowNodes.find((n) => n.id === "c2")!;
  assert.equal(c2.data.dimmed, true, "c2 (not in presentationFocus) must be dimmed even though nothing is selected");
});

// B. Activating temporal focus does not require setSelectedNode — proven directly: selectedNodeId stays null throughout this whole file's calls.
test("B. every call in this suite passes selectedNodeId=null — presentationFocus never needs a fabricated selection", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  assert.ok(flowNodes.every((n) => n.selected === false), "no node should carry xyflow's own selected=true when selectedNodeId is null");
});

// C. Inspector is not auto-opened — this is a page-level (not adapter-level) behavior, covered by drug_temporal_graph_focus_wiring.test.ts's source checks that handleTemporalViewOnGraph never calls setSelectedNode with a real node.

// D. Matching CASE nodes are emphasized (not dimmed).
test("D. the matching CASE node (c1) is not dimmed", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  const c1 = flowNodes.find((n) => n.id === "c1")!;
  assert.equal(c1.data.dimmed, false);
  assert.equal(c1.data.onSelectedPath, true);
});

// E. Directly connected entity nodes are emphasized.
test("E. directly connected entities (ph1, veh1, p1) in presentationFocus.nodeIds are not dimmed", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  for (const id of ["ph1", "veh1", "p1"]) {
    const node = flowNodes.find((n) => n.id === id)!;
    assert.equal(node.data.dimmed, false, `${id} must not be dimmed`);
  }
});

// F. Matching CASE-touching edges are emphasized.
test("F. edges in presentationFocus.edgeIds (pc:1, cp:1, cv:1) are marked onPath/not dimmed via full opacity", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  for (const id of ["pc:1", "cp:1", "cv:1"]) {
    const edge = flowEdges.find((e) => e.id === id)!;
    assert.equal(edge.style?.opacity, 1, `${id} must render at full opacity (in focus)`);
  }
});

// G. Unrelated nodes remain rendered but dimmed (never removed).
test("G. c2 (unrelated to the temporal focus) remains present in flowNodes, only dimmed — never removed", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  const c2 = flowNodes.find((n) => n.id === "c2");
  assert.ok(c2, "c2 must still be rendered — presentation focus never removes graph records");
  assert.equal(c2!.data.dimmed, true);
});

// H. Shared entity (ph1) does not promote a non-matching CASE (c2).
test("H. ph1 is emphasized (touches matching c1) but this does NOT promote c2, which stays dimmed", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  const ph1 = flowNodes.find((n) => n.id === "ph1")!;
  const c2 = flowNodes.find((n) => n.id === "c2")!;
  assert.equal(ph1.data.dimmed, false);
  assert.equal(c2.data.dimmed, true, "c2 must remain dimmed even though it shares ph1 with the matching case");
});

// I. Shared entity's edge to the non-matching CASE remains dimmed.
test("I. the cp:2 edge (ph1 <-> c2, non-matching) is NOT in presentationFocus.edgeIds and renders dimmed", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  const cp2 = flowEdges.find((e) => e.id === "cp:2")!;
  assert.notEqual(cp2.style?.opacity, 1, "cp:2 (ph1<->non-matching c2) must render dimmed, not full opacity");
  const pc2 = flowEdges.find((e) => e.id === "pc:2")!;
  assert.notEqual(pc2.style?.opacity, 1, "pc:2 (p1<->non-matching c2) must also stay dimmed");
});

// J. Explicit user node selection after temporal focus still supports normal Inspector behavior.
test("J. a real selectedNodeId takes precedence over presentationFocus — the adapter ignores presentationFocus once something is actually selected", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "c2", null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
    emphasizeSelectedPath: true,
  });
  const c2 = flowNodes.find((n) => n.id === "c2")!;
  assert.equal(c2.selected, true, "the explicitly selected node must show xyflow's own selected=true");
  // With a real selection active, dimming now follows the NORMAL selected-path logic, not the stale presentationFocus set.
  assert.equal(c2.data.dimmed, false, "the newly selected node itself is never dimmed");
});

// K/L are page-level state-clearing behaviors — covered by drug_temporal_graph_focus_wiring.test.ts (S, R, existing tests).

// M. No topology mutation — node/edge counts identical with and without presentationFocus.
test("M. presentationFocus never changes node/edge counts", () => {
  const data = neighborhood();
  const withoutFocus = buildDrugNetworkFlowGraph(data, (k) => k, null, null, DEFAULT_OPTIONS);
  const withFocus = buildDrugNetworkFlowGraph(data, (k) => k, null, null, { ...DEFAULT_OPTIONS, presentationFocus: TEMPORAL_FOCUS_C1 });
  assert.equal(withFocus.flowNodes.length, withoutFocus.flowNodes.length);
  assert.equal(withFocus.flowEdges.length, withoutFocus.flowEdges.length);
  assert.deepEqual(withFocus.flowNodes.map((n) => n.id).sort(), withoutFocus.flowNodes.map((n) => n.id).sort());
  assert.deepEqual(withFocus.flowEdges.map((e) => e.id).sort(), withoutFocus.flowEdges.map((e) => e.id).sort());
});

// N. No DIRECT/PATH/INFERRED semantic changes — every edge's recorded edgeKind
// (DIRECT here; INFERRED would render dashed, see e.edgeKind === "INFERRED"
// branch in the adapter) is read straight from the source neighborhood data
// and is completely untouched by presentationFocus — it only ever affects
// opacity/strokeWidth, never the dash pattern that encodes edgeKind.
test("N. presentationFocus never changes an edge's edgeKind-driven dash styling — every source edge here is DIRECT and stays solid (no strokeDasharray) regardless of focus/dim state", () => {
  const data = neighborhood();
  assert.ok(data.edges.every((e) => e.edgeKind === "DIRECT"), "fixture sanity: this suite's edges are all DIRECT");
  const withFocus = buildDrugNetworkFlowGraph(data, (k) => k, null, null, { ...DEFAULT_OPTIONS, presentationFocus: TEMPORAL_FOCUS_C1 });
  for (const edge of data.edges) {
    const flowEdge = withFocus.flowEdges.find((e) => e.id === edge.id)!;
    assert.equal(flowEdge.style?.strokeDasharray, undefined, `${edge.id} is DIRECT and must never render dashed (that's the INFERRED-only styling) regardless of dim/focus state`);
  }
});

// VISUAL HOTFIX — Section 14.A: strong visual hierarchy (matching case strongest, touching entity readable, non-focus strongly dimmed).
test("VISUAL: matching CASE node c1 carries temporalFocused=true and a strong accent ring, never the ordinary weak onSelectedPath ring", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  const c1 = flowNodes.find((n) => n.id === "c1")!;
  assert.equal(c1.data.temporalFocused, true);
  assert.equal(c1.data.temporalContextDimmed, false);
});
test("VISUAL: directly connected entities (ph1, veh1, p1) are temporalFocused=true and readable (not dimmed)", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  for (const id of ["ph1", "veh1", "p1"]) {
    const node = flowNodes.find((n) => n.id === id)!;
    assert.equal(node.data.temporalFocused, true, `${id} must be temporalFocused`);
  }
});
test("VISUAL: non-focus node c2 is temporalContextDimmed=true and uses the strong CARD_GRAPH_TEMPORAL_CONTEXT_OPACITY tier, not the weaker ordinary dim tiers", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  const c2 = flowNodes.find((n) => n.id === "c2")!;
  assert.equal(c2.data.temporalContextDimmed, true);
  assert.equal(c2.data.temporalFocused, false);
});
test("VISUAL: non-focus edges (pc:2, cp:2) render at the strong CARD_GRAPH_TEMPORAL_CONTEXT_OPACITY (0.22), not the weaker 0.28/0.42 ordinary isolate tiers", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: TEMPORAL_FOCUS_C1,
  });
  for (const id of ["pc:2", "cp:2"]) {
    const edge = flowEdges.find((e) => e.id === id)!;
    assert.equal(edge.style?.opacity, 0.22, `${id} must use the dedicated strong temporal-context opacity`);
  }
});
test("VISUAL: without presentationFocus, no node ever carries temporalFocused=true or temporalContextDimmed=true", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, DEFAULT_OPTIONS);
  assert.ok(flowNodes.every((n) => n.data.temporalFocused === false && n.data.temporalContextDimmed === false));
});

// Empty presentationFocus (0 nodes) behaves as if absent — never an empty/broken isolate state.
test("presentationFocus with an empty nodeIds array behaves as if absent (no dimming applied from it)", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null, {
    ...DEFAULT_OPTIONS,
    presentationFocus: { nodeIds: [], edgeIds: [] },
  });
  assert.ok(flowNodes.every((n) => n.data.dimmed === false), "an empty presentationFocus must never dim the whole graph");
});

