import { test } from "node:test";
import assert from "node:assert/strict";

import { computePopoverPlacement } from "@/lib/ui/popover_placement";

// Phase 47B — collision-aware popover placement (pure geometry, no DOM).

const VIEWPORT_1440 = { width: 1440, height: 900 };
const POPOVER = { width: 320, height: 358 };

test("default: trigger near the left edge places the popover left-aligned below the trigger", () => {
  const trigger = { top: 200, left: 50, width: 149, height: 38 };
  const placement = computePopoverPlacement(trigger, POPOVER, VIEWPORT_1440);
  assert.equal(placement.horizontal, "left");
  assert.equal(placement.vertical, "below");
  assert.equal(placement.left, 50);
  assert.equal(placement.top, 200 + 38 + 4); // trigger.top + trigger.height + gap
});

test("right-edge trigger (the reported bug: Renewal Date field) switches to right-aligned so the popover opens leftward", () => {
  // Reproduces the exact reported geometry: trigger at x=1271, width=149, viewport 1440.
  const trigger = { top: 624.5, left: 1271, width: 149, height: 38 };
  const placement = computePopoverPlacement(trigger, POPOVER, VIEWPORT_1440);
  assert.equal(placement.horizontal, "right");
  // Popover's right edge should land exactly at the trigger's right edge.
  assert.equal(placement.left + POPOVER.width, trigger.left + trigger.width);
  // And it must be fully within the viewport now.
  assert.ok(placement.left >= 0);
  assert.ok(placement.left + POPOVER.width <= VIEWPORT_1440.width);
});

test("right-aligned placement never produces a negative left coordinate even at the extreme right edge", () => {
  const trigger = { top: 100, left: 1440 - 149, width: 149, height: 38 };
  const placement = computePopoverPlacement(trigger, POPOVER, VIEWPORT_1440);
  assert.ok(placement.left >= 0);
});

test("clamped: popover wider than the available horizontal span (mobile) stays within the viewport with margin on both sides", () => {
  const mobileViewport = { width: 390, height: 844 };
  const widePopover = { width: 340, height: 358 }; // wider than most safe placements at this size
  const trigger = { top: 300, left: 20, width: 149, height: 38 };
  const placement = computePopoverPlacement(trigger, widePopover, mobileViewport);
  assert.ok(placement.left >= 0);
  assert.ok(placement.left + widePopover.width <= mobileViewport.width);
});

test("insufficient space below the trigger but enough above opens the popover upward", () => {
  const trigger = { top: 850, left: 100, width: 149, height: 38 }; // near the bottom of a 900px-tall viewport
  const placement = computePopoverPlacement(trigger, POPOVER, VIEWPORT_1440);
  assert.equal(placement.vertical, "above");
  assert.equal(placement.top, 850 - 4 - POPOVER.height);
});

test("popover taller than the entire viewport (no position can fully avoid overflow) still pins to a non-negative top, never off-screen upward", () => {
  const shortViewport = { width: 1440, height: 300 }; // shorter than POPOVER.height (358) — genuinely impossible to fit
  const trigger = { top: 140, left: 100, width: 149, height: 38 };
  const placement = computePopoverPlacement(trigger, POPOVER, shortViewport);
  // Best effort: never negative (that would push the top out of view entirely).
  assert.ok(placement.top >= 0);
});

test("a popover that DOES fit vertically in a short-but-sufficient viewport is fully contained, top and bottom", () => {
  const shortViewport = { width: 1440, height: 500 };
  const trigger = { top: 140, left: 100, width: 149, height: 38 };
  const placement = computePopoverPlacement(trigger, POPOVER, shortViewport);
  assert.ok(placement.top >= 0);
  assert.ok(placement.top + POPOVER.height <= shortViewport.height);
});

test("popover exactly fitting left-aligned at the viewport edge (boundary case) still reports 'left', not 'clamped'", () => {
  const trigger = { top: 100, left: 1440 - POPOVER.width - 8, width: 149, height: 38 };
  const placement = computePopoverPlacement(trigger, POPOVER, VIEWPORT_1440);
  assert.equal(placement.horizontal, "left");
});

test("placement is a pure function: identical inputs always produce identical outputs", () => {
  const trigger = { top: 300, left: 700, width: 149, height: 38 };
  const a = computePopoverPlacement(trigger, POPOVER, VIEWPORT_1440);
  const b = computePopoverPlacement(trigger, POPOVER, VIEWPORT_1440);
  assert.deepEqual(a, b);
});
