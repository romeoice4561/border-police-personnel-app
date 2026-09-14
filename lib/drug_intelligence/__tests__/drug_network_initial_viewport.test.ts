/**
 * Depth-2 PERSON BY-DEPTH initial viewport — readability-first, presentation only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getViewportForBounds } from "@xyflow/react";
import { planGroupByHopLayout } from "@/lib/drug_intelligence/drug_network_graph_layout";
import { hopDistances } from "@/lib/drug_intelligence/drug_network_graph_readability";
import {
  computeReadableHopContextBounds,
  computeReadableHopContextViewport,
  isNodeVisibleInViewport,
  resolveInitialViewportKind,
  selectReadableHopContextNodes,
  type ReadableFitNode,
} from "@/lib/drug_intelligence/drug_network_initial_viewport";
import { pathNodesBounds } from "@/lib/drug_intelligence/drug_network_drawer_viewport";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");

const TYPES = ["CASE", "PHONE", "SIM", "DEVICE", "VEHICLE", "PERSON"] as const;

function wideDepth2Neighborhood() {
  const nodes: { id: string; type: (typeof TYPES)[number] }[] = [{ id: "focus", type: "PERSON" }];
  const edges: { source: string; target: string }[] = [];
  TYPES.forEach((type) => {
    const hop1Id = `h1-${type}`;
    nodes.push({ id: hop1Id, type });
    edges.push({ source: "focus", target: hop1Id });
    const hop2Id = `h2-${type}`;
    nodes.push({ id: hop2Id, type });
    edges.push({ source: hop1Id, target: hop2Id });
    for (let extra = 0; extra < 3; extra += 1) {
      const extraId = `h2-${type}-${extra}`;
      nodes.push({ id: extraId, type });
      edges.push({ source: hop1Id, target: extraId });
    }
  });
  return { nodes, edges };
}

function toFitNodes(): { fitNodes: ReadableFitNode[]; headings: { hop: 1 | 2; x: number; y: number }[]; hops: Map<string, number> } {
  const { nodes, edges } = wideDepth2Neighborhood();
  const hops = hopDistances("focus", nodes, edges);
  const plan = planGroupByHopLayout("focus", nodes, edges);
  const fitNodes: ReadableFitNode[] = nodes.map((node) => ({
    id: node.id,
    position: plan.positions.get(node.id) ?? { x: 0, y: 0 },
    width: node.id === "focus" ? 240 : 180,
    height: node.id === "focus" ? 150 : 110,
    hopDistance: hops.get(node.id) ?? 1,
    isFocus: node.id === "focus",
  }));
  return { fitNodes, headings: plan.bands, hops };
}

test("depth=1 PERSON keeps the neighbor-fit policy; CASE is not given PERSON hop-context rules", () => {
  assert.equal(
    resolveInitialViewportKind({
      focusType: "PERSON",
      depth: 1,
      viewMode: "BY_DEPTH",
      canvasArrangement: "DEFAULT",
      hasSelectedSecondary: false,
    }),
    "DEPTH1_PERSON_NEIGHBORS"
  );
  assert.equal(
    resolveInitialViewportKind({
      focusType: "CASE",
      depth: 1,
      viewMode: "BY_DEPTH",
      canvasArrangement: "DEFAULT",
      hasSelectedSecondary: false,
    }),
    "FULL_GRAPH"
  );
  assert.equal(
    resolveInitialViewportKind({
      focusType: "CASE",
      depth: 2,
      viewMode: "BY_DEPTH",
      canvasArrangement: "GROUP_BY_HOP",
      hasSelectedSecondary: false,
    }),
    "FULL_GRAPH"
  );
  assert.match(pageSource, /fitView\(\{ nodes: hopNodes, duration: 300, padding: 0\.28, maxZoom: 1\.12 \}\)/);
});

test("PERSON depth=2 BY-DEPTH does not initial-fit every hop-2 node", () => {
  assert.equal(
    resolveInitialViewportKind({
      focusType: "PERSON",
      depth: 2,
      viewMode: "BY_DEPTH",
      canvasArrangement: "GROUP_BY_HOP",
      hasSelectedSecondary: false,
    }),
    "READABLE_HOP_CONTEXT"
  );
  const { fitNodes } = toFitNodes();
  const hop2 = fitNodes.filter((node) => node.hopDistance >= 2);
  assert.ok(hop2.length >= 10, "fixture must have a stacked hop-2 band");
  const selected = selectReadableHopContextNodes(fitNodes);
  const selectedHop2Ids = new Set(selected.filter((node) => node.hopDistance >= 2).map((node) => node.id));
  assert.ok(selectedHop2Ids.size < hop2.length, "first hop-2 row only — not the full stack");
  const bounds = computeReadableHopContextBounds({ nodes: fitNodes, hopBandHeadings: toFitNodes().headings })!;
  const deepestHop2Bottom = Math.max(...hop2.map((node) => node.position.y + (node.height ?? 110)));
  assert.ok(bounds.y + bounds.height < deepestHop2Bottom - 40, "initial bounds must leave lower hop-2 off-screen");
});

test("readable initial bounds contain focus and every hop-1 node", () => {
  const { fitNodes, headings } = toFitNodes();
  const bounds = computeReadableHopContextBounds({ nodes: fitNodes, hopBandHeadings: headings })!;
  const hop2Heading = headings.find((heading) => heading.hop === 2);
  assert.ok(hop2Heading, "ชั้น 2 heading must exist");
  assert.ok(hop2Heading.y <= bounds.y + bounds.height, "ชั้น 2 heading stays inside the readable bounds");
  const viewport = computeReadableHopContextViewport({
    nodes: fitNodes,
    hopBandHeadings: headings,
    canvasWidth: 1200,
    canvasHeight: 640,
  })!;
  const required = fitNodes.filter((node) => node.hopDistance <= 1);
  for (const node of required) {
    assert.equal(
      isNodeVisibleInViewport({ node, viewport, canvasWidth: 1200, canvasHeight: 640 }),
      true,
      `${node.id} must stay in the initial readable viewport`
    );
  }
  assert.ok(viewport.zoom >= 0.6 && viewport.zoom <= 0.9, `typical 1440-class zoom should be readable, got ${viewport.zoom.toFixed(3)}`);
  const fullBounds = pathNodesBounds(fitNodes)!;
  const fullViewport = getViewportForBounds(fullBounds, 1200, 640, 0.2, 1.12, 0.18);
  assert.ok(fullViewport.zoom < 0.55, "fitting every hop-2 node would still produce the tiny overview zoom");
  assert.ok(viewport.zoom > fullViewport.zoom + 0.12, "readable fit must be meaningfully larger than full-graph fit");
});

test("toolbar ปรับให้พอดีหน้าจอ still fits the entire loaded graph", () => {
  const toolbarFits = [...pageSource.matchAll(/onClick=\{\(\) => fitView\(\{ duration: 300 \}\)\}/g)];
  assert.ok(toolbarFits.length >= 2, "desktop and compact toolbars must keep a full-graph fit");
  assert.doesNotMatch(pageSource, /onClick=\{\(\) => fitView\(\{ nodes:/);
});

test("PATH empty state does not refit; selected destination still uses drawer-aware path fit", () => {
  assert.equal(
    resolveInitialViewportKind({
      focusType: "PERSON",
      depth: 2,
      viewMode: "SELECTED_PATH",
      canvasArrangement: "GROUP_BY_HOP",
      hasSelectedSecondary: false,
    }),
    "PRESERVE"
  );
  assert.equal(
    resolveInitialViewportKind({
      focusType: "PERSON",
      depth: 2,
      viewMode: "SELECTED_PATH",
      canvasArrangement: "VERTICAL_PATH",
      hasSelectedSecondary: true,
    }),
    "DRAWER_AWARE_PATH"
  );
  assert.match(pageSource, /initialViewportKind === "PRESERVE"/);
  assert.match(pageSource, /computeReadableHopContextViewport/);
  assert.match(pageSource, /computeDrawerAwarePathViewport/);
  assert.match(pageSource, /NETWORK_SAME_ROUTE_ROUTER_OPTIONS/);
});

test("no initial or selected-path fit while dragging; same-route stays scroll:false", () => {
  assert.match(pageSource, /if \(isNodeDraggingRef\.current\) return;/);
  assert.match(pageSource, /shouldFitSelectedPath\([\s\S]*isDragging: isNodeDraggingRef\.current/);
  assert.match(pageSource, /router\.push\(buildNetworkSameRouteHref\(next\),\s*NETWORK_SAME_ROUTE_ROUTER_OPTIONS\)/);
  const buildEffectDeps = pageSource.match(/\n  \}, \[neighborhood\.data, querySignature[^\]]+\]\);/);
  assert.ok(buildEffectDeps, "could not locate graph-build effect deps");
  assert.doesNotMatch(buildEffectDeps[0], /hoveredNodeId|hoveredEdgeId/);
});
