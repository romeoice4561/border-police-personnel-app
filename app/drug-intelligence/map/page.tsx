/**
 * Drug Intelligence Analysis Map (Phase DI-8, extended DI-8.1/8.1.1/8.2).
 *
 * "แผนที่วิเคราะห์ข่าวกรองยาเสพติด" — the map is the dominant surface
 * (Section 4); Leaflet + OpenStreetMap tiles, no API key. Filters persist
 * in the URL (Section 29) — read via useSearchParams, written via a real
 * browser navigation (see the DI-8.2.1 note below) — so refresh/back/
 * forward restore the exact same view (Section 36 V/W). Expanded mode
 * (Section 5) uses a fixed-position in-app overlay rather than the browser
 * Fullscreen API — simpler, and preserves filter access/exit button
 * reliably across browsers.
 *
 * DI-8.2 additions: a right-side analysis panel (top provinces, seizure
 * summary, monthly trend — all computed CLIENT-SIDE from the already-
 * fetched result, no new API/aggregation), removable filter chips, a time-
 * period preset selector, and an opt-in dependency-free cluster view mode
 * — see each new component's own doc comment for why no new backend
 * endpoint or npm dependency was needed.
 *
 * DI-8.2.1 fix (production-only Clear All / filter defect): loading this
 * page directly from a URL that already carries query params (e.g. a
 * personId/caseId/province deep link, a bookmark, or a hard refresh) left
 * the Next.js client router's internal navigation cache for this route
 * permanently unable to process any LATER same-pathname router.push()/
 * replace() call — every filter change AND Clear All silently no-op'd:
 * history.pushState was never invoked, the URL never changed, and no
 * console error was raised. Client-state-only interactions (view mode,
 * expand, refetch) were unaffected since they never call the router.
 *
 * Reproduced identically against a local `next build && next start`
 * production build and the live Vercel deployment; NEVER under `next dev`.
 * The page was also the one useSearchParams() consumer in this app
 * missing a <Suspense> boundary (now added, matching every other page's
 * convention) — but that alone did NOT fix the defect; router.push,
 * router.replace, router.refresh, a manual history.pushState alongside
 * router.push, wrapping the call in startTransition, an absolute-URL
 * target, and a self-referential router.replace()-on-mount "priming" call
 * were all tried and all failed identically. The router's internal
 * same-pathname navigation handling for this exact page is broken in this
 * Next.js build for this specific "hard load with search params" case, and
 * nothing short of bypassing the client router removes the symptom.
 *
 * Fix: applyFilters/clearAll now perform a real browser navigation
 * (window.location.assign) instead of a Next.js client-side
 * router.push()/replace() for this one page's filter-changing actions —
 * this reliably updates the URL and reloads with the new filters/cleared
 * state every time, at the cost of a full page reload per filter change
 * (previously instant). Given the defect makes the ENTIRE filter panel
 * silently non-functional for any user who arrives via this app's own
 * personId/caseId/returnTo deep-link conventions — not a rare edge case —
 * reliability was prioritized over instant client-side updates. Back/
 * Forward/Refresh are native browser behavior and are unaffected either
 * way; chips/time-presets/org-hierarchy/returnTo/cluster mode/analysis
 * panels all read their state fresh from the URL on every load, so they
 * are unaffected by how the URL got there.
 */
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Maximize2, MapPinned, ChevronDown, ChevronUp, X, RefreshCw, PanelRightClose, PanelRightOpen, FileText } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useOrganizationEngine } from "@/lib/ui/hooks";
import { getSafeReturnTo } from "@/lib/ui/return_context";
import { returnToBackLabelKey } from "@/lib/ui/return_to_back_label";
import { useDrugGeoResult } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { useDrugMapCaseDetail } from "@/lib/drug_intelligence/use_drug_map_case_detail";
import { DrugGeoFilterPanel } from "@/components/drug_intelligence/drug_geo_filter_panel";
import { DrugGeoFilterChips } from "@/components/drug_intelligence/drug_geo_filter_chips";
import { DrugGeoMap } from "@/components/drug_intelligence/drug_geo_map";
import { DrugGeoMarkerPopup } from "@/components/drug_intelligence/drug_geo_marker_popup";
import { DrugGeoResultList } from "@/components/drug_intelligence/drug_geo_result_list";
import { DrugGeoProvinceBreakdown } from "@/components/drug_intelligence/drug_geo_province_breakdown";
import { DrugGeoReportDrawer } from "@/components/drug_intelligence/drug_geo_report_drawer";
import { DrugGeoHotspotInspector } from "@/components/drug_intelligence/drug_geo_hotspot_inspector";
import { DrugGeoAreaRankingPanel } from "@/components/drug_intelligence/drug_geo_area_ranking_panel";
import { DrugGeoIntelligenceSummary } from "@/components/drug_intelligence/drug_geo_intelligence_summary";
import { DrugGeoAreaTemporalPatternPanel } from "@/components/drug_intelligence/drug_geo_area_temporal_pattern_panel";
import {
  drugGeoFilterStateFromSearchParams,
  drugGeoFilterStateToSearchParams,
  type DrugGeoFilterState,
} from "@/lib/drug_intelligence/drug_geo_filter_state";
import { deriveDrugGeoFilterChips } from "@/lib/drug_intelligence/drug_geo_filter_chips";
import { isDrugMapHardLimit, isDrugMapSoftLimit, isDrugMapTrueEmpty } from "@/lib/drug_intelligence/drug_map_view";
import { MAP_LIST_DEFAULT_PAGE_SIZE } from "@/lib/drug_intelligence/drug_map_query";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import { serializeWeekdaysParam } from "@/lib/drug_intelligence/drug_map_temporal";
import type { DrugGeoQueryParams } from "@/lib/drug_intelligence/drug_geo_client";
import { DrugGeoTemporalSummary } from "@/components/drug_intelligence/drug_geo_temporal_summary";
import {
  computeDrugGeoHotspots,
  DRUG_GEO_HOTSPOT_RADIUS_KM_OPTIONS,
  type DrugGeoHotspot,
  type DrugGeoHotspotRadiusKm,
  type DrugGeoMapMode,
} from "@/lib/drug_intelligence/drug_geo_hotspot";
import {
  enrichDistrictRanking,
  enrichProvinceRanking,
} from "@/lib/drug_intelligence/drug_geo_area_intelligence";

