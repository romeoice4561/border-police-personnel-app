/**
 * FilterPanel (Phase 14 UI): the officer-list filter controls (rank, unit,
 * region, min quality), laid out in a single row above the table per the
 * filters-in-one-row convention. Rank/unit options are supplied by the parent
 * (from the /ranks and /units endpoints); controlled via value + onChange.
 */
"use client";

import type { OfficerListFilters } from "@/lib/ui/list_filters";

const controlClass =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function FilterPanel({
  value,
  ranks,
  units,
  onChange,
}: {
  value: OfficerListFilters;
  ranks: string[];
  units: string[];
  onChange: (next: OfficerListFilters) => void;
}) {
  function set<K extends keyof OfficerListFilters>(key: K, v: OfficerListFilters[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-muted">
        <span className="sr-only">Rank</span>
        <select className={controlClass} value={value.rank ?? ""} onChange={(e) => set("rank", e.target.value || undefined)}>
          <option value="">All ranks</option>
          {ranks.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium text-muted">
        <span className="sr-only">Unit</span>
        <select className={controlClass} value={value.unit ?? ""} onChange={(e) => set("unit", e.target.value || undefined)}>
          <option value="">All units</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>

      <input
        className={controlClass}
        placeholder="Region"
        value={value.region ?? ""}
        onChange={(e) => set("region", e.target.value || undefined)}
        aria-label="Region"
      />

      <input
        type="number"
        min={0}
        max={100}
        className={`${controlClass} w-32`}
        placeholder="Min quality"
        value={value.minQuality ?? ""}
        onChange={(e) => set("minQuality", e.target.value === "" ? undefined : Number(e.target.value))}
        aria-label="Minimum quality"
      />
    </div>
  );
}
