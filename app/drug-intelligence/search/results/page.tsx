/**
 * Single-entity-type search results (Phase DI-3 — Section 24's "ดูทั้งหมด"
 * drill-in). Backend-paginated, never a client-side slice of an
 * already-fetched full list.
 */
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { DrugSearchResultCard } from "@/components/drug_intelligence/drug_search_result_card";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugSearchByType } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import type { DrugSearchEntityType } from "@/lib/drug_intelligence/drug_intelligence_client";

const PAGE_SIZE = 20;

const GROUP_LABEL_KEY: Record<DrugSearchEntityType, "di.search.groupPerson" | "di.search.groupPhone" | "di.search.groupSim" | "di.search.groupDevice" | "di.search.groupVehicle" | "di.search.groupCase"> = {
  PERSON: "di.search.groupPerson",
  PHONE: "di.search.groupPhone",
  SIM: "di.search.groupSim",
  DEVICE: "di.search.groupDevice",
  VEHICLE: "di.search.groupVehicle",
  CASE: "di.search.groupCase",
};

export default function DrugSearchResultsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugSearchResultsContent />
    </Suspense>
  );
}

function DrugSearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();

  const q = searchParams.get("q") ?? "";
  const entityType = (searchParams.get("entityType") as DrugSearchEntityType | null) ?? "PERSON";
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const province = searchParams.get("province") ?? undefined;
  const minCaseCount = searchParams.get("minCaseCount") ? Number(searchParams.get("minCaseCount")) : undefined;
  const page = Number(searchParams.get("page") ?? "1");

  const result = useDrugSearchByType(user?.id ?? null, { q, entityType, dateFrom, dateTo, province, minCaseCount, page, pageSize: PAGE_SIZE });

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `/drug-intelligence/search/results?${params.toString()}`;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${t(GROUP_LABEL_KEY[entityType])} — "${q}"`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/drug-intelligence/search?${new URLSearchParams({ q }).toString()}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("di.search.backToResults")}
            </Link>
          </Button>
        }
      />

      {result.isPending ? (
        <LoadingState />
      ) : result.isError ? (
        <ErrorState message={t("di.search.errorLoad")} onRetry={() => result.refetch()} />
      ) : result.data.meta.total === 0 ? (
        <EmptyState title={t("di.search.noResults")} icon={<ScanSearch className="h-8 w-8" />} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.rows.map((row) => (
              <DrugSearchResultCard key={`${row.entityType}-${row.entityId}`} result={row} />
            ))}
          </div>
          <Pagination
            page={result.data.meta.page}
            totalPages={result.data.meta.totalPages}
            total={result.data.meta.total}
            pageSize={result.data.meta.pageSize}
            onPageChange={(next) => router.push(pageHref(next))}
          />
        </div>
      )}
    </div>
  );
}
