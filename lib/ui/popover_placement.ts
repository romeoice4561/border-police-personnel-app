/**
 * Collision-aware popover placement (Phase 47B — Thai Date Picker Placement
 * Fix).
 *
 * Pure geometry — no DOM, no React. Takes a trigger element's bounding rect,
 * the popover's own dimensions, and the viewport size, and returns the
 * top/left coordinates (for `position: fixed`) that keep the popover fully
 * on-screen, plus which horizontal/vertical edge it ended up aligned to
 * (useful for tests and for choosing an "opens upward" visual affordance).
 *
 * Algorithm (spec §1):
 *   1. Default: below the trigger, left-aligned to the trigger's left edge.
 *   2. If that would overflow the right edge of the viewport, right-align
 *      instead (popover's right edge meets the trigger's right edge).
 *   3. If even right-aligned it doesn't fit, clamp horizontally within the
 *      viewport with a safe margin.
 *   4. If there isn't enough vertical space below the trigger but there IS
 *      enough above, open above instead.
 *   5. Vertical position is then clamped with the same safe margin as a
 *      last resort (e.g. a very short viewport).
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PopoverPlacement {
  top: number;
  left: number;
  /** Which edge of the trigger the popover's horizontal position is anchored to. */
  horizontal: "left" | "right" | "clamped";
  /** Whether the popover opened below or above the trigger. */
  vertical: "below" | "above";
}

const DEFAULT_MARGIN = 8;
const DEFAULT_GAP = 4;

export function computePopoverPlacement(
  trigger: Rect,
  popover: { width: number; height: number },
  viewport: ViewportSize,
  options: { margin?: number; gap?: number } = {}
): PopoverPlacement {
  const margin = options.margin ?? DEFAULT_MARGIN;
  const gap = options.gap ?? DEFAULT_GAP;

  // ── Horizontal ──────────────────────────────────────────────────────────
  const leftAligned = trigger.left;
  const rightAligned = trigger.left + trigger.width - popover.width;

  let left: number;
  let horizontal: PopoverPlacement["horizontal"];

  const fitsLeftAligned = leftAligned + popover.width <= viewport.width - margin;
  const fitsRightAligned = rightAligned >= margin;

  if (fitsLeftAligned) {
    left = leftAligned;
    horizontal = "left";
  } else if (fitsRightAligned) {
    left = rightAligned;
    horizontal = "right";
  } else {
    // Neither pure alignment fits (popover wider than the available span,
    // e.g. mobile) — clamp inside the viewport with the safe margin.
    left = Math.max(margin, Math.min(leftAligned, viewport.width - popover.width - margin));
    horizontal = "clamped";
  }

  // ── Vertical ────────────────────────────────────────────────────────────
  const belowTop = trigger.top + trigger.height + gap;
  const aboveTop = trigger.top - gap - popover.height;

  const fitsBelow = belowTop + popover.height <= viewport.height - margin;
  const fitsAbove = aboveTop >= margin;

  let top: number;
  let vertical: PopoverPlacement["vertical"];

  if (fitsBelow || !fitsAbove) {
    // Prefer below; also falls back to below (then clamps) if NEITHER
    // fits, since below is the more natural default direction. The clamp
    // target itself is clamped to `margin` as a floor — when the popover is
    // taller than the whole viewport (e.g. a tiny embedded frame), there is
    // no valid position that avoids overflow entirely, so this pins the top
    // edge at the safe margin rather than producing a negative coordinate.
    const clampTarget = Math.max(margin, viewport.height - popover.height - margin);
    top = Math.max(margin, Math.min(belowTop, clampTarget));
    vertical = "below";
  } else {
    top = aboveTop;
    vertical = "above";
  }

  return { top, left, horizontal, vertical };
}
