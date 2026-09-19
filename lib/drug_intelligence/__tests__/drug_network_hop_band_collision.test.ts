/**
 * Depth-2 hop-band collision / band-gap safeguards.
 * Presentation only — does not change graph query semantics.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  anyLayoutRectsCollide,
  collectGroupByHopLayoutRects,
  computeGroupByTypeLayout,
  graphLayoutCardSize,
  HOP_SAFE_BAND_GAP,
  HOP_SAFE_BAND_GAP_MAX,
  HOP_SAFE_BAND_GAP_MIN,
  layoutRectsOverlap,
  planGroupByHopLayout,
  type LayoutNodeInput,
  type LayoutEdgeInput,
} from "@/lib/drug_intelligence/drug_network_graph_layout";

const ROOT = process.cwd();

/**
 * Representative Depth-2 neighborhood sized like the visual-review Person graph
 * (22 nodes / 42 edges): 3 cases, 2 phones, 1 SIM, 1 device, 1 vehicle at hop 1,
 * plus hop-2 persons/cases/phones/locations.
 */
function depth2ReviewNeighborhood(): {
  focusId: string;
  nodes: LayoutNodeInput[];
  edges: LayoutEdgeInput[];
} {
  const focusId = "p-kittisak";
  const nodes: LayoutNodeInput[] = [
    { id: focusId, type: "PERSON" },
    { id: "v-9009", type: "VEHICLE" },
    { id: "c-001", type: "CASE" },
    { id: "c-002", type: "CASE" },
    { id: "c-003", type: "CASE" },
    { id: "ph-1001", type: "PHONE" },
    { id: "ph-1005", type: "PHONE" },
    { id: "sim-1", type: "SIM" },
    { id: "dev-1", type: "DEVICE" },
    { id: "p-b", type: "PERSON" },
    { id: "p-c", type: "PERSON" },
    { id: "p-d", type: "PERSON" },
    { id: "p-e", type: "PERSON" },
    { id: "c-004", type: "CASE" },
    { id: "c-005", type: "CASE" },
    { id: "ph-2001", type: "PHONE" },
    { id: "ph-2002", type: "PHONE" },
    { id: "loc-1", type: "LOCATION" },
    { id: "loc-2", type: "LOCATION" },
    { id: "sim-2", type: "SIM" },
    { id: "dev-2", type: "DEVICE" },
    { id: "v-2", type: "VEHICLE" },
  ];
  const edges: LayoutEdgeInput[] = [
    { source: focusId, target: "v-9009" },
    { source: focusId, target: "c-001" },
    { source: focusId, target: "c-002" },
    { source: focusId, target: "c-003" },
    { source: focusId, target: "ph-1001" },
    { source: focusId, target: "ph-1005" },
    { source: focusId, target: "sim-1" },
    { source: focusId, target: "dev-1" },
    { source: "c-001", target: "ph-1001" },
    { source: "c-001", target: "v-9009" },
    { source: "c-002", target: "ph-1005" },
    { source: "c-003", target: "sim-1" },
    { source: "c-003", target: "dev-1" },
    { source: "ph-1001", target: "sim-1" },
    { source: "sim-1", target: "dev-1" },
    { source: "c-001", target: "p-b" },
    { source: "c-001", target: "p-c" },
    { source: "c-002", target: "p-d" },
    { source: "c-003", target: "p-e" },
    { source: "c-001", target: "loc-1" },
    { source: "c-002", target: "loc-2" },
    { source: "c-003", target: "c-004" },
    { source: "ph-1001", target: "ph-2001" },
    { source: "ph-1005", target: "ph-2002" },
    { source: "p-b", target: "c-005" },
    { source: "p-c", target: "sim-2" },
    { source: "p-d", target: "dev-2" },
    { source: "p-e", target: "v-2" },
    { source: "c-004", target: "loc-1" },
    { source: "c-005", target: "loc-2" },
    { source: "ph-2001", target: "c-004" },
    { source: "ph-2002", target: "c-005" },
    { source: "sim-2", target: "c-004" },
    { source: "dev-2", target: "c-005" },
    { source: "v-2", target: "c-004" },
    { source: "p-b", target: "ph-2001" },
    { source: "p-c", target: "ph-2002" },
    { source: "p-d", target: "sim-2" },
    { source: "p-e", target: "dev-2" },
    { source: "loc-1", target: "c-005" },
    { source: "loc-2", target: "c-004" },
    { source: "v-9009", target: "c-002" },
  ];
  assert.equal(nodes.length, 22);
  assert.equal(edges.length, 42);
  return { focusId, nodes, edges };
}

