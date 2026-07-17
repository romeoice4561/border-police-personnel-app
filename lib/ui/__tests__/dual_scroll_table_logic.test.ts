import { test } from "node:test";
import assert from "node:assert/strict";

import { tableOverflowsViewport, isInteractiveDragTarget, dragScrollLeft } from "@/lib/ui/dual_scroll_table_logic";

// ---------------------------------------------------------------------------
// B3: no decorative top scrollbar when content doesn't overflow.
// ---------------------------------------------------------------------------
test("table narrower than viewport does not overflow", () => {
  assert.equal(tableOverflowsViewport(500, 800), false);
});

test("table exactly matching viewport width does not overflow (no 1px flicker)", () => {
  assert.equal(tableOverflowsViewport(800, 800), false);
});

test("table 1px wider than viewport is within tolerance, does not overflow", () => {
  assert.equal(tableOverflowsViewport(801, 800), false);
});

test("table meaningfully wider than viewport overflows", () => {
  assert.equal(tableOverflowsViewport(1200, 800), true);
});

// ---------------------------------------------------------------------------
// B4: drag-to-scroll must not start on interactive elements.
// ---------------------------------------------------------------------------
test("drag starting directly on a link is ignored", () => {
  assert.equal(isInteractiveDragTarget(["A", "TD", "TR"]), true);
});

test("drag starting on a button nested inside a cell is ignored", () => {
  assert.equal(isInteractiveDragTarget(["SPAN", "BUTTON", "TD"]), true);
});

test("drag starting on plain cell text (no interactive ancestor) is allowed", () => {
  assert.equal(isInteractiveDragTarget(["SPAN", "TD", "TR", "TBODY", "TABLE"]), false);
});

test("drag on a select/input/textarea is ignored (form controls inside filters)", () => {
  assert.equal(isInteractiveDragTarget(["SELECT"]), true);
  assert.equal(isInteractiveDragTarget(["INPUT"]), true);
  assert.equal(isInteractiveDragTarget(["TEXTAREA"]), true);
});

// ---------------------------------------------------------------------------
// B4: click-and-drag scroll delta.
// ---------------------------------------------------------------------------
test("dragging the mouse right (positive delta) scrolls content left", () => {
  // Started at scrollLeft=100, mouse moved from x=50 to x=80 (dx=+30).
  assert.equal(dragScrollLeft(100, 50, 80), 70);
});

test("dragging the mouse left (negative delta) scrolls content right", () => {
  assert.equal(dragScrollLeft(100, 80, 50), 130);
});

test("no mouse movement leaves scrollLeft unchanged (drag state doesn't stick/drift)", () => {
  assert.equal(dragScrollLeft(250, 40, 40), 250);
});
