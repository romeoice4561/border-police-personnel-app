/**
 * Card-based intelligence graph presentation. Must not change query
 * semantics, relationship derivation, or Entity Media architecture.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { NETWORK_DEFAULT_CONNECTION_DEPTH } from "@/lib/drug_intelligence/drug_network_connection_depth";
import { buildDrugNetworkFlowGraph } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("PERSON/PHONE/VEHICLE/CASE cards use readable widths and hide UUID wrapping", () => {
  const nodeSrc = read("components/drug_intelligence/drug_network_graph_node.tsx");
  assert.match(nodeSrc, /w-\[276px\]/);
  assert.match(nodeSrc, /w-\[236px\]/);
  assert.match(nodeSrc, /w-\[220px\]/);
  assert.match(nodeSrc, /w-\[176px\]/);
  assert.match(nodeSrc, /graphCardFocus/);
  assert.match(nodeSrc, /text-base font-bold/);
  assert.match(nodeSrc, /data-testid="network-intelligence-card"/);
  assert.doesNotMatch(nodeSrc, /break-all/);
  assert.doesNotMatch(nodeSrc, /max-w-\[180px\]/);
  assert.match(nodeSrc, /nodrag nopan/);
  assert.match(nodeSrc, /di\.network\.expandCard/);
  assert.match(read("components/drug_intelligence/drug_entity_visual_thumb.tsx"), /graphCardFocus: "h-\[72px\] w-\[72px\]"/);
});

test("operational edge labels stay presentation-only and map known relationship types", () => {
  assert.equal(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY.PERSON_PHONE, "di.network.relOpPersonPhone");
  assert.equal(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY.PERSON_VEHICLE, "di.network.relOpPersonVehicle");
  assert.equal(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY.PERSON_CASE, "di.network.relOpPersonCase");
  assert.equal(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY.CASE_PHONE, "di.network.relOpFoundInCase");
  assert.equal(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY.CASE_LOCATION, "di.network.relOpFoundAt");
  const dictionary = read("lib/i18n/dictionary.ts");
  assert.match(dictionary, /"di\.network\.relOpPersonPhone": tr\("ใช้เบอร์"/);
  assert.match(dictionary, /"di\.network\.relOpPersonVehicle": tr\("ใช้รถ"/);
  assert.match(dictionary, /"di\.network\.relOpPersonCase": tr\("เกี่ยวข้องในคดี"/);
  assert.match(dictionary, /"di\.network\.relOpFoundInCase": tr\("พบในคดี"/);
});

test("default graph view is level 1 with relationship labels visible", () => {
  assert.equal(NETWORK_DEFAULT_CONNECTION_DEPTH, 1);
  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /useState<DrugNetworkLabelMode>\("ALL"\)/);
  assert.match(page, /handleExpandGraphCard/);
  assert.match(page, /onNodeDoubleClick=\{handleNodeDoubleClick\}/);
  assert.match(page, /connectionDepthUrlPatch\(2\)/);
  assert.doesNotMatch(page, /connectingEdgeForExplanationClick/);
});

test("adapter still preserves DIRECT/INFERRED and depth caps while adding card stats", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    truncated: false,
    nodes: [
      {
        id: "p1",
        type: "PERSON",
        label: "นายทดสอบ",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 3,
        riskIndicators: [],
      },
      {
        id: "ph1",
        type: "PHONE",
        label: "66900001001",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "PHONE", carrier: null },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 2,
        riskIndicators: [],
      },
    ],
    edges: [
      {
        id: "e1",
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
    ],
  };
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(neighborhood, (key) => key, null, null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    connectionDepth: 1,
  });
  const person = flowNodes.find((node) => node.id === "p1")!;
  assert.equal(person.data.isFocus, true);
  assert.equal(person.data.canExpand, true);
  assert.equal(person.data.neighborCounts.PHONE, 1);
  assert.equal(flowEdges[0]?.label, "di.network.relOpPersonPhone");
  assert.equal(flowEdges[0]?.style.strokeDasharray, undefined);
});

test("focus-direct edges stay labeled and stronger; secondary cross-links stay quieter until selection", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    truncated: false,
    nodes: [
      {
        id: "p1",
        type: "PERSON",
        label: "นายทดสอบ",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 3,
        riskIndicators: [],
      },
      {
        id: "ph1",
        type: "PHONE",
        label: "66900001001",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "PHONE", carrier: null },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 2,
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
        id: "e-phone",
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
        id: "e-case",
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
        id: "e-cross",
        source: "ph1",
        target: "c1",
        relationshipType: "CASE_PHONE",
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: null,
        lastSeenAt: null,
        sourceCaseIds: ["c1"],
        explanation: { kind: "DIRECT_LINK" },
      },
    ],
  };
  const idle = buildDrugNetworkFlowGraph(neighborhood, (key) => key, null, null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    connectionDepth: 1,
  });
  const personPhone = idle.flowEdges.find((edge) => edge.id === "e-phone")!;
  const personCase = idle.flowEdges.find((edge) => edge.id === "e-case")!;
  const phoneCase = idle.flowEdges.find((edge) => edge.id === "e-cross")!;
  assert.equal(personPhone.label, "di.network.relOpPersonPhone");
  assert.equal(personCase.label, "di.network.relOpPersonCase");
  assert.equal(phoneCase.label, "");
  assert.ok((personPhone.style.opacity ?? 1) > (phoneCase.style.opacity ?? 1));
  assert.ok((personPhone.style.strokeWidth ?? 1) > (phoneCase.style.strokeWidth ?? 1));

  const selected = buildDrugNetworkFlowGraph(neighborhood, (key) => key, "ph1", null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    connectionDepth: 1,
  });
  const selectedCross = selected.flowEdges.find((edge) => edge.id === "e-cross")!;
  const selectedVehicleLike = selected.flowEdges.find((edge) => edge.id === "e-case")!;
  assert.equal(selectedCross.label, "di.network.relOpFoundInCase");
  assert.equal(selectedCross.style.opacity, 1);
  assert.equal(selected.flowEdges.find((edge) => edge.id === "e-phone")!.label, "di.network.relOpPersonPhone");
  assert.equal(selectedVehicleLike.label, "");
  assert.ok((selectedVehicleLike.style.opacity ?? 1) < 1);
});

test("dark-mode graph contrast uses theme tokens for headings, cards, and edge labels", () => {
  const headings = read("components/drug_intelligence/drug_network_type_lane_headers.tsx");
  assert.match(headings, /bg-neutral-bg/);
  assert.match(headings, /text-foreground/);
  assert.doesNotMatch(headings, /text-muted/);
  assert.doesNotMatch(headings, /bg-surface\/90/);
  const hopHeadings = read("components/drug_intelligence/drug_network_hop_band_headers.tsx");
  assert.match(hopHeadings, /bg-neutral-bg/);
  assert.match(hopHeadings, /text-foreground/);
  assert.doesNotMatch(hopHeadings, /text-muted/);
  const nodeSrc = read("components/drug_intelligence/drug_network_graph_node.tsx");
  assert.match(nodeSrc, /bg-surface/);
  assert.match(nodeSrc, /text-foreground/);
  assert.match(nodeSrc, /opacity-\[0\.62\]/);
  assert.match(nodeSrc, /opacity-\[0\.55\]/);
  assert.doesNotMatch(nodeSrc, /opacity-30|opacity-50|opacity-90/);
  const adapter = read("lib/drug_intelligence/drug_network_graph_flow_adapter.ts");
  assert.match(adapter, /fill: "var\(--color-foreground\)"/);
  assert.match(adapter, /fill: "var\(--color-neutral-bg\)"/);
  const css = read("app/globals.css");
  assert.match(css, /react-flow__edge-text/);
  assert.match(css, /fill: var\(--foreground\)/);
  assert.match(css, /fill: var\(--neutral-bg\)/);
});

test("graph API handler and media architecture remain unchanged by the card UI", () => {
  const handler = read("lib/drug_intelligence/drug_network_graph_api_handlers.ts");
  assert.match(handler, /attachGraphNodeVisuals/);
  assert.match(handler, /depth/);
  assert.match(handler, /DRUG_GRAPH_HARD_MAX_NODES|maxNodes/);
  const nodeSrc = read("components/drug_intelligence/drug_network_graph_node.tsx");
  assert.doesNotMatch(nodeSrc, /fetch\(|useQuery/);
});
