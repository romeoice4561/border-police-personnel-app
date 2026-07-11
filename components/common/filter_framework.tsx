/**
 * FilterFramework (Phase 26B Part 6 Part S/T).
 *
 * ONE reusable filter-bar shell every page's filter UI is built from —
 * Officers today (Part M), Gallery/Portrait Cleanup/Review/Statistics reuse
 * it later (Part N/O/P/Q) — so there is exactly one implementation of "basic
 * filters always visible, advanced filters collapsed under More Filters"
 * (Part T) rather than each page hand-rolling its own disclosure toggle.
 *
 * Deliberately a SLOT/layout component, not a schema-driven one: each page
 * still owns its own filter STATE and renders its own filter CONTROLS
 * (Select/Combobox/input, whichever fits that field) as `basicFilters`/
 * `advancedFilters` children — this framework only supplies the shared
 * shell (flex-wrap row, the "More Filters" toggle + active-count badge, and
 * the "Clear all" action). This mirrors how FilterPanel/SearchBar already
 * work in this codebase (controlled components, parent owns state) — no new
 * state-management pattern, just factoring the REPEATED layout/disclosure
 * chrome out of each page into one place.
 */
"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FilterFrameworkProps {
  /** Always-visible controls (Part T: "Basic filters always visible"). */
  basicFilters: React.ReactNode;
  /** Controls collapsed behind "More Filters" until expanded (Part T). Omit when a page has no advanced tier. */
  advancedFilters?: React.ReactNode;
  /** Count of currently-active filters (basic + advanced combined), shown as a badge on the toggle and driving whether "Clear all" renders. Pass 0 when nothing is active. */
  activeCount: number;
  /** Clears every filter (basic + advanced) at once. Omitted buttons hide the "Clear all" action. */
  onClearAll?: () => void;
}

export function FilterFramework({ basicFilters, advancedFilters, activeCount, onClearAll }: FilterFrameworkProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        {basicFilters}

        {advancedFilters ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            More Filters
            {activeCount > 0 ? (
              <Badge tone="accent" className="ml-0.5">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        ) : null}

        {onClearAll && activeCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear all
          </Button>
        ) : null}
      </div>

      {advancedFilters && expanded ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">{advancedFilters}</div>
      ) : null}
    </div>
  );
}
