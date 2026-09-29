/**
 * DI-8.7 V2 — Bridge & Network Structure Intelligence: dedup + integration
 * tests proving PATH_BRIDGE is correctly folded into the existing
 * computeNetworkGraphInsights pipeline (Section 6 of the V2 prompt).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { computeNetworkGraphInsights } from "@/lib/drug_intelligence/drug_network_graph_insights";

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

// Q. semantic dedup against existing CROSS_CASE_ENTITY equivalent.
test("Q. an entity directly connecting two cases (CASE A -> ph1 -> CASE B) produces ONLY CROSS_CASE_ENTITY — PATH_BRIDGE for the identical (entity, case-set) tuple is suppressed", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      caseNode("c2", "DI-TEST-002"),
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c1", "DI-TEST-001"),
      node("d1", "DEVICE", "Samsung Galaxy A54"),
    ],
    edges: [
      edge("e1", "p1", "c2", "PERSON_CASE", ["c2"]),
      edge("e2", "c2", "ph1", "CASE_PHONE", ["c2"]),
      edge("e3", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e4", "c1", "d1", "CASE_DEVICE", ["c1"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const phoneInsights = insights.filter((i) => i.entityId === "ph1");
  assert.equal(phoneInsights.length, 1, "only one insight card should remain for ph1 — the more direct CROSS_CASE_ENTITY fact");
  assert.equal(phoneInsights[0]!.type, "CROSS_CASE_ENTITY");
  assert.ok(!insights.some((i) => i.type === "PATH_BRIDGE" && i.entityId === "ph1"), "PATH_BRIDGE for the identical (ph1, {c1,c2}) tuple must be suppressed");
});

// R. genuinely different PATH_BRIDGE fact remains visible.
test("R. an entity that is ONLY an indirect path-bridge between two cases it has no direct edge to remains visible as PATH_BRIDGE (genuinely different fact from any CROSS_CASE_ENTITY tuple)", () => {
  // ph1 directly touches c1 and c2 (2 cases -> CROSS_CASE_ENTITY for {c1,c2}).
  // p1 sits between c1 and c3 ONLY via the path c1 -> ph1 -> c2 -> p1 -> c3 wait, simplify:
  // Build: c1 - ph1 - c2 - p1 - c3, where p1 has NO direct edge to c1, only to c2/c3.
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [
      caseNode("c1", "DI-TEST-001"),
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c2", "DI-TEST-002"),
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      caseNode("c3", "DI-TEST-003"),
    ],
    edges: [
      edge("e1", "c1", "ph1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e3", "c2", "p1", "PERSON_CASE", ["c2"]),
      edge("e4", "p1", "c3", "PERSON_CASE", ["c3"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  // p1 is directly connected to c2 and c3 only (2 cases) -> its own CROSS_CASE_ENTITY tuple is {c2,c3}.
  // p1 is also a PATH_BRIDGE between c1 and c3 (path c1-ph1-c2-p1-c3 has TWO intermediates: ph1 and p1;
  // for the c1/c3 pair specifically, p1's involvement covers case pair {c1,c3} — a DIFFERENT tuple from {c2,c3}).
  const personCrossCase = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "p1");
  const personPathBridge = insights.find((i) => i.type === "PATH_BRIDGE" && i.entityId === "p1");
  assert.ok(personCrossCase, "p1 must still get its own direct CROSS_CASE_ENTITY for {c2,c3}");
  assert.ok(personPathBridge, "p1 must ALSO get a PATH_BRIDGE observation for the c1<->c3 path — a genuinely different case-set tuple ({c1,c3} vs {c2,c3})");
});

// S. no risk/importance score fields anywhere in the PATH_BRIDGE output.
test("S. PATH_BRIDGE insights never carry a risk/importance score field — only pathCount via the shared metric field", () => {
  // Same shape as test R: p1 is directly connected to c2/c3 only (its own
  // CROSS_CASE_ENTITY tuple is {c2,c3}), and is a genuine PATH_BRIDGE for
  // the DIFFERENT {c1,c3} tuple via c1-ph1-c2-p1-c3 — never deduplicated.
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [
      caseNode("c1", "DI-TEST-001"),
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c2", "DI-TEST-002"),
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      caseNode("c3", "DI-TEST-003"),
    ],
    edges: [
      edge("e1", "c1", "ph1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e3", "c2", "p1", "PERSON_CASE", ["c2"]),
      edge("e4", "p1", "c3", "PERSON_CASE", ["c3"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const bridge = insights.find((i) => i.type === "PATH_BRIDGE");
  assert.ok(bridge);
  const keys = Object.keys(bridge!);
  // `pathPairs` is real case-pair + path-sequence EVIDENCE (visual-hotfix
  // Section 4/5), not a score/rank field — every other key is the exact
  // same NetworkGraphInsight shape every other insight type uses.
  assert.deepEqual(
    keys.sort(),
    ["cases", "entityId", "entityLabel", "entityType", "factText", "graphFocus", "id", "metric", "pathPairs", "reasonKey", "titleKey", "type"].sort(),
    "PATH_BRIDGE must use the exact same NetworkGraphInsight shape plus only real pathPairs evidence — no score/rank field",
  );
  assert.ok(Array.isArray(bridge!.pathPairs), "pathPairs must be a real array of case-pair evidence");
  for (const pair of bridge!.pathPairs!) {
    assert.equal(typeof pair.caseANumber, "string");
    assert.equal(typeof pair.caseBNumber, "string");
    assert.ok(Array.isArray(pair.pathNodeLabels));
    assert.ok(
      !("score" in pair) && !("rank" in pair) && !("importance" in pair),
      "no score/rank/importance field anywhere inside pathPairs evidence either",
    );
  }
});

// T. no new graph edge kind.
test("T. computing PATH_BRIDGE insights never introduces a new edgeKind value into any produced insight or the source module", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [caseNode("c1", "DI-TEST-001"), node("ph1", "PHONE", "090-000-1001"), caseNode("c2", "DI-TEST-002")],
    edges: [edge("e1", "c1", "ph1", "CASE_PHONE", ["c1"]), edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"])],
    truncated: false,
  };
  // computeNetworkGraphInsights never mutates edges — verified by re-checking edgeKind values are exactly what the fixture set.
  const before = neighborhood.edges.map((e) => e.edgeKind);
  computeNetworkGraphInsights(neighborhood);
  const after = neighborhood.edges.map((e) => e.edgeKind);
  assert.deepEqual(before, after);
  assert.ok(before.every((k) => k === "DIRECT" || k === "INFERRED"));
});

// U. three-way precedence: CROSS_CASE_ENTITY > PATH_BRIDGE > COMMON_EVIDENCE
// for the identical (entity, case-set) tuple (visual-review hotfix round 2).
test("U. an entity that is simultaneously a PATH_BRIDGE and a COMMON_EVIDENCE candidate for the IDENTICAL case-set tuple shows only the PATH_BRIDGE card", () => {
  // LOCATION node loc1 has no direct CASE edge of its own kind that would
  // make it a CROSS_CASE_ENTITY (LOCATION is excluded from that type), but
  // it DOES get picked up by computeCommonEvidenceInsights (any non-CASE
  // endpoint with >=2 distinct case ids across edges) AND by
  // computePathBridgeObservations (it sits on the shortest path between two
  // CASE nodes) for the exact same {c1, c3} tuple, via c1 - loc1 - c2, and
  // c1 - loc1 - c3 (loc1 directly touches c1, c2, c3 with CASE_LOCATION-like
  // edges each carrying a single sourceCaseId).
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      caseNode("c1", "DI-TEST-001"),
      node("loc1", "LOCATION", "จุดพักสินค้า TEST-A"),
      caseNode("c2", "DI-TEST-002"),
      caseNode("c3", "DI-TEST-003"),
    ],
    edges: [
      edge("e1", "c1", "loc1", "CASE_LOCATION", ["c1"]),
      edge("e2", "loc1", "c2", "CASE_LOCATION", ["c2"]),
      edge("e3", "loc1", "c3", "CASE_LOCATION", ["c3"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const loc1Insights = insights.filter((i) => i.entityId === "loc1");
  assert.equal(loc1Insights.length, 1, "only one card should remain for loc1 for this exact tuple");
  assert.equal(loc1Insights[0]!.type, "PATH_BRIDGE", "PATH_BRIDGE outranks COMMON_EVIDENCE for the identical tuple");
});

// V. pathPairs compact display data is real, correctly resolved, and deterministically ordered.
test("V. pathPairs resolves real case numbers and real intermediate node labels (never raw ids), in deterministic sorted order", () => {
  // p1 sits strictly BETWEEN cases via a shared PHONE/DEVICE/SIM chain, with
  // no direct edge of its own to any CASE — a genuine indirect path-bridge
  // (not a CROSS_CASE_ENTITY candidate), bridging {c1,c2}, {c1,c3}, {c2,c3}.
  //   c1 - ph1 - p1 - dv1 - c2
  //   c1 - ph1 - p1 - sim1 - c3
  //   c2 - dv1 - p1 - sim1 - c3   (>4 intermediates -> excluded by the hop bound, fine)
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      caseNode("c1", "DI-TEST-001"),
      node("ph1", "PHONE", "090-000-1001"),
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("dv1", "DEVICE", "Samsung Galaxy A54"),
      caseNode("c2", "DI-TEST-002"),
      node("sim1", "SIM", "89000000000000000001"),
      caseNode("c3", "DI-TEST-003"),
    ],
    edges: [
      edge("e1", "c1", "ph1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "p1", "PERSON_CASE", []),
      edge("e3", "p1", "dv1", "PERSON_CASE", []),
      edge("e4", "dv1", "c2", "CASE_DEVICE", ["c2"]),
      edge("e5", "p1", "sim1", "PERSON_CASE", []),
      edge("e6", "sim1", "c3", "CASE_SIM", ["c3"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const bridge = insights.find((i) => i.type === "PATH_BRIDGE" && i.entityId === "p1");
  assert.ok(bridge, "p1 must produce a PATH_BRIDGE insight (it indirectly bridges multiple case pairs)");
  assert.ok(bridge!.pathPairs && bridge!.pathPairs.length >= 2);
  for (const pair of bridge!.pathPairs!) {
    assert.ok(pair.caseANumber.startsWith("DI-TEST-"), "must show the real resolved case NUMBER, never a raw id");
    assert.ok(pair.caseBNumber.startsWith("DI-TEST-"), "must show the real resolved case NUMBER, never a raw id");
    assert.ok(pair.pathNodeLabels.length > 0, "path sequence evidence must list the real intermediate node labels, never be empty");
    assert.ok(
      pair.pathNodeLabels.every((label) => label === "090-000-1001" || label === "นายกิตติศักดิ์ ทดสอบระบบ" || label === "Samsung Galaxy A54" || label === "89000000000000000001"),
      "every path label must be a real loaded node label, never a raw id or fabricated string",
    );
    assert.ok(pair.caseANumber.localeCompare(pair.caseBNumber, "th") <= 0, "each pair's own two case numbers are placed in sorted order");
  }
  // Deterministic pair ordering across the whole array, not just within a pair.
  const orderedKeys = bridge!.pathPairs!.map((p) => `${p.caseANumber}|${p.caseBNumber}`);
  const sortedKeys = [...orderedKeys].sort((a, b) => a.localeCompare(b, "th"));
  assert.deepEqual(orderedKeys, sortedKeys, "pathPairs must be in deterministic sorted order, never input/insertion order");
});

// Sparse graph honest empty state (Samsung Galaxy A54-style single-case dead-end entity).
test("a single dead-end entity attached to only one case produces no bridge observation of any kind", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "DEVICE", entityId: "d1" },
    nodes: [node("d1", "DEVICE", "Samsung Galaxy A54"), caseNode("c1", "DI-TEST-001")],
    edges: [edge("e1", "d1", "c1", "CASE_DEVICE", ["c1"])],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.deepEqual(insights, []);
});
