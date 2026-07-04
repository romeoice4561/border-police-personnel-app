/**
 * Search (Phase 14): multi-field officer search with match modes. Uses the
 * SearchBar form; results are paginated and reuse the OfficerTable.
 */
"use client";

import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { useSearch } from "@/lib/ui/hooks";
import { buildSearchQuery, hasSearchCriteria } from "@/lib/ui/list_filters";
import { PageHeader } from "@/components/common/page_header";
import { SearchBar, EMPTY_SEARCH, type SearchFormValue } from "@/components/common/search_bar";
import { OfficerTable } from "@/components/common/officer_table";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";

const PAGE_SIZE = 20;

export default function SearchPage() {
  // `form` is the live form state; `applied` is the submitted criteria that drive the query.
  const [form, setForm] = useState<SearchFormValue>(EMPTY_SEARCH);
  const [applied, setApplied] = useState<SearchFormValue | null>(null);
  const [page, setPage] = useState(1);

  const criteria = applied ?? EMPTY_SEARCH;
  const enabled = applied !== null && hasSearchCriteria(applied);
  const query = useMemo(() => buildSearchQuery(criteria, page, PAGE_SIZE), [criteria, page]);

  const results = useSearch(query, enabled);

  function onSubmit() {
    setApplied(form);
    setPage(1);
  }
  function onReset() {
    setForm(EMPTY_SEARCH);
    setApplied(null);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Search" description="Find officers by name, rank, unit, phone, position, region, or thresholds." />

      <SearchBar value={form} onChange={setForm} onSubmit={onSubmit} onReset={onReset} />

      {!enabled ? (
        <EmptyState
          title="Enter search criteria"
          message="Fill in at least one field above and press Search."
          icon={<SearchX className="h-8 w-8" />}
        />
      ) : results.isPending ? (
        <LoadingState />
      ) : results.isError ? (
        <ErrorState message={(results.error as Error).message} onRetry={() => results.refetch()} />
      ) : results.data.data.length === 0 ? (
        <EmptyState title="No matches" message="No officers matched your search." icon={<SearchX className="h-8 w-8" />} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {results.data.meta.total} result(s) · match: {results.data.meta.match}
          </p>
          <OfficerTable officers={results.data.data} />
          <Pagination
            page={results.data.meta.page}
            totalPages={results.data.meta.totalPages}
            total={results.data.meta.total}
            pageSize={results.data.meta.pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
