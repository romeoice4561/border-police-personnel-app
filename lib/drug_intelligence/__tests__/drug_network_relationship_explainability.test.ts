/**
 * DI-9.5 / DI-9.5.1 — Network relationship explainability
 * ("why are these connected?" operational storytelling).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildRelationshipExplanation,
  compactCaseContextLine,
  connectingEdgeForExplanationClick,
  explanationContainsForbiddenClaim,
  findConnectingEdge,
  otherCaseLabelsForEntity,
  safeDisplayLabel,
  sharedEntitiesBetween,
  sortCrossCaseSignals,
} from "@/lib/drug_intelligence/drug_network_relationship_explainability";
import { buildDrugNetworkFlowGraph } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import { DrugNetworkEdgeDetail } from "@/components/drug_intelligence/drug_network_edge_detail";
import { parseNetworkInvestigationTrail } from "@/lib/drug_intelligence/drug_network_investigation_trail";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import type { DrugGraphEdge, DrugGraphNeighborhoodResponse, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function person(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "PERSON",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function caseNode(id: string, label: string, extra?: Partial<Extract<DrugGraphNode["metadata"], { type: "CASE" }>>): DrugGraphNode {
  return {
    id,
    type: "CASE",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: {
      type: "CASE",
      caseNumber: label,
      status: "OPEN",
      arrestDate: extra?.arrestDate ?? null,
      province: extra?.province ?? null,
      reportingUnitText: extra?.reportingUnitText ?? null,
    },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function phone(id: string, label: string, caseCount = 1, maskedLabel: string | null = null): DrugGraphNode {
  return {
    id,
    type: "PHONE",
    label,
    secondaryLabel: null,
    maskedLabel,
    metadata: { type: "PHONE", carrier: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount,
    riskIndicators: [],
  };
}

function sim(id: string, label: string, caseCount = 1): DrugGraphNode {
  return {
    id,
    type: "SIM",
    label,
    secondaryLabel: null,
    maskedLabel: label,
    metadata: { type: "SIM", imsi: null, carrier: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount,
    riskIndicators: [],
  };
}

function device(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "DEVICE",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "DEVICE", brand: "Apple", model: "iPhone 14" },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function vehicle(id: string, label: string, caseCount = 1): DrugGraphNode {
  return {
    id,
    type: "VEHICLE",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "VEHICLE", registrationProvince: null, brand: null, model: null, color: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount,
    riskIndicators: [],
  };
}

function edge(partial: Partial<DrugGraphEdge> & Pick<DrugGraphEdge, "id" | "source" | "target" | "relationshipType">): DrugGraphEdge {
  return {
    edgeKind: "DIRECT",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [],
    explanation: { kind: "DIRECT_LINK" },
    ...partial,
  };
}

function demoNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "CASE", entityId: "case-003" },
    truncated: false,
    nodes: [
      caseNode("case-003", "DI-TEST-003", { province: "เชียงราย", reportingUnitText: "ภ.จว.เชียงราย", arrestDate: "2026-01-15T00:00:00.000Z" }),
      caseNode("case-001", "DI-TEST-001"),
      caseNode("case-002", "DI-TEST-002"),
      person("person-k", "นายกิตติศักดิ์ ทดสอบระบบ"),
      phone("ph-1001", "0900001001", 3),
      phone("ph-1005", "0900001005", 1),
      sim("sim-1", "8900...0001", 2),
      device("dev-1", "Apple iPhone 14"),
      vehicle("veh-1", "TEST-9009", 2),
    ],
    edges: [
      edge({
        id: "pc:1",
        source: "person-k",
        target: "case-003",
        relationshipType: "PERSON_CASE",
        sourceCaseIds: ["case-003"],
        explanation: { kind: "DIRECT_ROLE", role: "ARRESTED_PERSON" },
      }),
      edge({ id: "cp:1001", source: "case-003", target: "ph-1001", relationshipType: "CASE_PHONE", sourceCaseIds: ["case-003"] }),
      edge({ id: "cp:1001-a", source: "case-001", target: "ph-1001", relationshipType: "CASE_PHONE", sourceCaseIds: ["case-001"] }),
      edge({ id: "cp:1001-b", source: "case-002", target: "ph-1001", relationshipType: "CASE_PHONE", sourceCaseIds: ["case-002"] }),
      edge({ id: "cp:1005", source: "case-003", target: "ph-1005", relationshipType: "CASE_PHONE", sourceCaseIds: ["case-003"] }),
      edge({ id: "pp:1001", source: "person-k", target: "ph-1001", relationshipType: "PERSON_PHONE", sourceCaseIds: ["case-003"] }),
      edge({ id: "pp:1005", source: "person-k", target: "ph-1005", relationshipType: "PERSON_PHONE", sourceCaseIds: ["case-003"] }),
      edge({ id: "cs:1", source: "case-003", target: "sim-1", relationshipType: "CASE_SIM", sourceCaseIds: ["case-003"] }),
      edge({ id: "ps:1", source: "person-k", target: "sim-1", relationshipType: "PERSON_SIM", sourceCaseIds: ["case-003"] }),
      edge({ id: "cd:1", source: "case-003", target: "dev-1", relationshipType: "CASE_DEVICE", sourceCaseIds: ["case-003"] }),
      edge({ id: "pd:1", source: "person-k", target: "dev-1", relationshipType: "PERSON_DEVICE", sourceCaseIds: ["case-003"] }),
      edge({ id: "cv:1", source: "case-003", target: "veh-1", relationshipType: "CASE_VEHICLE", sourceCaseIds: ["case-003"] }),
      edge({ id: "pv:1", source: "person-k", target: "veh-1", relationshipType: "PERSON_VEHICLE", sourceCaseIds: ["case-003"] }),
    ],
  };
}

function allStoryText(model: ReturnType<typeof buildRelationshipExplanation>): string {
  return [
    model.sentence,
    model.followUpSentence ?? "",
    model.inferredDisclaimer ?? "",
    ...model.inferredFacts,
    ...model.crossCaseSignals.map((item) => `${item.story} ${item.totalLine} ${item.openAllHint ?? ""} ${item.label}`),
    ...model.otherInCase.map((item) => `${item.label} ${item.foundLine}`),
    ...model.actions.map((item) => item.label),
    model.compactCaseContext ?? "",
  ].join(" ");
}

test("CASE ↔ PERSON primary story uses the stored role, not a hardcoded arrest claim", () => {
  const graph = demoNeighborhood();
  const model = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  assert.equal(model.classification, "DIRECT");
  assert.match(model.sentence, /นายกิตติศักดิ์ ทดสอบระบบ ถูกบันทึกเป็นผู้ถูกจับกุมในคดี DI-TEST-003/);
  assert.equal(model.roleLabel, "ผู้ถูกจับกุม");
  assert.doesNotMatch(model.sentence, /เบอร์ของนาย|รถของนาย|โทรศัพท์ของนาย/);
});

test("CASE ↔ PERSON falls back when no stored role is present", () => {
  const graph = demoNeighborhood();
  const rel = edge({
    id: "pc:norole",
    source: "person-k",
    target: "case-003",
    relationshipType: "PERSON_CASE",
    sourceCaseIds: ["case-003"],
  });
  const model = buildRelationshipExplanation({
    edge: rel,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  assert.equal(model.roleLabel, null);
  assert.match(model.sentence, /บุคคลนี้ถูกบันทึกอยู่ในคดี DI-TEST-003/);
  assert.doesNotMatch(model.sentence, /ผู้ถูกจับกุม/);
});

test("compact case context is one Thai date/province/unit line", () => {
  const graph = demoNeighborhood();
  const model = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  const expected = `${formatDiDate("2026-01-15T00:00:00.000Z")} • เชียงราย • ภ.จว.เชียงราย`;
  assert.equal(model.compactCaseContext, expected);
  assert.equal(
    compactCaseContextLine({ arrestDate: "2026-08-10T00:00:00.000Z", province: "สุราษฎร์ธานี", reportingUnitText: "ร้อย ตชด.414" }),
    `${formatDiDate("2026-08-10T00:00:00.000Z")} • สุราษฎร์ธานี • ร้อย ตชด.414`
  );
  assert.doesNotMatch(model.compactCaseContext ?? "", /วันที่จับกุมของคดี/);
});

test("summary counts come only from factual shared DIRECT neighbors", () => {
  const graph = demoNeighborhood();
  const stray = phone("ph-stray", "0999999999", 9);
  graph.nodes.push(stray);
  graph.edges.push(edge({ id: "pp:stray", source: "person-k", target: "ph-stray", relationshipType: "PERSON_PHONE" }));
  const model = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  assert.deepEqual(
    model.summaryChips.map((chip) => `${chip.label} ${chip.count}`),
    ["เบอร์โทร 2", "SIM 1", "อุปกรณ์ 1", "ยานพาหนะ 1"]
  );
  assert.equal(model.summaryChips.find((chip) => chip.type === "PHONE")?.count, 2);
});

test("cross-case signals are caseCount > 1, sorted DESC, and do not promote caseCount = 1", () => {
  const graph = demoNeighborhood();
  const model = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  assert.deepEqual(
    model.crossCaseSignals.map((item) => `${item.id}:${item.caseCount}`),
    ["ph-1001:3", "sim-1:2", "veh-1:2"]
  );
  assert.equal(model.crossCaseSignals.some((item) => item.id === "ph-1005"), false);
  assert.equal(model.otherInCase.some((item) => item.id === "ph-1005"), true);
  assert.equal(model.otherInCase.some((item) => item.id === "dev-1"), true);
  const sorted = sortCrossCaseSignals([
    { id: "b", label: "B", caseCount: 2 },
    { id: "a", label: "A", caseCount: 3 },
    { id: "c", label: "C", caseCount: 2 },
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["a", "b", "c"]
  );
});

test("other-case labels exclude the current case and never show UUIDs", () => {
  const graph = demoNeighborhood();
  const model = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  const phoneSignal = model.crossCaseSignals.find((item) => item.id === "ph-1001")!;
  assert.deepEqual(phoneSignal.otherCaseLabels, ["DI-TEST-001", "DI-TEST-002"]);
  assert.equal(phoneSignal.otherCaseLabels.includes("DI-TEST-003"), false);
  assert.equal(phoneSignal.neighborhoodIncomplete, false);
  assert.match(phoneSignal.story, /พบใน DI-TEST-003 และพบซ้ำในอีก 2 คดี/);
  assert.equal(phoneSignal.totalLine, "พบรวม 3 คดี");
  assert.equal(
    otherCaseLabelsForEntity(graph, "ph-1001", "case-003").some((label) => /[0-9a-f]{8}-[0-9a-f]{4}/i.test(label)),
    false
  );
});

test("bounded-neighborhood fallback does not pretend the loaded graph is complete", () => {
  const graph = demoNeighborhood();
  const wide = phone("ph-1001", "0900001001", 5);
  graph.nodes = graph.nodes.map((node) => (node.id === "ph-1001" ? wide : node));
  const model = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  const phoneSignal = model.crossCaseSignals.find((item) => item.id === "ph-1001")!;
  assert.equal(phoneSignal.neighborhoodIncomplete, true);
  assert.equal(phoneSignal.totalLine, "พบรวม 5 คดี");
  assert.match(phoneSignal.openAllHint ?? "", /เปิดข้อมูลเบอร์เพื่อดูคดีทั้งหมด/);
});

test("PERSON ↔ PHONE story is case-provenance with recurrence, never ownership", () => {
  const graph = demoNeighborhood();
  const rel = graph.edges.find((item) => item.id === "pp:1001")!;
  const model = buildRelationshipExplanation({
    edge: rel,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "ph-1001")!,
    neighborhood: graph,
    language: "th",
  });
  assert.match(model.sentence, /หมายเลข 0900001001 พบเชื่อมโยงกับนายกิตติศักดิ์ ทดสอบระบบจากข้อมูลคดี/);
  assert.equal(model.followUpSentence, "พบหมายเลขนี้รวม 3 คดี");
  assert.deepEqual(model.crossCaseSignals[0]?.otherCaseLabels, ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"]);
  assert.doesNotMatch(allStoryText(model), /เบอร์ของ|เจ้าของ|โทรศัพท์ของนาย/);
});

test("CASE ↔ PHONE story names the case then the repeated-entity signal", () => {
  const graph = demoNeighborhood();
  const phoneEdge = graph.edges.find((item) => item.id === "cp:1001")!;
  const model = buildRelationshipExplanation({
    edge: phoneEdge,
    sourceNode: graph.nodes.find((n) => n.id === "case-003")!,
    targetNode: graph.nodes.find((n) => n.id === "ph-1001")!,
    neighborhood: graph,
    language: "th",
  });
  assert.match(model.sentence, /หมายเลข 0900001001 ถูกบันทึกอยู่ในคดี DI-TEST-003/);
  assert.equal(model.followUpSentence, "หมายเลขเดียวกันพบรวม 3 คดี");
  assert.equal(model.recurrence?.caseCount, 3);
  assert.deepEqual(model.crossCaseSignals[0]?.otherCaseLabels, ["DI-TEST-001", "DI-TEST-002"]);
  assert.equal(drugEntityDetailPath("PHONE", "ph-1001"), "/drug-intelligence/phones/ph-1001");
});

test("INFERRED person-person story uses shared-data disclaimer and only loaded DIRECT facts", () => {
  const graph = demoNeighborhood();
  const inferredEdge = edge({
    id: "inf:1",
    source: "person-k",
    target: "person-b",
    relationshipType: "SHARED_PHONE",
    edgeKind: "INFERRED",
    evidenceCount: 1,
    explanation: { kind: "SHARED_PHONE" },
  });
  const inferred = buildRelationshipExplanation({
    edge: inferredEdge,
    sourceNode: person("person-k", "นายกิตติศักดิ์ ทดสอบระบบ"),
    targetNode: person("person-b", "นายบี"),
    neighborhood: { nodes: [...graph.nodes, person("person-b", "นายบี")], edges: [...graph.edges, inferredEdge] },
    language: "th",
  });
  assert.equal(inferred.classification, "INFERRED");
  assert.equal(inferred.whyHeadingKind, "INFERRED_PERSONS");
  assert.equal(inferred.sentence, "ระบบพบว่าบุคคลทั้งสองมีข้อมูลร่วมกัน");
  assert.equal(inferred.inferredDisclaimer, "เป็นความเชื่อมโยงจากข้อมูลร่วม ไม่ใช่การยืนยันความสัมพันธ์ระหว่างบุคคล");
  assert.equal(inferred.inferredFacts.includes("ใช้หมายเลขที่เชื่อมโยงร่วมกัน"), false);
  assert.doesNotMatch(allStoryText(inferred), /โทรหา|สนทนา|CDR/);
});

test("INFERRED shared facts appear only when loaded DIRECT relationships support them", () => {
  const a = person("p-a", "นายเอ");
  const b = person("p-b", "นายบี");
  const sharedPhone = phone("ph-shared", "0811111111", 2);
  const inferredEdge = edge({
    id: "inf:shared",
    source: "p-a",
    target: "p-b",
    relationshipType: "SHARED_PHONE",
    edgeKind: "INFERRED",
    explanation: { kind: "SHARED_PHONE" },
  });
  const model = buildRelationshipExplanation({
    edge: inferredEdge,
    sourceNode: a,
    targetNode: b,
    neighborhood: {
      nodes: [a, b, sharedPhone],
      edges: [
        inferredEdge,
        edge({ id: "pp:a", source: "p-a", target: "ph-shared", relationshipType: "PERSON_PHONE" }),
        edge({ id: "pp:b", source: "p-b", target: "ph-shared", relationshipType: "PERSON_PHONE" }),
      ],
    },
    language: "th",
  });
  assert.deepEqual(model.inferredFacts, ["ใช้หมายเลขที่เชื่อมโยงร่วมกัน"]);
});

test("unsupported provenance uses the safe fallback and never invents a fact", () => {
  const fallback = "ระบบพบความเชื่อมโยงนี้จากข้อมูลที่มีอยู่ แต่ยังไม่มีรายละเอียดเพียงพอสำหรับอธิบายเพิ่มเติม";
  assert.equal(explanationContainsForbiddenClaim(fallback), false);
});

test("SIM / DEVICE / VEHICLE explanations are case-recorded wording", () => {
  const graph = demoNeighborhood();
  const simModel = buildRelationshipExplanation({
    edge: graph.edges.find((item) => item.id === "cs:1")!,
    sourceNode: graph.nodes.find((n) => n.id === "case-003")!,
    targetNode: graph.nodes.find((n) => n.id === "sim-1")!,
    neighborhood: graph,
    language: "th",
  });
  const deviceModel = buildRelationshipExplanation({
    edge: graph.edges.find((item) => item.id === "cd:1")!,
    sourceNode: graph.nodes.find((n) => n.id === "case-003")!,
    targetNode: graph.nodes.find((n) => n.id === "dev-1")!,
    neighborhood: graph,
    language: "th",
  });
  const vehicleModel = buildRelationshipExplanation({
    edge: graph.edges.find((item) => item.id === "cv:1")!,
    sourceNode: graph.nodes.find((n) => n.id === "case-003")!,
    targetNode: graph.nodes.find((n) => n.id === "veh-1")!,
    neighborhood: graph,
    language: "th",
  });
  assert.match(simModel.sentence, /SIM นี้ถูกบันทึกในคดี DI-TEST-003/);
  assert.match(deviceModel.sentence, /อุปกรณ์นี้ถูกบันทึกในคดี DI-TEST-003/);
  assert.match(vehicleModel.sentence, /ยานพาหนะนี้ถูกบันทึกในคดี DI-TEST-003/);
});

test("PERSON_DEVICE without sourceCaseIds uses unspecified-case wording", () => {
  const personNode = person("p1", "นายเอ");
  const deviceNode = device("d1", "iPhone");
  const rel = edge({
    id: "pd:x",
    source: "p1",
    target: "d1",
    relationshipType: "PERSON_DEVICE",
    sourceCaseIds: [],
  });
  const model = buildRelationshipExplanation({
    edge: rel,
    sourceNode: personNode,
    targetNode: deviceNode,
    neighborhood: { nodes: [personNode, deviceNode], edges: [rel] },
    language: "th",
  });
  assert.match(model.sentence, /ยังระบุคดีที่พบไม่ได้/);
});

test("shared entities between CASE and PERSON are DIRECT neighbors of both, deduped by id", () => {
  const graph = demoNeighborhood();
  const shared = sharedEntitiesBetween(graph, "case-003", "person-k");
  assert.deepEqual(
    shared.map((item) => item.id).sort(),
    ["dev-1", "ph-1001", "ph-1005", "sim-1", "veh-1"]
  );
  const model = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
  });
  assert.equal(model.sharedEntities.length, 5);
  assert.equal(new Set(model.sharedEntities.map((item) => item.id)).size, 5);
  assert.ok(model.sharedEntities.every((item) => item.foundInThisCase));
  const phoneNode = model.sharedEntities.find((item) => item.id === "ph-1001")!;
  assert.equal(phoneNode.caseCount, 3);
});

test("nearby but unlinked entities are not treated as shared", () => {
  const graph = demoNeighborhood();
  const stray = phone("ph-stray", "0999999999", 9);
  graph.nodes.push(stray);
  graph.edges.push(edge({ id: "pp:stray", source: "person-k", target: "ph-stray", relationshipType: "PERSON_PHONE" }));
  const shared = sharedEntitiesBetween(graph, "case-003", "person-k");
  assert.equal(shared.some((item) => item.id === "ph-stray"), false);
});

test("masking uses the already-safe node label and never a raw UUID", () => {
  assert.equal(safeDisplayLabel("081-xxx-5678"), "081-xxx-5678");
  assert.equal(safeDisplayLabel("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), null);
  const maskedPhone = phone("ph-1", "081-xxx-5678", 2, "081-xxx-5678");
  const c = caseNode("c1", "DI-1");
  const rel = edge({ id: "cp:m", source: "c1", target: "ph-1", relationshipType: "CASE_PHONE", sourceCaseIds: ["c1"] });
  const model = buildRelationshipExplanation({
    edge: rel,
    sourceNode: c,
    targetNode: maskedPhone,
    neighborhood: { nodes: [c, maskedPhone], edges: [rel] },
    language: "th",
  });
  assert.equal(model.recurrence?.label, "081-xxx-5678");
  assert.equal(model.sentence.includes("aaaaaaaa-bbbb"), false);
});

test("safe drill-down URLs reuse canonical entity routes", () => {
  assert.equal(drugEntityDetailPath("CASE", "case-003"), "/drug-intelligence/cases/case-003");
  assert.equal(drugEntityDetailPath("PERSON", "person-k"), "/drug-intelligence/persons/person-k");
  assert.equal(drugEntityDetailPath("PHONE", "ph-1001"), "/drug-intelligence/phones/ph-1001");
});

test("clicking a connected node while focused on the counterpart opens that edge, not page 2", () => {
  const graph = demoNeighborhood();
  const found = connectingEdgeForExplanationClick({
    clickedId: "person-k",
    focusId: "case-003",
    selectedNodeId: null,
    selectedEdge: null,
    edges: graph.edges,
  });
  assert.equal(found?.id, "pc:1");
  assert.equal(findConnectingEdge(graph.edges, "case-003", "person-k")?.relationshipType, "PERSON_CASE");
});

test("Investigation Trail URL parsing is unchanged by explainability", () => {
  const trail = parseNetworkInvestigationTrail(new URLSearchParams("from=CASE:case-003&fromLabels=DI-TEST-003"));
  assert.equal(trail[0]?.id, "case-003");
  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /appendNetworkTrailStep\(investigationTrail/);
  assert.match(page, /expandFromNode\(node\)/);
});

test("edge selection highlights the two endpoints and dims unrelated nodes", () => {
  const graph = demoNeighborhood();
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(graph, (key) => key, null, "pc:1", {
    layoutMode: "PERSON_CENTERED",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
  });
  assert.equal(flowEdges.find((item) => item.id === "pc:1")?.selected, true);
  assert.equal(flowNodes.find((item) => item.id === "person-k")?.selected, true);
  assert.equal(flowNodes.find((item) => item.id === "case-003")?.selected, true);
  assert.equal(flowNodes.find((item) => item.id === "person-k")?.data.dimmed, false);
  assert.equal(flowNodes.find((item) => item.id === "ph-1001")?.data.dimmed, true);
  assert.ok((flowEdges.find((item) => item.id === "cp:1001")?.style.opacity ?? 1) >= 0.4);
});

test("panel close keeps selectedEdge so Analyst waypoint handles survive", () => {
  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /onClose=\{\(\) => setEdgeDrawerOpen\(false\)\}/);
  assert.match(page, /<Drawer open=\{Boolean\(selectedEdge\) && edgeDrawerOpen\}/);
});

test("initial Network load stays one neighborhood request; explanation uses loaded graph only", () => {
  const page = read("app/drug-intelligence/network/page.tsx");
  const neighborhoodHooks = page.match(/useDrugNetworkNeighborhood\(/g) ?? [];
  assert.equal(neighborhoodHooks.length, 1);
  const detail = read("components/drug_intelligence/drug_network_edge_detail.tsx");
  assert.doesNotMatch(detail, /fetch\(|useQuery|listCase/);
  assert.match(detail, /buildRelationshipExplanation/);
  assert.match(page, /connectingEdgeForExplanationClick/);
  assert.match(page, /di\.network\.explainHoverHint/);
});

test("context-aware primary actions change when the current focus is the person", () => {
  const graph = demoNeighborhood();
  const onCase = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
    focusId: "case-003",
  });
  const onPerson = buildRelationshipExplanation({
    edge: graph.edges[0]!,
    sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
    targetNode: graph.nodes.find((n) => n.id === "case-003")!,
    neighborhood: graph,
    language: "th",
    focusId: "person-k",
  });
  assert.deepEqual(
    onCase.actions.filter((item) => item.prominence === "primary").map((item) => item.label),
    ["โฟกัสที่นายกิตติศักดิ์ ทดสอบระบบ", "เปิดคดี DI-TEST-003"]
  );
  assert.equal(onCase.actions.some((item) => item.prominence === "secondary" && item.label === "เปิดโปรไฟล์บุคคล"), true);
  assert.deepEqual(
    onPerson.actions.filter((item) => item.prominence === "primary").map((item) => item.label),
    ["เปิดโปรไฟล์บุคคล", "โฟกัสที่คดี DI-TEST-003"]
  );
  assert.equal(onPerson.actions.some((item) => item.label === "โฟกัสที่นายกิตติศักดิ์ ทดสอบระบบ"), false);
});

test("no CDR / call / ownership / risk / confidence claims in explainability copy", () => {
  const detail = read("components/drug_intelligence/drug_network_edge_detail.tsx");
  const dict = read("lib/i18n/dictionary.ts");
  const explainDict = dict.slice(dict.indexOf('"di.network.explainTitle"'), dict.indexOf('"di.network.edgeDirect"'));
  assert.doesNotMatch(detail, /โทรหา|สนทนา|CDR|call history|เป็นเจ้าของโทรศัพท์|จุดเสี่ยง|ความเสี่ยงสูง/);
  assert.doesNotMatch(explainDict, /โทรหา|สนทนา|CDR|call history|เป็นเจ้าของโทรศัพท์|จุดเสี่ยง|บุคคลสำคัญ|เบอร์ต้องสงสัย|ความเสี่ยงสูง/);
  const graph = demoNeighborhood();
  for (const item of graph.edges) {
    const source = graph.nodes.find((node) => node.id === item.source)!;
    const target = graph.nodes.find((node) => node.id === item.target)!;
    const model = buildRelationshipExplanation({
      edge: item,
      sourceNode: source,
      targetNode: target,
      neighborhood: graph,
      language: "th",
    });
    assert.equal(explanationContainsForbiddenClaim(allStoryText(model)), false, item.relationshipType);
  }
});

test("edge detail renders CASE↔PERSON story hierarchy without a second request", () => {
  const graph = demoNeighborhood();
  const html = renderToStaticMarkup(
    createElement(DrugNetworkEdgeDetail, {
      edge: graph.edges[0]!,
      sourceNode: graph.nodes.find((n) => n.id === "person-k")!,
      targetNode: graph.nodes.find((n) => n.id === "case-003")!,
      neighborhood: graph,
      focusId: "case-003",
    })
  );
  assert.match(html, /ทำไมถึงเชื่อมกัน\?/);
  assert.match(html, /นายกิตติศักดิ์ ทดสอบระบบ/);
  assert.match(html, /DI-TEST-003/);
  assert.match(html, /ถูกบันทึกเป็นผู้ถูกจับกุมในคดี DI-TEST-003/);
  assert.match(html, /ข้อมูลที่บันทึกโดยตรง/);
  assert.match(html, /คดีนี้พบข้อมูลอะไรเกี่ยวกับบุคคลนี้\?/);
  assert.match(html, /ข้อมูลที่พบเชื่อมโยงจากคดีนี้/);
  assert.match(html, /เบอร์โทร 2/);
  assert.match(html, /จุดเชื่อมไปยังคดีอื่น/);
  assert.match(html, /พบซ้ำข้ามคดี/);
  assert.match(html, /0900001001/);
  assert.match(html, /พบรวม 3 คดี/);
  assert.match(html, /ข้อมูลอื่นในคดีนี้/);
  assert.match(html, /โฟกัสที่นายกิตติศักดิ์ ทดสอบระบบ/);
  assert.match(html, /เปิดคดี DI-TEST-003/);
  assert.match(html, /เปิดโปรไฟล์บุคคล/);
  assert.doesNotMatch(html, /เหตุผลที่เชื่อมโยง/);
  assert.doesNotMatch(html, /โทรหา|เจ้าของ|จุดเสี่ยง|ความเสี่ยงสูง|ดูคดีที่เกี่ยวข้อง/);
  assert.doesNotMatch(html, /เบอร์ของนาย|รถของนาย/);
});
