/**
 * DI-8.4 — Explainable Network Path model tests.
 * Presentation/path enumeration only — uses loaded neighborhood edges.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { buildDrugNetworkFlowGraph } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import {
  enumerateUndirectedPaths,
  explainFocusToSelectedPaths,
  formatNetworkPathSummary,
  isSharedEntityPath,
  pathStepRelationLabelKey,
  supportingCaseIdsFromPath,
  viaHintFromPath,
  viaHintsForNeighborhood,
} from "@/lib/drug_intelligence/drug_network_path_explanation";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dictionarySource = readFileSync(path.join(dir, "..", "..", "i18n", "dictionary.ts"), "utf8");
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const adapterSource = readFileSync(
  path.join(dir, "..", "drug_network_graph_flow_adapter.ts"),
  "utf8",
);

function node(
  id: string,
  type: DrugGraphNeighborhoodResponse["nodes"][number]["type"],
  label: string,
): DrugGraphNeighborhoodResponse["nodes"][number] {
  return {
    id,
    type,
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type } as DrugGraphNeighborhoodResponse["nodes"][number]["metadata"],
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: type === "CASE" ? 1 : 1,
    riskIndicators: [],
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  relationshipType: DrugGraphNeighborhoodResponse["edges"][number]["relationshipType"],
  sourceCaseIds: string[] = [],
): DrugGraphNeighborhoodResponse["edges"][number] {
  return {
    id,
    source,
    target,
    relationshipType,
    edgeKind: relationshipType.startsWith("SHARED_") ? "INFERRED" : "DIRECT",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds,
    explanation: { kind: "DIRECT_LINK" },
  };
}

/** Focus person → case → phone (Depth-2 canonical example). */
function depth2Neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("c1", "CASE", "DI-TEST-001"),
      node("ph2", "PHONE", "090-000-1002"),
      node("ph1", "PHONE", "090-000-1001"),
    ],
    edges: [
      edge("pc1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("cp2", "c1", "ph2", "CASE_PHONE", ["c1"]),
      edge("pp1", "p1", "ph1", "PERSON_PHONE", ["c1"]),
    ],
    truncated: false,
  };
}

/** Direct person → phone. */
function directNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [node("p1", "PERSON", "นาย ก"), node("ph1", "PHONE", "081-111-1111")],
    edges: [edge("pp1", "p1", "ph1", "PERSON_PHONE", ["c9"])],
    truncated: false,
  };
}

/** Depth-3: person → case → phone → personB. */
function depth3Neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นาย ก"),
      node("c1", "CASE", "CASE-A"),
      node("ph1", "PHONE", "082-000-0001"),
      node("p2", "PERSON", "นาย ข"),
    ],
    edges: [
      edge("pc1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("cp1", "c1", "ph1", "CASE_PHONE", ["c1"]),
      edge("php2", "ph1", "p2", "PERSON_PHONE", ["c1"]),
    ],
    truncated: false,
  };
}

/** Two equal-length paths to p2: via case and via phone. */
function multiPathNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นาย ก"),
      node("c1", "CASE", "คดี A"),
      node("ph1", "PHONE", "เบอร์ X"),
      node("p2", "PERSON", "นาย ข"),
    ],
    edges: [
      edge("pc1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("cp2", "c1", "p2", "PERSON_CASE", ["c1"]),
      edge("pp1", "p1", "ph1", "PERSON_PHONE", ["c1"]),
      edge("php2", "ph1", "p2", "PERSON_PHONE", ["c1"]),
    ],
    truncated: false,
  };
}

/** Shared-entity bridge: person → phone → person. */
function sharedPhoneNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นาย ก"),
      node("ph1", "PHONE", "090-111-2222"),
      node("p2", "PERSON", "นาย ข"),
    ],
    edges: [
      edge("pp1", "p1", "ph1", "PERSON_PHONE", ["c1"]),
      edge("pp2", "p2", "ph1", "PERSON_PHONE", ["c1"]),
    ],
    truncated: false,
  };
}

const th = (key: string) => {
  const match = dictionarySource.match(new RegExp(`"${key.replace(/\./g, "\\.")}":\\s*tr\\(\\s*"([^"]+)"`));
  return match?.[1] ?? key;
};

test("DI-8.4 direct node path is hopCount 1 with DIRECT summary", () => {
  const explanation = explainFocusToSelectedPaths(directNeighborhood(), "ph1");
  assert.ok(explanation);
  assert.equal(explanation!.isDirect, true);
  assert.equal(explanation!.hopCount, 1);
  assert.equal(explanation!.paths[0]!.nodeIds.join(">"), "p1>ph1");
  assert.match(formatNetworkPathSummary(explanation!, th), /โดยตรง/);
  assert.equal(explanation!.viaHint, null);
});

