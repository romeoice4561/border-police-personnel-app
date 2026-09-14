/**
 * Connection-depth UX — presentation only. Uses the existing 1 | 2 neighborhood
 * contract. Must not invent deeper traversal or change relationship semantics.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";
import {
  applyConnectionDepthSearchParams,
  connectionDepthPreservesFocus,
  connectionDepthUrlPatch,
  NETWORK_DEFAULT_CONNECTION_DEPTH,
  NETWORK_MAX_CONNECTION_DEPTH,
  nextSelectedEntityAfterNeighborhoodChange,
  nodeIdsWithinConnectionDepth,
  parseNetworkConnectionDepth,
} from "@/lib/drug_intelligence/drug_network_connection_depth";
import {
  appearanceReasonKey,
  selectedPathSteps,
  shortestUndirectedPath,
} from "@/lib/drug_intelligence/drug_network_graph_readability";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const toolbarSource = readFileSync(
  path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_connection_depth.tsx"),
  "utf8"
);
const hookSource = readFileSync(path.join(dir, "..", "drug_intelligence_hooks.ts"), "utf8");
const dictionarySource = readFileSync(path.join(dir, "..", "..", "..", "lib", "i18n", "dictionary.ts"), "utf8");

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

/** Fixture topology: P002 → vehicle + SIM at hop 1; CASE005 / CASE006 at hop 2. */
function depthTwoNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p002" },
    truncated: false,
    nodes: [
      node("p002", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("veh", "VEHICLE", "TEST-9009"),
      node("sim", "SIM", "SIM001"),
      node("c5", "CASE", "DI-TEST-005"),
      node("c6", "CASE", "DI-TEST-006"),
    ],
    edges: [
      edge("e-veh", "p002", "veh", "PERSON_VEHICLE"),
      edge("e-sim", "p002", "sim", "PERSON_SIM"),
      edge("e-c5", "veh", "c5", "CASE_VEHICLE"),
      edge("e-c6", "sim", "c6", "CASE_SIM"),
    ],
  };
}

test("default connection depth remains 1", () => {
  assert.equal(NETWORK_DEFAULT_CONNECTION_DEPTH, 1);
  assert.equal(parseNetworkConnectionDepth(null), 1);
  assert.equal(parseNetworkConnectionDepth(undefined), 1);
  assert.equal(parseNetworkConnectionDepth(""), 1);
  assert.equal(parseNetworkConnectionDepth("1"), 1);
});

test("depth 2 is accepted and values above the existing max fall back to 1", () => {
  assert.equal(NETWORK_MAX_CONNECTION_DEPTH, 2);
  assert.equal(parseNetworkConnectionDepth("2"), 2);
  assert.equal(parseNetworkConnectionDepth(2), 2);
  assert.equal(parseNetworkConnectionDepth("3"), 1);
  assert.equal(parseNetworkConnectionDepth("hop"), 1);
});

test("depth URL patch updates only depth and preserves focusType/focusId", () => {
  const current = new URLSearchParams(
    "focusType=PERSON&focusId=04d2ac30-976a-460d-b77d-31e74153e59f"
  );
  const next = applyConnectionDepthSearchParams(current, 2);
  assert.equal(next.get("focusType"), "PERSON");
  assert.equal(next.get("focusId"), "04d2ac30-976a-460d-b77d-31e74153e59f");
  assert.equal(next.get("depth"), "2");
  assert.deepEqual(connectionDepthUrlPatch(2), { depth: "2" });
  assert.ok(
    connectionDepthPreservesFocus(
      { focusType: current.get("focusType"), focusId: current.get("focusId") },
      { focusType: next.get("focusType"), focusId: next.get("focusId") }
    )
  );
});

test("depth 2 fixture exposes second-level cases; depth 1 removes them", () => {
  const data = depthTwoNeighborhood();
  const layoutNodes = data.nodes.map((item) => ({ id: item.id, type: item.type }));
  const layoutEdges = data.edges.map((item) => ({ source: item.source, target: item.target }));
  const depth1 = nodeIdsWithinConnectionDepth("p002", layoutNodes, layoutEdges, 1);
  const depth2 = nodeIdsWithinConnectionDepth("p002", layoutNodes, layoutEdges, 2);
  assert.deepEqual(depth1.sort(), ["p002", "sim", "veh"].sort());
  assert.ok(!depth1.includes("c5"));
  assert.ok(!depth1.includes("c6"));
  assert.ok(depth2.includes("c5"));
  assert.ok(depth2.includes("c6"));
});

