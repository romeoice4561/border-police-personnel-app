/**
 * Officers list (Phase 14): filterable, sortable, paginated officer table.
 * Filter/rank/unit options come from the /ranks and /units endpoints.
 */
"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useOfficers, useRanks, useUnits } from "@/lib/ui/hooks";
import { buildOfficerQuery, type OfficerListFilters } from "@/lib/ui/list_filters";
import { PageHeader } from "@/components/common/page_header";
import { FilterPanel } from "@/components/common/filter_panel";
import { OfficerTable } from "@/components/common/officer_table";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";

const PAGE_SIZE = 20;

export default function OfficersPage() {
  const [filters, setFilters] = useState<OfficerListFilters>({});
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const query = useMemo(
    () => buildOfficerQuery(filters, page, PAGE_SIZE, sortBy, sortOrder),
    [filters, page, sortBy, sortOrder]
  );

  const officers = useOfficers(query);
  const ranks = useRanks();
  const units = useUnits();

  function onSort(field: string) {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function onFilterChange(next: OfficerListFilters) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Officers" description="Browse and filter the personnel directory." />

      <FilterPanel
        value={filters}
        ranks={(ranks.data ?? []).map((r) => r.rank)}
        units={(units.data ?? []).map((u) => u.unit)}
        onChange={onFilterChange}
      />

      {officers.isPending ? (
        <LoadingState />
      ) : officers.isError ? (
        <ErrorState message={(officers.error as Error).message} onRetry={() => officers.refetch()} />
      ) : officers.data.data.length === 0 ? (
        <EmptyState
          title="No officers match"
          message="Try clearing filters, or import data if the database is empty."
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          <OfficerTable officers={officers.data.data} sort={{ sortBy, sortOrder, onSort }} />
          <Pagination
            page={officers.data.meta.page}
            totalPages={officers.data.meta.totalPages}
            total={officers.data.meta.total}
            pageSize={officers.data.meta.pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
