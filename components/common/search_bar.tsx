/**
 * SearchBar (Phase 14 UI): the multi-field search form. Controlled by the
 * parent (search page) via value + onChange, with a match-mode selector and a
 * submit. Fields mirror the API's search params exactly (name, rank, unit,
 * phone, position, region, minQuality, minCareerYears).
 */
"use client";

import { Search as SearchIcon } from "lucide-react";
import type { MatchMode } from "@/lib/ui/api_client";
import { Button } from "@/components/ui/button";

export interface SearchFormValue {
  name: string;
  rank: string;
  unit: string;
  phone: string;
  position: string;
  region: string;
  minQuality: string;
  minCareerYears: string;
  match: MatchMode;
}

export const EMPTY_SEARCH: SearchFormValue = {
  name: "",
  rank: "",
  unit: "",
  phone: "",
  position: "",
  region: "",
  minQuality: "",
  minCareerYears: "",
  match: "contains",
};

const TEXT_FIELDS: Array<{ key: keyof SearchFormValue; label: string; placeholder: string }> = [
  { key: "name", label: "Name", placeholder: "First or last name" },
  { key: "rank", label: "Rank", placeholder: "e.g. พ.ต.ท." },
  { key: "unit", label: "Unit", placeholder: "e.g. ตชด.447" },
  { key: "phone", label: "Phone", placeholder: "081-…" },
  { key: "position", label: "Position", placeholder: "e.g. ผบ.ร้อย" },
  { key: "region", label: "Region", placeholder: "e.g. ภาค1" },
];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onReset,
}: {
  value: SearchFormValue;
  onChange: (next: SearchFormValue) => void;
  onSubmit: () => void;
  onReset: () => void;
}) {
  function set<K extends keyof SearchFormValue>(key: K, v: SearchFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs font-medium text-muted">
            {f.label}
            <input
              className={`mt-1 ${inputClass}`}
              value={value[f.key] as string}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </label>
        ))}
        <label className="block text-xs font-medium text-muted">
          Min Quality
          <input
            type="number"
            min={0}
            max={100}
            className={`mt-1 ${inputClass}`}
            value={value.minQuality}
            placeholder="0–100"
            onChange={(e) => set("minQuality", e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Min Career Years
          <input
            type="number"
            min={0}
            className={`mt-1 ${inputClass}`}
            value={value.minCareerYears}
            placeholder="e.g. 10"
            onChange={(e) => set("minCareerYears", e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Match
          <select
            className={`mt-1 ${inputClass}`}
            value={value.match}
            onChange={(e) => set("match", e.target.value as MatchMode)}
          >
            <option value="contains">Contains</option>
            <option value="startsWith">Starts with</option>
            <option value="exact">Exact</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit">
          <SearchIcon className="h-4 w-4" aria-hidden="true" />
          Search
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>
    </form>
  );
}
