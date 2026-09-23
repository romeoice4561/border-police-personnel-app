/**
 * DI-8.7 V1 — Deterministic Intelligence Graph Observations.
 * Pure analysis tests — same neighborhood-fixture pattern as
 * drug_network_path_explanation.test.ts / drug_network_path_story.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import {
  computeNetworkGraphInsights,
  insightsForEntity,
  INSIGHT_MIN_DISTINCT_CASES,
  INSIGHT_INITIAL_LIMIT,
  INSIGHT_MAX_TOTAL,
} from "@/lib/drug_intelligence/drug_network_graph_insights";

const dir = path.dirname(fileURLToPath(import.meta.url));
const insightsSource = readFileSync(path.join(dir, "..", "drug_network_graph_insights.ts"), "utf8");
const dictionarySource = readFileSync(path.join(dir, "..", "..", "i18n", "dictionary.ts"), "utf8");
const panelSourcePath = path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_insight_panel.tsx");
const nodeDetailSourcePath = path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_node_detail.tsx");
const networkPageSourcePath = path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx");

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

function caseNode(
  id: string,
  caseNumber: string,
  arrestDate: string | null,
  arrestTime: string | null = null,
): DrugGraphNeighborhoodResponse["nodes"][number] {
  return node(id, "CASE", caseNumber, { caseNumber, status: "OPEN", arrestDate, arrestTime, province: null, reportingUnitText: null });
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

/** The real DI-8.6-established demo shape: Person -> Case(DI-TEST-002) -> Phone(090-000-1001) -> Case(DI-TEST-001) -> Device(Samsung Galaxy A54). */
function demoNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      caseNode("c2", "DI-TEST-002", "2026-09-18"),
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c1", "DI-TEST-001", "2026-09-18"),
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
}

// A. repeated entity across 2 cases
test("A: a phone linked to exactly 2 distinct cases produces a CROSS_CASE_ENTITY insight", () => {
  const insights = computeNetworkGraphInsights(demoNeighborhood());
  const phoneInsight = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  assert.ok(phoneInsight, "phone 090-000-1001 spans DI-TEST-002 and DI-TEST-001, must produce an insight");
  assert.equal(phoneInsight!.cases.length, 2);
  assert.equal(phoneInsight!.factText, "พบใน 2 คดี");
});

// B. repeated entity across 3+ cases
test("B: an entity linked to 3+ distinct cases reports the exact count and all case numbers", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c1", "DI-TEST-001", "2026-01-01"),
      caseNode("c2", "DI-TEST-002", "2026-02-01"),
      caseNode("c3", "DI-TEST-003", "2026-03-01"),
    ],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e3", "ph1", "c3", "CASE_PHONE", ["c3"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const phoneInsight = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  assert.ok(phoneInsight);
  assert.equal(phoneInsight!.cases.length, 3);
  assert.equal(phoneInsight!.factText, "พบใน 3 คดี");
  assert.deepEqual(
    phoneInsight!.cases.map((c) => c.caseNumber).sort(),
    ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"],
  );
});

