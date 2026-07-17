/**
 * Pure logic extracted from components/ui/dual_scroll_table.tsx (Phase 43
 * Workstream B) so the scroll-UX rules are unit-testable without a DOM
 * harness or brittle full-render snapshot.
 */

/** B3: the top scrollbar (and any decorative spacer) should only render when the table's real content is wider than the visible viewport. A 1px tolerance absorbs sub-pixel rounding so an exact-fit table never flickers a 1px-wide scrollbar. */
export function tableOverflowsViewport(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth > clientWidth + 1;
}

/** B4: a drag-to-scroll gesture must not start when the mouse-down target is (or is inside) an interactive element, so ordinary link/button clicks still work. Mirrors `target.closest("a,button,input,select,textarea")` without needing a real DOM node. */
export function isInteractiveDragTarget(tagChainUppercase: readonly string[]): boolean {
  const interactive = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
  return tagChainUppercase.some((tag) => interactive.has(tag));
}

/** B4: click-and-drag horizontal scroll delta — dragging the mouse right (positive dx) scrolls the content left (decreases scrollLeft), matching a "grab the content and pull" interaction. */
export function dragScrollLeft(startScrollLeft: number, startClientX: number, currentClientX: number): number {
  return startScrollLeft - (currentClientX - startClientX);
}
