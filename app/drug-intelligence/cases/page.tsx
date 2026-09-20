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

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, FileWarning, Download } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { DrugContextualReturnLink } from "@/components/drug_intelligence/drug_contextual_return_link";
import { DrugCaseListExportDrawer } from "@/components/drug_intelligence/drug_case_list_export_drawer";
import { GlobalSearchBox } from "@/components/common/global_search_box";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { DrugCaseListCard } from "@/components/drug_intelligence/drug_case_list_card";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugCases } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { formatThaiPersonnelDate, toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugCaseListQuery } from "@/lib/drug_intelligence/drug_intelligence_client";
import {
  isCaseCompletenessFilter,
  isCommanderUnitGroupBy,
  type CaseCompletenessFilter,
} from "@/lib/drug_intelligence/drug_case_completeness";
import { resolveExportPeriod } from "@/lib/drug_intelligence/drug_export_period";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const PAGE_SIZE = 20;

const COMPLETENESS_LABEL: Record<CaseCompletenessFilter, TranslationKey> = {
  missingArrested: "di.list.completeness.missingArrested",
  missingReportingUnit: "di.list.completeness.missingReportingUnit",
  missingCoordinates: "di.list.completeness.missingCoordinates",
  incompleteSeizure: "di.list.completeness.incompleteSeizure",
};

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

function optionalFiscalYearBe(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 2500 && n <= 2700 ? n : undefined;
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
  const [exportOpen, setExportOpen] = useState(false);

  const completenessRaw = searchParams.get("completeness");
  const completeness = isCaseCompletenessFilter(completenessRaw) ? completenessRaw : undefined;
  const unitGroupRaw = searchParams.get("unitGroup");
  const unitGroup = isCommanderUnitGroupBy(unitGroupRaw) ? unitGroupRaw : undefined;
  const fiscalYearBe = optionalFiscalYearBe(searchParams.get("fy"));
  const explicitDateFrom = toIsoDate(filters.arrestDateFrom);
  const explicitDateTo = toIsoDate(filters.arrestDateTo);
  const fyPeriod = !explicitDateFrom && !explicitDateTo && fiscalYearBe != null ? resolveExportPeriod({ fiscalYearBe }) : undefined;

  const query: DrugCaseListQuery = {
    page,
    pageSize: PAGE_SIZE,
    query: filters.query.trim() || undefined,
    province: filters.province || undefined,
    status: filters.status || undefined,
    arrestDateFrom: explicitDateFrom ?? fyPeriod?.dateFrom,
    arrestDateTo: explicitDateTo ?? fyPeriod?.dateTo,
    headquartersId: optionalPositiveInt(searchParams.get("headquartersId")),
    regionId: optionalPositiveInt(searchParams.get("regionId")),
    battalionId: optionalPositiveInt(searchParams.get("battalionId")),
    companyId: optionalPositiveInt(searchParams.get("companyId")),
    completeness,
    unitGroup,
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
  const exportFilters = useMemo(
    () => ({
      query: filters.query.trim() || undefined,
      arrestDateFrom: explicitDateFrom,
      arrestDateTo: explicitDateTo,
      fiscalYearBe: explicitDateFrom && explicitDateTo ? undefined : fiscalYearBe,
      province: filters.province || undefined,
      status: filters.status || undefined,
      headquartersId: query.headquartersId,
      regionId: query.regionId,
      battalionId: query.battalionId,
      companyId: query.companyId,
      completeness,
      unitGroup,
    }),
    [filters, explicitDateFrom, explicitDateTo, fiscalYearBe, query.headquartersId, query.regionId, query.battalionId, query.companyId, completeness, unitGroup]
  );

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
            {can("drug.export") ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("di.export.title")}
              </Button>
            ) : null}
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

      {completeness ? (
        <p
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          data-testid="cases-completeness-banner"
        >
          {t("di.list.completenessBanner")}: {t(COMPLETENESS_LABEL[completeness])}
        </p>
      ) : null}

      <Card>
        <CardBody className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("di.list.filterDateFrom")}</label>
            <ThaiDatePicker value={filters.arrestDateFrom} onChange={(v) => updateFilters({ arrestDateFrom: v })} placeholder="DD/MM/YYYY" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("di.list.filterDateTo")}</label>
            <ThaiDatePicker value={filters.arrestDateTo} onChange={(v) => updateFilters({ arrestDateTo: v })} placeholder="DD/MM/YYYY" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("di.list.filterProvince")}</label>
            <Select options={provinceOptions} placeholder={t("common.all")} value={filters.province} onChange={(e) => updateFilters({ province: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("di.list.filterStatus")}</label>
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
        <div className="space-y-3">
          <div className="grid gap-2" data-testid="case-list-results">
            {cases.data.rows.map((row) => (
              <DrugCaseListCard key={row.id} row={row} />
            ))}
          </div>
          <Pagination page={cases.data.meta.page} totalPages={cases.data.meta.totalPages} total={cases.data.meta.total} pageSize={cases.data.meta.pageSize} onPageChange={setPage} />
        </div>
      )}
      <DrugCaseListExportDrawer open={exportOpen} onClose={() => setExportOpen(false)} filters={exportFilters} />
    </div>
  );
}
