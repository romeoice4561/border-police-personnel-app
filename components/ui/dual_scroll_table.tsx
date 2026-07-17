/**
 * DualScrollTable (Commander Promotion UX refinement).
 *
 * A horizontal-scroll wrapper for wide data tables — NOT a new table
 * library, just a thin scroll-UX layer around a plain <table> the caller
 * still renders entirely itself (columns, rows, sorting — all unchanged).
 * Renders a synchronized horizontal scrollbar ABOVE the table content (in
 * addition to the browser's native scrollbar below, which the wrapping
 * `overflow-x-auto` div already provides), plus click-and-drag ("grab")
 * scrolling and Shift+MouseWheel horizontal scrolling on the table body
 * itself.
 *
 * Usage: wrap the <table> in <DualScrollTable> instead of a bare
 * `<div className="overflow-x-auto">`. The table's own markup (columns,
 * sticky first-column classes, cell content) is unchanged.
 */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { tableOverflowsViewport, isInteractiveDragTarget, dragScrollLeft } from "@/lib/ui/dual_scroll_table_logic";

export function DualScrollTable({ children, className }: { children: ReactNode; className?: string }) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncingFrom = useRef<"top" | "body" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });
  // B3: no decorative top scrollbar when the table content doesn't actually
  // overflow the viewport — only show it once there's real horizontal
  // content to scroll.
  const [overflows, setOverflows] = useState(false);

  // Keep the top scrollbar's spacer the same width as the table's actual
  // scrollable content, so it represents the true horizontal extent, and
  // track whether the content overflows the visible width at all.
  useEffect(() => {
    const body = bodyScrollRef.current;
    const spacer = spacerRef.current;
    if (!body || !spacer) return;

    const updateWidth = () => {
      const table = body.firstElementChild as HTMLElement | null;
      const scrollWidth = table?.scrollWidth ?? body.scrollWidth;
      spacer.style.width = `${scrollWidth}px`;
      setOverflows(tableOverflowsViewport(scrollWidth, body.clientWidth));
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(body);
    const table = body.firstElementChild;
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, []);

  function syncScroll(source: "top" | "body") {
    if (syncingFrom.current && syncingFrom.current !== source) return;
    const top = topScrollRef.current;
    const body = bodyScrollRef.current;
    if (!top || !body) return;
    syncingFrom.current = source;
    if (source === "top") body.scrollLeft = top.scrollLeft;
    else top.scrollLeft = body.scrollLeft;
    // Release on the next frame so the reciprocal scroll event (fired by
    // the assignment above) is ignored instead of bouncing back and forth.
    requestAnimationFrame(() => {
      syncingFrom.current = null;
    });
  }

  function onBodyWheel(event: React.WheelEvent<HTMLDivElement>) {
    // Shift+MouseWheel horizontal scrolling — most browsers already convert
    // a shift-modified vertical wheel delta into `deltaX` natively, but not
    // all (notably some Windows/Firefox combinations), so this is an
    // explicit, harmless fallback: only acts when deltaX is ~0 and shift is
    // held, and never prevents the default when the browser already handled it.
    if (event.shiftKey && Math.abs(event.deltaX) < 1 && Math.abs(event.deltaY) > 0) {
      const body = bodyScrollRef.current;
      if (body) {
        body.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }
  }

  function onDragStart(event: React.MouseEvent<HTMLDivElement>) {
    // Ignore drags starting on an interactive element (link/button) so
    // normal clicks still work — only the empty table background/cell text
    // initiates a drag-scroll.
    const target = event.target as HTMLElement;
    const tagChain: string[] = [];
    for (let el: HTMLElement | null = target; el; el = el.parentElement) tagChain.push(el.tagName);
    if (isInteractiveDragTarget(tagChain)) return;
    const body = bodyScrollRef.current;
    if (!body) return;
    setIsDragging(true);
    dragStart.current = { x: event.clientX, scrollLeft: body.scrollLeft };
  }

  useEffect(() => {
    if (!isDragging) return;
    function onMove(event: MouseEvent) {
      const body = bodyScrollRef.current;
      if (!body) return;
      body.scrollLeft = dragScrollLeft(dragStart.current.scrollLeft, dragStart.current.x, event.clientX);
    }
    function onUp() {
      setIsDragging(false);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  return (
    <div className={className}>
      {/* Top scrollbar — mirrors the table's real content width, synced with the table body below. Hidden entirely when the content doesn't overflow (B3: no decorative scrollbar). */}
      {overflows ? (
        <div ref={topScrollRef} onScroll={() => syncScroll("top")} className="overflow-x-auto overflow-y-hidden" style={{ height: 14 }}>
          <div ref={spacerRef} style={{ height: 1 }} />
        </div>
      ) : (
        <div ref={spacerRef} style={{ display: "none" }} />
      )}
      <div
        ref={bodyScrollRef}
        onScroll={() => syncScroll("body")}
        onWheel={onBodyWheel}
        onMouseDown={onDragStart}
        className="overflow-x-auto"
        style={{ cursor: overflows ? (isDragging ? "grabbing" : "grab") : "default", userSelect: isDragging ? "none" : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
