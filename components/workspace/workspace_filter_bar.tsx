/**
 * WorkspaceFilterBar (Phase 48A — Enterprise Workspace Foundation).
 *
 * ONE reusable filter bar covering the five fields every workspace page
 * needs in the same layout: Organization, Company, Status, Search, Date.
 * Built entirely from existing primitives — FilterFramework (the shared
 * shell: basic row + "More Filters" disclosure + active-count + clear-all),
 * Select (Organization/Company/Status dropdowns), GlobalSearchBox (the
 * existing debounced free-text search), and a plain date input styled to
 * match Select — so there is exactly one filter-bar layout implementation
 * for pages to adopt, instead of each page hand-rolling its own row of
 * controls (as Officers/Search/Commander Search currently do).
 *
 * Controlled component: the caller owns filter state (same "parent owns
 * state" convention as FilterFramework/OfficerFilters/SearchBar already
 * use) and passes it in as `value` + `onChange`. Organization/Company/Status
 * options are caller-supplied (they vary per page — e.g. Gallery's "Status"
 * options differ from Review's), so this component owns LAYOUT, not the
 * domain vocabulary.
 *
 * This is a NEW, standalone component this phase — no existing page is
 * wired to it yet (Personnel/Search/Gallery/Review/Statistics/Commander
 * Search keep their current bespoke filter UIs unchanged until Phase 48B
 * migrates them one by one).
 */
"use client";

import { FilterFramework } from "@/components/common/filter_framework";
import { GlobalSearchBox } from "@/components/common/global_search_box";
import { Select, type SelectOption } from "@/components/ui/select";

export interface WorkspaceFilterValue {
  organization: string;
  company: string;
  status: string;
  search: string;
  date: string;
}

export const EMPTY_WORKSPACE_FILTER: WorkspaceFilterValue = {
  organization: "",
  company: "",
  status: "",
  search: "",
  date: "",
};

export interface WorkspaceFilterBarProps {
  value: WorkspaceFilterValue;
  onChange: (next: WorkspaceFilterValue) => void;
  organizationOptions: readonly SelectOption[];
  companyOptions: readonly SelectOption[];
  statusOptions: readonly SelectOption[];
  /** Labels for the fields — caller supplies already-translated (bilingual) copy, same convention as the rest of the workspace layer. */
  labels: {
    organizationPlaceholder: string;
    companyPlaceholder: string;
    statusPlaceholder: string;
    searchPlaceholder: string;
    dateLabel: string;
  };
}

function countActive(value: WorkspaceFilterValue): number {
  return [value.organization, value.company, value.status, value.search, value.date].filter(Boolean).length;
}

export function WorkspaceFilterBar({ value, onChange, organizationOptions, companyOptions, statusOptions, labels }: WorkspaceFilterBarProps) {
  const set = (patch: Partial<WorkspaceFilterValue>) => onChange({ ...value, ...patch });

  return (
    <FilterFramework
      activeCount={countActive(value)}
      onClearAll={() => onChange(EMPTY_WORKSPACE_FILTER)}
      basicFilters={
        <>
          <div className="w-full sm:w-64">
            <GlobalSearchBox value={value.search} onChange={(search) => set({ search })} placeholder={labels.searchPlaceholder} />
          </div>
          <div className="w-40">
            <Select
              options={organizationOptions}
              placeholder={labels.organizationPlaceholder}
              value={value.organization}
              onChange={(e) => set({ organization: e.target.value })}
              aria-label={labels.organizationPlaceholder}
            />
          </div>
        </>
      }
      advancedFilters={
        <>
          <div className="w-40">
            <Select
              options={companyOptions}
              placeholder={labels.companyPlaceholder}
              value={value.company}
              onChange={(e) => set({ company: e.target.value })}
              aria-label={labels.companyPlaceholder}
            />
          </div>
          <div className="w-40">
            <Select
              options={statusOptions}
              placeholder={labels.statusPlaceholder}
              value={value.status}
              onChange={(e) => set({ status: e.target.value })}
              aria-label={labels.statusPlaceholder}
            />
          </div>
          <div className="w-40">
            <input
              type="date"
              value={value.date}
              onChange={(e) => set({ date: e.target.value })}
              aria-label={labels.dateLabel}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </>
      }
    />
  );
}
