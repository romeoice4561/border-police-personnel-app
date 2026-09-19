/**
 * Presentation-only readability helpers. These must never mutate graph
 * payloads or invent relationship semantics.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { buildDrugNetworkFlowGraph } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import {
  appearanceReasonKey,
  EDGE_LABEL_MIN_CLEARANCE_PX,
  edgeLabelCorridorKey,
  edgeLabelOffsetPx,
  edgeLabelStaggerSigned,
  edgeSmoothStepPathOffset,
  formatGraphNodeCard,
  formatReadablePhoneLabel,
  formatReadableSimLabel,
  hopDistances,
  isSharedEntity,
  neighborCountsForNode,
  selectedPathSteps,
  shouldShowEdgeLabel,
  shortestUndirectedPath,
  summarizeNeighborhood,
} from "@/lib/drug_intelligence/drug_network_graph_readability";
import { computeGroupByTypeLaneHeaders, resolveAutoLayoutMode } from "@/lib/drug_intelligence/drug_network_graph_layout";

function node(
  id: string,
  type: DrugGraphNeighborhoodResponse["nodes"][number]["type"],
  label: string,
  extras: Partial<DrugGraphNeighborhoodResponse["nodes"][number]> = {},
): DrugGraphNeighborhoodResponse["nodes"][number] {
  return {
    id,
    type,
    label,
    secondaryLabel: extras.secondaryLabel ?? null,
    maskedLabel: null,
    metadata: extras.metadata ?? { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: extras.caseCount ?? 1,
    riskIndicators: [],
  };
}

function neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    truncated: false,
    nodes: [
      node("p1", "PERSON", "นายทดสอบ", { secondaryLabel: "ก้อง", caseCount: 3 }),
      node("c1", "CASE", "DI-A", { metadata: { type: "CASE", caseNumber: "DI-A", status: "OPEN", arrestDate: null, province: null, reportingUnitText: null } }),
      node("c2", "CASE", "DI-B", { metadata: { type: "CASE", caseNumber: "DI-B", status: "OPEN", arrestDate: null, province: null, reportingUnitText: null } }),
      node("ph1", "PHONE", "66900001001", { metadata: { type: "PHONE", carrier: null }, caseCount: 2 }),
      node("sim1", "SIM", "89000000000000000001", { metadata: { type: "SIM", imsi: null, carrier: null } }),
      node("c5", "CASE", "CASE005", { metadata: { type: "CASE", caseNumber: "CASE005", status: "OPEN", arrestDate: null, province: null, reportingUnitText: null } }),
    ],
    edges: [
      {
        id: "e-pc1",
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
        id: "e-pc2",
        source: "p1",
        target: "c2",
        relationshipType: "PERSON_CASE",
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: ["c2"],
        explanation: { kind: "DIRECT_ROLE", role: "SUSPECT" },
      },
      {
        id: "e-pph",
        source: "p1",
        target: "ph1",
        relationshipType: "PERSON_PHONE",
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: [],
        explanation: { kind: "DIRECT_LINK" },
      },
      {
        id: "e-psim",
        source: "p1",
        target: "sim1",
        relationshipType: "PERSON_SIM",
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: [],
        explanation: { kind: "DIRECT_LINK" },
      },
      {
        id: "e-shared",
        source: "ph1",
        target: "c5",
        relationshipType: "CASE_PHONE",
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: ["c5"],
        explanation: { kind: "DIRECT_LINK" },
      },
    ],
  };
}

test("focused person remains visually marked isFocus and hop 0 after the adapter transform", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, null, null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "SELECTED_ONLY",
    nodeDensity: "STANDARD",
  });
  const focus = flowNodes.find((n) => n.id === "p1")!;
  assert.equal(focus.data.isFocus, true);
  assert.equal(focus.data.hopDistance, 0);
  assert.ok(flowNodes.filter((n) => n.data.isFocus).length === 1);
});

test("GROUP_BY_TYPE headers use occupied entity types only and never invent graph nodes", () => {
  const data = neighborhood();
  const headers = computeGroupByTypeLaneHeaders(
    data.focus.entityId,
    data.nodes.map((n) => ({ id: n.id, type: n.type })),
    data.edges.map((e) => ({ source: e.source, target: e.target })),
  );
  assert.deepEqual(headers.map((h) => h.type), ["CASE", "PHONE", "SIM"]);
  assert.equal(headers.find((h) => h.type === "CASE")!.hop1Count, 2);
  assert.equal(headers.find((h) => h.type === "CASE")!.count, 3);
  assert.equal(data.nodes.length, 6);
});

test("DIRECT edges stay solid and INFERRED edges stay dashed", () => {
  const data = neighborhood();
  data.edges.push({
    id: "inf",
    source: "p1",
    target: "c5",
    relationshipType: "SHARED_PHONE",
    edgeKind: "INFERRED",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [],
    explanation: { kind: "SHARED_PHONE" },
  });
  const { flowEdges } = buildDrugNetworkFlowGraph(data, (key) => key, null, null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "SELECTED_ONLY",
    nodeDensity: "STANDARD",
  });
  assert.equal(flowEdges.find((e) => e.id === "e-pc1")!.style.strokeDasharray, undefined);
  assert.equal(flowEdges.find((e) => e.id === "inf")!.style.strokeDasharray, "5 5");
});

test("edge-label decluttering hides DIRECT labels until hover or selection", () => {
  assert.equal(
    shouldShowEdgeLabel({
      labelMode: "SELECTED_ONLY",
      edgeKind: "DIRECT",
      isSelected: false,
      touchesSelectedNode: false,
      isHovered: false,
      touchesHoveredNode: false,
    }),
    false,
  );
  assert.equal(
    shouldShowEdgeLabel({
      labelMode: "SELECTED_ONLY",
      edgeKind: "DIRECT",
      isSelected: false,
      touchesSelectedNode: false,
      isHovered: true,
      touchesHoveredNode: false,
    }),
    true,
  );
});

test("ALL mode keeps focus-direct labels and hides secondary labels until hover or selection", () => {
  assert.equal(
    shouldShowEdgeLabel({
      labelMode: "ALL",
      edgeKind: "DIRECT",
      isSelected: false,
      touchesSelectedNode: false,
      isHovered: false,
      touchesHoveredNode: false,
      isFocusDirect: true,
    }),
    true,
  );
  assert.equal(
    shouldShowEdgeLabel({
      labelMode: "ALL",
      edgeKind: "DIRECT",
      isSelected: false,
      touchesSelectedNode: false,
      isHovered: false,
      touchesHoveredNode: false,
      isFocusDirect: false,
    }),
    false,
  );
  assert.equal(
    shouldShowEdgeLabel({
      labelMode: "ALL",
      edgeKind: "DIRECT",
      isSelected: false,
      touchesSelectedNode: true,
      isHovered: false,
      touchesHoveredNode: false,
      isFocusDirect: false,
      hasCanvasSelection: true,
    }),
    true,
  );
});

test("summary counts come from the existing neighborhood payload", () => {
  const data = neighborhood();
  const snapshot = structuredClone(data);
  const summary = summarizeNeighborhood(data);
  assert.equal(summary.focusLabel, "นายทดสอบ");
  assert.equal(summary.directByType.CASE, 2);
  assert.equal(summary.directByType.PHONE, 1);
  assert.equal(summary.directByType.SIM, 1);
  assert.equal(summary.indirectTotal, 1);
  assert.equal(summary.sharedEntityCount, 1);
  assert.deepEqual(data, snapshot);
});

test("adapter transform does not mutate neighborhood nodes or edges", () => {
  const data = neighborhood();
  const snapshot = structuredClone(data);
  buildDrugNetworkFlowGraph(data, (key) => key, "c5", null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "SELECTED_ONLY",
    nodeDensity: "STANDARD",
  });
  assert.deepEqual(data, snapshot);
});

test("existing layout modes remain independently resolvable", () => {
  assert.equal(resolveAutoLayoutMode({ focusType: "CASE", isPathResult: false, nodeCount: 4 }), "CASE_CENTERED");
  assert.equal(resolveAutoLayoutMode({ focusType: "PERSON", isPathResult: false, nodeCount: 4 }), "GROUP_BY_TYPE");
  assert.equal(resolveAutoLayoutMode({ focusType: "PHONE", isPathResult: false, nodeCount: 4 }), "HIERARCHICAL");
  assert.equal(resolveAutoLayoutMode({ focusType: "PERSON", isPathResult: true, nodeCount: 4 }), "PATH");
});

test("phone and SIM card text prefer human-readable forms", () => {
  assert.equal(formatReadablePhoneLabel("66900001001"), "090-000-1001");
  assert.equal(formatReadableSimLabel("89000000000000000001"), "8900…0001");
  const phoneCard = formatGraphNodeCard(node("ph", "PHONE", "66900001005", { metadata: { type: "PHONE", carrier: null } }));
  assert.equal(phoneCard.title, "090-000-1005");
  assert.equal(phoneCard.titleTitle, "66900001005");
});

test("shared-entity emphasis uses graph-derived caseCount only", () => {
  const shared = node("ph1", "PHONE", "0900001001", { caseCount: 2, metadata: { type: "PHONE", carrier: null } });
  const single = node("ph2", "PHONE", "0900001002", { caseCount: 1, metadata: { type: "PHONE", carrier: null } });
  assert.equal(isSharedEntity(shared, false), true);
  assert.equal(isSharedEntity(shared, true), false);
  assert.equal(isSharedEntity(single, false), false);
});

test("selected-path helper is a client-side walk and does not invent edges", () => {
  const path = shortestUndirectedPath("p1", "c5", neighborhood().edges);
  assert.deepEqual(path?.nodeIds, ["p1", "ph1", "c5"]);
  assert.deepEqual(path?.edgeIds, ["e-pph", "e-shared"]);
  assert.equal(shortestUndirectedPath("p1", "missing", neighborhood().edges), null);
});

test("safe appearance wording never claims a confirmed common network", () => {
  assert.equal(appearanceReasonKey({ isFocus: true, hopDistance: 0, relationshipTypes: [] }), "di.network.reasonFocus");
  assert.equal(appearanceReasonKey({ isFocus: false, hopDistance: 1, relationshipTypes: ["PERSON_CASE"] }), "di.network.reasonDirect");
  assert.equal(appearanceReasonKey({ isFocus: false, hopDistance: 2, relationshipTypes: ["SHARED_SIM"] }), "di.network.reasonSharedSim");
  assert.equal(appearanceReasonKey({ isFocus: false, hopDistance: 2, relationshipTypes: ["SHARED_VEHICLE"] }), "di.network.reasonSharedVehicle");
  assert.notEqual(appearanceReasonKey({ isFocus: false, hopDistance: 2, relationshipTypes: ["SHARED_CASE"] }), "di.network.reasonDirect");
  assert.notEqual(appearanceReasonKey({ isFocus: false, hopDistance: undefined, relationshipTypes: ["PERSON_VEHICLE"] }), "di.network.reasonDirect");
});

test("path explanation is the existing node-label sequence, never invented relationships", () => {
  const data = neighborhood();
  const steps = selectedPathSteps(data, "c5");
  assert.deepEqual(
    steps.map((step) => step.id),
    ["p1", "ph1", "c5"]
  );
  assert.deepEqual(
    steps.map((step) => step.label),
    ["นายทดสอบ", "66900001001", "CASE005"]
  );
  assert.deepEqual(selectedPathSteps(data, "p1"), []);
});

test("DIRECT wording requires hopDistance === 1, not merely being on a selected path", () => {
  const data = neighborhood();
  const hops = hopDistances(
    data.focus.entityId,
    data.nodes.map((n) => ({ id: n.id, type: n.type })),
    data.edges.map((e) => ({ source: e.source, target: e.target })),
  );
  assert.equal(hops.get("sim1"), 1);
  assert.equal(appearanceReasonKey({ isFocus: false, hopDistance: hops.get("sim1"), relationshipTypes: ["PERSON_SIM"] }), "di.network.reasonDirect");
  assert.equal(hops.get("c5"), 2);
  assert.notEqual(appearanceReasonKey({ isFocus: false, hopDistance: hops.get("c5"), relationshipTypes: ["CASE_PHONE"] }), "di.network.reasonDirect");
});

test("hop distances treat the graph as undirected without changing edge records", () => {
  const data = neighborhood();
  const hops = hopDistances(
    data.focus.entityId,
    data.nodes.map((n) => ({ id: n.id, type: n.type })),
    data.edges.map((e) => ({ source: e.source, target: e.target })),
  );
  assert.equal(hops.get("p1"), 0);
  assert.equal(hops.get("c1"), 1);
  assert.equal(hops.get("c5"), 2);
});

test("neighbor counts come only from loaded edges and never invent entity types", () => {
  const data = neighborhood();
  const counts = neighborCountsForNode("p1", data.nodes, data.edges);
  assert.equal(counts.CASE, 2);
  assert.equal(counts.PHONE, 1);
  assert.equal(counts.SIM, 1);
  assert.equal(counts.VEHICLE, 0);
  assert.equal(counts.PERSON, 0);
});

test("person graph cards never use a UUID as the visible title", () => {
  const opaque = formatGraphNodeCard(
    node("p-uuid", "PERSON", "16b1274d-8553-4833-9ebe-24c236c95d54", { secondaryLabel: "นามแฝง" }),
  );
  assert.equal(opaque.title, "นามแฝง");
  assert.notEqual(opaque.title, "16b1274d-8553-4833-9ebe-24c236c95d54");
});

test("edge label stagger is deterministic and grows clearance within a corridor", () => {
  assert.equal(edgeLabelStaggerSigned(0, 16), 0);
  assert.equal(edgeLabelStaggerSigned(1, 16), -16);
  assert.equal(edgeLabelStaggerSigned(2, 16), 16);
  assert.equal(edgeLabelStaggerSigned(3, 16), -32);
  assert.equal(edgeLabelCorridorKey({ x: 100, y: 200 }, { x: 180, y: 260 }), edgeLabelCorridorKey({ x: 110, y: 210 }, { x: 170, y: 250 }));
  assert.notEqual(edgeLabelCorridorKey({ x: 0, y: 0 }, { x: 20, y: 20 }), edgeLabelCorridorKey({ x: 400, y: 0 }, { x: 420, y: 20 }));
  const vertical = edgeLabelOffsetPx({
    sourcePos: { x: 200, y: 0 },
    targetPos: { x: 210, y: 240 },
    indexInCorridor: 1,
  });
  assert.ok(Math.abs(vertical.y) >= EDGE_LABEL_MIN_CLEARANCE_PX * 2);
  const horizontal = edgeLabelOffsetPx({
    sourcePos: { x: 0, y: 200 },
    targetPos: { x: 300, y: 210 },
    indexInCorridor: 1,
  });
  assert.ok(Math.abs(horizontal.y) >= EDGE_LABEL_MIN_CLEARANCE_PX * 2);
  assert.ok(edgeSmoothStepPathOffset(0) >= 24);
  assert.ok(edgeSmoothStepPathOffset(1) > edgeSmoothStepPathOffset(0));
});

test("flow adapter applies corridor label transforms and smoothstep path offsets without changing topology", () => {
  const data = neighborhood();
  const { flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, null, null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    canvasArrangement: "GROUP_BY_HOP",
  });
  const labeled = flowEdges.filter((edge) => edge.label);
  assert.ok(labeled.length >= 3);
  const transforms = labeled.map((edge) => edge.labelStyle.transform ?? "none");
  assert.ok(transforms.some((value) => value !== "none"), "at least one labeled edge should receive a clearance transform");
  assert.ok(new Set(transforms).size >= 2, "focus-direct labels must not all share one identical transform");
  const pathOffsets = flowEdges.filter((edge) => edge.type === "smoothstep").map((edge) => edge.pathOptions?.offset ?? 0);
  assert.ok(pathOffsets.every((offset) => offset >= 24));
  assert.ok(new Set(pathOffsets).size >= 2, "smoothstep stub lengths should vary slightly in a congested fan");
  assert.deepEqual(
    flowEdges.map((edge) => edge.id).sort(),
    data.edges.map((edge) => edge.id).sort(),
  );
});
