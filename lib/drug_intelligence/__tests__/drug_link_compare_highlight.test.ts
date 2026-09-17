/**
 * LC-2C.1 Compare Highlight Mode — bounded URL context, classification,
 * adapter emphasis, and fail-safe. Presentation only; no graph writes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "path";

import { translate } from "@/lib/i18n/dictionary";
import { applyNetworkSearchParamPatch } from "@/lib/drug_intelligence/drug_network_route_navigation";
import { buildLinkCompareHref, linkCompareInspectNetworkHref, linkCompareNetworkFocusHref, parseLinkCompareReturnTo } from "@/lib/drug_intelligence/drug_link_compare_client_state";
import { getSafeReturnTo } from "@/lib/ui/return_context";
import { buildDrugNetworkFlowGraph, type BuildFlowGraphOptions } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import {
  COMPARE_HIGHLIGHT_CONTEXT_EDGE_OPACITY,
  COMPARE_HIGHLIGHT_PATH_STROKE_WIDTH,
  buildCompareHighlightFromResult,
  buildComparePathExplanation,
  classifyCompareHighlightNode,
  compareHighlightHasC,
  compareHighlightGraphNodeIds,
  compareHighlightIdentityKey,
  compareHighlightPathEdgeIds,
  compareInspectGraphNodeId,
  formatCompareConnectingSummary,
  formatCompareHopLine,
  isFactualComparePathEdge,
  parseCompareHighlightSearchParams,
  parseCompareInspectSlot,
  serializeCompareHighlightSearchParams,
  withCompareHighlightParams,
  type LinkCompareHighlightContext,
} from "@/lib/drug_intelligence/drug_link_compare_highlight";
import type {
  DrugGraphEdge,
  DrugGraphNeighborhoodResponse,
  DrugGraphNode,
  DrugLinkComparePairDto,
  DrugLinkCompareResponse,
} from "@/lib/drug_intelligence/drug_intelligence_client";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const DEFAULT_OPTIONS: BuildFlowGraphOptions = { layoutMode: "PERSON_CENTERED", labelMode: "ALL", nodeDensity: "STANDARD" };

const personA = { entityType: "PERSON" as const, entityId: "p-kittisak", label: "นายกิตติศักดิ์ ทดสอบระบบ", caseCount: 3 };
const vehicleB = { entityType: "VEHICLE" as const, entityId: "v-9009", label: "TEST-9009", caseCount: 1 };
const phoneC = { entityType: "PHONE" as const, entityId: "ph-1001", label: "66900001001", caseCount: 1 };

function graphNode(id: string, type: DrugGraphNode["type"], label: string): DrugGraphNode {
  return {
    id,
    type,
    label,
    secondaryLabel: null,
    maskedLabel: type === "PHONE" ? "xxx-xxx-0001" : null,
    metadata:
      type === "PERSON"
        ? { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false }
        : type === "CASE"
          ? { type: "CASE", caseNumber: label, status: "OPEN", arrestDate: null, province: null, reportingUnitText: null }
          : type === "VEHICLE"
            ? { type: "VEHICLE", registrationProvince: null, brand: null, model: null, color: null }
            : type === "PHONE"
              ? { type: "PHONE", carrier: null }
              : type === "SIM"
                ? { type: "SIM", imsi: null, carrier: null }
                : type === "DEVICE"
                  ? { type: "DEVICE", brand: null, model: null }
                  : { type: "LOCATION", province: null, district: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function directEdge(id: string, source: string, target: string, relationshipType: DrugGraphEdge["relationshipType"]): DrugGraphEdge {
  return {
    id,
    source,
    target,
    relationshipType,
    edgeKind: "DIRECT",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: ["c-003"],
    explanation: { kind: "DIRECT_LINK" },
  };
}

function neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p-kittisak" },
    truncated: false,
    nodes: [
      graphNode("p-kittisak", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      graphNode("v-9009", "VEHICLE", "TEST-9009"),
      graphNode("ph-1001", "PHONE", "66900001001"),
      graphNode("c-003", "CASE", "DI-TEST-003"),
      graphNode("c-001", "CASE", "DI-TEST-001"),
      graphNode("c-002", "CASE", "DI-TEST-002"),
      graphNode("ph-other", "PHONE", "other-phone"),
      graphNode("sim-1", "SIM", "sim-1"),
      graphNode("dev-1", "DEVICE", "device-1"),
    ],
    edges: [
      directEdge("e-pv", "p-kittisak", "v-9009", "PERSON_VEHICLE"),
      directEdge("e-pp", "p-kittisak", "ph-1001", "PERSON_PHONE"),
      directEdge("e-pc3", "p-kittisak", "c-003", "PERSON_CASE"),
      directEdge("e-cv", "c-003", "v-9009", "CASE_VEHICLE"),
      directEdge("e-cph", "c-003", "ph-1001", "CASE_PHONE"),
      directEdge("e-pc1", "p-kittisak", "c-001", "PERSON_CASE"),
      directEdge("e-pc2", "p-kittisak", "c-002", "PERSON_CASE"),
      directEdge("e-other", "c-001", "ph-other", "CASE_PHONE"),
      {
        id: "e-shared",
        source: "p-kittisak",
        target: "v-9009",
        relationshipType: "SHARED_CASE",
        edgeKind: "INFERRED",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: ["c-003"],
        explanation: { kind: "SHARED_CASES", count: 1 },
      },
    ],
  };
}

function pair(
  left: "A" | "B" | "C",
  right: "A" | "B" | "C",
  kind: DrugLinkComparePairDto["connectionKind"],
  steps: Array<{ id: string; type: DrugGraphNode["type"] }>
): DrugLinkComparePairDto {
  return {
    left,
    right,
    connectionKind: kind,
    hopCount: Math.max(0, steps.length - 1),
    shortestPath:
      steps.length > 0
        ? {
            hopCount: Math.max(0, steps.length - 1),
            steps: steps.map((step, index) => ({
              node: graphNode(step.id, step.type, step.id),
              viaEdge: index === 0 ? null : directEdge(`e-${left}${right}-${index}`, steps[index - 1]!.id, step.id, "PERSON_CASE"),
            })),
          }
        : null,
    sharedCases: [],
    sharedEntities: [],
    truncated: false,
    absenceExplanationKey: kind === "NONE_KNOWN" ? "di.linkCompare.noneKnown" : null,
  };
}

function demoResult(): DrugLinkCompareResponse {
  return {
    interpretation: { kind: "QUERY" },
    slots: [
      { key: "A", kind: "DATABASE", entityType: "PERSON", entityId: "p-kittisak", label: "นายกิตติศักดิ์ ทดสอบระบบ", caseCount: 3 },
      { key: "B", kind: "DATABASE", entityType: "VEHICLE", entityId: "v-9009", label: "TEST-9009", caseCount: 1 },
      { key: "C", kind: "DATABASE", entityType: "PHONE", entityId: "ph-1001", label: "66900001001", caseCount: 1 },
    ],
    pairs: [
      pair("A", "B", "DIRECT", [
        { id: "p-kittisak", type: "PERSON" },
        { id: "v-9009", type: "VEHICLE" },
      ]),
      pair("A", "C", "DIRECT", [
        { id: "p-kittisak", type: "PERSON" },
        { id: "ph-1001", type: "PHONE" },
      ]),
      pair("B", "C", "INDIRECT", [
        { id: "v-9009", type: "VEHICLE" },
        { id: "c-003", type: "CASE" },
        { id: "ph-1001", type: "PHONE" },
      ]),
    ],
    tripleIntersection: { cases: [{ caseId: "c-003", caseNumber: "DI-TEST-003", label: "DI-TEST-003" }], entities: [] },
    bounds: { maxEntities: 3, maxPathDepth: 3, maxVisited: 150 },
  };
}

function demoContext(): LinkCompareHighlightContext {
  const context = buildCompareHighlightFromResult({ A: personA, B: vehicleB, C: phoneC }, demoResult());
  assert.ok(context);
  return context;
}

test("normal Network has no compare-highlight mode", () => {
  const parsed = parseCompareHighlightSearchParams(new URLSearchParams("focusType=PERSON&focusId=p-kittisak"));
  assert.equal(parsed, null);
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, null, null, DEFAULT_OPTIONS);
  assert.ok(flowNodes.every((node) => node.data.compareRole == null && node.data.compareJunction === false && node.data.dimmed === false));
  assert.ok(flowEdges.every((edge) => (edge.style.opacity ?? 1) === 1));
  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /parseCompareHighlightSearchParams/);
  assert.match(page, /boardId \? null/);
  assert.doesNotMatch(page, /querySignature[\s\S]{0,200}compareHighlight/);
});

test("A/B compare activates compare context without labels", () => {
  const two = buildCompareHighlightFromResult({ A: personA, B: vehicleB }, {
    ...demoResult(),
    pairs: [demoResult().pairs[0]!],
    tripleIntersection: null,
  });
  assert.ok(two);
  assert.equal(compareHighlightHasC(two), false);
  const params = serializeCompareHighlightSearchParams(two);
  assert.equal(params.get("cmpA"), "PERSON:p-kittisak");
  assert.equal(params.get("cmpB"), "VEHICLE:v-9009");
  assert.equal(params.get("cmpC"), null);
  assert.doesNotMatch(params.toString(), /กิตติศักดิ์|TEST-9009|label=/);
  const href = linkCompareNetworkFocusHref("PERSON", personA.entityId, buildLinkCompareHref({ A: personA, B: vehicleB }), two);
  const qs = new URLSearchParams(href.split("?")[1] ?? "");
  assert.equal(qs.get("cmpA"), "PERSON:p-kittisak");
  assert.equal(qs.get("cmpB"), "VEHICLE:v-9009");
  assert.doesNotMatch(href, /กิตติศักดิ์/);
});

test("A/B/C compare activates compare context and includes the case path node", () => {
  const three = demoContext();
  assert.equal(compareHighlightHasC(three), true);
  assert.ok(three.pathNodes.some((node) => node.entityType === "CASE" && node.entityId === "c-003"));
  const params = serializeCompareHighlightSearchParams(three);
  assert.equal(params.get("cmpC"), "PHONE:ph-1001");
  assert.match(String(params.get("cmpP")), /CASE:c-003/);
  assert.doesNotMatch(params.toString(), /66900001001|DI-TEST-003/);
});

test("compared endpoints classified correctly", () => {
  const context = demoContext();
  assert.deepEqual(classifyCompareHighlightNode({ id: "p-kittisak", type: "PERSON" }, context), {
    role: "endpoint",
    slot: "A",
    junction: false,
  });
  assert.deepEqual(classifyCompareHighlightNode({ id: "v-9009", type: "VEHICLE" }, context), {
    role: "endpoint",
    slot: "B",
    junction: false,
  });
  assert.deepEqual(classifyCompareHighlightNode({ id: "ph-1001", type: "PHONE" }, context), {
    role: "endpoint",
    slot: "C",
    junction: false,
  });
});

test("intermediate path node classified correctly", () => {
  const context = demoContext();
  assert.deepEqual(classifyCompareHighlightNode({ id: "c-003", type: "CASE" }, context), {
    role: "path",
    slot: null,
    junction: true,
  });
});

test("factual path edges classified correctly", () => {
  const context = demoContext();
  const ids = compareHighlightPathEdgeIds(neighborhood().edges, neighborhood().nodes, context);
  assert.ok(ids.has("e-pv"));
  assert.ok(ids.has("e-pp"));
  assert.ok(ids.has("e-cv"));
  assert.ok(ids.has("e-cph"));
});

test("unrelated nodes are context/dimmed", () => {
  const context = demoContext();
  assert.equal(classifyCompareHighlightNode({ id: "c-001", type: "CASE" }, context).role, "context");
  assert.equal(classifyCompareHighlightNode({ id: "sim-1", type: "SIM" }, context).role, "context");
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
  });
  const case001 = flowNodes.find((node) => node.id === "c-001")!;
  const person = flowNodes.find((node) => node.id === "p-kittisak")!;
  const junction = flowNodes.find((node) => node.id === "c-003")!;
  assert.equal(case001.data.compareRole, "context");
  assert.equal(case001.data.dimmed, true);
  assert.equal(case001.data.stronglyDimmed, true);
  assert.equal(person.data.compareRole, "endpoint");
  assert.equal(person.data.dimmed, false);
  assert.equal(junction.data.compareRole, "path");
  assert.equal(junction.data.compareJunction, true);
  assert.equal(junction.data.dimmed, false);
});

test("unrelated edges are context/dimmed", () => {
  const context = demoContext();
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
  });
  const pathEdge = flowEdges.find((edge) => edge.id === "e-pv")!;
  const other = flowEdges.find((edge) => edge.id === "e-pc1")!;
  assert.equal(pathEdge.style.opacity, 1);
  assert.equal(pathEdge.style.strokeWidth, COMPARE_HIGHLIGHT_PATH_STROKE_WIDTH);
  assert.equal(other.style.opacity, COMPARE_HIGHLIGHT_CONTEXT_EDGE_OPACITY);
  assert.ok((other.style.strokeWidth ?? 1.5) < COMPARE_HIGHLIGHT_PATH_STROKE_WIDTH);
});

test("SHARED_* is never treated as factual highlighted path", () => {
  const context = demoContext();
  const shared = neighborhood().edges.find((edge) => edge.id === "e-shared")!;
  const pathNodeIds = compareHighlightGraphNodeIds(neighborhood().nodes, context).pathIds;
  assert.equal(isFactualComparePathEdge(shared, pathNodeIds), false);
  const pathIds = compareHighlightPathEdgeIds(neighborhood().edges, neighborhood().nodes, context);
  assert.equal(pathIds.has("e-shared"), false);
  const { flowEdges } = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
  });
  const inferred = flowEdges.find((edge) => edge.id === "e-shared")!;
  assert.equal(inferred.style.opacity, COMPARE_HIGHLIGHT_CONTEXT_EDGE_OPACITY);
  assert.equal(inferred.style.strokeDasharray, "5 5");
});

test("แสดงทั้งหมด restores normal visual emphasis and เน้นเส้นทาง restores compare emphasis", () => {
  const context = demoContext();
  const highlighted = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
  });
  const shownAll = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: false,
  });
  assert.ok(highlighted.flowNodes.some((node) => node.data.compareRole === "context" && node.data.stronglyDimmed));
  assert.ok(shownAll.flowNodes.every((node) => node.data.compareRole == null && node.data.compareJunction === false && node.data.dimmed === false));
  assert.ok(shownAll.flowEdges.every((edge) => (edge.style.opacity ?? 1) === 1));
  assert.equal(translate("di.network.compareHighlightOn", "th"), "เน้นเส้นทาง");
  assert.equal(translate("di.network.compareHighlightAll", "th"), "แสดงทั้งหมด");
  assert.equal(translate("di.network.compareHighlightThree", "th"), "กำลังแสดงเหตุผลความเชื่อมโยง A • B • C");
  assert.equal(translate("di.network.compareHighlightTwo", "th"), "กำลังแสดงเหตุผลความเชื่อมโยง A • B");
  assert.equal(translate("di.network.compareShowAllHint", "th"), "ผังกำลังแสดงบริบทรอบข้างทั้งหมด ไม่ได้เน้นเส้นทางเปรียบเทียบ");
});

test("return to Compare preserves A/B and A/B/C", () => {
  const twoHref = linkCompareNetworkFocusHref(
    "PERSON",
    personA.entityId,
    buildLinkCompareHref({ A: personA, B: vehicleB }),
    buildCompareHighlightFromResult({ A: personA, B: vehicleB }, { ...demoResult(), pairs: [demoResult().pairs[0]!] })
  );
  const twoReturn = getSafeReturnTo(new URLSearchParams(twoHref.split("?")[1] ?? ""));
  const twoSlots = parseLinkCompareReturnTo(twoReturn);
  assert.equal(twoSlots?.A?.entityId, personA.entityId);
  assert.equal(twoSlots?.B?.entityId, vehicleB.entityId);
  assert.equal(twoSlots?.C, null);

  const threeHref = linkCompareNetworkFocusHref(
    "PHONE",
    phoneC.entityId,
    buildLinkCompareHref({ A: personA, B: vehicleB, C: phoneC }),
    demoContext()
  );
  const threeReturn = getSafeReturnTo(new URLSearchParams(threeHref.split("?")[1] ?? ""));
  const threeSlots = parseLinkCompareReturnTo(threeReturn);
  assert.equal(threeSlots?.A?.entityId, personA.entityId);
  assert.equal(threeSlots?.B?.entityId, vehicleB.entityId);
  assert.equal(threeSlots?.C?.entityId, phoneC.entityId);
});

test("malformed compare context fails safe", () => {
  assert.equal(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON")), null);
  assert.equal(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON:p1&cmpB=PHONE")), null);
  assert.equal(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=LOCATION:loc-1&cmpB=VEHICLE:v-9009")), null);
  assert.equal(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON:p1&cmpB=PERSON:p1")), null);
  assert.equal(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON:p1&cmpB=VEHICLE:v1&cmpC=PHONE")), null);
  assert.equal(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON:p1&cmpB=VEHICLE:v1&cmpP=NOPE:x")), null);
  assert.equal(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON:p1&cmpB=VEHICLE:v1&cmpP=CASE:c-003,BAD")), null);
  const parsed = parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON:p1&cmpB=VEHICLE:v1&cmpP=CASE:c-003"));
  assert.equal(parsed?.A.entityId, "p1");
  assert.ok(parsed?.pathNodes.some((node) => node.entityId === "c-003"));
});

test("normal Network filters/trail behavior unchanged and compare params survive same-route patches", () => {
  const compare = "/drug-intelligence/network/compare?aType=PERSON&aId=p-kittisak&bType=VEHICLE&bId=v-9009&cType=PHONE&cId=ph-1001";
  const current = new URLSearchParams({
    focusType: "PERSON",
    focusId: "p-kittisak",
    depth: "2",
    view: "by-depth",
    returnTo: compare,
    cmpA: "PERSON:p-kittisak",
    cmpB: "VEHICLE:v-9009",
    cmpC: "PHONE:ph-1001",
    cmpP: "CASE:c-003",
  });
  const after = applyNetworkSearchParamPatch(current, { depth: "1", relationshipTypes: "PERSON_CASE" });
  assert.equal(after.get("returnTo"), compare);
  assert.equal(after.get("cmpA"), "PERSON:p-kittisak");
  assert.equal(after.get("cmpC"), "PHONE:ph-1001");
  assert.equal(after.get("cmpP"), "CASE:c-003");
  assert.equal(after.get("depth"), "1");
  const page = read("app/drug-intelligence/network/page.tsx");
  const resetBody = page.slice(page.indexOf("function handleBackToStart"), page.indexOf("function exitPathView"));
  assert.doesNotMatch(resetBody, /network\/compare|LINK_COMPARE_PATH/);
  assert.match(page, /di\.network\.resetToFocus/);
  assert.match(page, /DrugNetworkCompareHighlightBar/);
});

test("no graph/data writes and masking/RBAC unchanged", () => {
  const highlight = read("lib/drug_intelligence/drug_link_compare_highlight.ts");
  const result = read("components/drug_intelligence/drug_link_compare_result.tsx");
  const page = read("app/drug-intelligence/network/page.tsx");
  const adapter = read("lib/drug_intelligence/drug_network_graph_flow_adapter.ts");
  assert.doesNotMatch(highlight, /requestPost|prisma|create\(|update\(/);
  assert.doesNotMatch(adapter, /requestPost|getNetworkPath|getLinkCompare/);
  assert.match(page, /can\(\"drug\.read\"\)/);
  assert.doesNotMatch(highlight, /label=/);
  assert.doesNotMatch(result, /unmask|normalizedNumber/);
  assert.doesNotMatch(translate("di.network.compareHighlightThree", "th"), /เจ้าของ|CDR|โทรหา/);
  const href = withCompareHighlightParams("/drug-intelligence/network?focusType=PERSON&focusId=p-kittisak", demoContext());
  assert.doesNotMatch(href, /กิตติศักดิ์|66900001001|TEST-9009/);
});

test("LC-2C.2 explanation fails safe when neighborhood nodes/pairs are missing", () => {
  const partial = { ...demoContext(), pairs: undefined as unknown as [] };
  const explanation = buildComparePathExplanation(partial, undefined, undefined);
  assert.equal(explanation.slotCount, 3);
  assert.equal(explanation.pairs.length, 0);
  assert.equal(explanation.endpoints[0]?.slot, "A");
  assert.doesNotThrow(() => classifyCompareHighlightNode({ id: "c-003", type: "CASE" }, partial));
});

function tTh(key: Parameters<typeof translate>[0]): string {
  return translate(key, "th");
}

function twoBoxDirectContext(): LinkCompareHighlightContext {
  const context = buildCompareHighlightFromResult(
    { A: personA, B: vehicleB },
    { ...demoResult(), pairs: [demoResult().pairs[0]!], tripleIntersection: null }
  );
  assert.ok(context);
  return context;
}

function twoBoxIndirectContext(): LinkCompareHighlightContext {
  const context = buildCompareHighlightFromResult(
    { A: vehicleB, B: phoneC },
    {
      ...demoResult(),
      slots: [
        { key: "A", kind: "DATABASE", entityType: "VEHICLE", entityId: "v-9009", label: "TEST-9009", caseCount: 1 },
        { key: "B", kind: "DATABASE", entityType: "PHONE", entityId: "ph-1001", label: "66900001001", caseCount: 1 },
      ],
      pairs: [
        pair("A", "B", "INDIRECT", [
          { id: "v-9009", type: "VEHICLE" },
          { id: "c-003", type: "CASE" },
          { id: "ph-1001", type: "PHONE" },
        ]),
      ],
      tripleIntersection: null,
    }
  );
  assert.ok(context);
  return context;
}

function noneKnownContext(): LinkCompareHighlightContext {
  const context = buildCompareHighlightFromResult(
    { A: personA, B: vehicleB },
    { ...demoResult(), pairs: [pair("A", "B", "NONE_KNOWN", [])], tripleIntersection: null }
  );
  assert.ok(context);
  return context;
}

test("LC-2C.2 A: 2-box DIRECT explanation", () => {
  const graph = neighborhood();
  const explanation = buildComparePathExplanation(twoBoxDirectContext(), graph.nodes, graph.edges);
  assert.equal(explanation.slotCount, 2);
  assert.equal(explanation.pairs.length, 1);
  assert.equal(explanation.pairs[0]!.connectionKind, "DIRECT");
  assert.equal(formatCompareHopLine(explanation.pairs[0]!, tTh), "เชื่อมโยงโดยตรง");
  assert.equal(explanation.endpoints[0]!.label, "นายกิตติศักดิ์ ทดสอบระบบ");
  assert.equal(explanation.endpoints[1]!.label, "TEST-9009");
  assert.equal(explanation.connectingCases.length, 0);
  assert.equal(explanation.bothInConnectingCase, false);
});

test("LC-2C.2 B: 2-box INDIRECT hop explanation", () => {
  const graph = neighborhood();
  const context = twoBoxIndirectContext();
  const explanation = buildComparePathExplanation(context, graph.nodes, graph.edges);
  assert.equal(explanation.pairs[0]!.connectionKind, "INDIRECT");
  assert.equal(explanation.pairs[0]!.intermediaryCount, 1);
  assert.equal(formatCompareHopLine(explanation.pairs[0]!, tTh), "เชื่อมโยงผ่าน 1 จุดกลาง: DI-TEST-003");
  assert.equal(explanation.connectingCases[0]?.label, "DI-TEST-003");
  assert.equal(explanation.bothInConnectingCase, true);
  assert.match(formatCompareConnectingSummary(explanation, tTh).join("\n"), /พบทั้งสองรายการในคดี DI-TEST-003/);
});

test("LC-2C.2 C: 3-box demo explanation", () => {
  const graph = neighborhood();
  const explanation = buildComparePathExplanation(demoContext(), graph.nodes, graph.edges);
  assert.equal(explanation.slotCount, 3);
  assert.equal(explanation.endpoints.map((row) => row.label).join("|"), "นายกิตติศักดิ์ ทดสอบระบบ|TEST-9009|66900001001");
  const byPair = new Map(explanation.pairs.map((pair) => [`${pair.left}${pair.right}`, pair]));
  assert.equal(formatCompareHopLine(byPair.get("AB")!, tTh), "เชื่อมโยงโดยตรง");
  assert.equal(formatCompareHopLine(byPair.get("AC")!, tTh), "เชื่อมโยงโดยตรง");
  assert.equal(formatCompareHopLine(byPair.get("BC")!, tTh), "เชื่อมโยงผ่าน 1 จุดกลาง: DI-TEST-003");
  assert.equal(explanation.allThreeInConnectingCase, true);
  assert.match(formatCompareConnectingSummary(explanation, tTh).join("\n"), /พบทั้ง 3 รายการในคดี DI-TEST-003/);
});

test("LC-2C.2 D: DI-TEST-003 is connecting evidence", () => {
  const graph = neighborhood();
  const explanation = buildComparePathExplanation(demoContext(), graph.nodes, graph.edges);
  assert.deepEqual(
    explanation.connectingCases.map((row) => row.label),
    ["DI-TEST-003"]
  );
  assert.match(formatCompareConnectingSummary(explanation, tTh).join("\n"), /พบจุดเชื่อมร่วม 1 คดี: DI-TEST-003/);
  const { flowNodes } = buildDrugNetworkFlowGraph(graph, (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: demoContext(),
    compareHighlightEmphasize: true,
  });
  const junction = flowNodes.find((node) => node.id === "c-003")!;
  const otherCase = flowNodes.find((node) => node.id === "c-001")!;
  assert.equal(junction.data.compareJunction, true);
  assert.equal(junction.data.dimmed, false);
  assert.equal(otherCase.data.compareJunction, false);
  assert.equal(otherCase.data.dimmed, true);
});

test("LC-2C.2 E-G: unrelated stay dimmed and Show All / Highlight Path toggle visual weight", () => {
  const graph = neighborhood();
  const context = demoContext();
  const highlighted = buildDrugNetworkFlowGraph(graph, (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
  });
  const shownAll = buildDrugNetworkFlowGraph(graph, (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: false,
  });
  const restored = buildDrugNetworkFlowGraph(graph, (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
  });
  assert.equal(highlighted.flowNodes.find((node) => node.id === "c-002")!.data.stronglyDimmed, true);
  assert.equal(highlighted.flowNodes.find((node) => node.id === "sim-1")!.data.dimmed, true);
  assert.ok(shownAll.flowNodes.every((node) => node.data.dimmed === false && (node.data.compareRole ?? null) == null));
  assert.ok(shownAll.flowEdges.every((edge) => (edge.style.opacity ?? 1) === 1 && (edge.style.strokeWidth ?? 1.5) === 1.5));
  assert.equal(restored.flowNodes.find((node) => node.id === "c-003")!.data.compareJunction, true);
  assert.equal(restored.flowNodes.find((node) => node.id === "p-kittisak")!.data.compareSlot, "A");
});

test("LC-2C.2 H-I: SHARED_* and INFERRED are not factual path edges or path reasons", () => {
  const graph = neighborhood();
  const context = demoContext();
  const { flowEdges } = buildDrugNetworkFlowGraph(graph, (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
  });
  const shared = flowEdges.find((edge) => edge.id === "e-shared")!;
  const caseVehicle = flowEdges.find((edge) => edge.id === "e-cv")!;
  const casePhone = flowEdges.find((edge) => edge.id === "e-cph")!;
  const personCase = flowEdges.find((edge) => edge.id === "e-pc3")!;
  assert.equal(shared.style.opacity, COMPARE_HIGHLIGHT_CONTEXT_EDGE_OPACITY);
  assert.equal(shared.style.strokeDasharray, "5 5");
  assert.equal(shared.label, "di.network.relShortSharedCase");
  assert.equal(caseVehicle.label, "di.network.relCaseVehicle");
  assert.equal(casePhone.label, "di.network.relCasePhone");
  assert.equal(personCase.label, "di.network.relPersonCase");
  assert.notEqual(caseVehicle.label, "di.network.relShortVehicle");
  const shownAll = buildDrugNetworkFlowGraph(graph, (key) => key, null, null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: false,
  });
  assert.equal(shownAll.flowEdges.find((edge) => edge.id === "e-cv")!.label, "di.network.relShortVehicle");
});

test("LC-2C.2 J: NONE_KNOWN wording is safe", () => {
  const graph = neighborhood();
  const explanation = buildComparePathExplanation(noneKnownContext(), graph.nodes, graph.edges);
  const line = formatCompareHopLine(explanation.pairs[0]!, tTh);
  assert.equal(line, "ยังไม่พบเส้นทางความเชื่อมโยงจากข้อมูลที่มีอยู่ในระบบ");
  assert.doesNotMatch(line, /ไม่เกี่ยวข้อง/);
  assert.doesNotMatch(translate("di.network.compareHopNone", "th"), /สูง|กลาง|ต่ำ|strong|weak|risk|confidence|CDR|เจ้าของ/);
});

test("LC-2C.2 pair facts round-trip without labels and malformed cmpK fails safe", () => {
  const serialized = serializeCompareHighlightSearchParams(demoContext());
  assert.equal(serialized.get("cmpK"), "D,D,I");
  assert.equal(serialized.get("cmpH"), "1,1,2");
  assert.equal(serialized.get("cmpV"), "-,-,CASE:c-003");
  assert.doesNotMatch(serialized.toString(), /กิตติศักดิ์|DI-TEST-003|66900001001|TEST-9009/);
  const parsed = parseCompareHighlightSearchParams(serialized);
  assert.equal(parsed?.pairs[2]?.connectionKind, "INDIRECT");
  assert.equal(parsed?.pairs[2]?.via[0]?.entityId, "c-003");
  const malformedKind = parseCompareHighlightSearchParams(
    new URLSearchParams("cmpA=PERSON:p-kittisak&cmpB=VEHICLE:v-9009&cmpK=NOPE")
  );
  assert.equal(malformedKind?.A.entityId, "p-kittisak");
  assert.equal(malformedKind?.pairs.length, 0);
  const mismatchedArity = parseCompareHighlightSearchParams(
    new URLSearchParams("cmpA=PERSON:p1&cmpB=VEHICLE:v1&cmpK=D,D,I")
  );
  assert.equal(mismatchedArity?.pairs.length, 0);
});

test("LC-2C.2 explainable bar uses neighborhood DTO facts only", () => {
  const bar = read("components/drug_intelligence/drug_network_compare_highlight_bar.tsx");
  const node = read("components/drug_intelligence/drug_network_graph_node.tsx");
  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(bar, /buildComparePathExplanation/);
  assert.match(bar, /formatCompareHopLine/);
  assert.match(bar, /network-compare-connecting-case/);
  assert.match(bar, /compareShowAllHint/);
  assert.doesNotMatch(bar, /getLinkCompare|fetch\(|requestPost|เจ้าของ|CDR|โทรหา/);
  assert.match(node, /compareJunctionBadge/);
  assert.match(node, /data-compare-junction/);
  assert.match(page, /nodes=\{neighborhood\.data\.nodes\}/);
  assert.match(page, /edges=\{neighborhood\.data\.edges\}/);
});

test("LC-2C.3 open B/C inspects inside the A-centered Compare graph", () => {
  const slots = { A: personA, B: vehicleB, C: phoneC };
  const compareHref = buildLinkCompareHref(slots);
  const highlight = demoContext();
  const openB = linkCompareInspectNetworkHref({ inspect: "B", slots, compareHref, highlight });
  const openC = linkCompareInspectNetworkHref({ inspect: "C", slots, compareHref, highlight });
  const openA = linkCompareInspectNetworkHref({ inspect: "A", slots, compareHref, highlight });
  const b = new URLSearchParams(openB.split("?")[1] ?? "");
  const c = new URLSearchParams(openC.split("?")[1] ?? "");
  const a = new URLSearchParams(openA.split("?")[1] ?? "");
  assert.equal(b.get("focusType"), "PERSON");
  assert.equal(b.get("focusId"), personA.entityId);
  assert.equal(b.get("cmpInspect"), "B");
  assert.equal(c.get("focusType"), "PERSON");
  assert.equal(c.get("cmpInspect"), "C");
  assert.equal(a.get("cmpInspect"), "A");
  assert.equal(b.get("cmpA"), "PERSON:p-kittisak");
  assert.equal(b.get("cmpC"), "PHONE:ph-1001");
  assert.match(String(b.get("cmpP")), /CASE:c-003/);
  assert.doesNotMatch(openB, /กิตติศักดิ์|TEST-9009|66900001001/);
  assert.equal(parseCompareInspectSlot(b, highlight), "B");
  assert.equal(parseCompareInspectSlot(c, highlight), "C");
  assert.equal(compareInspectGraphNodeId(neighborhood().nodes, highlight, "B"), "v-9009");
  assert.equal(compareInspectGraphNodeId(neighborhood().nodes, highlight, "C"), "ph-1001");
  const restored = parseLinkCompareReturnTo(getSafeReturnTo(b));
  assert.equal(restored?.A?.entityId, personA.entityId);
  assert.equal(restored?.B?.entityId, vehicleB.entityId);
  assert.equal(restored?.C?.entityId, phoneC.entityId);
});

test("LC-2C.3 inspecting B does not dim A/C/connecting evidence or change layout focus", () => {
  const context = demoContext();
  const graph = neighborhood();
  const { flowNodes } = buildDrugNetworkFlowGraph(graph, (key) => key, "v-9009", null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: context,
    compareHighlightEmphasize: true,
    compareInspectSlot: "B",
  });
  const person = flowNodes.find((node) => node.id === "p-kittisak")!;
  const vehicle = flowNodes.find((node) => node.id === "v-9009")!;
  const phone = flowNodes.find((node) => node.id === "ph-1001")!;
  const junction = flowNodes.find((node) => node.id === "c-003")!;
  const unrelated = flowNodes.find((node) => node.id === "c-001")!;
  assert.equal(person.data.isFocus, true);
  assert.equal(person.data.dimmed, false);
  assert.equal(vehicle.data.compareInspect, true);
  assert.equal(vehicle.selected, true);
  assert.equal(phone.data.dimmed, false);
  assert.equal(junction.data.compareJunction, true);
  assert.equal(junction.data.dimmed, false);
  assert.equal(unrelated.data.dimmed, true);
  const explanation = buildComparePathExplanation(context, graph.nodes, graph.edges);
  assert.match(formatCompareConnectingSummary(explanation, tTh).join("\n"), /DI-TEST-003/);
  assert.equal(
    formatCompareHopLine(explanation.pairs.find((pair) => pair.left === "B" && pair.right === "C")!, tTh),
    "เชื่อมโยงผ่าน 1 จุดกลาง: DI-TEST-003"
  );
});

test("LC-2C.3 cmpInspect is presentation-only and malformed values fail safe", () => {
  const context = demoContext();
  const withInspect = serializeCompareHighlightSearchParams(context);
  withInspect.set("cmpInspect", "B");
  assert.doesNotMatch(compareHighlightIdentityKey(context), /cmpInspect/);
  assert.equal(parseCompareInspectSlot(new URLSearchParams("cmpInspect=NOPE"), context), null);
  assert.equal(parseCompareInspectSlot(new URLSearchParams("cmpInspect=C"), twoBoxDirectContext()), null);
  assert.equal(parseCompareInspectSlot(new URLSearchParams("cmpInspect=B"), context), "B");
  assert.ok(parseCompareHighlightSearchParams(new URLSearchParams("cmpA=PERSON:p-kittisak&cmpB=VEHICLE:v-9009&cmpInspect=NOPE")));
  const page = read("app/drug-intelligence/network/page.tsx");
  const signature = page.slice(page.indexOf("const querySignature"), page.indexOf("lastQuerySignatureRef"));
  assert.doesNotMatch(signature, /cmpInspect|compareInspect/);
  assert.match(page, /parseCompareInspectSlot/);
  const secondary = page.slice(page.indexOf("const selectedSecondaryId"), page.indexOf("const canvasArrangement"));
  assert.match(secondary, /compareHighlight/);
  assert.match(secondary, /\? null/);
  const after = applyNetworkSearchParamPatch(withInspect, { depth: "2" });
  assert.equal(after.get("cmpInspect"), "B");
  assert.equal(translate("di.network.compareInspecting", "th"), "กำลังดู: {slot} • {label}");
});

test("LC-2C.3 Show All plus inspect B still keeps compare endpoints visible", () => {
  const { flowNodes } = buildDrugNetworkFlowGraph(neighborhood(), (key) => key, "v-9009", null, {
    ...DEFAULT_OPTIONS,
    compareHighlight: demoContext(),
    compareHighlightEmphasize: false,
    compareInspectSlot: "B",
  });
  assert.ok(flowNodes.every((node) => node.data.dimmed === false));
  assert.equal(flowNodes.find((node) => node.id === "v-9009")!.data.compareInspect, true);
  assert.equal(flowNodes.find((node) => node.id === "v-9009")!.selected, true);
  assert.equal(flowNodes.find((node) => node.id === "p-kittisak")!.data.isFocus, true);
});
