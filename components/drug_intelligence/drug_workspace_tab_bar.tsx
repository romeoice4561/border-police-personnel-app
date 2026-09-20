/**
 * Shared horizontal workspace tab bar with overflow navigation.
 * Keeps a single row; scrolls to the active/focused tab; no label truncation.
 */
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";

export type DrugWorkspaceTabItem = {
  key: string;
  label: string;
};

export function DrugWorkspaceTabBar({
  tabs,
  activeKey,
  onChange,
  testId = "workspace-tabs",
  className,
}: {
  tabs: DrugWorkspaceTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  testId?: string;
  className?: string;
}) {
  const { t } = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 2;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && el.scrollLeft > 2);
    setCanScrollRight(overflow && el.scrollLeft < max - 2);
  }, []);

  const scrollTabIntoView = useCallback((key: string, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    const tab = tabRefs.current.get(key);
    if (!scroller || !tab) return;
    const pad = 12;
    const tabLeft = tab.offsetLeft;
    const tabRight = tabLeft + tab.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (tabLeft < viewLeft + pad) {
      scroller.scrollTo({ left: Math.max(0, tabLeft - pad), behavior });
      return;
    }
    if (tabRight > viewRight - pad) {
      scroller.scrollTo({ left: Math.max(0, tabRight - scroller.clientWidth + pad), behavior });
    }
  }, []);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.max(el.clientWidth * 0.7, 180) * direction;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    updateOverflow();
    scrollTabIntoView(activeKey, "auto");
  }, [activeKey, tabs, updateOverflow, scrollTabIntoView]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    const onScroll = () => updateOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateOverflow()) : null;
    ro?.observe(el);
    window.addEventListener("resize", updateOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [updateOverflow]);

  useEffect(() => {
    // After layout settles (fonts / late paint), keep active tab visible.
    const id = window.requestAnimationFrame(() => {
      scrollTabIntoView(activeKey, "auto");
      updateOverflow();
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeKey, tabs, scrollTabIntoView, updateOverflow]);

  return (
    <div className={cn("relative", className)} data-testid={testId} data-has-overflow={hasOverflow ? "true" : "false"}>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1.5">
        {hasOverflow ? (
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-neutral-bg text-foreground",
              "hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
            aria-label={t("di.workspace.tabsScrollPrev")}
            data-testid={`${testId}-prev`}
            disabled={!canScrollLeft}
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        <div className="relative min-w-0 flex-1">
          {canScrollLeft ? (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-surface to-transparent"
              aria-hidden="true"
              data-testid={`${testId}-fade-left`}
            />
          ) : null}
          {canScrollRight ? (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-surface to-transparent"
              aria-hidden="true"
              data-testid={`${testId}-fade-right`}
            />
          ) : null}
          <div
            ref={scrollerRef}
            role="tablist"
            className="flex flex-nowrap gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-testid={`${testId}-scroller`}
          >
            {tabs.map((tab) => {
              const selected = activeKey === tab.key;
              return (
                <button
                  key={tab.key}
                  ref={(node) => {
                    if (node) tabRefs.current.set(tab.key, node);
                    else tabRefs.current.delete(tab.key);
                  }}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  data-tab-key={tab.key}
                  onClick={() => onChange(tab.key)}
                  onFocus={() => scrollTabIntoView(tab.key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    selected ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {hasOverflow ? (
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-neutral-bg text-foreground",
              "hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
            aria-label={t("di.workspace.tabsScrollNext")}
            data-testid={`${testId}-next`}
            disabled={!canScrollRight}
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
