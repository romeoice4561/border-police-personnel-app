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
import { useSearchParams } from "next/navigation";
import { Maximize2, MapPinned, ChevronDown, ChevronUp, X, RefreshCw, PanelRightClose, PanelRightOpen } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useOrganizationEngine } from "@/lib/ui/hooks";
import { useDrugGeoResult } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { DrugGeoFilterPanel } from "@/components/drug_intelligence/drug_geo_filter_panel";
import { DrugGeoFilterChips } from "@/components/drug_intelligence/drug_geo_filter_chips";
import { DrugGeoMap } from "@/components/drug_intelligence/drug_geo_map";
import { DrugGeoMarkerPopup } from "@/components/drug_intelligence/drug_geo_marker_popup";
import { DrugGeoResultList } from "@/components/drug_intelligence/drug_geo_result_list";
import { DrugGeoProvinceBreakdown } from "@/components/drug_intelligence/drug_geo_province_breakdown";
import { DrugGeoTopProvincesPanel } from "@/components/drug_intelligence/drug_geo_top_provinces_panel";
import { DrugGeoSeizureSummaryPanel } from "@/components/drug_intelligence/drug_geo_seizure_summary_panel";
import { DrugGeoTimeTrendChart } from "@/components/drug_intelligence/drug_geo_time_trend_chart";
import {
  drugGeoFilterStateFromSearchParams,
  drugGeoFilterStateToSearchParams,
  isDrugGeoFilterStateEmpty,
  type DrugGeoFilterState,
} from "@/lib/drug_intelligence/drug_geo_filter_state";
import { deriveDrugGeoFilterChips } from "@/lib/drug_intelligence/drug_geo_filter_chips";
import { combineDrugGeoSeizureGroups } from "@/lib/drug_intelligence/drug_geo_seizure_summary";
import { computeDrugGeoMonthlyTrend } from "@/lib/drug_intelligence/drug_geo_time_trend";
import { computeDrugGeoDefendantCount, computeDrugGeoUnitCount } from "@/lib/drug_intelligence/drug_geo_summary_extra";
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
  const [clusterMode, setClusterMode] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);

  const filters = useMemo(() => drugGeoFilterStateFromSearchParams(searchParams), [searchParams]);

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
      navigateToMapUrl(`/drug-intelligence/map${params.toString() ? `?${params.toString()}` : ""}`);
    },
    [filters, navigateToMapUrl]
  );

  const clearAll = useCallback(() => {
    navigateToMapUrl("/drug-intelligence/map");
  }, [navigateToMapUrl]);

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
      showAnalysisPanel={showAnalysisPanel}
      setShowAnalysisPanel={setShowAnalysisPanel}
      clusterMode={clusterMode}
      setClusterMode={setClusterMode}
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
  showAnalysisPanel,
  setShowAnalysisPanel,
  clusterMode,
  setClusterMode,
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
  showAnalysisPanel: boolean;
  setShowAnalysisPanel: (v: boolean) => void;
  clusterMode: boolean;
  setClusterMode: (v: boolean) => void;
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string | null) => void;
  fitToken: number;
  setFitToken: (updater: (prev: number) => number) => void;
  actorId: string | null;
  organizationEngine: ReturnType<typeof useOrganizationEngine>;
}) {
  const { t } = useT();
  const query = useMemo(() => filterStateToQueryParams(filters), [filters]);

  // Section 6 (DI-8.1.1): the current filtered/deep-linked map URL, reusing
  // DI-8's own filter-state <-> URLSearchParams serialization — never a
  // second, ad-hoc URL-state encoding — so "return to map" restores the
  // exact same filtered view the user navigated away from.
  const mapReturnUrl = useMemo(() => {
    const params = drugGeoFilterStateToSearchParams(filters);
    return params.toString() ? `/drug-intelligence/map?${params.toString()}` : "/drug-intelligence/map";
  }, [filters]);
  const geoQuery = useDrugGeoResult(actorId, query);

  const activeFilterCount = useMemo(() => (isDrugGeoFilterStateEmpty(filters) ? 0 : Object.entries(filters).filter(([, v]) => v !== null && v !== "").length), [filters]);
  const filterChips = useMemo(() => deriveDrugGeoFilterChips(filters, organizationEngine), [filters, organizationEngine]);

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

  // Section 3/10/11/12 (DI-8.2): every figure below is computed CLIENT-SIDE
  // from the already-fetched geoQuery.data — no new API call, no new
  // backend aggregation. markerCount-scoped (defendants, seizures) vs.
  // all-cases-scoped (unit count, trend) intentionally differ, matching
  // what each underlying view model actually carries (see
  // drug_geo_summary_extra.ts / drug_geo_time_trend.ts doc comments).
  const defendantCount = computeDrugGeoDefendantCount(markers);
  const unitCount = computeDrugGeoUnitCount([...markers, ...noCoordinateCases]);
  const seizureSummary = combineDrugGeoSeizureGroups(markers.map((m) => m.seizedItems));
  const monthlyTrend = computeDrugGeoMonthlyTrend([...markers, ...noCoordinateCases]);

  const content = (
    <div className={expanded ? "flex h-full flex-col gap-3 p-3" : "space-y-5"}>
      {!expanded ? (
        <PageHeader
          title={t("di.map.title")}
          description={t("di.map.subtitle")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                  {t("di.map.activeFilters")}: {activeFilterCount}
                </span>
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

      {!expanded && filterChips.length > 0 ? <DrugGeoFilterChips chips={filterChips} onRemove={applyFilters} /> : null}

      {!expanded ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <KpiTile label={t("di.map.kpiTotalCases")} value={summary.totalCases} />
          <KpiTile label={t("di.map.kpiDefendantCount")} value={defendantCount} />
          <KpiTile label={t("di.map.kpiProvinceCount")} value={summary.provinceCount} />
          <KpiTile label={t("di.map.kpiUnitCount")} value={unitCount} />
          <KpiTile label={t("di.map.kpiMarkerCount")} value={summary.markerCount} />
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
          {/* Section 8/13 (DI-8.2): "จุดจับกุม" (points) vs. "ความหนาแน่น" (grid-bucket cluster density) — only meaningful in MAP view mode. */}
          {viewMode === "MAP" ? (
            <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setClusterMode(false)}
                aria-pressed={!clusterMode}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${!clusterMode ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg"}`}
              >
                {t("di.map.viewModePoints")}
              </button>
              <button
                type="button"
                onClick={() => setClusterMode(true)}
                aria-pressed={clusterMode}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${clusterMode ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg"}`}
              >
                {t("di.map.viewModeCluster")}
              </button>
            </div>
          ) : null}
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

      <div className={expanded ? "min-h-0 flex-1" : "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"}>
        <div className={expanded ? "flex h-full flex-col gap-3" : "space-y-5"}>
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
                  renderPopup={(marker) => <DrugGeoMarkerPopup marker={marker} returnTo={mapReturnUrl} />}
                  heightClassName={expanded ? "h-full w-full" : undefined}
                  clusterMode={clusterMode}
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

        {!expanded && showAnalysisPanel ? (
          <div className="space-y-4">
            <Card>
              <CardBody className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t("di.map.topProvincesTitle")}</p>
                <DrugGeoTopProvincesPanel rows={provinceBreakdown} />
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t("di.map.seizureSummaryTitle")}</p>
                <DrugGeoSeizureSummaryPanel groups={seizureSummary} />
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t("di.map.trendTitle")}</p>
                <DrugGeoTimeTrendChart buckets={monthlyTrend} />
              </CardBody>
            </Card>
          </div>
        ) : null}
      </div>
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