test("DI-8.4 Depth-2 path person→case→phone with Thai relation labels", () => {
  const explanation = explainFocusToSelectedPaths(depth2Neighborhood(), "ph2");
  assert.ok(explanation);
  assert.equal(explanation!.hopCount, 2);
  assert.equal(explanation!.isDirect, false);
  assert.deepEqual(explanation!.paths[0]!.nodeIds, ["p1", "c1", "ph2"]);
  assert.deepEqual(explanation!.paths[0]!.edgeIds, ["pc1", "cp2"]);
  const steps = explanation!.paths[0]!.steps;
  assert.equal(steps[1]!.viaLabelKey, "di.network.relOpPersonCase");
  assert.equal(steps[2]!.viaLabelKey, "di.network.pathRelCasePhone");
  assert.equal(viaHintFromPath(explanation!.paths[0]), "DI-TEST-001");
  assert.match(formatNetworkPathSummary(explanation!, th), /DI-TEST-001/);
  assert.match(formatNetworkPathSummary(explanation!, th), /2 ขั้น/);
});

test("DI-8.4 Depth-3 path enumerates three hops", () => {
  const explanation = explainFocusToSelectedPaths(depth3Neighborhood(), "p2");
  assert.ok(explanation);
  assert.equal(explanation!.hopCount, 3);
  assert.deepEqual(explanation!.paths[0]!.nodeIds, ["p1", "c1", "ph1", "p2"]);
  assert.equal(viaHintFromPath(explanation!.paths[0]), "082-000-0001");
});

test("DI-8.4 canonical shortest path preferred; multiple equal paths ordered deterministically", () => {
  const explanation = explainFocusToSelectedPaths(multiPathNeighborhood(), "p2");
  assert.ok(explanation);
  assert.equal(explanation!.paths.length, 2);
  assert.equal(explanation!.alternativeCount, 1);
  assert.equal(explanation!.hopCount, 2);
  // PERSON_CASE path sorts before PERSON_PHONE by relationship sequence.
  assert.deepEqual(explanation!.paths[0]!.nodeIds, ["p1", "c1", "p2"]);
  assert.deepEqual(explanation!.paths[1]!.nodeIds, ["p1", "ph1", "p2"]);
  const again = explainFocusToSelectedPaths(multiPathNeighborhood(), "p2");
  assert.deepEqual(
    again!.paths.map((p) => p.signature),
    explanation!.paths.map((p) => p.signature),
  );
});

test("DI-8.4 shared-entity explanation uses shared summary key", () => {
  const explanation = explainFocusToSelectedPaths(sharedPhoneNeighborhood(), "p2");
  assert.ok(explanation);
  assert.ok(isSharedEntityPath(explanation!.paths[0]!));
  assert.match(formatNetworkPathSummary(explanation!, th), /เดียวกัน/);
});

test("DI-8.4 human-readable Thai relation labels — no raw enums", () => {
  assert.equal(pathStepRelationLabelKey("PERSON", "CASE", "PERSON_CASE"), "di.network.relOpPersonCase");
  assert.equal(pathStepRelationLabelKey("CASE", "PHONE", "CASE_PHONE"), "di.network.pathRelCasePhone");
  assert.equal(pathStepRelationLabelKey("PERSON", "PHONE", "PERSON_PHONE"), "di.network.relOpPersonPhone");
  assert.equal(pathStepRelationLabelKey("CASE", "PERSON", "PERSON_CASE"), "di.network.pathRelCasePerson");
  assert.equal(th("di.network.relOpPersonCase"), "เกี่ยวข้องในคดี");
  assert.equal(th("di.network.pathRelCasePhone"), "พบเบอร์ในคดี");
  assert.equal(th("di.network.relOpPersonPhone"), "ใช้เบอร์");
  assert.doesNotMatch(th("di.network.relOpPersonCase"), /PERSON_CASE/);
});

test("DI-8.4 geographic proximity is never a path relation type", () => {
  assert.doesNotMatch(dictionarySource, /PROXIMITY|GEO_NEAR|ใกล้เคียง.*โดยตรง/);
  const enumerated = enumerateUndirectedPaths({
    fromId: "p1",
    toId: "ph2",
    edges: depth2Neighborhood().edges,
  });
  assert.ok(enumerated.paths.every((p) => p.edgeIds.every((id) => !id.includes("geo"))));
});

