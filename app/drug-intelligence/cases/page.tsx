/**
 * Drug Intelligence Case List (Phase DI-1 Round 2, Section 5).
 *
 * Single search box (case number / person name / phone — backed by the
 * Round 2 backend's expanded list query, never a client-side filter over
 * everything), quick filters (date range / province / status), responsive
 * table/card result set, pagination. Reuses GlobalSearchBox, Select,
 * ThaiDatePicker, Pagination, LoadingState/ErrorState/EmptyState — no new
 * primitives invented.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { DrugContextualReturnLink } from "@/components/drug_intelligence/drug_contextual_return_link";
import { GlobalSearchBox } from "@/components/common/global_search_box";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { DrugCaseStatusBadge } from "@/components/drug_intelligence/drug_case_status_badge";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugCases } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { formatThaiPersonnelDate, toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugCaseListQuery, DrugCaseListRow } from "@/lib/drug_intelligence/drug_intelligence_client";

const PAGE_SIZE = 20;

interface FilterState {
  query: string;
  arrestDateFrom: string;
  arrestDateTo: string;
  province: string;
  status: string;
}

const EMPTY_FILTERS: FilterState = { query: "", arrestDateFrom: "", arrestDateTo: "", province: "", status: "" };

function toIsoDate(thaiDate: string): string | undefined {
  if (!thaiDate) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(thaiDate)) return thaiDate;
  const parsed = toGregorianDateInputValue(thaiDate);
  return parsed ?? undefined;
}

function optionalPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function filtersFromSearchParams(searchParams: URLSearchParams): FilterState {
  const from = searchParams.get("arrestDateFrom") ?? "";
  const to = searchParams.get("arrestDateTo") ?? "";
  return {
    query: searchParams.get("query") ?? "",
    arrestDateFrom: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? formatThaiPersonnelDate(`${from}T00:00:00Z`) : from,
    arrestDateTo: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? formatThaiPersonnelDate(`${to}T00:00:00Z`) : to,
    province: searchParams.get("province") ?? "",
    status: searchParams.get("status") ?? "",
  };
}

export default function DrugCaseListPage() {
  const { user, can } = useAuth();
  const { t, language } = useT();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => filtersFromSearchParams(searchParams));
  const [page, setPage] = useState(1);

  const query: DrugCaseListQuery = {
    page,
    pageSize: PAGE_SIZE,
    query: filters.query.trim() || undefined,
    province: filters.province || undefined,
    status: filters.status || undefined,
    arrestDateFrom: toIsoDate(filters.arrestDateFrom),
    arrestDateTo: toIsoDate(filters.arrestDateTo),
    headquartersId: optionalPositiveInt(searchParams.get("headquartersId")),
    regionId: optionalPositiveInt(searchParams.get("regionId")),
    battalionId: optionalPositiveInt(searchParams.get("battalionId")),
    companyId: optionalPositiveInt(searchParams.get("companyId")),
  };

  const cases = useDrugCases(user?.id ?? null, query);

  const hasActiveFilters =
    filters.query.trim() !== "" || filters.arrestDateFrom !== "" || filters.arrestDateTo !== "" || filters.province !== "" || filters.status !== "";

  function updateFilters(next: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const statusOptions = DRUG_CASE_STATUSES.map((s) => ({ value: s, label: t(`di.status.${s}`) }));
  const provinceOptions = THAI_PROVINCE_OPTIONS.map((p) => ({ value: p, label: p }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.list.title")}
        description={
          cases.data ? t("di.list.resultCount").replace("{count}", cases.data.meta.total.toLocaleString(language === "th" ? "th-TH" : "en-US")) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DrugContextualReturnLink />
            {can("drug.create") ? (
              <Button asChild size="sm">
                <Link href="/drug-intelligence/cases/new">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("di.list.newCase")}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <GlobalSearchBox value={filters.query} onChange={(v) => updateFilters({ query: v })} placeholder={t("di.list.searchPlaceholder")} />

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.list.filterDateFrom")}</label>
            <ThaiDatePicker value={filters.arrestDateFrom} onChange={(v) => updateFilters({ arrestDateFrom: v })} placeholder="DD/MM/YYYY" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.list.filterDateTo")}</label>
            <ThaiDatePicker value={filters.arrestDateTo} onChange={(v) => updateFilters({ arrestDateTo: v })} placeholder="DD/MM/YYYY" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.list.filterProvince")}</label>
            <Select options={provinceOptions} placeholder={t("common.all")} value={filters.province} onChange={(e) => updateFilters({ province: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.list.filterStatus")}</label>
            <Select options={statusOptions} placeholder={t("common.all")} value={filters.status} onChange={(e) => updateFilters({ status: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!hasActiveFilters} className="w-full sm:w-auto">
              {t("di.list.clearFilters")}
            </Button>
          </div>
        </CardBody>
      </Card>

      {cases.isPending ? (
        <LoadingState />
      ) : cases.isError ? (
        <ErrorState message={(cases.error as Error).message} onRetry={() => cases.refetch()} />
      ) : cases.data.rows.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? t("di.list.emptySearchTitle") : t("di.list.emptyTitle")}
          icon={<FileWarning className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          <DrugCaseTable rows={cases.data.rows} />
          <Pagination page={cases.data.meta.page} totalPages={cases.data.meta.totalPages} total={cases.data.meta.total} pageSize={cases.data.meta.pageSize} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function DrugCaseTable({ rows }: { rows: DrugCaseListRow[] }) {
  const { t } = useT();

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/drug-intelligence/cases/${encodeURIComponent(row.id)}`}
            className="block rounded-xl border border-border bg-surface p-4 hover:border-accent/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{row.caseNumber}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{row.title}</p>
              </div>
              <DrugCaseStatusBadge status={row.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>
                <dt className="uppercase tracking-wide">{t("di.list.columnArrestDate")}</dt>
                <dd className="mt-0.5 text-foreground">{row.arrestDate ? toGregorianDateInputValue(row.arrestDate) : "—"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">{t("di.list.columnLocation")}</dt>
                <dd className="mt-0.5 text-foreground">{row.province || "—"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">{t("di.list.columnPersons")}</dt>
                <dd className="mt-0.5 text-foreground">{row.personCount}</dd>
              </div>
              <div className="col-span-2">
                <dt className="uppercase tracking-wide">{t("di.list.columnSeized")}</dt>
                <dd className="mt-0.5 truncate text-foreground">{row.seizedItemsSummary || "—"}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface sm:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[20%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">{t("di.list.columnCaseNumber")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.list.columnArrestDate")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.list.columnUnit")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.list.columnLocation")}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{t("di.list.columnPersons")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.list.columnSeized")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.list.columnStatus")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.list.columnUpdatedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/drug-intelligence/cases/${encodeURIComponent(row.id)}`} className="line-clamp-2 wrap-break-word text-accent hover:underline" title={row.caseNumber}>
                    {row.caseNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{row.arrestDate ? toGregorianDateInputValue(row.arrestDate) : "—"}</td>
                <td className="px-4 py-3 text-muted">
                  <span className="line-clamp-2 wrap-break-word">{row.reportingUnitText || "—"}</span>
                  {row.leadUnitText && row.leadUnitText !== row.reportingUnitText ? (
                    <span className="mt-0.5 block line-clamp-1 wrap-break-word text-xs text-muted/70" title={t("di.review.leadUnitLabel")}>
                      {t("di.review.leadUnitLabel")}: {row.leadUnitText}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">{row.province || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.personCount}</td>
                <td className="px-4 py-3 text-muted">
                  <span className="line-clamp-2 wrap-break-word">{row.seizedItemsSummary || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <DrugCaseStatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-muted">{new Date(row.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
