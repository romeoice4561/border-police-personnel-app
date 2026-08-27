/**
 * Drug Intelligence Map (Phase DI-8).
 *
 * "แผนที่ข่าวกรองยาเสพติด" — the map is the dominant surface (Section 4);
 * Leaflet + OpenStreetMap tiles, no API key. Filters persist in the URL
 * (Section 29) via useRouter/useSearchParams so refresh/back/forward
 * restore the exact same view (Section 36 V/W). Expanded mode (Section 5)
 * uses a fixed-position in-app overlay rather than the browser Fullscreen
 * API — simpler, and preserves filter access/exit button reliably across
 * browsers.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Maximize2, MapPinned, ChevronDown, ChevronUp, X } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useOrganizationEngine } from "@/lib/ui/hooks";
import { useDrugGeoResult } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { DrugGeoFilterPanel } from "@/components/drug_intelligence/drug_geo_filter_panel";
import { DrugGeoMap } from "@/components/drug_intelligence/drug_geo_map";
import { DrugGeoMarkerPopup } from "@/components/drug_intelligence/drug_geo_marker_popup";
import { DrugGeoResultList } from "@/components/drug_intelligence/drug_geo_result_list";
import { DrugGeoProvinceBreakdown } from "@/components/drug_intelligence/drug_geo_province_breakdown";
import {
  drugGeoFilterStateFromSearchParams,
  drugGeoFilterStateToSearchParams,
  isDrugGeoFilterStateEmpty,
  type DrugGeoFilterState,
} from "@/lib/drug_intelligence/drug_geo_filter_state";
import type { DrugGeoQueryParams } from "@/lib/drug_intelligence/drug_geo_client";

const VIEW_MODES = ["MAP", "LIST", "PROVINCE"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

function filterStateToQueryParams(state: DrugGeoFilterState): DrugGeoQueryParams {
  return {
    province: state.province || undefined,
    district: state.district || undefined,
    status: state.status || undefined,
    drugCategory: state.drugCategory || undefined,
    arrestDateFrom: state.dateFrom || undefined,
    arrestDateTo: state.dateTo || undefined,
    headquartersId: state.headquartersId ?? undefined,
    regionId: state.regionId ?? undefined,
    battalionId: state.battalionId ?? undefined,
    companyId: state.companyId ?? undefined,
    leadHeadquartersId: state.leadHeadquartersId ?? undefined,
    leadRegionId: state.leadRegionId ?? undefined,
    leadBattalionId: state.leadBattalionId ?? undefined,
    leadCompanyId: state.leadCompanyId ?? undefined,
    personId: state.personId || undefined,
  };
}

export default function DrugIntelligenceMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, can } = useAuth();
  const { t } = useT();
  const organizationEngine = useOrganizationEngine();

  const [viewMode, setViewMode] = useState<ViewMode>("MAP");
  const [expanded, setExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);

  const filters = useMemo(() => drugGeoFilterStateFromSearchParams(searchParams), [searchParams]);

  const applyFilters = useCallback(
    (patch: Partial<DrugGeoFilterState>) => {
      const next = { ...filters, ...patch };
      const params = drugGeoFilterStateToSearchParams(next);
      router.push(`/drug-intelligence/map${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    },
    [filters, router]
  );

  const clearAll = useCallback(() => {
    router.push("/drug-intelligence/map", { scroll: false });
  }, [router]);

  if (!can("drug.read")) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-muted">{t("di.error.permissionDenied")}</p>
      </div>
    );
  }

  return (
    <DrugIntelligenceMapContent
      filters={filters}
      applyFilters={applyFilters}
      clearAll={clearAll}
      viewMode={viewMode}
      setViewMode={setViewMode}
      expanded={expanded}
      setExpanded={setExpanded}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      selectedCaseId={selectedCaseId}
      setSelectedCaseId={setSelectedCaseId}
      fitToken={fitToken}
      setFitToken={setFitToken}
      actorId={user?.id ?? null}
      organizationEngine={organizationEngine}
    />
  );
}

function DrugIntelligenceMapContent({
  filters,
  applyFilters,
  clearAll,
  viewMode,
  setViewMode,
  expanded,
  setExpanded,
  showFilters,
  setShowFilters,
  selectedCaseId,
  setSelectedCaseId,
  fitToken,
  setFitToken,
  actorId,
  organizationEngine,
}: {
  filters: DrugGeoFilterState;
  applyFilters: (patch: Partial<DrugGeoFilterState>) => void;
  clearAll: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string | null) => void;
  fitToken: number;
  setFitToken: (updater: (prev: number) => number) => void;
  actorId: string | null;
  organizationEngine: ReturnType<typeof useOrganizationEngine>;
}) {
  const { t } = useT();
  const query = useMemo(() => filterStateToQueryParams(filters), [filters]);
  const geoQuery = useDrugGeoResult(actorId, query);

  const activeFilterCount = useMemo(() => (isDrugGeoFilterStateEmpty(filters) ? 0 : Object.entries(filters).filter(([, v]) => v !== null && v !== "").length), [filters]);

  const handleSelectMarker = useCallback((caseId: string) => setSelectedCaseId(caseId), [setSelectedCaseId]);
  const handleFitToScreen = useCallback(() => setFitToken((n) => n + 1), [setFitToken]);

  // Section 5 (DI-8.1): a caseId deep link (Case Workspace / Timeline "เปิดบนแผนที่")
  // selects and focuses that case's marker on load, same as personId already
  // filters on load. Runs once per distinct caseId value — not on every
  // markers/data refresh — so it never fights a later manual selection.
  const appliedCaseIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!filters.caseId || !geoQuery.data || appliedCaseIdRef.current === filters.caseId) return;
    appliedCaseIdRef.current = filters.caseId;
    const marker = geoQuery.data.markers.find((m) => m.caseId === filters.caseId);
    if (marker) {
      setSelectedCaseId(marker.caseId);
      setFitToken((n) => n + 1);
    }
  }, [filters.caseId, geoQuery.data, setSelectedCaseId, setFitToken]);
  const handleSelectProvince = useCallback(
    (province: string) => {
      applyFilters({ province });
      setViewMode("MAP");
      setFitToken((n) => n + 1);
    },
    [applyFilters, setViewMode, setFitToken]
  );

  if (geoQuery.isLoading) return <LoadingState />;
  if (geoQuery.isError) return <ErrorState message={geoQuery.error instanceof Error ? geoQuery.error.message : t("di.error.saveFailed")} />;
  if (!geoQuery.data) return null;

  const { summary, markers, noCoordinateCases, provinceBreakdown } = geoQuery.data;

  const periodLabel =
    filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "…"} – ${filters.dateTo || "…"}` : t("di.map.kpiPeriodAll");

  const content = (
    <div className={expanded ? "flex h-full flex-col gap-3 p-3" : "space-y-5"}>
      {!expanded ? (
        <PageHeader
          title={t("di.map.title")}
          description={t("di.map.subtitle")}
          actions={
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                  {t("di.map.activeFilters")}: {activeFilterCount}
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
                {t("di.map.clearAll")}
              </Button>
            </div>
          }
        />
      ) : null}

      {filters.personId ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">{t("di.map.personDeepLinkNotice")}</div>
      ) : null}

      {!expanded ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiTile label={t("di.map.kpiTotalCases")} value={summary.totalCases} />
          <KpiTile label={t("di.map.kpiMarkerCount")} value={summary.markerCount} />
          <KpiTile label={t("di.map.kpiProvinceCount")} value={summary.provinceCount} />
          <KpiTile label={t("di.map.kpiNoCoordinateCount")} value={summary.noCoordinateCount} />
          <div className="rounded-xl border border-border bg-neutral-bg p-3">
            <p className="text-xs text-muted">{t("di.map.kpiPeriod")}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{periodLabel}</p>
          </div>
        </div>
      ) : null}

      {!expanded ? (
        <Card>
          <CardBody className="space-y-3">
            <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              <span className="text-sm font-semibold text-foreground">{t("di.map.filtersLabel")}</span>
              {showFilters ? <ChevronUp className="h-4 w-4 text-muted" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />}
            </button>
            {showFilters ? <DrugGeoFilterPanel filters={filters} onChange={applyFilters} organizationEngine={organizationEngine} /> : null}
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === mode ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg"}`}
            >
              {mode === "MAP" ? t("di.map.viewModeMap") : mode === "LIST" ? t("di.map.viewModeList") : t("di.map.viewModeProvince")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "MAP" ? (
            <Button variant="outline" size="sm" onClick={handleFitToScreen}>
              {t("di.map.fitToScreen")}
            </Button>
          ) : null}
          {/* When expanded, the fixed-overlay header already has its own exit control (below) — avoid a second, redundant "ย่อกลับ" button on screen at once. */}
          {!expanded ? (
            <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
              {t("di.map.expand")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className={expanded ? "min-h-0 flex-1" : ""}>
        {viewMode === "MAP" ? (
          markers.length === 0 ? (
            <EmptyState title={t("di.map.emptyMap")} icon={<MapPinned className="h-8 w-8" />} />
          ) : (
            <DrugGeoMap
              markers={markers}
              selectedCaseId={selectedCaseId}
              onSelectMarker={handleSelectMarker}
              fitToken={fitToken}
              renderPopup={(marker) => <DrugGeoMarkerPopup marker={marker} />}
              heightClassName={expanded ? "h-full w-full" : undefined}
            />
          )
        ) : viewMode === "LIST" ? (
          <DrugGeoResultList markers={markers} noCoordinateCases={noCoordinateCases} selectedCaseId={selectedCaseId} onSelectMarker={handleSelectMarker} />
        ) : (
          <DrugGeoProvinceBreakdown rows={provinceBreakdown} onSelectProvince={handleSelectProvince} />
        )}
      </div>

      {!expanded && viewMode === "MAP" ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">{t("di.map.resultListTitle")}</p>
          <DrugGeoResultList markers={markers} noCoordinateCases={noCoordinateCases} selectedCaseId={selectedCaseId} onSelectMarker={handleSelectMarker} />
        </div>
      ) : null}

      {!expanded && noCoordinateCases.length > 0 && viewMode !== "LIST" ? (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-semibold text-foreground">{t("di.map.noCoordinateSectionTitle")}</p>
            <ul className="space-y-1 text-sm text-muted">
              {noCoordinateCases.map((c) => (
                <li key={c.caseId}>
                  {c.caseNumber} — {c.title}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <p className="text-sm font-semibold text-foreground">{t("di.map.title")}</p>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              <X className="h-4 w-4" aria-hidden="true" />
              {t("di.map.collapse")}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        </div>
      </div>
    );
  }

  return content;
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-neutral-bg p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}