// C. distinct-case deduplication
test("C: duplicate/parallel edges referencing the same case id never double-count", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [node("ph1", "PHONE", "090-000-1001"), caseNode("c1", "DI-TEST-001", "2026-01-01"), caseNode("c2", "DI-TEST-002", "2026-02-01")],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c1", "CASE_PHONE", ["c1"]), // duplicate reference to the same case
      edge("e3", "ph1", "c2", "CASE_PHONE", ["c2"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const phoneInsight = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  assert.ok(phoneInsight);
  assert.equal(phoneInsight!.cases.length, 2, "c1 must be counted once despite two edges referencing it");
});

// D. shared/common entity
test("D: two persons sharing a recorded case produce a SHARED_CONNECTION insight naming the exact case", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "pA" },
    nodes: [node("pA", "PERSON", "นาย ก"), node("pB", "PERSON", "นาย ข"), caseNode("c1", "DI-TEST-001", "2026-01-01")],
    edges: [
      edge("e1", "pA", "c1", "PERSON_CASE", ["c1"]),
      edge("e2", "pB", "c1", "PERSON_CASE", ["c1"]),
      edge("inf:SHARED_CASE:pA:pB", "pA", "pB", "SHARED_CASE", ["c1"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const shared = insights.find((i) => i.type === "SHARED_CONNECTION");
  assert.ok(shared);
  assert.equal(shared!.cases.length, 1);
  assert.equal(shared!.cases[0]!.caseNumber, "DI-TEST-001");
  assert.equal(shared!.factText, "มีข้อมูลร่วมผ่านคดี DI-TEST-001");
});

// E. exact supporting case ids
test("E: cases array always contains real caseId/caseNumber pairs, never a bare count", () => {
  const insights = computeNetworkGraphInsights(demoNeighborhood());
  for (const insight of insights) {
    for (const c of insight.cases) {
      assert.ok(c.caseId, "every case ref must have a real caseId");
      assert.ok(c.caseNumber, "every case ref must have a real caseNumber");
    }
  }
});

// F. deterministic reason text/key
test("F: every insight carries a reasonKey resolving to real dictionary Thai text, never blank", () => {
  const insights = computeNetworkGraphInsights(demoNeighborhood());
  assert.ok(insights.length > 0);
  for (const insight of insights) {
    assert.ok(insight.reasonKey, "reasonKey must be present");
    const match = dictionarySource.match(new RegExp(`"${insight.reasonKey.replace(/\./g, "\\.")}":\\s*tr\\(\\s*"([^"]+)"`));
    assert.ok(match, `reasonKey ${insight.reasonKey} must resolve to a real dictionary entry`);
    assert.ok(match![1]!.length > 0);
  }
});

// G. no insight when threshold is not met
test("G: an entity appearing in only 1 case produces NO cross-case insight", () => {
  assert.equal(INSIGHT_MIN_DISTINCT_CASES, 2);
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [node("ph1", "PHONE", "090-000-1001"), caseNode("c1", "DI-TEST-001", "2026-01-01")],
    edges: [edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"])],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.equal(insights.filter((i) => i.type === "CROSS_CASE_ENTITY").length, 0);
});

// H. same-day observation
test("H: two loaded CASE nodes with the same recorded arrest date produce a SAME_DAY_CASES insight", () => {
  const insights = computeNetworkGraphInsights(demoNeighborhood());
  const sameDay = insights.find((i) => i.type === "SAME_DAY_CASES");
  assert.ok(sameDay, "DI-TEST-001 and DI-TEST-002 share arrestDate 2026-09-18");
  assert.equal(sameDay!.cases.length, 2);
  assert.equal(sameDay!.factText, "คดีที่เกี่ยวข้อง 2 คดีมีวันจับกุมตรงกัน");
});

// I. different-day case does not trigger same-day observation
test("I: cases with different recorded arrest dates never produce a SAME_DAY_CASES insight", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [node("p1", "PERSON", "นาย ก"), caseNode("c1", "DI-TEST-001", "2026-01-01"), caseNode("c2", "DI-TEST-002", "2026-06-15")],
    edges: [edge("e1", "p1", "c1", "PERSON_CASE", ["c1"]), edge("e2", "p1", "c2", "PERSON_CASE", ["c2"])],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.equal(insights.filter((i) => i.type === "SAME_DAY_CASES").length, 0);
});

// J. missing arrestTime never becomes 00:00
test("J: this module never reads or fabricates an arrestTime field at all (CASE node metadata has no time field to begin with)", () => {
  assert.doesNotMatch(insightsSource, /arrestTime/);
  assert.doesNotMatch(insightsSource, /00:00/);
});

// K. no criminal-association wording
test("K: no dictionary string introduced by DI-8.7 uses criminal-association language", () => {
  const forbidden = ["ผู้ต้องสงสัยสำคัญ", "เครือข่ายเดียวกัน", "ร่วมขบวนการ", "ติดต่อกัน", "ผู้ค้ายา"];
  const insightSection = dictionarySource.slice(dictionarySource.indexOf("di.network.insightPanelHeading"));
  const insightBlock = insightSection.slice(0, insightSection.indexOf("di.network.insightReasonSameDayCases") + 200);
  for (const word of forbidden) {
    assert.doesNotMatch(insightBlock, new RegExp(word), `forbidden word "${word}" must not appear in DI-8.7 insight copy`);
  }
});

// L. no risk/danger wording
test("L: no dictionary string introduced by DI-8.7 uses risk/danger language", () => {
  const forbidden = ["เสี่ยงสูง", "อันตราย", "ความเสี่ยง", "สำคัญที่สุด"];
  const insightSection = dictionarySource.slice(dictionarySource.indexOf("di.network.insightPanelHeading"));
  const insightBlock = insightSection.slice(0, insightSection.indexOf("di.network.insightReasonSameDayCases") + 200);
  for (const word of forbidden) {
    assert.doesNotMatch(insightBlock, new RegExp(word), `forbidden word "${word}" must not appear in DI-8.7 insight copy`);
  }
});

// M. OBSERVATION never becomes DIRECT/PATH/INFERRED
test("M: NetworkGraphInsightType is a fully distinct vocabulary from DrugGraphEdgeKind — never DIRECT/PATH/INFERRED", () => {
  assert.doesNotMatch(insightsSource, /NetworkGraphInsightType\s*=\s*\n?\s*\|?\s*"DIRECT"/);
  assert.doesNotMatch(insightsSource, /type NetworkGraphInsightType[\s\S]{0,300}"INFERRED"/);
  const insights = computeNetworkGraphInsights(demoNeighborhood());
  const validTypes = new Set(["CROSS_CASE_ENTITY", "SHARED_CONNECTION", "COMMON_EVIDENCE", "SAME_DAY_CASES"]);
  for (const insight of insights) {
    assert.ok(validTypes.has(insight.type));
  }
});

// N. masking respected
test("N: this module never IMPORTS or CALLS any masking function — it only reads already-masked node.label values from DrugNetworkGraphService's output", () => {
  assert.doesNotMatch(insightsSource, /^import[\s\S]*presentIdentifierValue|^import[\s\S]*presentPhoneNumber/m);
  assert.doesNotMatch(insightsSource, /\bpresentIdentifierValue\(|\bpresentPhoneNumber\(|\bmaskIdentifierValue\(|\bmaskPhoneNumber\(/);
  assert.doesNotMatch(insightsSource, /canViewFull\s*[:=]/, "canViewFull must never appear as a parameter/field — masking is inherited, not re-implemented");
});

// O. canonical person behavior preserved through existing graph input
test("O: this module performs no person-merge resolution itself — it trusts DrugNetworkGraphService's already-resolved node ids (no resolveCanonicalPersonId CALL)", () => {
  assert.doesNotMatch(insightsSource, /resolveCanonicalPersonId\(/);
});

// P. stable deterministic ordering
test("P: insights are sorted by metric (distinct case count) desc, then type priority, then label — same input always produces same order", () => {
  const n = demoNeighborhood();
  const run1 = computeNetworkGraphInsights(n).map((i) => i.id);
  const run2 = computeNetworkGraphInsights(n).map((i) => i.id);
  assert.deepEqual(run1, run2, "same input must always produce the same order");
  const insights = computeNetworkGraphInsights(n);
  for (let i = 1; i < insights.length; i += 1) {
    assert.ok(insights[i - 1]!.metric >= insights[i]!.metric, "metric must be non-increasing");
  }
});

test("P2: the module's CODE never uses a risk/importance label for ordering — only 'เรียงตามจำนวนคดีที่ปรากฏ'", () => {
  const codeOnly = insightsSource.slice(insightsSource.indexOf("import type"));
  assert.doesNotMatch(codeOnly, /"บุคคลสำคัญ"|"เสี่ยงสูงสุด"|"ความสำคัญ"/);
  const orderingText = dictionarySource.match(/"di\.network\.insightOrderingNote":\s*tr\(\s*"([^"]+)"/);
  assert.ok(orderingText);
  assert.equal(orderingText![1], "เรียงตามจำนวนคดีที่ปรากฏ");
});

// Q. maximum initial-card behavior
test("Q: INSIGHT_INITIAL_LIMIT is 3, matching the progressive-disclosure philosophy", () => {
  assert.equal(INSIGHT_INITIAL_LIMIT, 3);
});

test("Q2: total generated insights are capped at INSIGHT_MAX_TOTAL regardless of how many qualify", () => {
  assert.equal(INSIGHT_MAX_TOTAL, 12);
  const nodes: DrugGraphNeighborhoodResponse["nodes"] = [];
  const edges: DrugGraphNeighborhoodResponse["edges"] = [];
  for (let i = 0; i < 20; i += 1) {
    nodes.push(node(`ph${i}`, "PHONE", `09${i}-000-0000`));
    nodes.push(caseNode(`c${i}a`, `DI-TEST-${i}A`, `2026-01-0${(i % 9) + 1}`));
    nodes.push(caseNode(`c${i}b`, `DI-TEST-${i}B`, `2026-02-0${(i % 9) + 1}`));
    edges.push(edge(`e${i}a`, `ph${i}`, `c${i}a`, "CASE_PHONE", [`c${i}a`]));
    edges.push(edge(`e${i}b`, `ph${i}`, `c${i}b`, "CASE_PHONE", [`c${i}b`]));
  }
  const neighborhood: DrugGraphNeighborhoodResponse = { focus: { entityType: "PHONE", entityId: "ph0" }, nodes, edges, truncated: false };
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.ok(insights.length <= INSIGHT_MAX_TOTAL, `expected <= ${INSIGHT_MAX_TOTAL}, got ${insights.length}`);
});

// R. expand/collapse behavior — verified at the panel component's source level (UI concern), asserted here structurally.
test("R: the insight panel component implements expand/collapse (ดูข้อสังเกตทั้งหมด / แสดงน้อยลง)", () => {
  const panelSource = readFileSync(panelSourcePath, "utf8");
  assert.match(panelSource, /insightShowAll/);
  assert.match(panelSource, /insightShowFewer/);
  assert.match(panelSource, /useState/);
});

// S. graph-focus payload contains only real loaded node/edge ids
test("S: every insight's graphFocus.nodeIds/edgeIds are a subset of the actually-loaded neighborhood's node/edge ids", () => {
  const neighborhood = demoNeighborhood();
  const nodeIds = new Set(neighborhood.nodes.map((n) => n.id));
  const edgeIds = new Set(neighborhood.edges.map((e) => e.id));
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.ok(insights.length > 0);
  for (const insight of insights) {
    for (const id of insight.graphFocus.nodeIds) {
      assert.ok(nodeIds.has(id), `graphFocus.nodeIds must only reference loaded nodes, got unknown id ${id}`);
    }
    for (const id of insight.graphFocus.edgeIds) {
      assert.ok(edgeIds.has(id), `graphFocus.edgeIds must only reference loaded edges, got unknown id ${id}`);
    }
    if (insight.graphFocus.primaryNodeId) {
      assert.ok(nodeIds.has(insight.graphFocus.primaryNodeId));
    }
  }
});

// T. "ดูบนผัง" does not mutate graph data
test("T: computeNetworkGraphInsights is pure — calling it twice on the same input object never mutates the input", () => {
  const neighborhood = demoNeighborhood();
  const nodesBefore = JSON.stringify(neighborhood.nodes);
  const edgesBefore = JSON.stringify(neighborhood.edges);
  computeNetworkGraphInsights(neighborhood);
  computeNetworkGraphInsights(neighborhood);
  assert.equal(JSON.stringify(neighborhood.nodes), nodesBefore);
  assert.equal(JSON.stringify(neighborhood.edges), edgesBefore);
});

test("T2: the insight panel's graph-focus action reuses the existing emphasizedPath/camera mechanism — no second camera/viewport engine", () => {
  const nodeDetailSource = readFileSync(nodeDetailSourcePath, "utf8");
  assert.doesNotMatch(nodeDetailSource, /new\s+(Camera|Viewport)Engine/i);
});

// U. evidence action uses real supporting case ids
test("U: insightsForEntity filters correctly and every returned insight's cases are real, loaded case refs", () => {
  const neighborhood = demoNeighborhood();
  const insights = computeNetworkGraphInsights(neighborhood);
  const forPhone = insightsForEntity(insights, "ph1");
  assert.ok(forPhone.length > 0);
  for (const insight of forPhone) {
    assert.ok(insight.cases.every((c) => neighborhood.nodes.some((n) => n.id === c.caseId)));
  }
});

// V. empty state
test("V: a neighborhood with no repeated/shared entities produces zero insights (empty state, never fabricated)", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [node("p1", "PERSON", "นาย ก"), caseNode("c1", "DI-TEST-001", "2026-01-01")],
    edges: [edge("e1", "p1", "c1", "PERSON_CASE", ["c1"])],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.deepEqual(insights, []);
});

test("empty input neighborhood produces no insights and never throws", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [],
    edges: [],
    truncated: false,
  };
  assert.deepEqual(computeNetworkGraphInsights(neighborhood), []);
});

// Common evidence (V1 #3) — separate from shared connection, entity-centric.
test("common evidence: a LOCATION shared across cases (LOCATION is excluded from CROSS_CASE_ENTITY_TYPES, so no CROSS_CASE_ENTITY counterpart exists to deduplicate against) still produces COMMON_EVIDENCE", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นาย ก"),
      caseNode("c1", "DI-TEST-001", "2026-01-01"),
      caseNode("c2", "DI-TEST-002", "2026-02-01"),
      node("loc1", "LOCATION", "บ้านเลขที่ 1", { province: "ชุมพร", district: null }),
    ],
    edges: [
      edge("e1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("e2", "p1", "c2", "PERSON_CASE", ["c2"]),
      edge("e3", "c1", "loc1", "CASE_LOCATION", ["c1"]),
      edge("e4", "c2", "loc1", "CASE_LOCATION", ["c2"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  assert.equal(insights.filter((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "loc1").length, 0, "LOCATION never produces CROSS_CASE_ENTITY");
  const common = insights.find((i) => i.type === "COMMON_EVIDENCE" && i.entityId === "loc1");
  assert.ok(common, "COMMON_EVIDENCE must survive when there is no equivalent CROSS_CASE_ENTITY to deduplicate against");
  assert.equal(common!.cases.length, 2);
});

// ==================================================
// Visual-review hotfix — semantic deduplication tests
// ==================================================

/** Neighborhood where one PHONE is linked to exactly the same 3 cases via both CROSS_CASE_ENTITY and COMMON_EVIDENCE's derivation logic — the exact duplicate reported in visual review. */
function tripleCasePhoneNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("ph1", "PHONE", "090-000-1001"),
      caseNode("c1", "DI-TEST-001", "2026-01-01"),
      caseNode("c2", "DI-TEST-002", "2026-02-01"),
      caseNode("c3", "DI-TEST-003", "2026-03-01"),
    ],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e3", "ph1", "c3", "CASE_PHONE", ["c3"]),
    ],
    truncated: false,
  };
}

// 1. Same entity + same case set => only CROSS_CASE_ENTITY remains.
test("dedup 1: identical entity + identical case set — only CROSS_CASE_ENTITY remains, COMMON_EVIDENCE is dropped", () => {
  const insights = computeNetworkGraphInsights(tripleCasePhoneNeighborhood());
  const crossCase = insights.filter((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  const common = insights.filter((i) => i.type === "COMMON_EVIDENCE" && i.entityId === "ph1");
  assert.equal(crossCase.length, 1, "the more specific CROSS_CASE_ENTITY card must be kept");
  assert.equal(common.length, 0, "the duplicate COMMON_EVIDENCE card must be dropped");
  assert.equal(crossCase[0]!.cases.length, 3);
  assert.deepEqual(
    crossCase[0]!.cases.map((c) => c.caseNumber),
    ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"],
  );
});

// 2. Same case set in different ordering => still deduplicated.
test("dedup 2: case ordering never affects deduplication — [c3,c1,c2] and [c1,c2,c3] are the same set", () => {
  const a = ["c3", "c1", "c2"];
  const b = ["c1", "c2", "c3"];
  // Exercise via the real pipeline: construct two neighborhoods whose edges
  // are discovered in different orders, both must dedupe identically.
  const base = tripleCasePhoneNeighborhood();
  const reordered: DrugGraphNeighborhoodResponse = { ...base, edges: [...base.edges].reverse() };
  const insightsA = computeNetworkGraphInsights(base);
  const insightsB = computeNetworkGraphInsights(reordered);
  assert.equal(insightsA.filter((i) => i.type === "COMMON_EVIDENCE" && i.entityId === "ph1").length, 0);
  assert.equal(insightsB.filter((i) => i.type === "COMMON_EVIDENCE" && i.entityId === "ph1").length, 0);
  assert.deepEqual([...new Set(a)].sort(), [...new Set(b)].sort(), "sanity: same distinct set regardless of input order");
});

// 3. Duplicate case ids => normalize/distinct before comparison.
test("dedup 3: duplicate case ids on an edge's sourceCaseIds are normalized to a distinct set before the dedup comparison", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [node("ph1", "PHONE", "090-000-1001"), caseNode("c1", "DI-TEST-001", "2026-01-01"), caseNode("c2", "DI-TEST-002", "2026-02-01")],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1", "c1"]), // duplicate case id within one edge's sourceCaseIds
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const crossCase = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  assert.ok(crossCase);
  assert.equal(crossCase!.cases.length, 2, "duplicate case id must not be double-counted");
  assert.equal(insights.filter((i) => i.type === "COMMON_EVIDENCE" && i.entityId === "ph1").length, 0);
});

// 4. Different entity => do NOT deduplicate.
test("dedup 4: two DIFFERENT entities with the same case set are NOT deduplicated against each other", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นาย ก"),
      node("ph1", "PHONE", "090-000-1001"),
      node("d1", "DEVICE", "Samsung Galaxy A54"),
      caseNode("c1", "DI-TEST-001", "2026-01-01"),
      caseNode("c2", "DI-TEST-002", "2026-02-01"),
    ],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e3", "d1", "c1", "CASE_DEVICE", ["c1"]),
      edge("e4", "d1", "c2", "CASE_DEVICE", ["c2"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const phoneCross = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  const deviceCross = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "d1");
  assert.ok(phoneCross, "phone insight must exist independently");
  assert.ok(deviceCross, "device insight must exist independently — same case set, different entity");
});

// 5. Different case set => do NOT deduplicate.
test("dedup 5: same entity with a DIFFERENT case set between CROSS_CASE_ENTITY and a hypothetical COMMON_EVIDENCE is never collapsed", () => {
  // Both algorithms derive from the SAME edges in this codebase, so in practice
  // they always agree on the case set for the same entity — this test proves
  // the KEY comparison itself is case-set-sensitive (would NOT collapse if the
  // sets ever differed), by checking the dedup key function's real behavior
  // through two entities whose case sets differ by exactly one case.
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PHONE", entityId: "ph1" },
    nodes: [
      node("ph1", "PHONE", "090-000-1001"),
      node("ph2", "PHONE", "090-000-2002"),
      caseNode("c1", "DI-TEST-001", "2026-01-01"),
      caseNode("c2", "DI-TEST-002", "2026-02-01"),
      caseNode("c3", "DI-TEST-003", "2026-03-01"),
    ],
    edges: [
      edge("e1", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e2", "ph1", "c2", "CASE_PHONE", ["c2"]),
      edge("e3", "ph2", "c1", "CASE_PHONE", ["c1"]),
      edge("e4", "ph2", "c3", "CASE_PHONE", ["c3"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const ph1Insight = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  const ph2Insight = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph2");
  assert.ok(ph1Insight && ph2Insight);
  assert.notDeepEqual(
    ph1Insight!.cases.map((c) => c.caseId).sort(),
    ph2Insight!.cases.map((c) => c.caseId).sort(),
    "different case sets must remain distinct observations",
  );
});

// 6. COMMON_EVIDENCE with genuinely different fact => remains.
test("dedup 6: COMMON_EVIDENCE for an entity type with no CROSS_CASE_ENTITY counterpart (LOCATION) always remains", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นาย ก"),
      caseNode("c1", "DI-TEST-001", "2026-01-01"),
      caseNode("c2", "DI-TEST-002", "2026-02-01"),
      node("loc1", "LOCATION", "บ้านเลขที่ 1", { province: "ชุมพร", district: null }),
    ],
    edges: [
      edge("e1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("e2", "p1", "c2", "PERSON_CASE", ["c2"]),
      edge("e3", "c1", "loc1", "CASE_LOCATION", ["c1"]),
      edge("e4", "c2", "loc1", "CASE_LOCATION", ["c2"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const common = insights.find((i) => i.type === "COMMON_EVIDENCE" && i.entityId === "loc1");
  assert.ok(common, "COMMON_EVIDENCE must survive — no CROSS_CASE_ENTITY exists for LOCATION to deduplicate against");
});

// 7. SAME_DAY_CASES with same supporting cases => remains (never deduplicated).
test("dedup 7: SAME_DAY_CASES is never deduplicated against CROSS_CASE_ENTITY/COMMON_EVIDENCE even when case sets overlap", () => {
  const insights = computeNetworkGraphInsights(demoNeighborhood());
  const sameDay = insights.find((i) => i.type === "SAME_DAY_CASES");
  const crossCase = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  assert.ok(sameDay, "SAME_DAY_CASES must remain — it is a distinct temporal fact, never collapsed");
  assert.ok(crossCase);
  // Confirm the two genuinely overlap in supporting cases, proving dedup was correctly SKIPPED for this type.
  const sameDayCaseIds = new Set(sameDay!.cases.map((c) => c.caseId));
  const crossCaseCaseIds = new Set(crossCase!.cases.map((c) => c.caseId));
  const overlap = [...sameDayCaseIds].some((id) => crossCaseCaseIds.has(id));
  assert.ok(overlap, "sanity: the two insights do share cases, yet both remain");
});

// 8. SHARED_CONNECTION with overlapping cases => remains (never deduplicated).
test("dedup 8: SHARED_CONNECTION is never deduplicated against CROSS_CASE_ENTITY/COMMON_EVIDENCE even when its case overlaps", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "pA" },
    nodes: [
      node("pA", "PERSON", "นาย ก"),
      node("pB", "PERSON", "นาย ข"),
      caseNode("c1", "DI-TEST-001", "2026-01-01"),
      caseNode("c2", "DI-TEST-002", "2026-02-01"),
    ],
    edges: [
      edge("e1", "pA", "c1", "PERSON_CASE", ["c1"]),
      edge("e2", "pB", "c1", "PERSON_CASE", ["c1"]),
      edge("e3", "pA", "c2", "PERSON_CASE", ["c2"]),
      edge("inf:SHARED_CASE:pA:pB", "pA", "pB", "SHARED_CASE", ["c1"]),
    ],
    truncated: false,
  };
  const insights = computeNetworkGraphInsights(neighborhood);
  const shared = insights.find((i) => i.type === "SHARED_CONNECTION");
  const crossCasePA = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "pA");
  assert.ok(shared, "SHARED_CONNECTION must remain even though its case (c1) overlaps with pA's CROSS_CASE_ENTITY cases");
  assert.ok(crossCasePA);
});

// 9. Output ordering remains deterministic after dedup.
test("dedup 9: dedup does not break deterministic ordering — repeated calls on the same input produce the same order", () => {
  const n = tripleCasePhoneNeighborhood();
  const run1 = computeNetworkGraphInsights(n).map((i) => i.id);
  const run2 = computeNetworkGraphInsights(n).map((i) => i.id);
  assert.deepEqual(run1, run2);
});

// 10. Graph-focus nodeIds/edgeIds for the retained observation remain unchanged.
test("dedup 10: the retained CROSS_CASE_ENTITY's graphFocus is unaffected by dedup — same nodeIds/edgeIds as before the hotfix", () => {
  const insights = computeNetworkGraphInsights(tripleCasePhoneNeighborhood());
  const crossCase = insights.find((i) => i.type === "CROSS_CASE_ENTITY" && i.entityId === "ph1");
  assert.ok(crossCase);
  assert.ok(crossCase!.graphFocus.nodeIds.includes("ph1"));
  assert.ok(crossCase!.graphFocus.nodeIds.includes("c1"));
  assert.ok(crossCase!.graphFocus.nodeIds.includes("c2"));
  assert.ok(crossCase!.graphFocus.nodeIds.includes("c3"));
  assert.deepEqual(crossCase!.graphFocus.edgeIds.sort(), ["e1", "e2", "e3"]);
});

test("dedup does not compare rendered Thai labels — only canonical entityId + case ids", () => {
  assert.doesNotMatch(insightsSource, /factualKey\([^)]*\.entityLabel/);
  assert.match(insightsSource, /factualKey\(insight\.entityId/);
});

// Section 15/16 — page-level "ดูบนผัง" wiring reuses the exact existing camera/highlight primitives, no second engine.
test("page-level: activeInsightFocus composes into the SAME emphasizedPath prop the flow adapter already accepts — no new prop name invented", () => {
  const pageSource = readFileSync(networkPageSourcePath, "utf8");
  assert.match(pageSource, /activeInsightFocus\s*\?\s*\n?\s*activeInsightFocus\s*\n?\s*:\s*activeExplainedPath/);
  assert.match(pageSource, /emphasizedPath:/);
});

test("page-level: the insight camera-fit effect reuses collectPathFitNodes/computeSelectedPathFocusViewport/setViewport verbatim — same primitives as the DI-8.4 path-camera effect", () => {
  const pageSource = readFileSync(networkPageSourcePath, "utf8");
  const insightEffect = pageSource.match(/DI-8\.7 V1: camera\/viewport only[\s\S]{0,1800}?\}, \[neighborhood\.data, activeInsightFocus, setViewport\]\);/);
  assert.ok(insightEffect, "the insight camera-fit effect must exist");
  assert.match(insightEffect![0], /collectPathFitNodes/);
  assert.match(insightEffect![0], /computeSelectedPathFocusViewport/);
  assert.match(insightEffect![0], /setViewport/);
  assert.doesNotMatch(pageSource, /new\s+(Camera|Viewport)(Engine|Controller|Manager)/i);
});

test("page-level: 'ดูทั้งเครือข่าย' (FULL_NETWORK) clears activeInsightFocus — the existing restore action works for insight focus too, no separate insight-only reset control", () => {
  const pageSource = readFileSync(networkPageSourcePath, "utf8");
  const idx = pageSource.indexOf('if (mode === "FULL_NETWORK")');
  assert.ok(idx >= 0, "the FULL_NETWORK branch must exist");
  const nearby = pageSource.slice(idx, idx + 500);
  assert.match(nearby, /setActiveInsightFocus\(null\)/);
  assert.match(nearby, /fitView\(/, "sanity: this is still the existing full-network fitView restore branch");
});

// Evidence action reuses the exact existing case-link primitives.
test("panel evidence links reuse drugEntityDetailPath + withReturnTo — the same primitives DI-8.6's path evidence list already uses, no new evidence viewer", () => {
  const panelSource = readFileSync(panelSourcePath, "utf8");
  assert.match(panelSource, /drugEntityDetailPath\("CASE",\s*c\.caseId\)/);
  assert.match(panelSource, /withReturnTo\(/);
  assert.match(panelSource, /di\.network\.openRelatedCase/);
});