test("DI-8.4 emphasizeSelectedPath highlights path node/edge ids and dims non-path", () => {
  const data = depth2Neighborhood();
  const explanation = explainFocusToSelectedPaths(data, "ph2")!;
  const path = explanation.paths[0]!;
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(data, (k) => k, "ph2", null, {
    layoutMode: "PERSON_CENTERED",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    emphasizeSelectedPath: true,
    emphasizedPath: { nodeIds: path.nodeIds, edgeIds: path.edgeIds },
    pathViaHints: new Map([["ph2", "DI-TEST-001"]]),
    pathViaMoreCount: 0,
  });
  for (const id of path.nodeIds) {
    const n = flowNodes.find((item) => item.id === id)!;
    assert.equal(n.data.dimmed, false);
    assert.equal(n.data.onSelectedPath, true);
  }
  const off = flowNodes.find((item) => item.id === "ph1")!;
  assert.equal(off.data.dimmed, true);
  assert.equal(off.data.stronglyDimmed, true);
  assert.ok(off.data.dimmed);
  for (const edgeId of path.edgeIds) {
    const e = flowEdges.find((item) => item.id === edgeId)!;
    assert.equal(e.style.opacity, 1);
    assert.ok((e.style.strokeWidth as number) >= 2);
  }
  const offEdge = flowEdges.find((item) => item.id === "pp1")!;
  assert.ok((offEdge.style.opacity as number) < 0.5);
  assert.equal(flowNodes.find((n) => n.id === "ph2")!.data.pathViaHint, "DI-TEST-001");
});

test("DI-8.4 clear selection restores undimmed graph contract", () => {
  const data = depth2Neighborhood();
  const selected = buildDrugNetworkFlowGraph(data, (k) => k, "ph2", null, {
    layoutMode: "PERSON_CENTERED",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    emphasizeSelectedPath: true,
  });
  assert.ok(selected.flowNodes.some((n) => n.data.dimmed));
  const cleared = buildDrugNetworkFlowGraph(data, (k) => k, null, null, {
    layoutMode: "PERSON_CENTERED",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    emphasizeSelectedPath: true,
  });
  assert.ok(cleared.flowNodes.every((n) => n.data.dimmed === false));
  assert.ok(cleared.flowNodes.every((n) => n.data.stronglyDimmed === false));
});

test("DI-8.4 missing relationship yields safe empty explanation", () => {
  const data = depth2Neighborhood();
  data.edges = data.edges.filter((e) => e.id === "pp1");
  assert.equal(explainFocusToSelectedPaths(data, "ph2"), null);
  assert.equal(explainFocusToSelectedPaths(data, "p1"), null);
});

test("DI-8.4 supporting cases collected from path steps", () => {
  const explanation = explainFocusToSelectedPaths(depth2Neighborhood(), "ph2")!;
  assert.deepEqual(supportingCaseIdsFromPath(explanation.paths[0]), ["c1"]);
});

test("DI-8.4 via hints for neighborhood Depth-2 cards", () => {
  const hints = viaHintsForNeighborhood(depth2Neighborhood());
  assert.equal(hints.get("ph2"), "DI-TEST-001");
  assert.equal(hints.has("ph1"), false);
});

test("DI-8.4 depth wording keys use commander language", () => {
  assert.match(dictionarySource, /ชั้น 1 · เชื่อมโดยตรง/);
  assert.match(dictionarySource, /ชั้น 2 · เชื่อมผ่านข้อมูล 1 ขั้น/);
  assert.match(dictionarySource, /ชั้น 3 · เชื่อมผ่านข้อมูล 2 ขั้น/);
  assert.match(dictionarySource, /เหตุที่รายการนี้ปรากฏในเครือข่าย/);
  assert.match(dictionarySource, /สรุปความเชื่อมโยง/);
});

test("DI-8.4 page wires emphasizeSelectedPath and pathExplanation without layout reset on path index alone", () => {
  assert.match(pageSource, /emphasizeSelectedPath:\s*Boolean\(selectedSecondaryId\)/);
  assert.match(pageSource, /explainFocusToSelectedPaths/);
  assert.match(pageSource, /pathExplanation=\{pathExplanation\}/);
  assert.match(pageSource, /selectedPathIndex/);
  assert.match(adapterSource, /emphasizeSelectedPath/);
  // Selection must not force VERTICAL_PATH — only visual emphasize.
  assert.doesNotMatch(pageSource, /emphasizeSelectedPath[\s\S]{0,80}VERTICAL_PATH/);
});

test("DI-8.4 follow-up: path switch triggers path-camera fit keyed by signature", () => {
  assert.match(pageSource, /shouldFitPathCamera/);
  assert.match(pageSource, /computeSelectedPathFocusViewport/);
  assert.match(pageSource, /handleSelectPathIndex/);
  assert.match(pageSource, /pathCameraMode/);
  assert.match(pageSource, /collectPathFitNodes/);
});

test("DI-8.4 merge-aware PERSON still uses focus entityId as path origin", () => {
  const data = depth2Neighborhood();
  data.focus = { entityType: "PERSON", entityId: "p1" };
  const explanation = explainFocusToSelectedPaths(data, "ph2");
  assert.equal(explanation!.focusId, "p1");
  assert.equal(explanation!.paths[0]!.steps[0]!.entityType, "PERSON");
});
