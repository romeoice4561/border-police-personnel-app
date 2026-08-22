/**
 * Tests for the DI-5 deterministic radial layout helper.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRadialLayout } from "@/lib/drug_intelligence/drug_network_graph_layout";

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
