/**
 * Intelligence Search Center (Phase DI-3 + Phase 1B).
 *
 * Modes on the EXISTING Search workspace (no new sidebar item):
 * - general: existing Global Search (default / backward compatible)
 * - relationship: evidence-backed Relationship Search MVP
 * - ai: disabled placeholder ("เร็ว ๆ นี้")
 *
 * Query/filters persist in the URL. Relationship Search is READ-ONLY —
 * QUERY CONDITION ≠ FACT.
 */
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ScanSearch, ChevronDown, ChevronUp } from "lucide-react";
import { GlobalSearchBox } from "@/components/common/global_search_box";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { DrugSearchResultCard } from "@/components/drug_intelligence/drug_search_result_card";
import { DrugSearchModeSwitcher, type DrugSearchCenterMode } from "@/components/drug_intelligence/drug_search_mode_switcher";
import { DrugRelationshipSearchPanel } from "@/components/drug_intelligence/drug_relationship_search_panel";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugSearchGrouped } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { normalizeThaiPersonnelDateForSave } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugSearchEntityType } from "@/lib/drug_intelligence/drug_intelligence_client";

const ENTITY_TYPES: DrugSearchEntityType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE"];

const GROUP_LABEL_KEY: Record<DrugSearchEntityType, "di.search.groupPerson" | "di.search.groupPhone" | "di.search.groupSim" | "di.search.groupDevice" | "di.search.groupVehicle" | "di.search.groupCase"> = {
  PERSON: "di.search.groupPerson",
  PHONE: "di.search.groupPhone",
  SIM: "di.search.groupSim",
  DEVICE: "di.search.groupDevice",
  VEHICLE: "di.search.groupVehicle",
  CASE: "di.search.groupCase",
};

function toIsoDate(thaiDate: string): string | undefined {
  if (!thaiDate) return undefined;
  return normalizeThaiPersonnelDateForSave(thaiDate) ?? undefined;
}

function parseMode(raw: string | null): DrugSearchCenterMode {
  if (raw === "relationship") return "relationship";
  if (raw === "ai") return "ai";
  return "general";
}

export default function DrugSearchPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugSearchContent />
    </Suspense>
  );
}

function DrugSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t, language } = useT();

  const mode = parseMode(searchParams.get("mode"));
  const q = searchParams.get("q") ?? "";
  const entityType = (searchParams.get("entityType") as DrugSearchEntityType | null) ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const province = searchParams.get("province") ?? "";
  const minCaseCount = searchParams.get("minCaseCount") ?? "";
  const [showAdvanced, setShowAdvanced] = useState(false);

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/drug-intelligence/search?${next.toString()}`);
  }

  function setMode(nextMode: DrugSearchCenterMode) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextMode === "general") next.delete("mode");
    else next.set("mode", nextMode);
    // Switching modes must not accidentally submit relationship or clear general q.
    if (nextMode !== "relationship") {
      for (const key of ["relRun", "relPage"]) next.delete(key);
    }
    router.push(`/drug-intelligence/search?${next.toString()}`);
  }

  const search = useDrugSearchGrouped(user?.id ?? null, user?.displayName ?? "", {
    q,
    entityType,
    dateFrom: toIsoDate(dateFrom),
    dateTo: toIsoDate(dateTo),
    province: province || undefined,
    minCaseCount: minCaseCount ? Number(minCaseCount) : undefined,
  });

  const hasActiveFilters = Boolean(entityType || dateFrom || dateTo || province || minCaseCount);
  const entityTypeOptions = ENTITY_TYPES.map((et) => ({ value: et, label: t(GROUP_LABEL_KEY[et]) }));
  const provinceOptions = THAI_PROVINCE_OPTIONS.map((p) => ({ value: p, label: p }));

  function clearFilters() {
    updateParams({ entityType: undefined, dateFrom: undefined, dateTo: undefined, province: undefined, minCaseCount: undefined });
  }

  return (
    <div className="space-y-5">
      <header className="mb-2 space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{t("di.search.centerTitle")}</h1>
        <p className="text-sm font-medium text-muted">{t("di.search.centerSubtitle")}</p>
        <p className="text-sm text-muted">{t("di.search.centerDescription")}</p>
      </header>

      <DrugSearchModeSwitcher mode={mode === "ai" ? "general" : mode} onChange={setMode} />

      {mode === "relationship" ? (
        <DrugRelationshipSearchPanel />
      ) : (
        <>
          <GlobalSearchBox value={q} onChange={(v) => updateParams({ q: v })} placeholder={t("di.search.placeholder")} />

          <Card>
            <CardBody className="space-y-3">
              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {showAdvanced ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                {t("di.search.filters")}
              </button>
              {showAdvanced ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.search.filterEntityType")}</label>
                    <Select options={entityTypeOptions} placeholder={t("common.all")} value={entityType ?? ""} onChange={(e) => updateParams({ entityType: e.target.value || undefined })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.search.filterDateFrom")}</label>
                    <ThaiDatePicker value={dateFrom} onChange={(v) => updateParams({ dateFrom: v || undefined })} placeholder="DD/MM/YYYY" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.search.filterDateTo")}</label>
                    <ThaiDatePicker value={dateTo} onChange={(v) => updateParams({ dateTo: v || undefined })} placeholder="DD/MM/YYYY" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.search.filterProvince")}</label>
                    <Select options={provinceOptions} placeholder={t("common.all")} value={province} onChange={(e) => updateParams({ province: e.target.value || undefined })} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!hasActiveFilters} className="w-full sm:w-auto">
                      {t("di.search.clearFilters")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {!q.trim() ? (
            <EmptyState title={t("di.search.promptEmpty")} icon={<ScanSearch className="h-8 w-8" />} />
          ) : search.isPending ? (
            <LoadingState />
          ) : search.isError ? (
            <ErrorState message={t("di.search.errorLoad")} onRetry={() => search.refetch()} />
          ) : search.data.totalCount === 0 ? (
            <EmptyState title={t("di.search.noResults")} icon={<ScanSearch className="h-8 w-8" />} />
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted">{t("di.search.resultCount").replace("{count}", search.data.totalCount.toLocaleString(language === "th" ? "th-TH" : "en-US"))}</p>
              {search.data.groups.map((group) => (
                <section key={group.entityType} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                      {t(GROUP_LABEL_KEY[group.entityType])} ({group.count})
                    </h2>
                    {group.count > group.results.length ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`/drug-intelligence/search/results?${new URLSearchParams({
                            q,
                            entityType: group.entityType,
                            ...(dateFrom ? { dateFrom } : {}),
                            ...(dateTo ? { dateTo } : {}),
                            ...(province ? { province } : {}),
                            ...(minCaseCount ? { minCaseCount } : {}),
                          }).toString()}`}
                        >
                          {t("di.search.viewAll")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.results.map((result) => (
                      <DrugSearchResultCard key={`${result.entityType}-${result.entityId}`} result={result} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
