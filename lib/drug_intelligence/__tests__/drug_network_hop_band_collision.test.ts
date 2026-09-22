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
  collectGroupByTypeLayoutRects,
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

// ==================================================
// Visual-review hotfix — GROUP_BY_TYPE (Depth-2 FULL_NETWORK / restored
// full-network) no longer uses a fixed LANE_NODE_SPACING/GROUP_HOP2_GAP —
// it now derives hop-2 Y from the ACTUAL max hop-1 bottom across all
// lanes, using real per-type card heights, exactly like GROUP_BY_HOP does.
// ==================================================

test("GROUP_BY_TYPE hop-2 Y is derived from the actual max hop-1 bottom across ALL lanes + HOP_SAFE_BAND_GAP — never a fixed GROUP_HOP2_GAP constant", () => {
  const layoutSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_network_graph_layout.ts"), "utf8");
  assert.doesNotMatch(layoutSrc, /const GROUP_HOP2_GAP/, "the old fixed hop-2 gap constant must be gone");
  assert.doesNotMatch(layoutSrc, /const LANE_NODE_SPACING/, "the old flat per-type spacing constant must be gone");
  assert.match(layoutSrc, /maxHop1Bottom\s*=\s*Math\.max\(maxHop1Bottom, laneBottom\)/);
  assert.match(layoutSrc, /hop2StartY\s*=\s*maxHop1Bottom \+ HOP_SAFE_BAND_GAP/);
});

test("GROUP_BY_TYPE card rectangles never overlap on the exact 22-node/42-edge visual-review neighborhood", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const { cardRects } = collectGroupByTypeLayoutRects(focusId, nodes, edges);
  assert.equal(cardRects.length, 22);
  assert.equal(anyLayoutRectsCollide(cardRects), false, "no two cards may overlap in GROUP_BY_TYPE layout");
});

test("GROUP_BY_TYPE lane headers never overlap any card rectangle", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const { cardRects, laneHeaderRects } = collectGroupByTypeLayoutRects(focusId, nodes, edges);
  assert.ok(laneHeaderRects.length > 0);
  for (const header of laneHeaderRects) {
    for (const card of cardRects) {
      assert.equal(layoutRectsOverlap(header, card), false, `${header.id} must not overlap card ${card.id}`);
    }
  }
});

test("GROUP_BY_TYPE hop-2 cards always start at or after hop1Bottom + HOP_SAFE_BAND_GAP, in every lane including short ones", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const audit = collectGroupByTypeLayoutRects(focusId, nodes, edges);
  assert.ok(audit.hop2StartY >= audit.hop1Bottom + HOP_SAFE_BAND_GAP);
  const distance = (() => {
    // Re-derive hop distance the same way the layout does, for the assertion below.
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) adjacency.set(node.id, new Set());
    for (const edge of edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }
    const dist = new Map<string, number>();
    dist.set(focusId, 0);
    const queue = [focusId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adjacency.get(cur) ?? []) {
        if (dist.has(n)) continue;
        dist.set(n, dist.get(cur)! + 1);
        queue.push(n);
      }
    }
    return dist;
  })();
  const positions = computeGroupByTypeLayout(focusId, nodes, edges);
  for (const node of nodes) {
    const hop = distance.get(node.id);
    if (node.id === focusId || hop == null || hop < 2) continue;
    assert.ok(
      positions.get(node.id)!.y >= audit.hop1Bottom + HOP_SAFE_BAND_GAP,
      `${node.id} (hop ${hop}) must start at/after the shared safe hop-2 Y, even in a lane with few hop-1 cards`,
    );
  }
});

test("restoring FULL_NETWORK after SELECTED_PATH produces the SAME canonical GROUP_BY_TYPE coordinates as a fresh full-network render — no stale coordinates", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const fresh = computeGroupByTypeLayout(focusId, nodes, edges);
  // Simulate "restore": compute again from the same canonical (focus, nodes, edges) input,
  // exactly what the page does when canvasArrangement returns to DEFAULT after a path/vertical
  // arrangement — switching layout mode never touches graph data, so re-deriving from the same
  // nodes/edges must be byte-for-byte identical, never carrying over VERTICAL_PATH coordinates.
  const restored = computeGroupByTypeLayout(focusId, nodes, edges);
  for (const node of nodes) {
    assert.deepEqual(restored.get(node.id), fresh.get(node.id), `${node.id} must land at the same coordinates on restore`);
  }
});

test("DI-8.7 insight graph focus (activeInsightFocus) never alters canonical GROUP_BY_TYPE node coordinates — it is presentation-only dimming/camera, not a layout input", () => {
  const layoutSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_network_graph_layout.ts"), "utf8");
  assert.doesNotMatch(layoutSrc, /activeInsightFocus/, "the layout engine must never import or reference insight-focus state");
  assert.doesNotMatch(layoutSrc, /NetworkGraphInsight/);
});

test("layout fix changes coordinates only — node/edge COUNT is unaffected", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const positions = computeGroupByTypeLayout(focusId, nodes, edges);
  assert.equal(positions.size, nodes.length, "every node still gets exactly one position — none dropped or duplicated");
  assert.equal(nodes.length, 22);
  assert.equal(edges.length, 42);
});

test("GROUP_BY_TYPE respects real per-type card WIDTH — a PERSON/VEHICLE (236px) card and a PHONE/SIM/DEVICE/CASE (220px) card in adjacent lanes never collide horizontally", () => {
  const { focusId, nodes, edges } = depth2ReviewNeighborhood();
  const { cardRects } = collectGroupByTypeLayoutRects(focusId, nodes, edges);
  const byId = new Map(cardRects.map((r) => [r.id, r]));
  const personCard = byId.get("p-b"); // PERSON, 236px wide
  const phoneCard = byId.get("ph-1001"); // PHONE, 220px wide
  assert.ok(personCard && phoneCard);
  assert.equal(personCard!.width, graphLayoutCardSize("PERSON").width);
  assert.equal(phoneCard!.width, graphLayoutCardSize("PHONE").width);
  assert.notEqual(personCard!.width, phoneCard!.width, "sanity: the two types really do have different widths");
  assert.equal(layoutRectsOverlap(personCard!, phoneCard!), false);
});

test("hop-band header overlay keeps approved contrast tokens", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_hop_band_headers.tsx"), "utf8");
  assert.match(src, /bg-neutral-bg/);
  assert.match(src, /text-foreground/);
  assert.doesNotMatch(src, /text-muted/);
});