test("Depth-2 hop-2 band starts below the tallest hop-1 card bottom plus dense safe gap", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const audit = collectGroupByHopLayoutRects(focusId, nodes, edges);
  const gap = audit.hop2BandTop - audit.hop1Bottom;
  assert.equal(HOP_SAFE_BAND_GAP, 40, "density polish uses a tight 40px inter-band clearance");
  assert.ok(gap >= HOP_SAFE_BAND_GAP_MIN, `inter-band gap ${gap} must stay collision-safe (>= ${HOP_SAFE_BAND_GAP_MIN})`);
  assert.ok(gap <= HOP_SAFE_BAND_GAP_MAX, `inter-band gap ${gap} must not reintroduce excess whitespace (<= ${HOP_SAFE_BAND_GAP_MAX})`);
  assert.equal(gap, HOP_SAFE_BAND_GAP);
  const plan = planGroupByHopLayout(focusId, nodes, edges);
  const hop2Cards = nodes
    .filter((node) => node.id !== focusId)
    .filter((node) => {
      const y = plan.positions.get(node.id)!.y;
      return y >= audit.hop2BandTop;
    });
  assert.ok(hop2Cards.length >= 8);
  for (const node of hop2Cards) {
    assert.ok(
      plan.positions.get(node.id)!.y >= audit.hop1Bottom + HOP_SAFE_BAND_GAP_MIN,
      `${node.id} must not enter hop-1 vertical range`,
    );
  }
});

test("Depth-2 layout still derives Hop-2 Y from hop1Bottom, never fixed hop1 row-count spacing", () => {
  const layoutSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_network_graph_layout.ts"), "utf8");
  assert.match(layoutSrc, /hop1Bottom \+ HOP_SAFE_BAND_GAP/);
  assert.doesNotMatch(layoutSrc, /HOP1_START_Y \+ hop1Rows/);
  assert.doesNotMatch(layoutSrc, /const HOP_NODE_SPACING = 190/);
});

test("Depth-2 card rectangles never overlap (hop1/hop1, hop2/hop2, hop1/hop2)", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const { cardRects } = collectGroupByHopLayoutRects(focusId, nodes, edges);
  assert.equal(cardRects.length, 22);
  assert.equal(anyLayoutRectsCollide(cardRects), false);
});

test("Depth-2 band and type headers do not occupy card rectangles", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const { cardRects, bandHeaderRects, typeHeaderRects } = collectGroupByHopLayoutRects(focusId, nodes, edges);
  assert.ok(bandHeaderRects.some((rect) => rect.id === "band-1"));
  assert.ok(bandHeaderRects.some((rect) => rect.id === "band-2"));
  assert.ok(typeHeaderRects.length >= 8);
  for (const header of [...bandHeaderRects, ...typeHeaderRects]) {
    for (const card of cardRects) {
      assert.equal(
        layoutRectsOverlap(header, card),
        false,
        `${header.id} must not overlap card ${card.id}`
      );
    }
  }
});

test("within a hop/type lane, stacked cards use card height + row gap (never fixed under-height spacing)", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const plan = planGroupByHopLayout(focusId, nodes, edges);
  const caseHop1 = ["c-001", "c-002", "c-003"]
    .map((id) => plan.positions.get(id)!)
    .sort((a, b) => a.y - b.y);
  const step = caseHop1[1]!.y - caseHop1[0]!.y;
  const expected = graphLayoutCardSize("CASE").height + 24;
  assert.equal(step, expected);
  assert.ok(step >= graphLayoutCardSize("CASE").height + 20, "row gap must clear the rendered card height");
  assert.ok(
    caseHop1[0]!.y + graphLayoutCardSize("CASE").height <= caseHop1[1]!.y,
    "stacked CASE cards must not overlap"
  );
});

test("Depth-1 GROUP_BY_TYPE constants stay on the approved lane sizing (no hop-band bleed)", () => {
  const layoutSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_network_graph_layout.ts"), "utf8");
  assert.match(layoutSrc, /const LANE_WIDTH = 380/);
  assert.match(layoutSrc, /const LANE_NODE_SPACING = 172/);
  assert.match(layoutSrc, /const GROUP_HOP1_Y = 360/);
  const positions = computeGroupByTypeLayout(
    "p1",
    [
      { id: "p1", type: "PERSON" },
      { id: "c1", type: "CASE" },
      { id: "ph1", type: "PHONE" },
    ],
    [
      { source: "p1", target: "c1" },
      { source: "p1", target: "ph1" },
    ]
  );
  assert.deepEqual(positions.get("p1"), { x: 0, y: 0 });
  assert.equal(positions.get("c1")!.y, 360);
});

test("hop-band header overlay keeps approved contrast tokens", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_hop_band_headers.tsx"), "utf8");
  assert.match(src, /bg-neutral-bg/);
  assert.match(src, /text-foreground/);
  assert.doesNotMatch(src, /text-muted/);
});
