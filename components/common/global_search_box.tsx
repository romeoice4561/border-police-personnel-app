/**
 * GlobalSearchBox (Phase 26B Part B).
 *
 * A single free-text search box above the per-field filters, searching
 * simultaneously across name/surname/full name/phone/officerId/rank/
 * position/region/battalion/company/unit/Drive filename (see
 * lib/search/global_search_service.ts for the full field list). Debounced
 * so typing doesn't fire a request per keystroke.
 */
"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

const DEBOUNCE_MS = 300;

export interface GlobalSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function GlobalSearchBox({ value, onChange, placeholder }: GlobalSearchBoxProps) {
  const [draft, setDraft] = useState(value);
  // Tracks the last `value` we've synced from, so an external reset (e.g. a
  // "clear all" action) is picked up during render — no effect, no
  // cascading-render lint violation (React's documented "adjusting state
  // when a prop changes" pattern).
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-debounce when the draft itself changes
  }, [draft]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder ?? "ค้นหาชื่อ, เบอร์โทร, ยศ, ตำแหน่ง, หน่วย, รหัส..."}
        aria-label="ค้นหาทั่วไป"
        className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-10 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {draft ? (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label="ล้างการค้นหา"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
