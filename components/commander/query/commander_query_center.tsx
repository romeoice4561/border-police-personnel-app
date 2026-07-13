"use client";

import { useMemo, useState } from "react";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderQueryFilters, CommanderSortField, DrilldownFilter, NumericFilter } from "@/components/commander/query/types";
import { CommanderQueryBuilder } from "@/components/commander/filters/commander_query_builder";
import { CommanderQuerySummary } from "@/components/commander/summary/commander_query_summary";
import { CommanderQueryCharts } from "@/components/commander/charts/commander_query_charts";
import { CommanderTimelineCharts } from "@/components/commander/charts/commander_timeline_charts";
import { CommanderResultsTable } from "@/components/commander/results/commander_results_table";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function matchesNumber(value: number | null, filter: NumericFilter | undefined): boolean {
  if (!filter) return true;
  if (value == null) return false;
  if (filter.operator === "exactly") return Math.round(value) === filter.value;
  if (filter.operator === "at_least") return value >= filter.value;
  if (filter.operator === "more_than") return value > filter.value;
  return value < filter.value;
}

function matchesDrilldown(row: CommanderQueryOfficer, drilldown: DrilldownFilter | null): boolean {
  if (!drilldown) return true;
  return row[drilldown.field] === drilldown.value;
}

function applyFilters(row: CommanderQueryOfficer, filters: CommanderQueryFilters, drilldown: DrilldownFilter | null): boolean {
  if (!matchesDrilldown(row, drilldown)) return false;
  if (filters.rank && row.rank !== filters.rank) return false;
  if (filters.currentPosition && !(row.currentPosition ?? "").includes(filters.currentPosition)) return false;
  if (filters.positionLevel && row.positionLevel !== filters.positionLevel) return false;
  if (filters.regionId != null && row.regionId !== filters.regionId) return false;
  if (filters.battalionId != null && row.battalionId !== filters.battalionId) return false;
  if (filters.companyId != null && row.companyId !== filters.companyId) return false;
  if (filters.promotionStatus && row.promotionStatus !== filters.promotionStatus) return false;
  if (filters.flagCode && !row.flagCodes.includes(filters.flagCode)) return false;
  if (filters.priority && row.priority !== filters.priority) return false;
  if (filters.minProfileCompleteness != null && (row.profileCompletenessPercent ?? 0) < filters.minProfileCompleteness) return false;
  return (
    matchesNumber(row.yearsInRank, filters.yearsInRank) &&
    matchesNumber(row.yearsInPosition, filters.yearsInPosition) &&
    matchesNumber(row.ageYears, filters.age) &&
    matchesNumber(row.governmentServiceYears, filters.governmentServiceYears)
  );
}

function sortRows(rows: CommanderQueryOfficer[], sortBy: CommanderSortField, direction: "asc" | "desc"): CommanderQueryOfficer[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    if (typeof aValue === "number" || typeof bValue === "number") {
      return (((aValue as number | null) ?? -1) - ((bValue as number | null) ?? -1)) * multiplier;
    }
    return String(aValue ?? "").localeCompare(String(bValue ?? ""), "th") * multiplier;
  });
}

export function CommanderQueryCenter({ dataset }: { dataset: CommanderQueryDataset }) {
  const [filters, setFilters] = useState<CommanderQueryFilters>({});
  const [drilldown, setDrilldown] = useState<DrilldownFilter | null>(null);
  const [sortBy, setSortBy] = useState<CommanderSortField>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const matches = dataset.officers.filter((row) => applyFilters(row, filters, drilldown));
    return sortRows(matches, sortBy, sortDirection);
  }, [dataset.officers, drilldown, filters, sortBy, sortDirection]);

  function clearAll() {
    setFilters({});
    setDrilldown(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <CommanderQueryBuilder options={dataset.options} value={filters} onChange={setFilters} onClear={clearAll} />
        <Card>
          <CardBody className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Export</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled>Excel</Button>
              <Button type="button" variant="outline" size="sm" disabled>PDF</Button>
              <Button type="button" variant="outline" size="sm" disabled>CSV</Button>
            </div>
            <p className="text-xs text-muted">Export architecture placeholder. Data is already prepared for future file writers.</p>
          </CardBody>
        </Card>
      </aside>

      <section className="space-y-5">
        {drilldown ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <span className="text-foreground">Drill-down: {drilldown.label}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDrilldown(null)}>Clear drill-down</Button>
          </div>
        ) : null}
        <CommanderQuerySummary officers={filtered} onDrilldown={setDrilldown} />
        <CommanderQueryCharts officers={filtered} onDrilldown={setDrilldown} />
        <CommanderTimelineCharts officers={filtered} onDrilldown={setDrilldown} />
        <CommanderResultsTable
          officers={filtered}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={(field) => {
            if (field === sortBy) setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
            else {
              setSortBy(field);
              setSortDirection("asc");
            }
          }}
        />
      </section>
    </div>
  );
}