test("returning to depth 1 clears a selected second-level node and leaves a still-present node", () => {
  const data = depthTwoNeighborhood();
  const depth1Ids = nodeIdsWithinConnectionDepth(
    "p002",
    data.nodes.map((item) => ({ id: item.id, type: item.type })),
    data.edges.map((item) => ({ source: item.source, target: item.target })),
    1
  );
  assert.equal(nextSelectedEntityAfterNeighborhoodChange({ id: "c5" }, depth1Ids), null);
  assert.equal(nextSelectedEntityAfterNeighborhoodChange({ id: "veh" }, depth1Ids)?.id, "veh");
  assert.equal(nextSelectedEntityAfterNeighborhoodChange(null, depth1Ids), null);
});

test("selected-path logic at depth 2 still walks the loaded topology only", () => {
  const data = depthTwoNeighborhood();
  assert.deepEqual(shortestUndirectedPath("p002", "c5", data.edges)?.nodeIds, ["p002", "veh", "c5"]);
  assert.deepEqual(
    selectedPathSteps(data, "c5").map((step) => step.label),
    ["นายกิตติศักดิ์ ทดสอบระบบ", "TEST-9009", "DI-TEST-005"]
  );
  assert.deepEqual(shortestUndirectedPath("p002", "c6", data.edges)?.nodeIds, ["p002", "sim", "c6"]);
  assert.deepEqual(
    selectedPathSteps(data, "c6").map((step) => step.label),
    ["นายกิตติศักดิ์ ทดสอบระบบ", "SIM001", "DI-TEST-006"]
  );
  assert.deepEqual(
    selectedPathSteps(data, "veh").map((step) => step.label),
    ["นายกิตติศักดิ์ ทดสอบระบบ", "TEST-9009"]
  );
});

test("direct / indirect wording is unchanged at depth 2", () => {
  assert.equal(
    appearanceReasonKey({ isFocus: false, hopDistance: 1, relationshipTypes: ["PERSON_VEHICLE"] }),
    "di.network.reasonDirect"
  );
  assert.notEqual(
    appearanceReasonKey({ isFocus: false, hopDistance: 2, relationshipTypes: ["CASE_VEHICLE"] }),
    "di.network.reasonDirect"
  );
});

test("page depth control uses the existing depth param and does not change focus", () => {
  assert.match(pageSource, /parseNetworkConnectionDepth\(searchParams\.get\("depth"\)\)/);
  assert.match(pageSource, /function setConnectionDepth/);
  assert.match(pageSource, /updateParams\(connectionDepthUrlPatch\(next\)\)/);
  assert.match(pageSource, /DrugNetworkConnectionDepthControl/);
  assert.match(pageSource, /nextSelectedEntityAfterNeighborhoodChange/);
  assert.doesNotMatch(pageSource, /setConnectionDepth[\s\S]{0,200}focusType/);
  assert.doesNotMatch(toolbarSource, /depth=1|depth=2|hop|graph traversal/i);
});

test("toolbar labels use ระดับความเชื่อมโยง / 1 ชั้น / 2 ชั้น and stay out of the label menu", () => {
  assert.match(dictionarySource, /"di\.network\.connectionDepthLabel": tr\("ระดับความเชื่อมโยง"/);
  assert.match(dictionarySource, /"di\.network\.connectionDepthOne": tr\("1 ชั้น"/);
  assert.match(dictionarySource, /"di\.network\.connectionDepthTwo": tr\("2 ชั้น"/);
  const labelMenu = pageSource.slice(
    pageSource.indexOf("drug-network-label-menu"),
    pageSource.indexOf("drug-network-label-menu") + 700
  );
  assert.doesNotMatch(labelMenu, /connectionDepth/);
  assert.match(toolbarSource, /di\.network\.connectionDepthLabel/);
});

test("neighborhood hook keeps previous graph visible while the existing depth query refetches", () => {
  const neighborhoodHook = hookSource.slice(
    hookSource.indexOf("export function useDrugNetworkNeighborhood"),
    hookSource.indexOf("export function useDrugNetworkPath")
  );
  assert.match(neighborhoodHook, /placeholderData:\s*keepPreviousData/);
});
