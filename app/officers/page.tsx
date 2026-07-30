/**
 * Officers list (Phase 14): filterable, sortable, paginated officer table.
 * Filter/rank options come from the /ranks and /organization/tree endpoints.
 *
 * Phase 26B Part 6 Part M: FilterPanel's Region text input + Min Quality
 * number replaced by OfficerFilters (Rank/Company/Battalion/Border Patrol
 * Division/Verification Status/Has Portrait/Has Phone/Sort), built on the
 * shared FilterFramework (Part S) — no page-specific disclosure logic.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, UserPlus } from "lucide-react";
import { useOfficers, useGlobalSearch, useRanks, useOrganizationEngine } from "@/lib/ui/hooks";
import { buildOfficerQuery, type OfficerListFilters } from "@/lib/ui/list_filters";
import { PageHeader } from "@/components/common/page_header";
import { GlobalSearchBox } from "@/components/common/global_search_box";
import { OfficerFilters } from "@/components/common/officer_filters";
import { OfficerTable } from "@/components/common/officer_table";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";

const PAGE_SIZE = 20;

export default function OfficersPage() {
  const { can } = useAuth();
  const { t } = useT();
  const [globalQuery, setGlobalQuery] = useState("");
  const [filters, setFilters] = useState<OfficerListFilters>({});
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const isGlobalSearching = globalQuery.trim().length > 0;

  const query = useMemo(
    () => buildOfficerQuery(filters, page, PAGE_SIZE, sortBy, sortOrder),
    [filters, page, sortBy, sortOrder]
  );

  const officers = useOfficers(query);
  const globalSearch = useGlobalSearch({ q: globalQuery, page, pageSize: PAGE_SIZE, sortBy, sortOrder });
  const ranks = useRanks();
  const organizationEngine = useOrganizationEngine();

  const active = isGlobalSearching ? globalSearch : officers;

  function onSort(field: string) {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function onSortChange(nextSortBy: string, nextSortOrder: "asc" | "desc") {
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }

  function onFilterChange(next: OfficerListFilters) {
    setFilters(next);
    setPage(1);
  }

  function onGlobalQueryChange(next: string) {
    setGlobalQuery(next);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Officers"
        description="Browse and filter the personnel directory."
        actions={
          can("officers.create") ? (
            <Button asChild size="sm">
              <Link href="/officers/new">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {t("manualEntry.addOfficerButton")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <GlobalSearchBox value={globalQuery} onChange={onGlobalQueryChange} />

      <OfficerFilters
        value={filters}
        ranks={(ranks.data ?? []).map((r) => r.rank)}
        organizationEngine={organizationEngine}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onChange={onFilterChange}
        onSortChange={onSortChange}
      />

      {active.isPending ? (
        <LoadingState />
      ) : active.isError ? (
        <ErrorState message={(active.error as Error).message} onRetry={() => active.refetch()} />
      ) : active.data.data.length === 0 ? (
        <EmptyState
          title="No officers match"
          message={isGlobalSearching ? "Try a different search term." : "Try clearing filters, or import data if the database is empty."}
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          <OfficerTable officers={active.data.data} sort={{ sortBy, sortOrder, onSort }} />
          <Pagination
            page={active.data.meta.page}
            totalPages={active.data.meta.totalPages}
            total={active.data.meta.total}
            pageSize={active.data.meta.pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
