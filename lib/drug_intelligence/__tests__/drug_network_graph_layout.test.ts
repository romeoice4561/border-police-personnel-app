/**
 * Tests for the deterministic client-side layout engine (Phase DI-5's
 * original radial layout, extended by Phase DI-5.3 Sections 4-10 with a
 * full multi-mode layout system: Person-centered, Case-centered,
 * Hierarchical, Group-by-type, Compact, Path, plus the AUTO resolver).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeRadialLayout,
  computePersonCenteredLayout,
  computeCaseCenteredLayout,
  computeHierarchicalLayout,
  computeGroupByTypeLayout,
  groupByTypeLaneOrder,
  computeCompactLayout,
  computePathLayout,
  resolveAutoLayoutMode,
  computeLayoutForMode,
  edgeTypeForLayoutMode,
  type LayoutNodeInput,
} from "@/lib/drug_intelligence/drug_network_graph_layout";

test("focus node is always placed at the center (0,0)", () => {
  const positions = computeRadialLayout("a", [{ id: "a" }, { id: "b" }], [{ source: "a", target: "b" }]);
  assert.deepEqual(positions.get("a"), { x: 0, y: 0 });
});

test("a direct neighbor is placed on the first ring, not at the center", () => {
  const positions = computeRadialLayout("a", [{ id: "a" }, { id: "b" }], [{ source: "a", target: "b" }]);
  const b = positions.get("b")!;
  const distance = Math.hypot(b.x, b.y);
  assert.ok(distance > 0);
});

test("a 2-hop node is placed further from center than a 1-hop node", () => {
  const positions = computeRadialLayout(
    "a",
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ]
  );
  const distB = Math.hypot(positions.get("b")!.x, positions.get("b")!.y);
  const distC = Math.hypot(positions.get("c")!.x, positions.get("c")!.y);
  assert.ok(distC > distB);
});

test("layout is deterministic — same input always produces the same output", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const edges = [
    { source: "a", target: "b" },
    { source: "a", target: "c" },
    { source: "a", target: "d" },
  ];
  const first = computeRadialLayout("a", nodes, edges);
  const second = computeRadialLayout("a", nodes, edges);
  for (const id of ["a", "b", "c", "d"]) {
    assert.deepEqual(first.get(id), second.get(id));
  }
});

test("every node gets a position, none are dropped", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const edges = [{ source: "a", target: "b" }];
  const positions = computeRadialLayout("a", nodes, edges);
  assert.equal(positions.size, 3);
});

test("empty node list returns an empty position map without throwing", () => {
  const positions = computeRadialLayout("a", [], []);
  assert.equal(positions.size, 0);
});

// ---------------------------------------------------------------------
// Fixture: a realistic Person-focused neighborhood mirroring the DI-5.2 QA
// dataset's shape — a focus Person with a Case, a Phone, a Vehicle on ring
// 1, and a second Person + a shared Location on ring 2.
function personNeighborhood(): { focusId: string; nodes: LayoutNodeInput[]; edges: { source: string; target: string }[] } {
  return {
    focusId: "personA",
    nodes: [
      { id: "personA", type: "PERSON" },
      { id: "case1", type: "CASE" },
      { id: "phone1", type: "PHONE" },
      { id: "vehicle1", type: "VEHICLE" },
      { id: "personB", type: "PERSON" },
      { id: "loc1", type: "LOCATION" },
    ],
    edges: [
      { source: "personA", target: "case1" },
      { source: "personA", target: "phone1" },
      { source: "personA", target: "vehicle1" },
      { source: "case1", target: "personB" },
      { source: "case1", target: "loc1" },
    ],
  };
}

test("Person-centered: focus stays at the exact center across the sectored layout", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const positions = computePersonCenteredLayout(focusId, nodes, edges);
  assert.deepEqual(positions.get(focusId), { x: 0, y: 0 });
});

test("Person-centered: same-type ring-1 siblings are NOT collapsed onto the same angle (deterministic sector spread)", () => {
  const nodes: LayoutNodeInput[] = [
    { id: "focus", type: "PERSON" },
    { id: "phoneA", type: "PHONE" },
    { id: "phoneB", type: "PHONE" },
    { id: "phoneC", type: "PHONE" },
  ];
  const edges = [
    { source: "focus", target: "phoneA" },
    { source: "focus", target: "phoneB" },
    { source: "focus", target: "phoneC" },
  ];
  const positions = computePersonCenteredLayout("focus", nodes, edges);
  const angles = ["phoneA", "phoneB", "phoneC"].map((id) => {
    const p = positions.get(id)!;
    return Math.atan2(p.y, p.x);
  });
  const unique = new Set(angles.map((a) => a.toFixed(4)));
  assert.equal(unique.size, 3, "each same-type sibling must get a distinct angle");
});

test("Person-centered: deterministic — same input produces the same output", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const first = computePersonCenteredLayout(focusId, nodes, edges);
  const second = computePersonCenteredLayout(focusId, nodes, edges);
  for (const n of nodes) assert.deepEqual(first.get(n.id), second.get(n.id));
});

test("Person-centered: no two nodes share the exact same coordinates", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const positions = computePersonCenteredLayout(focusId, nodes, edges);
  const seen = new Set<string>();
  for (const [, pos] of positions) {
    const key = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;
    assert.ok(!seen.has(key), `duplicate coordinate at ${key}`);
    seen.add(key);
  }
});

// ---------------------------------------------------------------------

function caseNeighborhood(): { focusId: string; nodes: LayoutNodeInput[]; edges: { source: string; target: string }[] } {
  return {
    focusId: "case1",
    nodes: [
      { id: "case1", type: "CASE" },
      { id: "personA", type: "PERSON" },
      { id: "phone1", type: "PHONE" },
      { id: "device1", type: "DEVICE" },
      { id: "loc1", type: "LOCATION" },
    ],
    edges: [
      { source: "case1", target: "personA" },
      { source: "case1", target: "phone1" },
      { source: "case1", target: "device1" },
      { source: "case1", target: "loc1" },
    ],
  };
}

test("Case-centered: focus case stays at the exact center", () => {
  const { focusId, nodes, edges } = caseNeighborhood();
  const positions = computeCaseCenteredLayout(focusId, nodes, edges);
  assert.deepEqual(positions.get(focusId), { x: 0, y: 0 });
});

test("Case-centered: Person lands top-left quadrant, Phone top-right, Device bottom-right, Location bottom-left", () => {
  const { focusId, nodes, edges } = caseNeighborhood();
  const positions = computeCaseCenteredLayout(focusId, nodes, edges);
  const person = positions.get("personA")!;
  const phone = positions.get("phone1")!;
  const device = positions.get("device1")!;
  const loc = positions.get("loc1")!;
  assert.ok(person.x < 0 && person.y < 0, "person should be top-left (negative x, negative y)");
  assert.ok(phone.x > 0 && phone.y < 0, "phone should be top-right (positive x, negative y)");
  assert.ok(device.x > 0 && device.y > 0, "device should be bottom-right (positive x, positive y)");
  assert.ok(loc.x < 0 && loc.y > 0, "location should be bottom-left (negative x, positive y)");
});

test("Case-centered: deterministic across repeated calls", () => {
  const { focusId, nodes, edges } = caseNeighborhood();
  const first = computeCaseCenteredLayout(focusId, nodes, edges);
  const second = computeCaseCenteredLayout(focusId, nodes, edges);
  for (const n of nodes) assert.deepEqual(first.get(n.id), second.get(n.id));
});

// ---------------------------------------------------------------------

test("Hierarchical: hop-layer assignment places the focus at layer 0 (y=0) and each hop further down", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const positions = computeHierarchicalLayout(focusId, nodes, edges);
  assert.equal(positions.get(focusId)!.y, 0);
  assert.ok(positions.get("case1")!.y > 0);
  assert.ok(positions.get("personB")!.y > positions.get("case1")!.y, "2-hop node sits in a lower layer than a 1-hop node");
});

test("Hierarchical: nodes in the same layer never share an x coordinate", () => {
  const nodes: LayoutNodeInput[] = [
    { id: "focus", type: "PERSON" },
    { id: "a", type: "PHONE" },
    { id: "b", type: "PHONE" },
    { id: "c", type: "CASE" },
  ];
  const edges = [
    { source: "focus", target: "a" },
    { source: "focus", target: "b" },
    { source: "focus", target: "c" },
  ];
  const positions = computeHierarchicalLayout("focus", nodes, edges);
  const xs = ["a", "b", "c"].map((id) => positions.get(id)!.x);
  assert.equal(new Set(xs).size, 3);
});

test("Hierarchical: deterministic layer-sort ordering across repeated calls", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const first = computeHierarchicalLayout(focusId, nodes, edges);
  const second = computeHierarchicalLayout(focusId, nodes, edges);
  for (const n of nodes) assert.deepEqual(first.get(n.id), second.get(n.id));
});

// ---------------------------------------------------------------------

test("Group-by-type: every node of the same type shares the same lane (x coordinate)", () => {
  const nodes: LayoutNodeInput[] = [
    { id: "p1", type: "PERSON" },
    { id: "p2", type: "PERSON" },
    { id: "ph1", type: "PHONE" },
  ];
  const positions = computeGroupByTypeLayout("p1", nodes);
  assert.equal(positions.get("p1")!.x, positions.get("p2")!.x);
  assert.notEqual(positions.get("p1")!.x, positions.get("ph1")!.x);
});

test("Group-by-type: within a lane, nodes get distinct y coordinates (stacked, not overlapping)", () => {
  const nodes: LayoutNodeInput[] = [
    { id: "p1", type: "PERSON" },
    { id: "p2", type: "PERSON" },
    { id: "p3", type: "PERSON" },
  ];
  const positions = computeGroupByTypeLayout("p1", nodes);
  const ys = nodes.map((n) => positions.get(n.id)!.y);
  assert.equal(new Set(ys).size, 3);
});

test("Group-by-type: lane order is fixed and includes every DrugGraphNodeType exactly once", () => {
  const order = groupByTypeLaneOrder();
  assert.equal(new Set(order).size, order.length);
  assert.deepEqual([...order].sort(), ["CASE", "DEVICE", "LOCATION", "PERSON", "PHONE", "SIM", "VEHICLE"]);
});

// ---------------------------------------------------------------------

test("Compact: no two nodes end up closer than the minimum spacing after relaxation", () => {
  // A cluster where the base radial layout would otherwise pack many
  // same-type nodes very close together on a small ring.
  const nodes: LayoutNodeInput[] = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, type: "PHONE" as const }));
  nodes.unshift({ id: "focus", type: "PERSON" });
  const edges = nodes.slice(1).map((n) => ({ source: "focus", target: n.id }));
  const positions = computeCompactLayout("focus", nodes, edges);
  const ids = [...positions.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = positions.get(ids[i])!;
      const b = positions.get(ids[j])!;
      const dist = Math.hypot(b.x - a.x, a.y - b.y === 0 ? b.y - a.y : b.y - a.y);
      assert.ok(dist >= 129, `nodes ${ids[i]} and ${ids[j]} are ${dist.toFixed(1)}px apart, below the minimum spacing`);
    }
  }
});

test("Compact: focus node stays exactly centered", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const positions = computeCompactLayout(focusId, nodes, edges);
  assert.deepEqual(positions.get(focusId), { x: 0, y: 0 });
});

test("Compact: deterministic — repeated calls on the same input converge to the same output", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const first = computeCompactLayout(focusId, nodes, edges);
  const second = computeCompactLayout(focusId, nodes, edges);
  for (const n of nodes) assert.deepEqual(first.get(n.id), second.get(n.id));
});

test("Compact: every input node still gets a position, none dropped by the relaxation pass", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const positions = computeCompactLayout(focusId, nodes, edges);
  assert.equal(positions.size, nodes.length);
});

// ---------------------------------------------------------------------

test("Path: path nodes are placed in exact left-to-right step order", () => {
  const pathOrder = ["a", "b", "c", "d"];
  const positions = computePathLayout(pathOrder, pathOrder.map((id) => ({ id, type: "PERSON" as const })));
  const xs = pathOrder.map((id) => positions.get(id)!.x);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], "each subsequent path step must be further right than the previous");
  for (const id of pathOrder) assert.equal(positions.get(id)!.y, 0, "path nodes sit on the same row");
});

test("Path: off-path nodes are placed on a separate row, never colliding with the path row", () => {
  const pathOrder = ["a", "b"];
  const allNodes = [
    { id: "a", type: "PERSON" as const },
    { id: "b", type: "PERSON" as const },
    { id: "offpath1", type: "CASE" as const },
  ];
  const positions = computePathLayout(pathOrder, allNodes);
  assert.notEqual(positions.get("offpath1")!.y, 0);
});

test("Path: deterministic ordering for the same path input", () => {
  const pathOrder = ["a", "b", "c"];
  const allNodes = pathOrder.map((id) => ({ id, type: "PERSON" as const }));
  const first = computePathLayout(pathOrder, allNodes);
  const second = computePathLayout(pathOrder, allNodes);
  for (const id of pathOrder) assert.deepEqual(first.get(id), second.get(id));
});

// ---------------------------------------------------------------------

test("AUTO resolver: PERSON focus resolves to PERSON_CENTERED", () => {
  assert.equal(resolveAutoLayoutMode({ focusType: "PERSON", isPathResult: false, nodeCount: 5 }), "PERSON_CENTERED");
});

test("AUTO resolver: CASE focus resolves to CASE_CENTERED", () => {
  assert.equal(resolveAutoLayoutMode({ focusType: "CASE", isPathResult: false, nodeCount: 5 }), "CASE_CENTERED");
});

test("AUTO resolver: a path result always resolves to PATH regardless of focus type", () => {
  assert.equal(resolveAutoLayoutMode({ focusType: "PERSON", isPathResult: true, nodeCount: 5 }), "PATH");
  assert.equal(resolveAutoLayoutMode({ focusType: "CASE", isPathResult: true, nodeCount: 5 }), "PATH");
});

test("AUTO resolver: a large non-Person/Case-focused neighborhood resolves to COMPACT", () => {
  assert.equal(resolveAutoLayoutMode({ focusType: "PHONE", isPathResult: false, nodeCount: 30 }), "COMPACT");
});

test("AUTO resolver: a small non-Person/Case-focused neighborhood resolves to HIERARCHICAL", () => {
  assert.equal(resolveAutoLayoutMode({ focusType: "PHONE", isPathResult: false, nodeCount: 5 }), "HIERARCHICAL");
});

test("AUTO resolver: deterministic — identical context always resolves to the same mode", () => {
  const ctx = { focusType: "VEHICLE" as const, isPathResult: false, nodeCount: 12 };
  assert.equal(resolveAutoLayoutMode(ctx), resolveAutoLayoutMode(ctx));
});

// ---------------------------------------------------------------------

test("computeLayoutForMode: dispatches to each mode without throwing and preserves every node id", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const modes = ["PERSON_CENTERED", "CASE_CENTERED", "HIERARCHICAL", "GROUP_BY_TYPE", "COMPACT"] as const;
  for (const mode of modes) {
    const positions = computeLayoutForMode(mode, focusId, nodes, edges);
    assert.deepEqual(
      [...positions.keys()].sort(),
      nodes.map((n) => n.id).sort(),
      `mode ${mode} must preserve every node id`
    );
  }
});

test("computeLayoutForMode: PATH mode preserves ids including off-path nodes", () => {
  const { nodes } = personNeighborhood();
  const positions = computeLayoutForMode("PATH", "personA", nodes, [], ["personA", "case1", "personB"]);
  assert.deepEqual(
    [...positions.keys()].sort(),
    nodes.map((n) => n.id).sort()
  );
});

test("computeLayoutForMode: switching mode on the SAME node/edge set never changes the set of node ids returned (Section 11 — layout switch never touches graph data)", () => {
  const { focusId, nodes, edges } = personNeighborhood();
  const before = computeLayoutForMode("PERSON_CENTERED", focusId, nodes, edges);
  const after = computeLayoutForMode("HIERARCHICAL", focusId, nodes, edges);
  assert.deepEqual([...before.keys()].sort(), [...after.keys()].sort());
});

// ---------------------------------------------------------------------

test("edgeTypeForLayoutMode: hierarchical/group/path use smoothstep, radial-family modes use the built-in bezier-curve renderer (xyflow type name \"default\")", () => {
  assert.equal(edgeTypeForLayoutMode("HIERARCHICAL"), "smoothstep");
  assert.equal(edgeTypeForLayoutMode("GROUP_BY_TYPE"), "smoothstep");
  assert.equal(edgeTypeForLayoutMode("PATH"), "smoothstep");
  assert.equal(edgeTypeForLayoutMode("PERSON_CENTERED"), "default");
  assert.equal(edgeTypeForLayoutMode("CASE_CENTERED"), "default");
  assert.equal(edgeTypeForLayoutMode("COMPACT"), "default");
});
