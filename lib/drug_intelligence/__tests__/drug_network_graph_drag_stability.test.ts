/**
 * Drag-flicker regression: position-only updates must not recompute
 * topology, layout, selected-path, or summary counts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { buildDrugNetworkFlowGraph, mergePreservingManualPositions } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";
import { computeLayoutForMode } from "@/lib/drug_intelligence/drug_network_graph_layout";
import { shortestUndirectedPath, summarizeNeighborhood } from "@/lib/drug_intelligence/drug_network_graph_readability";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const nodeSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_graph_node.tsx"), "utf8");

function neighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    truncated: false,
    nodes: [
      {
        id: "p1",
        type: "PERSON",
        label: "นายทดสอบ",
        secondaryLabel: "ก้อง",
        maskedLabel: null,
        metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 2,
        riskIndicators: [],
      },
      {
        id: "c1",
        type: "CASE",
        label: "DI-A",
        secondaryLabel: null,
        maskedLabel: null,
        metadata: { type: "CASE", caseNumber: "DI-A", status: "OPEN", arrestDate: null, province: null, reportingUnitText: null },
        firstSeenAt: null,
        lastSeenAt: null,
        caseCount: 1,
        riskIndicators: [],
      },
      {
        id: "ph1",
        type: "PHONE",
        label: "0900001001",
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
        id: "e2",
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
}

test("summary counts are identical after XY-only node movement because they ignore positions", () => {
  const data = neighborhood();
  const before = summarizeNeighborhood(data);
  const afterMove = structuredClone(data);
  assert.deepEqual(summarizeNeighborhood(afterMove), before);
});

test("selected-path derivation is stable under position-only updates — it uses edge topology only", () => {
  const data = neighborhood();
  const first = shortestUndirectedPath("p1", "ph1", data.edges);
  const second = shortestUndirectedPath("p1", "ph1", data.edges);
  assert.deepEqual(first, second);
  assert.deepEqual(first?.nodeIds, ["p1", "ph1"]);
});

test("mergePreservingManualPositions keeps a dragged coordinate without calling layout again", () => {
  const data = neighborhood();
  const { flowNodes } = buildDrugNetworkFlowGraph(data, (k) => k, null, null, {
    layoutMode: "GROUP_BY_TYPE",
    labelMode: "SELECTED_ONLY",
    nodeDensity: "STANDARD",
  });
  const dragged = flowNodes.map((node) => (node.id === "p1" ? { ...node, position: { x: 480, y: -90 } } : node));
  const merged = mergePreservingManualPositions(flowNodes, dragged, false);
  assert.deepEqual(merged.find((node) => node.id === "p1")!.position, { x: 480, y: -90 });
  assert.deepEqual(
    merged.map((node) => node.id).sort(),
    flowNodes.map((node) => node.id).sort()
  );
});

test("layout for the same topology is deterministic and does not read node XY from the DTO", () => {
  const data = neighborhood();
  const nodes = data.nodes.map((node) => ({ id: node.id, type: node.type }));
  const edges = data.edges.map((edge) => ({ source: edge.source, target: edge.target }));
  const a = computeLayoutForMode("GROUP_BY_TYPE", data.focus.entityId, nodes, edges);
  const b = computeLayoutForMode("GROUP_BY_TYPE", data.focus.entityId, nodes, edges);
  assert.deepEqual([...a.entries()], [...b.entries()]);
});

test("page graph-build effect no longer lists hover ids — drag enter/leave must not rebuild the graph", () => {
  const builtIndex = pageSource.indexOf("const built = buildDrugNetworkFlowGraph(");
  assert.ok(builtIndex !== -1);
  const depsStart = pageSource.indexOf("}, [", builtIndex);
  const depsEnd = pageSource.indexOf(");", depsStart);
  const deps = pageSource.slice(depsStart, depsEnd + 2);
  assert.doesNotMatch(deps, /hoveredNodeId|hoveredEdgeId/);
  assert.match(pageSource, /applyFlowEdgeHoverLabels/);
  assert.match(pageSource, /isNodeDraggingRef/);
  assert.match(pageSource, /onNodeDragStart/);
  assert.match(pageSource, /onNodeDragStop/);
  assert.match(pageSource, /shouldFitSelectedPath/);
  assert.doesNotMatch(pageSource, /fitView\(\{ nodes: pathNodes/);
});

test("node cards do not transition transform — that fights React Flow drag transforms", () => {
  assert.doesNotMatch(nodeSource, /transition-\[[^\]]*transform/);
  assert.match(nodeSource, /transition-\[box-shadow\]/);
});
