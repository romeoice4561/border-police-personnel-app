/**
 * DI-8.7 V2 — Final visual hotfix (round 3): Inspector Drawer presentation
 * duplication. When the Drawer already renders a dedicated focus→selected
 * path explanation for a node ("พบเส้นทางเชื่อมโยง N เส้นทาง" / "ทำไม ...
 * จึงปรากฏในเครือข่ายนี้?" / "ข้อสรุปของเส้นทาง"), that node's own
 * PATH_BRIDGE card must not repeat the identical fact under
 * "ข้อสังเกตจากข้อมูล". Tests the pure suppression function in isolation —
 * no component rendering/snapshot required, per the prompt's preference for
 * testing pure filtering logic.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import {
  computeNetworkGraphInsights,
  insightsForEntity,
  suppressPathBridgeDuplicateOfDrawerExplanation,
  type NetworkGraphInsight,
} from "@/lib/drug_intelligence/drug_network_graph_insights";

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

// A three-case "TEST-A"-style LOCATION bridging {c1,c5,c6} indirectly, plus a
// genuinely different PERSON with its own distinct CROSS_CASE_ENTITY tuple,
// used across several tests below.
function testANeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "focus1" },
    nodes: [
      node("focus1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      caseNode("c1", "DI-TEST-001"),
      node("loc1", "LOCATION", "จุดพักสินค้า TEST-A"),
      caseNode("c5", "DI-TEST-005"),
      caseNode("c6", "DI-TEST-006"),
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c2", "DI-TEST-002"),
    ],
    edges: [
      edge("e0", "focus1", "c1", "PERSON_CASE", ["c1"]),
      edge("e1", "c1", "loc1", "CASE_LOCATION", ["c1"]),
      edge("e2", "loc1", "c5", "CASE_LOCATION", ["c5"]),
      edge("e3", "loc1", "c6", "CASE_LOCATION", ["c6"]),
      // ph1 directly touches c1 and c2 -> its own, genuinely different, CROSS_CASE_ENTITY tuple.
      edge("e4", "c1", "ph1", "CASE_PHONE", ["c1"]),
      edge("e5", "ph1", "c2", "CASE_PHONE", ["c2"]),
    ],
    truncated: false,
  };
}

// A. Drawer with a dedicated PATH_BRIDGE explanation suppresses the equivalent PATH_BRIDGE insight below.
test("A. suppressPathBridgeDuplicateOfDrawerExplanation removes the PATH_BRIDGE card for the entity whose Drawer already shows the dedicated path explanation", () => {
  const neighborhood = testANeighborhood();
  const insights = computeNetworkGraphInsights(neighborhood);
  const locInsightsBefore = insightsForEntity(insights, "loc1").filter((i) => i.entityId === "loc1");
  assert.ok(
    locInsightsBefore.some((i) => i.type === "PATH_BRIDGE"),
    "sanity: TEST-A/loc1 must actually produce a PATH_BRIDGE insight for this test to be meaningful",
  );
  const nodeInsights = insightsForEntity(insights, "loc1");
  const suppressed = suppressPathBridgeDuplicateOfDrawerExplanation(nodeInsights, "loc1", true);
  assert.ok(
    !suppressed.some((i) => i.type === "PATH_BRIDGE" && i.entityId === "loc1"),
    "the PATH_BRIDGE card for loc1 must be removed once the Drawer's own dedicated path explanation is showing",
  );
});

// B. A genuinely different insight remains visible.
test("B. a genuinely different insight type for the same entity remains visible after suppression", () => {
  const neighborhood = testANeighborhood();
  const insights = computeNetworkGraphInsights(neighborhood);
  // ph1 has its own CROSS_CASE_ENTITY tuple {c1,c2} — a different type, different entity than loc1's PATH_BRIDGE.
  const phInsightsBefore = insightsForEntity(insights, "ph1");
  assert.ok(phInsightsBefore.some((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1"));
  // Suppression is scoped to loc1 only — ph1's card must be completely unaffected, even in the same insight list.
  const suppressed = suppressPathBridgeDuplicateOfDrawerExplanation(insights, "loc1", true);
  assert.ok(
    suppressed.some((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1"),
    "an unrelated entity's CROSS_CASE_ENTITY card must remain untouched",
  );
});

// C. Same entity but different factual tuple remains visible (a hypothetical second, non-PATH_BRIDGE insight for loc1 itself).
test("C. a DIFFERENT insight TYPE for the SAME entity (loc1) remains visible — suppression is scoped to type+entity, not the whole entity", () => {
  const fakeInsights: NetworkGraphInsight[] = [
    {
      id: "path-bridge:loc1",
      type: "PATH_BRIDGE",
      titleKey: "di.network.insightPathBridge",
      entityId: "loc1",
      entityType: "LOCATION",
      entityLabel: "จุดพักสินค้า TEST-A",
      factText: "ปรากฏเป็นทางผ่านของ 3 เส้นทาง",
      cases: [],
      reasonKey: "di.network.insightReasonPathBridge",
      graphFocus: { nodeIds: ["loc1"], edgeIds: [], primaryNodeId: "loc1" },
      metric: 3,
      pathPairs: [],
    },
    {
      // A hypothetical SHARED_CONNECTION mentioning loc1 in its label but a
      // different type entirely (SHARED_CONNECTION has entityId: null by
      // design elsewhere, but here we simulate a distinct type carrying the
      // same entity to prove the filter keys on TYPE, never just entityId).
      id: "common-evidence:loc1",
      type: "COMMON_EVIDENCE",
      titleKey: "di.network.insightCommonEvidence",
      entityId: "loc1",
      entityType: "LOCATION",
      entityLabel: "จุดพักสินค้า TEST-A",
      factText: "ปรากฏใน 3 คดี",
      cases: [],
      reasonKey: "di.network.insightReasonCommonEvidence",
      graphFocus: { nodeIds: ["loc1"], edgeIds: [], primaryNodeId: "loc1" },
      metric: 3,
    },
  ];
  const suppressed = suppressPathBridgeDuplicateOfDrawerExplanation(fakeInsights, "loc1", true);
  assert.equal(suppressed.length, 1);
  assert.equal(suppressed[0]!.type, "COMMON_EVIDENCE", "only the PATH_BRIDGE card for loc1 is removed; any other type for the same entity survives");
});

// D. Suppression does not rely on display text.
test("D. suppression keys ONLY on (type, entityId) — never Thai text/labels/factText, proven by two insights with IDENTICAL text but different types/entities", () => {
  const sameTextDifferentType: NetworkGraphInsight[] = [
    {
      id: "path-bridge:loc1",
      type: "PATH_BRIDGE",
      titleKey: "di.network.insightPathBridge",
      entityId: "loc1",
      entityType: "LOCATION",
      entityLabel: "จุดพักสินค้า TEST-A",
      factText: "ปรากฏเป็นทางผ่านของ 3 เส้นทาง",
      cases: [],
      reasonKey: "di.network.insightReasonPathBridge",
      graphFocus: { nodeIds: ["loc1"], edgeIds: [], primaryNodeId: "loc1" },
      metric: 3,
      pathPairs: [],
    },
    {
      // Deliberately IDENTICAL factText/entityLabel, but a DIFFERENT entityId — must NOT be suppressed.
      id: "path-bridge:loc2",
      type: "PATH_BRIDGE",
      titleKey: "di.network.insightPathBridge",
      entityId: "loc2",
      entityType: "LOCATION",
      entityLabel: "จุดพักสินค้า TEST-A",
      factText: "ปรากฏเป็นทางผ่านของ 3 เส้นทาง",
      cases: [],
      reasonKey: "di.network.insightReasonPathBridge",
      graphFocus: { nodeIds: ["loc2"], edgeIds: [], primaryNodeId: "loc2" },
      metric: 3,
      pathPairs: [],
    },
  ];
  const suppressed = suppressPathBridgeDuplicateOfDrawerExplanation(sameTextDifferentType, "loc1", true);
  assert.equal(suppressed.length, 1);
  assert.equal(suppressed[0]!.entityId, "loc2", "loc2's PATH_BRIDGE card must survive despite having byte-identical rendered text to loc1's, because suppression compares entityId, never text");
});

// Additional: hasDedicatedPathExplanation=false never suppresses anything (the Drawer isn't showing the dedicated explanation for this node — e.g. a direct 1-hop node, or the focus node itself).
test("hasDedicatedPathExplanation=false is a no-op — never suppresses any insight", () => {
  const neighborhood = testANeighborhood();
  const insights = computeNetworkGraphInsights(neighborhood);
  const nodeInsights = insightsForEntity(insights, "loc1");
  const result = suppressPathBridgeDuplicateOfDrawerExplanation(nodeInsights, "loc1", false);
  assert.deepEqual(result, nodeInsights);
});

// Additional: never mutates the input array.
test("suppressPathBridgeDuplicateOfDrawerExplanation never mutates its input array", () => {
  const neighborhood = testANeighborhood();
  const insights = computeNetworkGraphInsights(neighborhood);
  const nodeInsights = insightsForEntity(insights, "loc1");
  const copy = [...nodeInsights];
  suppressPathBridgeDuplicateOfDrawerExplanation(nodeInsights, "loc1", true);
  assert.deepEqual(nodeInsights, copy);
});

// E. Main Network Insight Panel (the full, unfiltered computeNetworkGraphInsights output) still exposes PATH_BRIDGE — this hotfix is Drawer-local only.
test("E. computeNetworkGraphInsights (the source for the main, unfiltered Insight Panel) still contains the TEST-A PATH_BRIDGE observation — this round never touches that pipeline", () => {
  const neighborhood = testANeighborhood();
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.ok(
    insights.some((i) => i.type === "PATH_BRIDGE" && i.entityId === "loc1"),
    "the main Insight Panel's own data source must be completely unaffected by the Drawer-local suppression helper",
  );
});

// J. No empty "ข้อสังเกตจากข้อมูล" container when nothing remains after suppression.
test("J. when suppression removes the entity's ONLY insight, the resulting filtered list is empty (component layer hides the section on empty, not tested here — pure-logic contract only)", () => {
  const soleInsight: NetworkGraphInsight[] = [
    {
      id: "path-bridge:loc1",
      type: "PATH_BRIDGE",
      titleKey: "di.network.insightPathBridge",
      entityId: "loc1",
      entityType: "LOCATION",
      entityLabel: "จุดพักสินค้า TEST-A",
      factText: "ปรากฏเป็นทางผ่านของ 3 เส้นทาง",
      cases: [],
      reasonKey: "di.network.insightReasonPathBridge",
      graphFocus: { nodeIds: ["loc1"], edgeIds: [], primaryNodeId: "loc1" },
      metric: 3,
      pathPairs: [],
    },
  ];
  const suppressed = suppressPathBridgeDuplicateOfDrawerExplanation(soleInsight, "loc1", true);
  assert.deepEqual(suppressed, [], "the filtered list must be genuinely empty so the component's nodeInsights.length > 0 gate hides the section");
});
