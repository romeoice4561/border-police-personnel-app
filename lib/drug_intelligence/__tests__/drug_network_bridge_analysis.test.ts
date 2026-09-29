/**
 * DI-8.7 V2 — Bridge & Network Structure Intelligence: PATH_BRIDGE pure
 * analysis tests. Same neighborhood-fixture pattern as
 * drug_network_graph_insights.test.ts / drug_network_path_explanation.test.ts.
 *
 * MULTI_CASE_BRIDGE (TYPE A) and CROSS_BRANCH_CONNECTOR (TYPE B) have no
 * dedicated tests here — see the architecture-audit note at the top of
 * drug_network_bridge_analysis.ts for why: TYPE A is already covered by
 * the existing CROSS_CASE_ENTITY tests in drug_network_graph_insights.test.ts,
 * and TYPE B was not implemented (reported as a STOP per Section 3).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import {
  computePathBridgeObservations,
  PATH_BRIDGE_MAX_INTERMEDIATE_HOPS,
  PATH_BRIDGE_MAX_CASE_NODES,
} from "@/lib/drug_intelligence/drug_network_bridge_analysis";

function node(
  id: string,
  type: DrugGraphNeighborhoodResponse["nodes"][number]["type"],
  label: string,
  metadata?: Partial<DrugGraphNeighborhoodResponse["nodes"][number]["metadata"]>,
): DrugGraphNeighborhoodResponse["nodes"][number] {
  const base = { type } as DrugGraphNeighborhoodResponse["nodes"][number]["metadata"];
  return {
    id,
    type,
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { ...base, ...metadata } as DrugGraphNeighborhoodResponse["nodes"][number]["metadata"],
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function caseNode(id: string, caseNumber: string): DrugGraphNeighborhoodResponse["nodes"][number] {
  return node(id, "CASE", caseNumber, { caseNumber, status: "OPEN", arrestDate: null, arrestTime: null, province: null, reportingUnitText: null });
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

/** CASE A -> PHONE -> CASE B: the phone is a real path-bridge intermediate. */
function twoCasePhoneBridge(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      caseNode("c1", "DI-TEST-001"),
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c2", "DI-TEST-002"),
      node("d1", "DEVICE", "Samsung Galaxy A54"),
    ],
    edges: [
      edge("e1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("e2", "c1", "ph1", "CASE_PHONE", ["c1"]),
      edge("e3", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e4", "c2", "d1", "CASE_DEVICE", ["c2"]),
    ],
    truncated: false,
  };
}

// F. CASE A -> PHONE -> CASE B => PHONE qualifies as intermediate path bridge.
test("F. an entity directly between two cases (CASE A -> PHONE -> CASE B) is reported as a PATH_BRIDGE with pathCount=1", () => {
  const observations = computePathBridgeObservations(twoCasePhoneBridge());
  const phoneObs = observations.find((o) => o.entityId === "ph1");
  assert.ok(phoneObs, "the phone must be reported as a path bridge");
  assert.equal(phoneObs!.pathCount, 1);
  assert.deepEqual(phoneObs!.supportingPairs[0]!.pathNodeIds, ["ph1"]);
});

// H. endpoint CASE nodes never reported as PATH_BRIDGE.
test("H. CASE nodes themselves are never reported as PATH_BRIDGE entities, even though they sit at path endpoints", () => {
  const observations = computePathBridgeObservations(twoCasePhoneBridge());
  assert.ok(!observations.some((o) => o.entityId === "c1"));
  assert.ok(!observations.some((o) => o.entityId === "c2"));
});

// A non-intermediate entity (p1, d1 dead-end off a case) never qualifies.
test("a dead-end entity attached to only one case (not between two cases) is never reported as PATH_BRIDGE", () => {
  const observations = computePathBridgeObservations(twoCasePhoneBridge());
  assert.ok(!observations.some((o) => o.entityId === "p1"));
  assert.ok(!observations.some((o) => o.entityId === "d1"));
});