const VIEW_MODES = ["MAP", "LIST", "PROVINCE"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

const GEO_MODES: DrugGeoMapMode[] = ["POINTS", "HOTSPOT", "DENSITY"];

function filterStateToQueryParams(state: DrugGeoFilterState): DrugGeoQueryParams {
  const weekdays = serializeWeekdaysParam(state.weekdays);
  return {
    province: state.province || undefined,
    district: state.district || undefined,
    status: state.status || undefined,
    drugCategory: state.drugCategory || undefined,
    dateFrom: state.dateFrom || undefined,
    dateTo: state.dateTo || undefined,
    weekdays,
    timePreset: state.timePreset !== "ALL_DAY" ? state.timePreset : undefined,
    timeFrom: state.timePreset === "CUSTOM" ? state.timeFrom || undefined : undefined,
    timeTo: state.timePreset === "CUSTOM" ? state.timeTo || undefined : undefined,
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

function countActiveMapFilters(filters: DrugGeoFilterState): number {
  let n = 0;
  if (filters.dateFrom) n += 1;
  if (filters.dateTo) n += 1;
  if (filters.weekdays.length) n += 1;
  if (filters.timePreset !== "ALL_DAY") n += 1;
  if (filters.province) n += 1;
  if (filters.district) n += 1;
  if (filters.status) n += 1;
  if (filters.drugCategory) n += 1;
  if (filters.headquartersId != null) n += 1;
  if (filters.regionId != null) n += 1;
  if (filters.battalionId != null) n += 1;
  if (filters.companyId != null) n += 1;
  if (filters.leadHeadquartersId != null) n += 1;
  if (filters.leadRegionId != null) n += 1;
  if (filters.leadBattalionId != null) n += 1;
  if (filters.leadCompanyId != null) n += 1;
  return n;
}

export default function DrugIntelligenceMapPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugIntelligenceMapPageContent />
    </Suspense>
  );
}

function DrugIntelligenceMapPageContent() {
  const searchParams = useSearchParams();
  const { user, can } = useAuth();
  const { t } = useT();
  const organizationEngine = useOrganizationEngine();

  const [viewMode, setViewMode] = useState<ViewMode>("MAP");
  const [expanded, setExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);

  const filters = useMemo(() => drugGeoFilterStateFromSearchParams(searchParams), [searchParams]);
  const inboundReturnTo = getSafeReturnTo(searchParams);
  const geoMode = filters.geoMode;
  const hotspotRadiusKm = filters.hotspotRadiusKm;

  // DI-8.2.1: a real browser navigation, not router.push/replace — see the
  // file's top doc comment for why. Kept as ONE shared helper so both
  // call sites stay identical rather than drifting.
  const navigateToMapUrl = useCallback((url: string) => {
    window.location.assign(url);
  }, []);

  const applyFilters = useCallback(
    (patch: Partial<DrugGeoFilterState>) => {
      const next = { ...filters, ...patch };
      const params = drugGeoFilterStateToSearchParams(next);
      if (inboundReturnTo) params.set("returnTo", inboundReturnTo);
      navigateToMapUrl(`/drug-intelligence/map${params.toString() ? `?${params.toString()}` : ""}`);
    },
    [filters, inboundReturnTo, navigateToMapUrl]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams();
    if (inboundReturnTo) params.set("returnTo", inboundReturnTo);
    navigateToMapUrl(`/drug-intelligence/map${params.toString() ? `?${params.toString()}` : ""}`);
  }, [inboundReturnTo, navigateToMapUrl]);

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
      inboundReturnTo={inboundReturnTo}
      viewMode={viewMode}
      setViewMode={setViewMode}
      expanded={expanded}
      setExpanded={setExpanded}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      showAnalysisPanel={showAnalysisPanel}
      setShowAnalysisPanel={setShowAnalysisPanel}
      geoMode={geoMode}
      hotspotRadiusKm={hotspotRadiusKm}
      selectedCaseId={selectedCaseId}
      setSelectedCaseId={setSelectedCaseId}
      selectedHotspotId={selectedHotspotId}
      setSelectedHotspotId={setSelectedHotspotId}
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
  inboundReturnTo,
  viewMode,
  setViewMode,
  expanded,
  setExpanded,
  showFilters,
  setShowFilters,
  showAnalysisPanel,
  setShowAnalysisPanel,
  geoMode,
  hotspotRadiusKm,
  selectedCaseId,
  setSelectedCaseId,
  selectedHotspotId,
  setSelectedHotspotId,
  fitToken,
  setFitToken,
  actorId,
  organizationEngine,
}: {
  filters: DrugGeoFilterState;
  applyFilters: (patch: Partial<DrugGeoFilterState>) => void;
  clearAll: () => void;
  inboundReturnTo: string | null;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  showAnalysisPanel: boolean;
  setShowAnalysisPanel: (v: boolean) => void;
  geoMode: DrugGeoMapMode;
  hotspotRadiusKm: DrugGeoHotspotRadiusKm;
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string | null) => void;
  selectedHotspotId: string | null;
  setSelectedHotspotId: (id: string | null) => void;
  fitToken: number;
  setFitToken: (updater: (prev: number) => number) => void;
  actorId: string | null;
  organizationEngine: ReturnType<typeof useOrganizationEngine>;
}) {
  const { t } = useT();
  const { can } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [listPage, setListPage] = useState(1);
  const query = useMemo(
    () => ({ ...filterStateToQueryParams(filters), page: listPage, pageSize: MAP_LIST_DEFAULT_PAGE_SIZE }),
    [filters, listPage]
  );

  // Section 6 (DI-8.1.1): the current filtered/deep-linked map URL, reusing
  // DI-8's own filter-state <-> URLSearchParams serialization — never a
  // second, ad-hoc URL-state encoding — so "return to map" restores the
  // exact same filtered view the user navigated away from.
  const mapReturnUrl = useMemo(() => {
    const params = drugGeoFilterStateToSearchParams(filters);
    return params.toString() ? `/drug-intelligence/map?${params.toString()}` : "/drug-intelligence/map";
  }, [filters]);
  const geoQuery = useDrugGeoResult(actorId, query);
  const detailCaseId = viewMode === "MAP" && selectedCaseId && geoQuery.data?.markers.some((marker) => marker.caseId === selectedCaseId) ? selectedCaseId : null;
  const caseDetail = useDrugMapCaseDetail(actorId, detailCaseId, Boolean(detailCaseId));

  const activeFilterCount = useMemo(() => countActiveMapFilters(filters), [filters]);
  const filterChips = useMemo(() => deriveDrugGeoFilterChips(filters, organizationEngine), [filters, organizationEngine]);

  const handleSelectMarker = useCallback((caseId: string) => {
    setSelectedHotspotId(null);
    setSelectedCaseId(caseId);
  }, [setSelectedCaseId, setSelectedHotspotId]);
  const handleSelectHotspot = useCallback((hotspotId: string) => {
    setSelectedCaseId(null);
    setSelectedHotspotId(hotspotId);
  }, [setSelectedCaseId, setSelectedHotspotId]);
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
      applyFilters({ province, district: "" });
      setViewMode("MAP");
      setFitToken((n) => n + 1);
    },
    [applyFilters, setViewMode, setFitToken]
  );
  const handleSelectDistrict = useCallback(
    (district: string) => {
      applyFilters({ district });
      setViewMode("MAP");
      setFitToken((n) => n + 1);
    },
    [applyFilters, setViewMode, setFitToken]
  );
  // DI-8.5 Section 8 "ดูเหตุการณ์" action: filter to this province AND switch
  // to List view (vs. handleSelectProvince's Map+fit) — same canonical
  // applyFilters mechanism, one filter state, no separate dashboard model.
  const handleViewProvinceEvents = useCallback(
    (province: string) => {
      applyFilters({ province, district: "" });
      setViewMode("LIST");
    },
    [applyFilters, setViewMode]
  );

  const hotspots: DrugGeoHotspot[] = useMemo(() => {
    if (!geoQuery.data) return [];
    return computeDrugGeoHotspots(geoQuery.data.markers, hotspotRadiusKm);
  }, [geoQuery.data, hotspotRadiusKm]);

  const selectedHotspot = useMemo(
    () => hotspots.find((h) => h.hotspotId === selectedHotspotId) ?? null,
    [hotspots, selectedHotspotId],
  );

  const provinceRanking = useMemo(() => {
    if (!geoQuery.data) return [];
    return enrichProvinceRanking(geoQuery.data.provinces, geoQuery.data.markers, geoQuery.data.summary.totalCases);
  }, [geoQuery.data]);

  const districtRanking = useMemo(() => {
    if (!geoQuery.data) return [];
    const districts = geoQuery.data.districts ?? [];
    return enrichDistrictRanking(districts, geoQuery.data.markers, geoQuery.data.summary.totalCases);
  }, [geoQuery.data]);

  if (geoQuery.isLoading && !geoQuery.data) return <LoadingState />;
  if (geoQuery.isError && !geoQuery.data) {
    return <ErrorState message={geoQuery.error instanceof Error ? geoQuery.error.message : t("di.error.saveFailed")} />;
  }
  if (!geoQuery.data) return null;

  const { summary, markers, list, provinces, warnings, temporal } = geoQuery.data;
  // DI-8.5 Section 8: derived purely client-side from the already-bounded
  // markers array — zero new queries (see drug_geo_area_temporal_pattern.ts).
  const areaTemporalRows = markers.map((m) => ({
    id: m.caseId,
    caseNumber: m.caseNumber,
    arrestDate: m.arrestDate,
    arrestTime: m.arrestTime,
    province: m.province,
    district: m.district,
  }));
  const hardLimit = isDrugMapHardLimit(warnings);
  const softLimit = isDrugMapSoftLimit(warnings);
  const trueEmpty = isDrugMapTrueEmpty(summary.totalCases);
  const timeFilterBlocksMap =
    temporal.timeFilterActive && temporal.coverage.total > 0 && temporal.coverage.withTime === 0 && trueEmpty;
  const hotspotTooFew = geoMode === "HOTSPOT" && markers.length > 0 && hotspots.length === 0;

  const periodLabel =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom ? formatShortThaiDateTh(new Date(`${filters.dateFrom}T00:00:00.000Z`)) : "…"} – ${filters.dateTo ? formatShortThaiDateTh(new Date(`${filters.dateTo}T00:00:00.000Z`)) : "…"}`
      : t("di.map.kpiPeriodAll");

  const content = (
    <div className={expanded ? "flex h-full flex-col gap-3 p-3" : "space-y-5"}>
      {!expanded ? (
        <PageHeader
          title={t("di.map.title")}
          description={t("di.map.subtitle")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {inboundReturnTo ? (
                <Button asChild variant="outline" size="sm" className="min-h-10">
                  <Link href={inboundReturnTo} data-testid="back-via-return-to">
                    {t(returnToBackLabelKey(inboundReturnTo))}
                  </Link>
                </Button>
              ) : null}
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                  {t("di.map.activeFilters")}: {activeFilterCount}
                </span>
              ) : null}
              {can("drug.export") ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReportOpen(true)}
                  data-testid="map-geographic-report-action"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {t("di.map.geographicReport")}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => geoQuery.refetch()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t("di.map.refreshData")}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
                {t("di.map.clearAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAnalysisPanel(!showAnalysisPanel)} aria-pressed={showAnalysisPanel}>
                {showAnalysisPanel ? <PanelRightClose className="h-4 w-4" aria-hidden="true" /> : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
                {t("di.map.toggleAnalysisPanel")}
              </Button>
            </div>
          }
        />
      ) : null}

      {filters.personId ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">{t("di.map.personDeepLinkNotice")}</div>
      ) : null}

      {softLimit ? (
        <div role="status" data-testid="map-marker-soft-limit" className="rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-foreground">
          {t("di.map.markerSoftLimit")}
        </div>
      ) : null}
      {hardLimit ? (
        <div role="status" data-testid="map-marker-hard-limit" className="rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-foreground">
          {t("di.map.markerHardLimit")}
        </div>
      ) : null}

      {!expanded && filterChips.length > 0 ? <DrugGeoFilterChips chips={filterChips} onRemove={applyFilters} /> : null}

      {!expanded ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile label={t("di.map.kpiTotalCases")} value={summary.totalCases} />
          <KpiTile label={t("di.map.kpiMarkerCount")} value={summary.withCoordinates} />
          <KpiTile label={t("di.map.kpiNoCoordinateCount")} value={summary.withoutCoordinates} />
          <KpiTile label={t("di.map.kpiProvinceCount")} value={summary.provinceCount} />
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

      {!expanded ? <DrugGeoTemporalSummary temporal={temporal} filters={filters} onApply={applyFilters} /> : null}

      {!expanded ? (
        <DrugGeoIntelligenceSummary
          temporal={temporal}
          hotspotCount={hotspots.length}
          radiusKm={hotspotRadiusKm}
          geoMode={geoMode}
          selectedHotspot={selectedHotspot}
        />
      ) : null}

      {!expanded ? (
        <DrugGeoAreaTemporalPatternPanel
          rows={areaTemporalRows}
          mapReturnUrl={mapReturnUrl}
          onFilterProvince={handleSelectProvince}
          onViewEvents={handleViewProvinceEvents}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
          {viewMode === "MAP" ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
                {GEO_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      applyFilters({ geoMode: mode });
                      setSelectedHotspotId(null);
                    }}
                    aria-pressed={geoMode === mode}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${geoMode === mode ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg"}`}
                  >
                    {mode === "POINTS"
                      ? t("di.map.viewModePoints")
                      : mode === "HOTSPOT"
                        ? t("di.map.viewModeHotspot")
                        : t("di.map.viewModeCluster")}
                  </button>
                ))}
              </div>
              {geoMode === "HOTSPOT" ? (
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <span>{t("di.map.hotspotRadiusLabel")}</span>
                  <select
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                    value={hotspotRadiusKm}
                    onChange={(e) => {
                      applyFilters({ hotspotRadiusKm: Number(e.target.value) as DrugGeoHotspotRadiusKm });
                      setSelectedHotspotId(null);
                    }}
                  >
                    {DRUG_GEO_HOTSPOT_RADIUS_KM_OPTIONS.map((km) => (
                      <option key={km} value={km}>
                        {km < 1 ? `${km * 1000} ม.` : `${km} กม.`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "MAP" ? (
            <Button variant="outline" size="sm" onClick={handleFitToScreen}>
              {t("di.map.fitToScreen")}
            </Button>
          ) : null}
          {!expanded ? (
            <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
              {t("di.map.expand")}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={
          expanded
            ? "min-h-0 flex-1"
            : selectedHotspot && geoMode === "HOTSPOT"
              ? "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(400px,440px)]"
              : "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]"
        }
      >
        <div className={expanded ? "flex h-full flex-col gap-3" : "space-y-5"}>
          <div className={expanded ? "min-h-0 flex-1" : ""}>
            {viewMode === "MAP" ? (
              trueEmpty ? (
                <div data-testid="map-empty-result">
                  <EmptyState
                    title={timeFilterBlocksMap ? t("di.map.emptyNoTimeData") : t("di.map.emptyNoMatch")}
                    icon={<MapPinned className="h-8 w-8" />}
                  />
                </div>
              ) : hardLimit ? (
                <div
                  data-testid="map-hard-limit-pane"
                  className="flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-neutral-bg px-4 py-8 text-center text-sm text-foreground"
                >
                  {t("di.map.markerHardLimit")}
                </div>
              ) : markers.length === 0 ? (
                <div data-testid="map-empty-no-coordinates">
                  <EmptyState title={t("di.map.emptyNoCoordinates")} icon={<MapPinned className="h-8 w-8" />} />
                </div>
              ) : hotspotTooFew ? (
                <div data-testid="map-empty-hotspot-few">
                  <EmptyState title={t("di.map.hotspotEmptyFew")} icon={<MapPinned className="h-8 w-8" />} />
                </div>
              ) : (
                <DrugGeoMap
                  markers={markers}
                  selectedCaseId={selectedCaseId}
                  onSelectMarker={handleSelectMarker}
                  fitToken={fitToken}
                  geoMode={geoMode}
                  hotspots={hotspots}
                  selectedHotspotId={selectedHotspotId}
                  onSelectHotspot={handleSelectHotspot}
                  renderPopup={(marker) => (
                    <DrugGeoMarkerPopup
                      marker={marker}
                      returnTo={mapReturnUrl}
                      detail={marker.caseId === selectedCaseId ? caseDetail : undefined}
                    />
                  )}
                  heightClassName={expanded ? "h-full w-full" : undefined}
                />
              )
            ) : viewMode === "LIST" ? (
              <DrugGeoResultList
                items={list.items}
                selectedCaseId={selectedCaseId}
                onSelectMarker={handleSelectMarker}
                page={list.page}
                totalPages={list.totalPages}
                onPageChange={setListPage}
                fetching={geoQuery.isFetching}
              />
            ) : (
              <DrugGeoProvinceBreakdown rows={provinces} onSelectProvince={handleSelectProvince} />
            )}
          </div>

          {!expanded && viewMode === "MAP" ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">{t("di.map.resultListTitle")}</p>
              <DrugGeoResultList
                items={list.items}
                selectedCaseId={selectedCaseId}
                onSelectMarker={handleSelectMarker}
                page={list.page}
                totalPages={list.totalPages}
                onPageChange={setListPage}
                fetching={geoQuery.isFetching}
              />
            </div>
          ) : null}
        </div>

        {!expanded && showAnalysisPanel ? (
          <div className="space-y-4">
            {selectedHotspot && geoMode === "HOTSPOT" ? (
              <DrugGeoHotspotInspector
                hotspot={selectedHotspot}
                actorId={actorId}
                mapReturnUrl={mapReturnUrl}
                onClose={() => setSelectedHotspotId(null)}
              />
            ) : (
              <Card>
                <CardBody className="space-y-2">
                  <DrugGeoAreaRankingPanel
                    provinceRows={provinceRanking}
                    districtRows={districtRanking}
                    onSelectProvince={handleSelectProvince}
                    onSelectDistrict={handleSelectDistrict}
                  />
                </CardBody>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  const reportDrawer = (
    <DrugGeoReportDrawer open={reportOpen} onClose={() => setReportOpen(false)} filters={filters} />
  );

  if (expanded) {
    return (
      <>
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
        {reportDrawer}
      </>
    );
  }

  return (
    <>
      {content}
      {reportDrawer}
    </>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-neutral-bg p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}
