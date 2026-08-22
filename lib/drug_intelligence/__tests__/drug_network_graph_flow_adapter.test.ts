/**
 * Tests for the DI-5.1 flow-graph adapter — the pure transform from
 * DrugGraphNeighborhoodResponse into @xyflow/react node/edge shapes,
 * extracted specifically to fix and regression-test the selected-state bug
 * found during DI-5.1 review (clicking a node never actually set xyflow's
 * `selected` flag, so the selected-ring visual never appeared).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDrugNetworkFlowGraph } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";

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

test("the focus node is marked isFocus=true, no other node is", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null);
  const p1 = flowNodes.find((n) => n.id === "p1")!;
  const c1 = flowNodes.find((n) => n.id === "c1")!;
  assert.equal(p1.data.isFocus, true);
  assert.equal(c1.data.isFocus, false);
});

test("selectedNodeId marks exactly that node's flow representation as selected=true — the DI-5.1 bug fix", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, "c1", null);
  const p1 = flowNodes.find((n) => n.id === "p1")!;
  const c1 = flowNodes.find((n) => n.id === "c1")!;
  assert.equal(p1.selected, false);
  assert.equal(c1.selected, true);
});

test("no selection means every flow node has selected=false", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null);
  assert.ok(flowNodes.every((n) => n.selected === false));
});

test("selectedEdgeId marks exactly that edge's flow representation as selected=true", () => {
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, "pc:1");
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
  const { flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, null, null);
  const direct = flowEdges.find((e) => e.id === "pc:1")!;
  const inferred = flowEdges.find((e) => e.id === "inf:1")!;
  assert.equal(direct.style.strokeDasharray, undefined);
  assert.equal(inferred.style.strokeDasharray, "5 5");
});

test("edge labels use the SHORT label key, not the full relationship label key, to stay canvas-safe", () => {
  const calls: string[] = [];
  buildDrugNetworkFlowGraph(neighborhood(), (k) => {
    calls.push(k);
    return k;
  }, null, null);
  assert.ok(calls.includes("di.network.relShortCase"), "must translate the SHORT label key for PERSON_CASE, not the long di.network.relPersonCase key");
  assert.ok(!calls.includes("di.network.relPersonCase"), "must never use the long relationship label on the canvas edge itself");
});

test("node positions are always finite numbers, never NaN, for every node including the focus", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (k) => k, null, null);
  for (const node of flowNodes) {
    assert.ok(Number.isFinite(node.position.x));
    assert.ok(Number.isFinite(node.position.y));
  }
});

test("empty neighborhood produces empty node/edge arrays without throwing", () => {
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph({ focus: { entityType: "PERSON", entityId: "p1" }, nodes: [], edges: [], truncated: false }, (k) => k, null, null);
  assert.deepEqual(flowNodes, []);
  assert.deepEqual(flowEdges, []);
});
