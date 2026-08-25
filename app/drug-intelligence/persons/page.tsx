/**
 * Advanced Person Search (DI-7.4) — "ค้นหาบุคคลเชิงวิเคราะห์"
 *
 * Replaces the old Person Directory. All filter state is persisted in the URL
 * (bookmarkable, refresh-safe, browser-back-friendly). Uses the new
 * useDrugPersonAdvancedSearch hook and DrugPersonAdvancedSearchResult type.
 *
 * Architecture:
 *  • Default export = Suspense boundary (required by useSearchParams)
 *  • DrugPersonAdvancedSearchContent = "use client" inner component that reads
 *    URL params and drives the full search/filter/sort/paginate surface.
 */
"use client";

import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { GlobalSearchBox } from "@/components/common/global_search_box";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugPersonAdvancedSearch, useDrugNetworkGroups } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { useOrgTree } from "@/lib/ui/hooks";
import { companiesForBattalion } from "@/lib/organization/org_tree";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { presentIdentifierValue } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import {
  DRUG_PERSON_SEX_OPTIONS,
  DRUG_PERSON_SEX_LABELS,
  DRUG_NETWORK_ROLES,
  DRUG_NETWORK_ROLE_LABELS,
  DRUG_NETWORK_ROLE_SOURCES,
  DRUG_NETWORK_ROLE_SOURCE_LABELS,
  DRUG_NETWORK_ROLE_VERIFICATION_STATUSES,
  DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS,
  DRUG_CASE_PERSON_ROLES,
  DRUG_CASE_PERSON_ROLE_LABELS,
  DRUG_PERSON_IDENTIFIER_TYPE_LABELS,
  isValidDrugPersonSex,
  isValidDrugNetworkRole,
  isValidDrugNetworkRoleVerificationStatus,
  isValidDrugCasePersonRole,
  isValidDrugPersonIdentifierType,
} from "@/lib/drug_intelligence/drug_person_options";
import type { DrugPersonAdvancedSearchResult, DrugPersonSearchMatchedField } from "@/lib/drug_intelligence/drug_intelligence_client";

const PAGE_SIZE = 20;
const VALID_SORTS = ["RELEVANCE", "NAME_ASC", "CASE_COUNT_DESC", "LAST_SEEN_DESC", "AGE_ASC", "AGE_DESC"] as const;
type SortValue = (typeof VALID_SORTS)[number];

// ── Default export: Suspense wrapper ──────────────────────────────────────────

export default function DrugPersonAdvancedSearchPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugPersonAdvancedSearchContent />
    </Suspense>
  );
}

// ── Inner "use client" content ────────────────────────────────────────────────

function DrugPersonAdvancedSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t, language } = useT();
  const [showFilters, setShowFilters] = useState(false);

  const localeStr = language === "th" ? "th-TH" : "en-US";

  // ── URL param readers ────────────────────────────────────────────────────
  const q                  = searchParams.get("q")                  ?? "";
  const sex                = searchParams.get("sex")                ?? "";
  const nationality        = searchParams.get("nationality")        ?? "";
  const ageMin             = searchParams.get("ageMin")             ?? "";
  const ageMax             = searchParams.get("ageMax")             ?? "";
  const networkGroupIds    = searchParams.get("networkGroupIds")    ?? "";
  const networkRoles       = searchParams.get("networkRoles")       ?? "";
  const networkRoleSources = searchParams.get("networkRoleSources") ?? "";
  const verificationStatuses = searchParams.get("verificationStatuses") ?? "";
  const caseRoles          = searchParams.get("caseRoles")          ?? "";
  const minCaseCount       = searchParams.get("minCaseCount")       ?? "";
  const dateFrom           = searchParams.get("dateFrom")           ?? "";
  const dateTo             = searchParams.get("dateTo")             ?? "";
  const province           = searchParams.get("province")           ?? "";
  const battalionId        = searchParams.get("battalionId")        ?? "";
  const companyId          = searchParams.get("companyId")          ?? "";
  const rawSort            = searchParams.get("sort")               ?? "RELEVANCE";
  const page               = Number(searchParams.get("page")        ?? "1");

  const sort: SortValue = (VALID_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as SortValue)
    : "RELEVANCE";

  // ── URL mutation helpers ─────────────────────────────────────────────────
  function updateParams(patch: Record<string, string | undefined>, resetPage = true) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && value !== "") next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete("page");
    router.push(`/drug-intelligence/persons?${next.toString()}`, { scroll: false });
  }

  function toggleArrayValue(paramKey: string, currentStr: string, value: string) {
    const arr = currentStr ? currentStr.split(",").filter(Boolean) : [];
    const idx = arr.indexOf(value);
    if (idx === -1) arr.push(value);
    else arr.splice(idx, 1);
    updateParams({ [paramKey]: arr.length ? arr.join(",") : undefined });
  }

  function removeArrayValue(paramKey: string, currentStr: string, value: string) {
    const arr = currentStr.split(",").filter((v) => v !== value && v !== "");
    updateParams({ [paramKey]: arr.length ? arr.join(",") : undefined });
  }

  /** Clear all search/filter state. Preserves the current sort order. */
  function clearAllFilters() {
    const next = new URLSearchParams();
    if (sort !== "RELEVANCE") next.set("sort", sort);
    const qs = next.toString();
    router.push(qs ? `/drug-intelligence/persons?${qs}` : "/drug-intelligence/persons", { scroll: false });
  }

  // ── Build search query from URL params ───────────────────────────────────
  const search = useDrugPersonAdvancedSearch(user?.id ?? null, {
    query:               q.trim()         || undefined,
    sex:                 sex              || undefined,
    nationality:         nationality.trim() || undefined,
    ageMin:              ageMin           ? Number(ageMin)      : undefined,
    ageMax:              ageMax           ? Number(ageMax)      : undefined,
    networkGroupIds:     networkGroupIds  ? networkGroupIds.split(",").filter(Boolean)    : undefined,
    networkRoles:        networkRoles     ? networkRoles.split(",").filter(Boolean)       : undefined,
    networkRoleSources:  networkRoleSources ? networkRoleSources.split(",").filter(Boolean) : undefined,
    verificationStatuses: verificationStatuses ? verificationStatuses.split(",").filter(Boolean) : undefined,
    caseRoles:           caseRoles        ? caseRoles.split(",").filter(Boolean)          : undefined,
    minCaseCount:        minCaseCount     ? Number(minCaseCount) : undefined,
    dateFrom:            dateFrom         || undefined,
    dateTo:              dateTo           || undefined,
    province:            province.trim()  || undefined,
    battalionId:         battalionId      ? Number(battalionId)  : undefined,
    companyId:           companyId        ? Number(companyId)    : undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  // ── Load org tree for battalion/company selectors ────────────────────────
  const orgTree = useOrgTree();
  const allBattalions = orgTree.data?.battalions ?? [];
  const selectedBattalionIdNum = battalionId ? Number(battalionId) : null;
  const availableCompanies = companiesForBattalion(orgTree.data ?? { headquarters: [], regions: [], battalions: [], companies: [] }, selectedBattalionIdNum);
  /** Map id→name for chip labels. */
  const battalionNameById = new Map(allBattalions.map((b) => [b.id, b.nameTh]));
  const companyNameById = new Map((orgTree.data?.companies ?? []).map((c) => [c.id, c.nameTh]));

  // ── Load canonical network groups for filter picker ──────────────────────
  const networkGroupsQuery = useDrugNetworkGroups(user?.id ?? null);
  const availableNetworkGroups = networkGroupsQuery.data ?? [];
  /** Map of groupId → name for active-chip display. */
  const groupNameById = new Map(availableNetworkGroups.map((g) => [g.id, g.name]));

  // ── Derived state ────────────────────────────────────────────────────────
  const hasActiveFilters = Boolean(
    q || sex || nationality || ageMin || ageMax || networkGroupIds || networkRoles ||
    networkRoleSources || verificationStatuses || caseRoles || minCaseCount ||
    dateFrom || dateTo || province || battalionId || companyId
  );
  const resultTotal = search.data?.meta.total ?? 0;

  // ── Sort options ─────────────────────────────────────────────────────────
  const sortOptions = [
    { value: "RELEVANCE",       label: t("di.advSearch.sortRelevance")     },
    { value: "NAME_ASC",        label: t("di.advSearch.sortNameAsc")       },
    { value: "CASE_COUNT_DESC", label: t("di.advSearch.sortCaseCountDesc") },
    { value: "LAST_SEEN_DESC",  label: t("di.advSearch.sortLastSeenDesc")  },
    { value: "AGE_ASC",         label: t("di.advSearch.sortAgeAsc")        },
    { value: "AGE_DESC",        label: t("di.advSearch.sortAgeDesc")       },
  ];

  // ── Active filter chips ───────────────────────────────────────────────────
  type Chip = { id: string; label: string; onRemove: () => void };
  const chips: Chip[] = [];

  if (sex && isValidDrugPersonSex(sex)) {
    chips.push({ id: "sex", label: `เพศ: ${DRUG_PERSON_SEX_LABELS[sex].labelTh}`, onRemove: () => updateParams({ sex: undefined }) });
  }
  if (nationality) {
    chips.push({ id: "nationality", label: `สัญชาติ: ${nationality}`, onRemove: () => updateParams({ nationality: undefined }) });
  }
  if (ageMin) {
    chips.push({ id: "ageMin", label: `อายุ ≥ ${ageMin}`, onRemove: () => updateParams({ ageMin: undefined }) });
  }
  if (ageMax) {
    chips.push({ id: "ageMax", label: `อายุ ≤ ${ageMax}`, onRemove: () => updateParams({ ageMax: undefined }) });
  }
  networkGroupIds.split(",").filter(Boolean).forEach((gid) => {
    const gname = groupNameById.get(gid) ?? gid;
    chips.push({ id: `ng-${gid}`, label: `เครือข่าย: ${gname}`, onRemove: () => removeArrayValue("networkGroupIds", networkGroupIds, gid) });
  });
  networkRoles.split(",").filter(Boolean).forEach((role) => {
    const label = isValidDrugNetworkRole(role) ? DRUG_NETWORK_ROLE_LABELS[role].labelTh : role;
    chips.push({ id: `nr-${role}`, label: `บทบาทเครือข่าย: ${label}`, onRemove: () => removeArrayValue("networkRoles", networkRoles, role) });
  });
  networkRoleSources.split(",").filter(Boolean).forEach((src) => {
    const typed = DRUG_NETWORK_ROLE_SOURCES.find((s) => s === src);
    const label = typed ? DRUG_NETWORK_ROLE_SOURCE_LABELS[typed].labelTh : src;
    chips.push({ id: `nrs-${src}`, label: `แหล่ง: ${label}`, onRemove: () => removeArrayValue("networkRoleSources", networkRoleSources, src) });
  });
  verificationStatuses.split(",").filter(Boolean).forEach((vs) => {
    const label = isValidDrugNetworkRoleVerificationStatus(vs) ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[vs].labelTh : vs;
    chips.push({ id: `vs-${vs}`, label: `ยืนยัน: ${label}`, onRemove: () => removeArrayValue("verificationStatuses", verificationStatuses, vs) });
  });
  caseRoles.split(",").filter(Boolean).forEach((role) => {
    const label = isValidDrugCasePersonRole(role) ? DRUG_CASE_PERSON_ROLE_LABELS[role].labelTh : role;
    chips.push({ id: `cr-${role}`, label: `บทบาทคดี: ${label}`, onRemove: () => removeArrayValue("caseRoles", caseRoles, role) });
  });
  if (minCaseCount) {
    chips.push({ id: "minCaseCount", label: `คดี ≥ ${minCaseCount}`, onRemove: () => updateParams({ minCaseCount: undefined }) });
  }
  if (province) {
    chips.push({ id: "province", label: `จังหวัด: ${province}`, onRemove: () => updateParams({ province: undefined }) });
  }
  if (dateFrom) {
    chips.push({ id: "dateFrom", label: `จาก: ${dateFrom}`, onRemove: () => updateParams({ dateFrom: undefined }) });
  }
  if (dateTo) {
    chips.push({ id: "dateTo", label: `ถึง: ${dateTo}`, onRemove: () => updateParams({ dateTo: undefined }) });
  }
  if (battalionId) {
    const bname = battalionNameById.get(Number(battalionId)) ?? battalionId;
    chips.push({ id: "battalionId", label: `กองกำกับการ: ${bname}`, onRemove: () => updateParams({ battalionId: undefined, companyId: undefined }) });
  }
  if (companyId) {
    const cname = companyNameById.get(Number(companyId)) ?? companyId;
    chips.push({ id: "companyId", label: `กองร้อย: ${cname}`, onRemove: () => updateParams({ companyId: undefined }) });
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Page header */}
      <PageHeader
        title={t("di.advSearch.pageTitle")}
        description={
          search.data
            ? t("di.advSearch.resultCount").replace("{count}", resultTotal.toLocaleString(localeStr))
            : t("di.advSearch.pageDescription")
        }
      />

      {/* Primary search box */}
      <GlobalSearchBox
        value={q}
        onChange={(v) => updateParams({ q: v || undefined })}
        placeholder={t("di.advSearch.searchPlaceholder")}
      />

      {/* Controls row: filter toggle + clear + sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-neutral-bg"
        >
          {showFilters
            ? <ChevronUp  className="h-4 w-4" aria-hidden="true" />
            : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          {t("di.advSearch.advancedFilters")}
          {chips.length > 0 && (
            <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-fg px-1">
              {chips.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t("di.advSearch.clearFilters")}
            </Button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-xs text-muted">{t("di.advSearch.sortLabel")}</span>
            <Select
              options={sortOptions}
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value || undefined }, false)}
            />
          </div>
        </div>
      </div>

      {/* ── Collapsible filter panel ─────────────────────────────────────── */}
      {showFilters && (
        <div className="space-y-5 rounded-xl border border-border bg-surface p-4">

          {/* A: ข้อมูลพื้นฐาน */}
          <FilterSection title={t("di.advSearch.filterSectionBasic")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Sex */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("di.advSearch.filterSex")}</p>
                <div className="flex flex-wrap gap-2">
                  <ToggleChip
                    label={t("di.advSearch.filterSexAll")}
                    active={!sex}
                    onClick={() => updateParams({ sex: undefined })}
                  />
                  {DRUG_PERSON_SEX_OPTIONS.map((s) => (
                    <ToggleChip
                      key={s}
                      label={DRUG_PERSON_SEX_LABELS[s].labelTh}
                      active={sex === s}
                      onClick={() => updateParams({ sex: sex === s ? undefined : s })}
                    />
                  ))}
                </div>
              </div>

              {/* Nationality */}
              <div>
                <label htmlFor="filter-nationality" className="mb-1.5 block text-xs font-medium text-muted">
                  {t("di.advSearch.filterNationality")}
                </label>
                <input
                  id="filter-nationality"
                  type="text"
                  value={nationality}
                  onChange={(e) => updateParams({ nationality: e.target.value || undefined })}
                  placeholder="ไทย / พม่า / ลาว..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Age range */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("di.advSearch.filterAgeRange")}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={ageMin}
                    onChange={(e) => updateParams({ ageMin: e.target.value || undefined })}
                    aria-label={t("di.advSearch.filterAgeFrom")}
                    placeholder={t("di.advSearch.filterAgeFrom")}
                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <span className="text-xs text-muted">{t("di.advSearch.filterAgeTo")}</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={ageMax}
                    onChange={(e) => updateParams({ ageMax: e.target.value || undefined })}
                    aria-label={t("di.advSearch.filterAgeTo")}
                    placeholder={t("di.advSearch.filterAgeTo")}
                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
            </div>
          </FilterSection>

          {/* B: เครือข่ายยาเสพติด */}
          <FilterSection title={t("di.advSearch.filterSectionNetwork")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("di.advSearch.filterNetworkGroup")}</p>
                {availableNetworkGroups.length === 0 ? (
                  <p className="text-xs text-muted">{networkGroupsQuery.isLoading ? "กำลังโหลด…" : "ยังไม่มีเครือข่ายในระบบ"}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableNetworkGroups.map((g) => (
                      <ToggleChip
                        key={g.id}
                        label={g.name}
                        active={networkGroupIds.split(",").includes(g.id)}
                        onClick={() => toggleArrayValue("networkGroupIds", networkGroupIds, g.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("di.advSearch.filterNetworkRole")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {DRUG_NETWORK_ROLES.map((role) => (
                    <ToggleChip
                      key={role}
                      label={DRUG_NETWORK_ROLE_LABELS[role].labelTh}
                      active={networkRoles.split(",").includes(role)}
                      onClick={() => toggleArrayValue("networkRoles", networkRoles, role)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </FilterSection>

          {/* C: แหล่งที่มา / สถานะยืนยัน */}
          <FilterSection title={t("di.advSearch.filterSectionSource")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("di.advSearch.filterSource")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {DRUG_NETWORK_ROLE_SOURCES.map((src) => (
                    <ToggleChip
                      key={src}
                      label={DRUG_NETWORK_ROLE_SOURCE_LABELS[src].labelTh}
                      active={networkRoleSources.split(",").includes(src)}
                      onClick={() => toggleArrayValue("networkRoleSources", networkRoleSources, src)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("di.advSearch.filterVerification")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {DRUG_NETWORK_ROLE_VERIFICATION_STATUSES.map((vs) => (
                    <ToggleChip
                      key={vs}
                      label={DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[vs].labelTh}
                      active={verificationStatuses.split(",").includes(vs)}
                      onClick={() => toggleArrayValue("verificationStatuses", verificationStatuses, vs)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </FilterSection>

          {/* D: ประวัติคดี */}
          <FilterSection title={t("di.advSearch.filterSectionCase")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Min case count */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("di.advSearch.filterMinCases")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["1", "2", "3", "5"] as const).map((n) => (
                    <ToggleChip
                      key={n}
                      label={`${n}+`}
                      active={minCaseCount === n}
                      onClick={() => updateParams({ minCaseCount: minCaseCount === n ? undefined : n })}
                    />
                  ))}
                </div>
              </div>

              {/* Province — canonical dropdown */}
              <div>
                <label htmlFor="filter-province" className="mb-1.5 block text-xs font-medium text-muted">
                  {t("di.advSearch.filterProvince")}
                </label>
                <select
                  id="filter-province"
                  value={province}
                  onChange={(e) => updateParams({ province: e.target.value || undefined })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">— ทุกจังหวัด —</option>
                  {THAI_PROVINCE_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div>
                <label htmlFor="filter-date-from" className="mb-1.5 block text-xs font-medium text-muted">
                  {t("di.advSearch.filterDateFrom")}
                </label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => updateParams({ dateFrom: e.target.value || undefined })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Date to */}
              <div>
                <label htmlFor="filter-date-to" className="mb-1.5 block text-xs font-medium text-muted">
                  {t("di.advSearch.filterDateTo")}
                </label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => updateParams({ dateTo: e.target.value || undefined })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Battalion — canonical org selector */}
              <div>
                <label htmlFor="filter-battalion" className="mb-1.5 block text-xs font-medium text-muted">
                  {t("di.advSearch.filterBattalion")}
                </label>
                <select
                  id="filter-battalion"
                  value={battalionId}
                  onChange={(e) => {
                    const newBattalionId = e.target.value || undefined;
                    // Clear company when battalion changes
                    updateParams({ battalionId: newBattalionId, companyId: undefined });
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">{orgTree.isLoading ? "กำลังโหลด…" : "— ทุกกองกำกับการ —"}</option>
                  {allBattalions.map((b) => (
                    <option key={b.id} value={String(b.id)}>{b.nameTh}</option>
                  ))}
                </select>
              </div>

              {/* Company — filtered by selected battalion */}
              <div>
                <label htmlFor="filter-company" className="mb-1.5 block text-xs font-medium text-muted">
                  {t("di.advSearch.filterCompany")}
                </label>
                <select
                  id="filter-company"
                  value={companyId}
                  onChange={(e) => updateParams({ companyId: e.target.value || undefined })}
                  disabled={selectedBattalionIdNum === null && availableCompanies.length === 0}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                >
                  <option value="">— ทุกกองร้อย —</option>
                  {availableCompanies.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.nameTh}</option>
                  ))}
                </select>
                {selectedBattalionIdNum === null && (
                  <p className="mt-1 text-xs text-muted">เลือกกองกำกับการก่อนเพื่อกรองกองร้อย</p>
                )}
              </div>
            </div>
          </FilterSection>

          {/* E: บทบาทในคดี */}
          <FilterSection title={t("di.advSearch.filterCaseRole")}>
            <div className="flex flex-wrap gap-1.5">
              {DRUG_CASE_PERSON_ROLES.map((role) => (
                <ToggleChip
                  key={role}
                  label={DRUG_CASE_PERSON_ROLE_LABELS[role].labelTh}
                  active={caseRoles.split(",").includes(role)}
                  onClick={() => toggleArrayValue("caseRoles", caseRoles, role)}
                />
              ))}
            </div>
          </FilterSection>
        </div>
      )}

      {/* ── Active filter chips + Clear All ──────────────────────────────── */}
      {(chips.length > 0 || hasActiveFilters) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">{t("di.advSearch.activeFiltersLabel")}:</span>
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`ลบตัวกรอง ${chip.label}`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-accent/20"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {/* Compact clear-all beside chips */}
          <button
            type="button"
            onClick={clearAllFilters}
            aria-label={t("di.advSearch.clearAllFilters")}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-serious/50 hover:bg-serious/10 hover:text-serious"
          >
            {t("di.advSearch.clearAllFilters")}
          </button>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {search.isPending ? (
        <LoadingState />
      ) : search.isError ? (
        <ErrorState message={(search.error as Error).message} onRetry={() => search.refetch()} />
      ) : search.data.items.length === 0 ? (
        <EmptyState
          title={hasActiveFilters || q ? t("di.advSearch.emptySearchTitle") : t("di.advSearch.emptyTitle")}
          message={hasActiveFilters || q ? t("di.advSearch.emptyHint") : undefined}
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {search.data.items.map((item) => (
              <PersonResultCard key={item.id} item={item} />
            ))}
          </div>
          <Pagination
            page={search.data.meta.page}
            totalPages={search.data.meta.totalPages}
            total={search.data.meta.total}
            pageSize={search.data.meta.pageSize}
            onPageChange={(p) => updateParams({ page: String(p) }, false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Reusable filter UI primitives ─────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-surface text-foreground hover:bg-neutral-bg",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ── Person result card ─────────────────────────────────────────────────────────

function matchedFieldLabel(
  field: DrugPersonSearchMatchedField["field"],
  t: ReturnType<typeof useT>["t"]
): string {
  switch (field) {
    case "NAME":       return t("di.advSearch.matchedName");
    case "NICKNAME":   return t("di.advSearch.matchedNickname");
    case "ALIAS":      return t("di.advSearch.matchedAlias");
    case "IDENTIFIER": return t("di.advSearch.matchedIdentifier");
    case "PHONE":      return t("di.advSearch.matchedPhone");
  }
}

function PersonResultCard({ item }: { item: DrugPersonAdvancedSearchResult }) {
  const { can } = useAuth();
  const { t } = useT();
  const canViewFull = can("drug.edit");

  const sexLabel =
    item.sex && isValidDrugPersonSex(item.sex)
      ? DRUG_PERSON_SEX_LABELS[item.sex].labelTh
      : (item.sex ?? null);

  const MAX_SHOWN_ALIASES = 3;
  const shownAliases   = item.aliases.slice(0, MAX_SHOWN_ALIASES);
  const extraAliases   = item.aliasCount - shownAliases.length;

  const MAX_SHOWN_ROLES = 3;
  // Map raw enum values → Thai labels before displaying
  const roleLabelsTh = item.networkRoleSummary.map((r) =>
    isValidDrugNetworkRole(r) ? DRUG_NETWORK_ROLE_LABELS[r].labelTh : r
  );
  const shownRoles = roleLabelsTh.slice(0, MAX_SHOWN_ROLES);
  const extraRoles = roleLabelsTh.length - shownRoles.length;

  const demographics = [
    sexLabel,
    item.displayAge !== null
      ? `${item.isAgeApproximate ? t("di.advSearch.ageApproximate") + " " : ""}อายุ ${item.displayAge} ${t("di.advSearch.years")}`
      : null,
    item.nationality,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
      {/* ── Name + badges ───────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/drug-intelligence/persons/${encodeURIComponent(item.id)}`}
            className="text-base font-semibold text-accent hover:underline"
          >
            {item.primaryFullName}
          </Link>
          {item.hasPotentialDuplicate && (
            <Link
              href={
                item.potentialDuplicateCandidateId
                  ? `/drug-intelligence/review/duplicates/compare?a=${encodeURIComponent(item.id)}&b=${encodeURIComponent(item.potentialDuplicateCandidateId)}`
                  : `/drug-intelligence/review/duplicates`
              }
              title="พบบุคคลที่อาจซ้ำ — ตรวจสอบเปรียบเทียบ"
            >
              <Badge tone="warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {t("di.directory.duplicateBadge")}
              </Badge>
            </Link>
          )}
        </div>

        {item.nickname && (
          <p className="mt-0.5 text-sm text-muted">
            ชื่อเล่น: <span className="text-foreground">{item.nickname}</span>
          </p>
        )}

        {shownAliases.length > 0 && (
          <p className="mt-0.5 text-sm text-muted">
            ชื่ออื่น: <span className="text-foreground">{shownAliases.join(", ")}</span>
            {extraAliases > 0 && (
              <span className="ml-1 text-xs text-muted">(+{extraAliases} รายการ)</span>
            )}
          </p>
        )}
      </div>

      {/* ── Demographics ────────────────────────────────────────────────── */}
      {demographics.length > 0 && (
        <p className="text-sm text-muted">{demographics.join(" • ")}</p>
      )}

      {/* ── Counts ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-muted">
          📁 <span className="font-medium text-foreground">{item.caseCount}</span>{" "}
          {t("di.advSearch.caseCountLabel")}
        </span>
        {item.phoneCount > 0 && (
          <span className="text-muted">
            📞 <span className="font-medium text-foreground">{item.phoneCount}</span>
          </span>
        )}
      </div>

      {/* ── Network role summary ─────────────────────────────────────────── */}
      {shownRoles.length > 0 && (
        <p className="text-sm text-muted">
          🏷 {t("di.advSearch.networkRoleHistory")}:{" "}
          <span className="text-foreground">{shownRoles.join(", ")}</span>
          {extraRoles > 0 && (
            <span className="ml-1 text-xs text-muted">(+{extraRoles})</span>
          )}
        </p>
      )}

      {/* ── Network groups ───────────────────────────────────────────────── */}
      {item.networkGroups.length > 0 && (
        <p className="text-sm text-muted">
          เครือข่าย:{" "}
          <span className="text-foreground">{item.networkGroups.map((g) => g.name).join(", ")}</span>
        </p>
      )}

      {/* ── Identifier preview ───────────────────────────────────────────── */}
      {item.identifierPreview && (
        <p className="font-mono text-xs text-muted">
          {isValidDrugPersonIdentifierType(item.identifierPreview.type)
            ? DRUG_PERSON_IDENTIFIER_TYPE_LABELS[item.identifierPreview.type].labelTh
            : item.identifierPreview.type}:{" "}
          <span className="text-foreground">
            {presentIdentifierValue(item.identifierPreview.value, canViewFull)}
          </span>
        </p>
      )}

      {/* ── Matched fields ───────────────────────────────────────────────── */}
      {item.matchedFields.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted">
          {item.matchedFields.map((mf, i) => (
            <li key={i}>
              {t("di.advSearch.matchPrefix")}:{" "}
              <span className="font-medium text-foreground">{matchedFieldLabel(mf.field, t)}</span>{" "}
              &ldquo;<span className="font-mono">{mf.maskedValue}</span>&rdquo;
            </li>
          ))}
        </ul>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/drug-intelligence/persons/${encodeURIComponent(item.id)}`}>
            {t("di.advSearch.openProfile")}
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/drug-intelligence/network?focusType=PERSON&focusId=${encodeURIComponent(item.id)}`}>
            {t("di.advSearch.openNetwork")}
          </Link>
        </Button>
        {item.hasPotentialDuplicate && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={
                item.potentialDuplicateCandidateId
                  ? `/drug-intelligence/review/duplicates/compare?a=${encodeURIComponent(item.id)}&b=${encodeURIComponent(item.potentialDuplicateCandidateId)}`
                  : `/drug-intelligence/review/duplicates`
              }
            >
              {t("di.advSearch.checkDuplicates")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