// Directly-connected cases (no intermediate) never produce a spurious observation.
test("two CASE nodes directly connected by an edge (no intermediate entity) never produce a path-bridge observation for either case", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "CASE", entityId: "c1" },
    nodes: [caseNode("c1", "DI-TEST-001"), caseNode("c2", "DI-TEST-002")],
    edges: [edge("e1", "c1", "c2", "CASE_LOCATION", [])],
    truncated: false,
  };
  const observations = computePathBridgeObservations(neighborhood);
  assert.deepEqual(observations, []);
});

// G. multiple case pairs through the same entity => correct pathCount.
test("G. an entity sitting between THREE cases (star shape) is counted once per distinct case pair", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c1", "DI-TEST-001"),
      caseNode("c2", "DI-TEST-002"),
      caseNode("c3", "DI-TEST-003"),
    ],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e3", "ph1", "c3", "CASE_PHONE", ["c3"]),
    ],
    truncated: false,
  };
  const observations = computePathBridgeObservations(neighborhood);
  const phoneObs = observations.find((o) => o.entityId === "ph1")!;
  // 3 cases -> C(3,2) = 3 distinct pairs, all routed through ph1.
  assert.equal(phoneObs.pathCount, 3);
  const pairKeys = phoneObs.supportingPairs.map((p) => [p.caseAId, p.caseBId].sort().join("|")).sort();
  assert.deepEqual(pairKeys, ["c1|c2", "c1|c3", "c2|c3"]);
});

// C-equivalent: duplicate edges to the same case pair via the same entity are naturally deduplicated by BFS shortest-path (only one path per pair).
test("a case pair reachable via multiple parallel edges through the same entity is still counted exactly once (BFS finds one shortest path)", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [node("ph1", "PHONE", "090-000-1001"), caseNode("c1", "DI-TEST-001"), caseNode("c2", "DI-TEST-002")],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e1b", "ph1", "c1", "CASE_PHONE", ["c1"]), // duplicate edge, same endpoints
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
    ],
    truncated: false,
  };
  const observations = computePathBridgeObservations(neighborhood);
  const phoneObs = observations.find((o) => o.entityId === "ph1")!;
  assert.equal(phoneObs.pathCount, 1);
});

// I. bounded path depth respected.
test("I. a case pair whose only connecting path exceeds PATH_BRIDGE_MAX_INTERMEDIATE_HOPS is excluded", () => {
  // c1 -> e1 -> e2 -> e3 -> e4 -> e5 -> c2 : 5 intermediate entities, over the 4-hop cap.
  const nodes: DrugGraphNeighborhoodResponse["nodes"] = [caseNode("c1", "DI-TEST-001"), caseNode("c2", "DI-TEST-002")];
  const edges: DrugGraphNeighborhoodResponse["edges"] = [];
  let prev = "c1";
  for (let i = 1; i <= PATH_BRIDGE_MAX_INTERMEDIATE_HOPS + 1; i++) {
    const id = `mid${i}`;
    nodes.push(node(id, "PERSON", `mid ${i}`));
    edges.push(edge(`e${i}`, prev, id, "PERSON_CASE", []));
    prev = id;
  }
  edges.push(edge("eLast", prev, "c2", "PERSON_CASE", []));
  const neighborhood: DrugGraphNeighborhoodResponse = { focus: { entityType: "CASE", entityId: "c1" }, nodes, edges, truncated: false };
  const observations = computePathBridgeObservations(neighborhood);
  assert.deepEqual(observations, [], "a path longer than the max intermediate-hop cap must not produce any observation");
});
test("I2. a case pair at exactly PATH_BRIDGE_MAX_INTERMEDIATE_HOPS intermediates is still included (boundary is inclusive)", () => {
  const nodes: DrugGraphNeighborhoodResponse["nodes"] = [caseNode("c1", "DI-TEST-001"), caseNode("c2", "DI-TEST-002")];
  const edges: DrugGraphNeighborhoodResponse["edges"] = [];
  let prev = "c1";
  for (let i = 1; i <= PATH_BRIDGE_MAX_INTERMEDIATE_HOPS; i++) {
    const id = `mid${i}`;
    nodes.push(node(id, "PERSON", `mid ${i}`));
    edges.push(edge(`e${i}`, prev, id, "PERSON_CASE", []));
    prev = id;
  }
  edges.push(edge("eLast", prev, "c2", "PERSON_CASE", []));
  const neighborhood: DrugGraphNeighborhoodResponse = { focus: { entityType: "CASE", entityId: "c1" }, nodes, edges, truncated: false };
  const observations = computePathBridgeObservations(neighborhood);
  assert.equal(observations.length, PATH_BRIDGE_MAX_INTERMEDIATE_HOPS, "every intermediate on the boundary-length path must be reported");
});

