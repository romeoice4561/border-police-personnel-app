/**
 * OfficerFilters (Phase 26B Part 6 Part M).
 *
 * Replaces the old FilterPanel (Region text input + Min Quality number —
 * spec: "are not useful"). New filters: Rank, Company, Battalion, Border
 * Patrol Division, Verification Status, Has Portrait, Has Phone, Sort — laid
 * out through the shared FilterFramework (Part S) so this page owns only its
 * OWN filter fields/state, not the disclosure chrome.
 *
 * Rank is a basic (always-visible) filter since it's the single most common
 * lookup; the org-hierarchy cascade (Division -> Battalion -> Company) and
 * the operational flags (Verification/Has Portrait/Has Phone) sit under
 * "More Filters" (Part T) since a typical lookup rarely needs all of them at
 * once. Sort is basic (right next to the results, not hidden).
 */
"use client";

import type { OfficerListFilters } from "@/lib/ui/list_filters";
import type { OrgTree } from "@/lib/organization/org_tree";
import { battalionsForRegion, companiesForBattalion } from "@/lib/organization/org_tree";
import { divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";
import { TIMELINE_VERIFICATION_STATUS_OPTIONS, VERIFICATION_STATUS_META } from "@/lib/officer_profile/verification_options";
import { FilterFramework } from "@/components/common/filter_framework";

const controlClass =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export interface OfficerSortOption {
  value: string;
  label: string;
}

export const OFFICER_SORT_OPTIONS: readonly OfficerSortOption[] = [
  { value: "createdAt", label: "Newest" },
  { value: "lastName", label: "Last Name" },
  { value: "rank", label: "Rank" },
  { value: "careerYears", label: "Career Years" },
  { value: "qualityScore", label: "Quality Score" },
];

export interface OfficerFiltersProps {
  value: OfficerListFilters;
  ranks: string[];
  orgTree: OrgTree | undefined;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onChange: (next: OfficerListFilters) => void;
  onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
}

function countActive(v: OfficerListFilters): number {
  return Object.values(v).filter((x) => x !== undefined && x !== "").length;
}

export function OfficerFilters({ value, ranks, orgTree, sortBy, sortOrder, onChange, onSortChange }: OfficerFiltersProps) {
  function set<K extends keyof OfficerListFilters>(key: K, v: OfficerListFilters[K]) {
    onChange({ ...value, [key]: v });
  }

  const regions = orgTree?.regions ?? [];
  const battalionOptions = orgTree ? battalionsForRegion(orgTree, value.regionId ?? null) : [];
  const companyOptions = orgTree ? companiesForBattalion(orgTree, value.battalionId ?? null) : [];

  function onDivisionChange(regionId: number | undefined) {
    // Selecting a Division clears the now-stale Battalion/Company selections (mirrors OrgHierarchyPicker's cascade convention).
    onChange({ ...value, regionId, battalionId: undefined, companyId: undefined });
  }

  function onBattalionChange(battalionId: number | undefined) {
    onChange({ ...value, battalionId, companyId: undefined });
  }

  const basicFilters = (
    <>
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

      <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
        Sort
        <select
          className={controlClass}
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value, sortOrder)}
        >
          {OFFICER_SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={controlClass}
          onClick={() => onSortChange(sortBy, sortOrder === "asc" ? "desc" : "asc")}
          aria-label={sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
        >
          {sortOrder === "asc" ? "↑" : "↓"}
        </button>
      </label>
    </>
  );

  const advancedFilters = (
    <>
      <label className="text-xs font-medium text-muted">
        <span className="sr-only">Border Patrol Division</span>
        <select
          className={controlClass}
          value={value.regionId ?? ""}
          onChange={(e) => onDivisionChange(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All divisions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {divisionLabelForRegion(r)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium text-muted">
        <span className="sr-only">Battalion</span>
        <select
          className={controlClass}
          value={value.battalionId ?? ""}
          onChange={(e) => onBattalionChange(e.target.value ? Number(e.target.value) : undefined)}
          disabled={!value.regionId}
        >
          <option value="">All battalions</option>
          {battalionOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameTh}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium text-muted">
        <span className="sr-only">Company</span>
        <select
          className={controlClass}
          value={value.companyId ?? ""}
          onChange={(e) => set("companyId", e.target.value ? Number(e.target.value) : undefined)}
          disabled={!value.battalionId}
        >
          <option value="">All companies</option>
          {companyOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameTh}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium text-muted">
        <span className="sr-only">Verification Status</span>
        <select
          className={controlClass}
          value={value.verificationStatus ?? ""}
          onChange={(e) => set("verificationStatus", e.target.value || undefined)}
        >
          <option value="">All verification statuses</option>
          {TIMELINE_VERIFICATION_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {VERIFICATION_STATUS_META[s].labelTh} / {VERIFICATION_STATUS_META[s].labelEn}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <input
          type="checkbox"
          checked={value.hasPortrait === true}
          onChange={(e) => set("hasPortrait", e.target.checked ? true : undefined)}
        />
        Has Portrait
      </label>

      <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <input
          type="checkbox"
          checked={value.hasPhone === true}
          onChange={(e) => set("hasPhone", e.target.checked ? true : undefined)}
        />
        Has Phone
      </label>
    </>
  );

  return (
    <FilterFramework
      basicFilters={basicFilters}
      advancedFilters={advancedFilters}
      activeCount={countActive(value)}
      onClearAll={() => onChange({})}
    />
  );
}
