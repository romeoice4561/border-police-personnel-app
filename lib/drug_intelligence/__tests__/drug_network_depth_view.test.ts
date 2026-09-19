/**
 * Depth-2 readability view modes — presentation only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";
import {
  isolateSelectedPathInView,
  isSelectedPathEmptyState,
  NETWORK_DEFAULT_DEPTH_VIEW,
  parseNetworkDepthViewMode,
  resolveDepthViewCanvas,
  shouldPreserveViewportForPathEmptyState,
  shouldShowDepthViewControl,
} from "@/lib/drug_intelligence/drug_network_depth_view";
import { computeGroupByHopLayout, planGroupByHopLayout } from "@/lib/drug_intelligence/drug_network_graph_layout";
import {
  appearanceReasonKey,
  hopDistances,
  selectedPathSteps,
  summarizeNeighborhood,
} from "@/lib/drug_intelligence/drug_network_graph_readability";
import { buildDrugNetworkFlowGraph } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import { computeDrawerAwarePathViewport, shouldFitSelectedPath } from "@/lib/drug_intelligence/drug_network_drawer_viewport";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const adapterSource = readFileSync(path.join(dir, "..", "drug_network_graph_flow_adapter.ts"), "utf8");

function node(
  id: string,
  type: DrugGraphNeighborhoodResponse["nodes"][number]["type"],
  label: string
): DrugGraphNeighborhoodResponse["nodes"][number] {
  return {
    id,
    type,
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata:
      type === "CASE"
        ? { type: "CASE", caseNumber: label, status: "OPEN", arrestDate: null, province: null, reportingUnitText: null }
        : type === "VEHICLE"
          ? { type: "VEHICLE", registrationProvince: null, brand: null, model: null, color: null }
          : type === "SIM"
            ? { type: "SIM", imsi: null, carrier: null }
            : { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  relationshipType: DrugGraphNeighborhoodResponse["edges"][number]["relationshipType"]
): DrugGraphNeighborhoodResponse["edges"][number] {
  return {
    id,
    source,
    target,
    relationshipType,
    edgeKind: "DIRECT",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [],
    explanation: { kind: "DIRECT_LINK" },
  };
}

function neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p002" },
    truncated: false,
    nodes: [
      node("p002", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("veh", "VEHICLE", "TEST-9009"),
      node("sim", "SIM", "SIM001"),
      node("c1", "CASE", "DI-TEST-001"),
      node("c5", "CASE", "DI-TEST-005"),
      node("c6", "CASE", "DI-TEST-006"),
    ],
    edges: [
      edge("e-c1", "p002", "c1", "PERSON_CASE"),
      edge("e-veh", "p002", "veh", "PERSON_VEHICLE"),
      edge("e-sim", "p002", "sim", "PERSON_SIM"),
      edge("e-c5", "veh", "c5", "CASE_VEHICLE"),
      edge("e-c6", "sim", "c6", "CASE_SIM"),
    ],
  };
}

test("default depth-2 view is BY_DEPTH and hidden at depth 1", () => {
  assert.equal(NETWORK_DEFAULT_DEPTH_VIEW, "BY_DEPTH");
  assert.equal(parseNetworkDepthViewMode(null), "BY_DEPTH");
  assert.equal(parseNetworkDepthViewMode("full"), "FULL_NETWORK");
  assert.equal(parseNetworkDepthViewMode("path"), "SELECTED_PATH");
  assert.equal(shouldShowDepthViewControl(1), false);
  assert.equal(shouldShowDepthViewControl(2), true);
});

test("canvas arrangement keeps hop bands as the depth-2 default", () => {
  assert.equal(resolveDepthViewCanvas({ depth: 1, viewMode: "BY_DEPTH", hasSelectedSecondary: false }), "DEFAULT");
  assert.equal(resolveDepthViewCanvas({ depth: 2, viewMode: "BY_DEPTH", hasSelectedSecondary: false }), "GROUP_BY_HOP");
  assert.equal(resolveDepthViewCanvas({ depth: 2, viewMode: "FULL_NETWORK", hasSelectedSecondary: true }), "DEFAULT");
  assert.equal(resolveDepthViewCanvas({ depth: 2, viewMode: "SELECTED_PATH", hasSelectedSecondary: true }), "VERTICAL_PATH");
  assert.equal(resolveDepthViewCanvas({ depth: 2, viewMode: "SELECTED_PATH", hasSelectedSecondary: false }), "GROUP_BY_HOP");
});

test("path empty state keeps hop-band layout and does not isolate or refit", () => {
  const empty = { depth: 2 as const, viewMode: "SELECTED_PATH" as const, hasSelectedSecondary: false };
  const selected = { depth: 2 as const, viewMode: "SELECTED_PATH" as const, hasSelectedSecondary: true };
  assert.equal(isSelectedPathEmptyState(empty), true);
  assert.equal(isSelectedPathEmptyState(selected), false);
  assert.equal(isSelectedPathEmptyState({ depth: 1, viewMode: "SELECTED_PATH", hasSelectedSecondary: false }), false);
  assert.equal(shouldPreserveViewportForPathEmptyState(empty), true);
  assert.equal(shouldPreserveViewportForPathEmptyState(selected), false);
  assert.equal(isolateSelectedPathInView(empty), false);
  assert.equal(isolateSelectedPathInView(selected), true);
  assert.equal(resolveDepthViewCanvas(empty), "GROUP_BY_HOP");
  assert.equal(resolveDepthViewCanvas(selected), "VERTICAL_PATH");
});

test("hop distances classify hop-1 and hop-2 from loaded topology only", () => {
  const data = neighborhood();
  const hops = hopDistances(
    data.focus.entityId,
    data.nodes.map((item) => ({ id: item.id, type: item.type })),
    data.edges.map((item) => ({ source: item.source, target: item.target }))
  );
  assert.equal(hops.get("p002"), 0);
  assert.equal(hops.get("veh"), 1);
  assert.equal(hops.get("c1"), 1);
  assert.equal(hops.get("c5"), 2);
  assert.equal(hops.get("c6"), 2);
});

test("by-depth layout separates hop bands and keeps type as a secondary column", () => {
  const data = neighborhood();
  const nodes = data.nodes.map((item) => ({ id: item.id, type: item.type }));
  const edges = data.edges.map((item) => ({ source: item.source, target: item.target }));
  const positions = computeGroupByHopLayout("p002", nodes, edges);
  const plan = planGroupByHopLayout("p002", nodes, edges);
  assert.equal(positions.get("p002")!.y, 0);
  assert.ok(positions.get("veh")!.y > positions.get("p002")!.y);
  assert.ok(positions.get("c5")!.y > positions.get("veh")!.y);
  assert.ok(positions.get("c6")!.y > positions.get("sim")!.y);
  assert.equal(positions.get("c1")!.x, positions.get("c5")!.x, "same type shares a column across hops");
  assert.notEqual(positions.get("veh")!.x, positions.get("c1")!.x);
  assert.ok(plan.bands.some((band) => band.hop === 1));
  assert.ok(plan.bands.some((band) => band.hop === 2));
  const hop1MaxY = Math.max(...["veh", "sim", "c1"].map((id) => positions.get(id)!.y + 148));
  const hop2MinY = Math.min(...["c5", "c6"].map((id) => positions.get(id)!.y));
  assert.ok(hop2MinY >= hop1MaxY + 32, "hop-2 cards must clear hop-1 card bottoms");
  assert.ok(plan.bands.find((band) => band.hop === 2)!.y > hop1MaxY);
});

test("selected-path view isolates the existing shortest walk without mutating the payload", () => {
  const data = neighborhood();
  const snapshot = structuredClone(data);
  const { flowNodes, flowEdges } = buildDrugNetworkFlowGraph(data, (key) => key, "c5", null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "SELECTED_ONLY",
    nodeDensity: "STANDARD",
    canvasArrangement: "VERTICAL_PATH",
    pathNodeIdsInOrder: ["p002", "veh", "c5"],
    isolateSelectedPath: true,
    showHopBadges: true,
  });
  assert.deepEqual(data, snapshot);
  const pathYs = ["p002", "veh", "c5"].map((id) => flowNodes.find((item) => item.id === id)!.position.y);
  assert.ok(pathYs[0]! < pathYs[1]! && pathYs[1]! < pathYs[2]!);
  assert.equal(flowNodes.find((item) => item.id === "c5")!.data.stronglyDimmed, false);
  assert.equal(flowNodes.find((item) => item.id === "c6")!.data.stronglyDimmed, true);
  assert.ok((flowEdges.find((item) => item.id === "e-c6")!.style.opacity ?? 1) <= 0.28);
  assert.equal(isolateSelectedPathInView({ depth: 2, viewMode: "SELECTED_PATH", hasSelectedSecondary: true }), true);
});

test("summary hop counts come only from loaded topology", () => {
  const summary = summarizeNeighborhood(neighborhood());
  assert.equal(summary.directByType.CASE, 1);
  assert.equal(summary.directByType.VEHICLE, 1);
  assert.equal(summary.directByType.SIM, 1);
  assert.equal(summary.indirectByType.CASE, 2);
  assert.equal(summary.indirectTotal, 2);
});

test("direct and indirect wording stay hop-based", () => {
  assert.equal(appearanceReasonKey({ isFocus: false, hopDistance: 1, relationshipTypes: ["PERSON_VEHICLE"] }), "di.network.reasonDirect");
  assert.notEqual(appearanceReasonKey({ isFocus: false, hopDistance: 2, relationshipTypes: ["CASE_VEHICLE"] }), "di.network.reasonDirect");
  const steps = selectedPathSteps(neighborhood(), "c5").map((step) => step.label);
  assert.deepEqual(steps, ["นายกิตติศักดิ์ ทดสอบระบบ", "TEST-9009", "DI-TEST-005"]);
});

test("drawer-aware selected-path fit still applies once and never while dragging", () => {
  const viewport = computeDrawerAwarePathViewport({
    nodes: [
      { id: "focus", position: { x: 0, y: 0 }, width: 240, height: 150, isFocus: true },
      { id: "dest", position: { x: 0, y: 400 }, width: 180, height: 110 },
    ],
    canvasWidth: 1200,
    canvasHeight: 640,
    canvasRight: 1440,
    drawerWidth: 512,
    viewportWidth: 1440,
  })!;
  assert.ok(400 * viewport.zoom + viewport.y + 110 * viewport.zoom <= 640 + 1);
  assert.equal(shouldFitSelectedPath({ selectedId: "c5", focusId: "p002", lastFittedSelectionId: "c5", isDragging: false }), false);
  assert.equal(shouldFitSelectedPath({ selectedId: "c5", focusId: "p002", lastFittedSelectionId: null, isDragging: true }), false);
});

test("page wires depth-2 view modes without changing graph query semantics", () => {
  assert.match(pageSource, /DrugNetworkDepthViewControl/);
  assert.match(pageSource, /resolveDepthViewCanvas/);
  assert.match(pageSource, /canvasArrangement/);
  assert.match(pageSource, /showHopBadges: depth === 2/);
  assert.match(adapterSource, /computeGroupByHopLayout/);
  assert.doesNotMatch(pageSource, /SUPPLIED_BY/);
  assert.match(pageSource, /entityType: focusType/);
});

test("path empty state reuses BY-DEPTH layout and skips full-graph fit", () => {
  const querySignatureMatch = pageSource.match(/const querySignature = JSON\.stringify\(\{([\s\S]*?)\}\);/);
  assert.ok(querySignatureMatch, "could not locate querySignature");
  assert.match(querySignatureMatch[1], /canvasArrangement/);
  assert.doesNotMatch(querySignatureMatch[1], /depthViewMode/);
  assert.match(pageSource, /resolveInitialViewportKind/);
  assert.match(pageSource, /di\.network\.depthViewPathEmpty/);
  assert.match(pageSource, /if \(isNewQuery\)[\s\S]{0,2500}initialViewportKind === "PRESERVE"/);
  assert.match(pageSource, /DRAWER_AWARE_PATH[\s\S]{0,800}computeDrawerAwarePathViewport/);
  assert.match(pageSource, /NETWORK_SAME_ROUTE_ROUTER_OPTIONS/);
  const dictionary = readFileSync(path.join(dir, "..", "..", "i18n", "dictionary.ts"), "utf8");
  assert.match(
    dictionary,
    /เลือกบุคคล คดี เบอร์โทร SIM อุปกรณ์ ยานพาหนะ หรือสถานที่\\nเพื่อดูเส้นทางความเชื่อมโยงจากบุคคลหลัก/
  );
});