// J. deterministic result ordering.
test("J. computePathBridgeObservations produces the same result on repeated calls with the same input (deterministic)", () => {
  const neighborhood = twoCasePhoneBridge();
  const a = computePathBridgeObservations(neighborhood);
  const b = computePathBridgeObservations(neighborhood);
  assert.deepEqual(a, b);
});
test("J2. case-pair enumeration order is independent of the neighborhood.nodes array order (CASE ids sorted before pairing)", () => {
  const base = twoCasePhoneBridge();
  const reordered: DrugGraphNeighborhoodResponse = { ...base, nodes: [...base.nodes].reverse() };
  const a = computePathBridgeObservations(base);
  const b = computePathBridgeObservations(reordered);
  assert.deepEqual(a, b);
});

// K. no mutation of input graph.
test("K. computePathBridgeObservations never mutates the input neighborhood", () => {
  const neighborhood = twoCasePhoneBridge();
  const nodesCopy = JSON.parse(JSON.stringify(neighborhood.nodes));
  const edgesCopy = JSON.parse(JSON.stringify(neighborhood.edges));
  computePathBridgeObservations(neighborhood);
  assert.deepEqual(neighborhood.nodes, nodesCopy);
  assert.deepEqual(neighborhood.edges, edgesCopy);
});

// L/M: computePathBridgeObservations reads but never returns modified counts of the ORIGINAL graph — the function is purely additive/derived, never touching topology.
test("L/M. the function never changes node/edge counts of the neighborhood it derives its facts from (structural read-only contract)", () => {
  const neighborhood = twoCasePhoneBridge();
  const nodeCountBefore = neighborhood.nodes.length;
  const edgeCountBefore = neighborhood.edges.length;
  computePathBridgeObservations(neighborhood);
  assert.equal(neighborhood.nodes.length, nodeCountBefore);
  assert.equal(neighborhood.edges.length, edgeCountBefore);
});

// P. sparse graph empty state.
test("P. a neighborhood with fewer than 2 CASE nodes produces no observations", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "DEVICE", entityId: "d1" },
    nodes: [node("d1", "DEVICE", "Samsung Galaxy A54"), caseNode("c1", "DI-TEST-001")],
    edges: [edge("e1", "d1", "c1", "CASE_DEVICE", ["c1"])],
    truncated: false,
  };
  assert.deepEqual(computePathBridgeObservations(neighborhood), []);
});
test("P2. an empty neighborhood produces no observations and never throws", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = { focus: { entityType: "PERSON", entityId: "p1" }, nodes: [], edges: [], truncated: false };
  assert.deepEqual(computePathBridgeObservations(neighborhood), []);
});

// Bound constant sanity (Section 12/19 — report actual bounds).
test("PATH_BRIDGE_MAX_CASE_NODES caps the number of CASE nodes considered for pairwise analysis", () => {
  assert.ok(PATH_BRIDGE_MAX_CASE_NODES > 0);
  assert.ok(Number.isInteger(PATH_BRIDGE_MAX_CASE_NODES));
});
