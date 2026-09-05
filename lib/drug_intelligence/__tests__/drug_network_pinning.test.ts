/**
 * DI-9.2 — Node pinning / board lock / partial auto-layout regression
 * tests.
 *
 * Two layers, matching the codebase's existing convention:
 *   - Pure logic (applyPinnedPositions/prunePinnedNodeIds) is tested by
 *     direct function calls — same pattern as
 *     drug_network_graph_layout.test.ts / drug_network_graph_flow_adapter.test.ts.
 *   - Page/component wiring (permission gating, state isolation, UI
 *     presence) is tested at the source level via readFileSync, since no
 *     React rendering harness exists in this codebase (see
 *     drug_network_workspace_mode.test.ts for the established pattern).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { applyPinnedPositions, prunePinnedNodeIds } from "../drug_network_graph_pinning.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const pageCode = pageSource.replace(/\/\*[\s\S]*?\*\//g, "");
const nodeDetailSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_node_detail.tsx"), "utf8");
const graphNodeSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_graph_node.tsx"), "utf8");
const flowAdapterSource = readFileSync(path.join(dir, "..", "drug_network_graph_flow_adapter.ts"), "utf8");

// =====================================================================
// Pure logic: applyPinnedPositions / prunePinnedNodeIds
// =====================================================================

// --- F/G. pinned nodes preserved, unpinned nodes take new positions ---
test("applyPinnedPositions keeps a pinned node's CURRENT position and gives unpinned nodes the newly computed position", () => {
  const computed = new Map([
    ["A", { x: 999, y: 999 }],
    ["B", { x: 500, y: 500 }],
  ]);
  const current = new Map([
    ["A", { x: 10, y: 20 }], // A was manually moved+pinned here
    ["B", { x: 0, y: 0 }],
  ]);
  const result = applyPinnedPositions(computed, current, new Set(["A"]));
  assert.deepEqual(result.get("A"), { x: 10, y: 20 }, "pinned node A must keep its current position, not the computed one");
  assert.deepEqual(result.get("B"), { x: 500, y: 500 }, "unpinned node B must take the newly computed layout position");
});

test("applyPinnedPositions falls back to the computed position for a pinned id with no current position on screen", () => {
  const computed = new Map([["A", { x: 1, y: 1 }]]);
  const current = new Map<string, { x: number; y: number }>();
  const result = applyPinnedPositions(computed, current, new Set(["A"]));
  assert.deepEqual(result.get("A"), { x: 1, y: 1 });
});

// --- Collision (Section 10): pinned positions are authoritative ---
test("applyPinnedPositions never moves a pinned node to resolve a collision — the unpinned neighbor is pushed instead", () => {
  const computed = new Map([
    ["pinned", { x: 0, y: 0 }],
    ["unpinned", { x: 5, y: 0 }], // deliberately overlapping (< MIN_SPACING)
  ]);
  const current = new Map([["pinned", { x: 0, y: 0 }]]);
  const result = applyPinnedPositions(computed, current, new Set(["pinned"]));
  assert.deepEqual(result.get("pinned"), { x: 0, y: 0 }, "pinned node must never move to resolve a collision");
  const dist = Math.hypot(result.get("unpinned")!.x - result.get("pinned")!.x, result.get("unpinned")!.y - result.get("pinned")!.y);
  assert.ok(dist >= 129, `unpinned node should have been pushed away from the pinned node, got distance ${dist}`);
});

test("applyPinnedPositions is a pure function — repeated calls with the same input produce the same output (determinism)", () => {
  const computed = new Map([
    ["A", { x: 0, y: 0 }],
    ["B", { x: 1, y: 1 }],
    ["C", { x: 2, y: 0 }],
  ]);
  const current = new Map([["A", { x: 50, y: 50 }]]);
  const r1 = applyPinnedPositions(computed, current, new Set(["A"]));
  const r2 = applyPinnedPositions(computed, current, new Set(["A"]));
  assert.deepEqual([...r1.entries()], [...r2.entries()]);
});

// --- M. stale pin id cleanup ---
test("prunePinnedNodeIds drops ids no longer present in the current node set and keeps the rest", () => {
  const pruned = prunePinnedNodeIds(new Set(["A", "B", "GONE"]), new Set(["A", "B", "C"]));
  assert.deepEqual([...pruned].sort(), ["A", "B"]);
});

// =====================================================================
// Page/component wiring
// =====================================================================

// --- A. Analyst permission required for pin controls ---
// Note: the standalone toolbar Pin/Unpin button was removed after browser
// QA found it unreachable — selecting a node opens the shared Drawer
// primitive's full-screen modal backdrop (same component the edge
// inspector uses), which sits above the toolbar and blocks its click.
// Pin/unpin lives in the node inspector drawer only (Section 14, tests
// below); the toolbar keeps only Lock/Unlock Board and Clear All Pins,
// neither of which depends on a node being selected.
test("lock/clear-pins controls are rendered only inside the Analyst Mode branch of the page", () => {
  const controlsBlockStart = pageCode.indexOf('analystControlsLabel');
  assert.ok(controlsBlockStart !== -1, "could not locate the Analyst controls block");
  const guardBefore = pageCode.slice(0, controlsBlockStart).lastIndexOf('effectiveWorkspaceMode === "ANALYST" ?');
  assert.ok(guardBefore !== -1 && controlsBlockStart - guardBefore < 400, "Analyst controls block must be immediately guarded by effectiveWorkspaceMode === ANALYST");
  const nextChunk = pageCode.slice(controlsBlockStart, controlsBlockStart + 1500);
  assert.match(nextChunk, /setBoardLocked/);
  assert.match(nextChunk, /clearAllPins/);
});

test("the toolbar's Analyst controls group never renders a selectedNode-gated pin button (removed as unreachable behind the Drawer backdrop)", () => {
  const controlsBlockStart = pageCode.indexOf("analystControlsLabel");
  const nextChunk = pageCode.slice(controlsBlockStart, controlsBlockStart + 1500);
  assert.doesNotMatch(nextChunk, /togglePinNode\(selectedNode\.id\)/);
});

// --- B. View Mode has no pin edit controls ---
test("the node inspector's onTogglePin prop is only ever passed when effectiveWorkspaceMode is ANALYST, never unconditionally", () => {
  assert.match(pageCode, /onTogglePin=\{effectiveWorkspaceMode === "ANALYST" \? \(\) => togglePinNode\(selectedNode\.id\) : undefined\}/);
});

test("DrugNetworkNodeDetail hides the entire pin section when onTogglePin is not provided (View Mode)", () => {
  assert.match(nodeDetailSource, /\{onTogglePin \? \(/);
});

// --- C/D. pin / unpin a selected node ---
test("togglePinNode adds an unpinned node id to the set and removes an already-pinned one", () => {
  assert.match(pageCode, /function togglePinNode\(nodeId: string\)/);
  assert.match(pageCode, /if \(next\.has\(nodeId\)\) next\.delete\(nodeId\);/);
  assert.match(pageCode, /else next\.add\(nodeId\);/);
});

// --- E. pinned state remains when View<->Analyst mode switches ---
test("pinnedNodeIds state is declared once at the page level, not reset or reinitialized by the mode toggle", () => {
  const pinStateDeclarations = pageCode.match(/useState<Set<string>>\(new Set\(\)\)/g) ?? [];
  assert.equal(pinStateDeclarations.length, 1, "pinnedNodeIds must be declared exactly once, independent of workspaceMode");
  assert.doesNotMatch(pageCode, /setWorkspaceMode[\s\S]{0,50}setPinnedNodeIds/, "switching mode must never clear pins");
});

// --- H/I/J. board lock disables dragging but not selection/pan/zoom ---
test("board lock is wired to xyflow's own nodesDraggable prop, never a custom drag-blocking layer", () => {
  // DI-9.4.4: also require Analyst Mode so View Mode never allows object movement.
  assert.match(pageCode, /nodesDraggable=\{effectiveWorkspaceMode === "ANALYST" && !boardLocked\}/);
});

test("board lock does not gate onNodeClick/onEdgeClick (selection/inspection keep working while locked)", () => {
  assert.match(pageCode, /onNodeClick=\{handleNodeClick\}/);
  assert.match(pageCode, /onEdgeClick=\{handleEdgeClick\}/);
  assert.doesNotMatch(pageCode, /onNodeClick=\{boardLocked/);
});

// --- K. reset pins clears pin state ---
test("clearAllPins replaces the pin set with an empty Set, never mutating in place", () => {
  assert.match(pageCode, /function clearAllPins\(\) \{\s*setPinnedNodeIds\(new Set\(\)\);/);
});

// --- L. layout change / rearrange does not silently clear pins ---
test("handleRearrange only bumps rearrangeToken — it never touches pinnedNodeIds directly", () => {
  const fn = extractFunctionBody(pageCode, "function handleRearrange()");
  assert.match(fn, /setRearrangeToken/);
  assert.doesNotMatch(fn, /setPinnedNodeIds/);
});

test("handleLayoutSelect (choosing a different layout mode) never touches pinnedNodeIds directly", () => {
  const fn = extractFunctionBody(pageCode, "function handleLayoutSelect(mode: DrugNetworkLayoutMode)");
  assert.doesNotMatch(fn, /setPinnedNodeIds/);
});

// --- M. stale pin IDs handled safely when graph nodes change (page wiring) ---
test("the page prunes stale pin ids against the freshly-fetched node id set before building the flow graph", () => {
  assert.match(pageCode, /prunePinnedNodeIds\(current, currentNodeIds\)/);
});

function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start !== -1, `could not locate function: ${signature}`);
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(bodyStart, i + 1);
}

const togglePinNodeBody = extractFunctionBody(pageCode, "function togglePinNode(nodeId: string)");
const clearAllPinsBody = extractFunctionBody(pageCode, "function clearAllPins()");

// --- N. no API call introduced for pin action ---
test("togglePinNode/clearAllPins never call fetch, a hook mutation, or any network-prefixed API helper", () => {
  assert.doesNotMatch(togglePinNodeBody, /fetch\(|useMutation|apiClient\.|await /);
  assert.doesNotMatch(clearAllPinsBody, /fetch\(|useMutation|apiClient\.|await /);
});

// --- O. no URL change caused by pin/lock action ---
test("togglePinNode/setBoardLocked/clearAllPins never call updateParams (the only URL-writing helper on this page)", () => {
  assert.doesNotMatch(togglePinNodeBody, /updateParams/);
  assert.doesNotMatch(clearAllPinsBody, /updateParams/);
});

// --- P. factual DrugGraphNode DTO remains unchanged ---
test("pinned state is carried on the xyflow FlowNode's presentation data, never merged into DrugGraphNode itself", () => {
  assert.match(flowAdapterSource, /pinned: boolean;/);
  assert.doesNotMatch(flowAdapterSource, /DrugGraphNode\s*\{[\s\S]{0,10}pinned/);
});

// --- Q. scope guard: undo/redo remain deferred; Save is a 9.5C document action ---
test("undo/redo are not yet present; saved-board persist lives in PageHeader document actions", () => {
  const forbiddenTokens = ["undo(", "redo(", "Undo(", "Redo("];
  for (const token of forbiddenTokens) {
    assert.ok(!pageCode.includes(token), `found forbidden token in page source: "${token}"`);
  }
  assert.match(pageCode, /di\.board\.save/);
  assert.match(pageCode, /investigation-board-persist/);
  const toolbarSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_analyst_toolbar.tsx"), "utf8");
  assert.doesNotMatch(toolbarSource, /di\.board\.save/);
  assert.doesNotMatch(toolbarSource, /investigation-board-persist/);
});

// --- Pin visual indicator: not color alone (Section 5) ---
test("the pinned node badge is accompanied by a text label (not an icon/color alone)", () => {
  assert.match(graphNodeSource, /t\("di\.network\.pinnedNode"\)/);
  assert.match(graphNodeSource, /pinned \? <span/);
});

// --- Board lock does not trap keyboard focus / has accessible name (Section 17) ---
test("board lock toggle exposes aria-pressed for its toggled state", () => {
  const lockBtnIndex = pageCode.indexOf("setBoardLocked((v) => !v)");
  const chunk = pageCode.slice(lockBtnIndex, lockBtnIndex + 200);
  assert.match(chunk, /aria-pressed=\{boardLocked\}/);
});

// --- Status bar extension stays optional / Analyst-only ---
test("pinnedCount/boardLocked are only ever passed to the status bar when effectiveWorkspaceMode is ANALYST", () => {
  assert.match(pageCode, /pinnedCount=\{effectiveWorkspaceMode === "ANALYST" \? pinnedNodeIds\.size : undefined\}/);
  assert.match(pageCode, /boardLocked=\{effectiveWorkspaceMode === "ANALYST" \? boardLocked : undefined\}/);
});
