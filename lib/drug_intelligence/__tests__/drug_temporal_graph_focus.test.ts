/**
 * DI-8.7 V1.5B — Temporal Cross-View Intelligence: Crime Clock → Network
 * Graph focus. Pure-engine tests for computeTemporalGraphFocus and
 * isEffectiveTemporalNarrowing (Section 18 items A–I, plus J–P covered
 * jointly with the existing temporal-selection tests since the subgraph
 * derivation is selection-agnostic — it only ever consumes
 * matchingCaseIds, which the existing engine already tests exhaustively
 * for time-only/weekday-only/date-only/combined/midnight-wrap/missing-
 * time semantics).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeTemporalGraphFocus,
  isEffectiveTemporalNarrowing,
  emptyTemporalSelection,
  type TemporalSelection,
  type TemporalGraphFocusNode,
  type TemporalGraphFocusEdge,
} from "../drug_temporal_explorer.js";

function n(id: string): TemporalGraphFocusNode {
  return { id };
}
function e(id: string, source: string, target: string): TemporalGraphFocusEdge {
  return { id, source, target };
}

// A. Temporal focus includes every matching CASE node.
test("A. every matching CASE node id is included in the focus nodeIds", () => {
  const nodes = [n("c1"), n("c2"), n("p1")];
  const edges = [e("e1", "c1", "p1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1", "c2"], selectionLabel: "test" });
  assert.ok(focus);
  assert.ok(focus!.nodeIds.includes("c1"));
  assert.ok(focus!.nodeIds.includes("c2"));
});

// B. Includes direct graph neighbors of matching CASE nodes.
test("B. the opposite endpoint of an edge touching a matching case is included", () => {
  const nodes = [n("c1"), n("p1"), n("ph1")];
  const edges = [e("e1", "c1", "p1"), e("e2", "c1", "ph1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1"], selectionLabel: "test" });
  assert.deepEqual(new Set(focus!.nodeIds), new Set(["c1", "p1", "ph1"]));
});

// C. Includes only edges directly touching matching CASE nodes.
test("C. an edge between two non-case, non-matching-touching nodes is excluded", () => {
  const nodes = [n("c1"), n("p1"), n("ph1"), n("veh1")];
  const edges = [e("e1", "c1", "p1"), e("e2", "p1", "ph1"), e("e3", "ph1", "veh1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1"], selectionLabel: "test" });
  assert.deepEqual(focus!.edgeIds, ["e1"]);
  assert.ok(!focus!.nodeIds.includes("ph1"));
  assert.ok(!focus!.nodeIds.includes("veh1"));
});

// D. Does not recursively expand from supporting entities.
test("D. a case's supporting entity's OTHER edges are never followed (no BFS)", () => {
  const nodes = [n("c1"), n("p1"), n("c2"), n("veh1")];
  // c1 -> p1 (matching case's direct neighbor)
  // p1 -> c2 -> veh1 (p1's own unrelated case chain, must not be pulled in)
  const edges = [e("e1", "c1", "p1"), e("e2", "p1", "c2"), e("e3", "c2", "veh1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1"], selectionLabel: "test" });
  assert.deepEqual(new Set(focus!.nodeIds), new Set(["c1", "p1"]));
  assert.deepEqual(focus!.edgeIds, ["e1"]);
  assert.ok(!focus!.nodeIds.includes("c2"));
  assert.ok(!focus!.nodeIds.includes("veh1"));
});

// E. Shared entity connected to matching + non-matching cases: non-matching case edge is not emphasized.
test("E. a phone shared between a matching case and a non-matching case only pulls in the matching case's edge", () => {
  const nodes = [n("c1"), n("c5"), n("ph1")];
  const edges = [e("e1", "c1", "ph1"), e("e2", "c5", "ph1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1"], selectionLabel: "test" });
  assert.deepEqual(new Set(focus!.nodeIds), new Set(["c1", "ph1"]));
  assert.deepEqual(focus!.edgeIds, ["e1"]);
  assert.ok(!focus!.nodeIds.includes("c5"));
  assert.ok(!focus!.edgeIds.includes("e2"));
});

// F. Duplicate case ids do not duplicate focus ids.
test("F. duplicate matchingCaseIds entries never produce duplicate nodeIds/edgeIds", () => {
  const nodes = [n("c1"), n("p1")];
  const edges = [e("e1", "c1", "p1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1", "c1", "c1"], selectionLabel: "test" });
  assert.deepEqual(focus!.caseIds, ["c1"]);
  assert.equal(focus!.nodeIds.filter((id) => id === "c1").length, 1);
  assert.equal(focus!.edgeIds.filter((id) => id === "e1").length, 1);
});

// G. Unknown/missing case id is safely ignored.
test("G. a matchingCaseId not present among nodes is safely ignored, not fabricated", () => {
  const nodes = [n("c1"), n("p1")];
  const edges = [e("e1", "c1", "p1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1", "does-not-exist"], selectionLabel: "test" });
  assert.deepEqual(focus!.caseIds, ["c1"]);
  assert.ok(!focus!.nodeIds.includes("does-not-exist"));
});

// H. Zero matches produce no temporal focus.
test("H. an empty matchingCaseIds array produces null (no focus)", () => {
  const nodes = [n("c1"), n("p1")];
  const edges = [e("e1", "c1", "p1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: [], selectionLabel: "test" });
  assert.equal(focus, null);
});
test("H2. matchingCaseIds that are all unknown ids also produce null", () => {
  const nodes = [n("c1")];
  const edges: TemporalGraphFocusEdge[] = [];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["ghost"], selectionLabel: "test" });
  assert.equal(focus, null);
});

// I. All-data/no-effective-filter state does not create a pointless focus (semantic check, not display-text check).
test("I. isEffectiveTemporalNarrowing is false for a fully empty selection", () => {
  assert.equal(isEffectiveTemporalNarrowing(emptyTemporalSelection()), false);
});
test("I2. isEffectiveTemporalNarrowing is true when only a date range is set (even with all 24 hours / all weekdays)", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", dateFrom: "2026-09-01", dateTo: "2026-09-30" };
  assert.equal(isEffectiveTemporalNarrowing(selection), true);
});
test("I3. isEffectiveTemporalNarrowing is true when only a weekday is set", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", weekday: 6 };
  assert.equal(isEffectiveTemporalNarrowing(selection), true);
});
test("I4. isEffectiveTemporalNarrowing is true when only a time range is set", () => {
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 0, endMinute: 24 * 60 };
  assert.equal(isEffectiveTemporalNarrowing(selection), true);
});

// F (Section 6, primaryNodeId): the primary node id prefers a matching CASE id.
test("primaryNodeId prefers the first matching case id, not a supporting entity", () => {
  const nodes = [n("c1"), n("p1")];
  const edges = [e("e1", "c1", "p1")];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1"], selectionLabel: "test" });
  assert.equal(focus!.primaryNodeId, "c1");
});

// P. Graph focus does not mutate node/edge counts (pure derivation — input arrays untouched).
test("P. computeTemporalGraphFocus never mutates the input nodes/edges arrays", () => {
  const nodes = [n("c1"), n("p1")];
  const edges = [e("e1", "c1", "p1")];
  const nodesCopy = JSON.parse(JSON.stringify(nodes));
  const edgesCopy = JSON.parse(JSON.stringify(edges));
  computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1"], selectionLabel: "test" });
  assert.deepEqual(nodes, nodesCopy);
  assert.deepEqual(edges, edgesCopy);
});

// Determinism: repeated calls on the same input produce identical output.
test("computeTemporalGraphFocus is deterministic across repeated calls", () => {
  const nodes = [n("c1"), n("c2"), n("p1"), n("ph1")];
  const edges = [e("e1", "c1", "p1"), e("e2", "c2", "ph1"), e("e3", "c1", "ph1")];
  const a = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1", "c2"], selectionLabel: "test" });
  const b = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1", "c2"], selectionLabel: "test" });
  assert.deepEqual(a, b);
});

// matchingCaseCount reflects the deduplicated real case count.
test("matchingCaseCount is the deduplicated, existing-only case count", () => {
  const nodes = [n("c1")];
  const edges: TemporalGraphFocusEdge[] = [];
  const focus = computeTemporalGraphFocus({ nodes, edges, matchingCaseIds: ["c1", "c1", "ghost"], selectionLabel: "test" });
  assert.equal(focus!.matchingCaseCount, 1);
});
