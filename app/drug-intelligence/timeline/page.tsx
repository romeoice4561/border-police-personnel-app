/**
 * Timeline & Geographic Intelligence workspace (Phase DI-7).
 *
 * "ไทม์ไลน์และพื้นที่" — a chronological + geographic analyst workspace over
 * the SAME recorded case data DI-1/DI-6 already surface elsewhere (Section
 * 1 audit: DrugCase already carries province/district/subdistrict/
 * latitude/longitude/arrestDate; no new schema for the timeline backbone
 * itself). Never claims proven movement/travel — every wording routes
 * through the neutral "พบข้อมูลในพื้นที่ / ปรากฏในคดี / มีประวัติเชื่อมโยงกับพื้นที่"
 * vocabulary (Section 6's explicit prohibition on "เดินทางจาก...").
 *
 * Map View is deliberately NOT implemented this phase (explicit product
 * decision): the existing QA dataset has zero populated latitude/longitude
 * anywhere, and no map library is installed — building a map that could
 * only ever render a "no coordinates" empty state would add a dependency
 * with nothing real to verify against. The Geographic Summary (province/
 * district aggregate) covers Section 9 using data that DOES exist today.
 * Every event still exposes hasCoordinates so a future phase can add the
 * map without any timeline-side rework.
 */
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, ChevronUp, Users, Phone, Smartphone, Car, Package, MapPin, MapPinned, Network as NetworkIcon, FileSpreadsheet, BellRing, ArrowUpDown, LayoutGrid, Map as MapIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugTimeline, useDrugTimelineGeographic } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { normalizeThaiPersonnelDateForSave, toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";
import { getSafeReturnTo, withReturnTo } from "@/lib/ui/return_context";
import type { DrugTimelineEvent, DrugTimelineSortDirection, DrugTimelineGroupMode } from "@/lib/drug_intelligence/drug_intelligence_client";

type ViewMode = "TIMELINE" | "GEOGRAPHIC";

const GROUP_MODE_OPTIONS: { value: DrugTimelineGroupMode; labelKey: "di.timeline.groupByDay" | "di.timeline.groupByMonth" | "di.timeline.groupByPerson" | "di.timeline.groupByLocation" | "di.timeline.groupByCase" }[] = [
  { value: "DAY", labelKey: "di.timeline.groupByDay" },
  { value: "MONTH", labelKey: "di.timeline.groupByMonth" },
  { value: "PERSON", labelKey: "di.timeline.groupByPerson" },
  { value: "LOCATION", labelKey: "di.timeline.groupByLocation" },
  { value: "CASE", labelKey: "di.timeline.groupByCase" },
];

export default function DrugTimelinePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugTimelineContent />
    </Suspense>
  );
}

function DrugTimelineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, can } = useAuth();
  const { t } = useT();

  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const province = searchParams.get("province") ?? "";
  const district = searchParams.get("district") ?? "";
  const reportingUnitText = searchParams.get("reportingUnitText") ?? "";
  const caseId = searchParams.get("caseId") ?? undefined;
  const personId = searchParams.get("personId") ?? undefined;
  const phoneNumberId = searchParams.get("phoneNumberId") ?? undefined;
  const simId = searchParams.get("simId") ?? undefined;
  const deviceId = searchParams.get("deviceId") ?? undefined;
  const vehicleId = searchParams.get("vehicleId") ?? undefined;
  const sort = (searchParams.get("sort") as DrugTimelineSortDirection | null) ?? "NEWEST_FIRST";
  const groupMode = (searchParams.get("groupMode") as DrugTimelineGroupMode | null) ?? "DAY";
  const returnTo = getSafeReturnTo(searchParams);

  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<ViewMode>("TIMELINE");
  const [selectedEvent, setSelectedEvent] = useState<DrugTimelineEvent | null>(null);

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/drug-intelligence/timeline?${next.toString()}`);
  }

  function clearFilters() {
    updateParams({ dateFrom: undefined, dateTo: undefined, province: undefined, district: undefined, reportingUnitText: undefined });
  }

  const canView = can("drug.read");

  const query = {
    dateFrom: dateFrom ? (normalizeThaiPersonnelDateForSave(dateFrom) ?? undefined) : undefined,
    dateTo: dateTo ? (normalizeThaiPersonnelDateForSave(dateTo) ?? undefined) : undefined,
    province: province || undefined,
    district: district || undefined,
    reportingUnitText: reportingUnitText || undefined,
    caseId,
    personId,
    phoneNumberId,
    simId,
    deviceId,
    vehicleId,
    sort,
    groupMode,
    page: 1,
    pageSize: 50,
  };

  const timeline = useDrugTimeline(user?.id ?? null, query);
  const geographic = useDrugTimelineGeographic(user?.id ?? null, query);

  const hasFocus = Boolean(caseId || personId || phoneNumberId || simId || deviceId || vehicleId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.timeline.title")}
        description={t("di.timeline.description")}
        actions={
          returnTo ? (
            <Button asChild variant="outline" size="sm">
              <Link href={returnTo}>
                <MapPinned className="h-4 w-4" aria-hidden="true" />
                {t("di.map.actionBackToMap")}
              </Link>
            </Button>
          ) : null
        }
      />

      {!canView ? (
        <ErrorState title={t("di.alert.permissionDenied")} />
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiTile label={t("di.timeline.kpiEventCount")} value={timeline.data?.kpi.eventCount} />
            <KpiTile label={t("di.timeline.kpiProvinceCount")} value={timeline.data?.kpi.provinceCount} />
            <KpiTile label={t("di.timeline.kpiPersonsRepeated")} value={timeline.data?.kpi.personsRepeatedAcrossAreas} />
            <KpiTile label={t("di.timeline.kpiAreasWithRepeat")} value={timeline.data?.kpi.areasWithRepeatEvents} tone="critical" />
            <div className="col-span-2 rounded-xl border border-border bg-surface p-3 sm:col-span-1">
              <p className="text-xs text-muted">{t("di.timeline.kpiDateRange")}</p>
              <p className="text-xs font-medium text-foreground">
                {timeline.data?.kpi.dateRangeFrom ? new Date(timeline.data.kpi.dateRangeFrom).toLocaleDateString("th-TH") : "—"}
                {" – "}
                {timeline.data?.kpi.dateRangeTo ? new Date(timeline.data.kpi.dateRangeTo).toLocaleDateString("th-TH") : "—"}
              </p>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardBody className="space-y-3">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-controls="drug-timeline-filters-panel"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                {showFilters ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                {t("di.timeline.filters")}
              </button>
              {showFilters ? (
                <div id="drug-timeline-filters-panel" className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label htmlFor="tl-filter-date-from" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.timeline.filterDateFrom")}
                      </label>
                      <ThaiDatePicker value={dateFrom} onChange={(v) => updateParams({ dateFrom: v || undefined })} placeholder="DD/MM/YYYY" />
                    </div>
                    <div>
                      <label htmlFor="tl-filter-date-to" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.timeline.filterDateTo")}
                      </label>
                      <ThaiDatePicker value={dateTo} onChange={(v) => updateParams({ dateTo: v || undefined })} placeholder="DD/MM/YYYY" />
                    </div>
                    <div>
                      <label htmlFor="tl-filter-province" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.timeline.filterProvince")}
                      </label>
                      <input
                        id="tl-filter-province"
                        value={province}
                        onChange={(e) => updateParams({ province: e.target.value || undefined })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label htmlFor="tl-filter-district" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.timeline.filterDistrict")}
                      </label>
                      <input
                        id="tl-filter-district"
                        value={district}
                        onChange={(e) => updateParams({ district: e.target.value || undefined })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    {t("di.timeline.clearFilters")}
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {hasFocus ? (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
              {t("di.timeline.locationHistory")}
              <button type="button" onClick={() => router.push("/drug-intelligence/timeline")} className="ml-auto underline hover:no-underline">
                {t("di.timeline.viewFullTimeline")}
              </button>
            </p>
          ) : null}

          {/* View switcher + sort/group controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
              <Button variant={view === "TIMELINE" ? "accent" : "ghost"} size="sm" onClick={() => setView("TIMELINE")}>
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                {t("di.timeline.viewTimeline")}
              </Button>
              <Button variant={view === "GEOGRAPHIC" ? "accent" : "ghost"} size="sm" onClick={() => setView("GEOGRAPHIC")}>
                <MapIcon className="h-4 w-4" aria-hidden="true" />
                {t("di.timeline.viewGeographic")}
              </Button>
            </div>
            {view === "TIMELINE" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => updateParams({ sort: sort === "NEWEST_FIRST" ? "OLDEST_FIRST" : "NEWEST_FIRST" })}>
                  <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                  {sort === "NEWEST_FIRST" ? t("di.timeline.sortNewestFirst") : t("di.timeline.sortOldestFirst")}
                </Button>
                <Select
                  options={GROUP_MODE_OPTIONS.map((g) => ({ value: g.value, label: t(g.labelKey) }))}
                  value={groupMode}
                  onChange={(e) => updateParams({ groupMode: e.target.value })}
                />
              </>
            ) : null}
          </div>

          {/* Main workspace */}
          {view === "TIMELINE" ? (
            timeline.isPending ? (
              <LoadingState rows={8} label={t("di.timeline.loading")} />
            ) : timeline.isError ? (
              <ErrorState message={t("di.timeline.errorLoad")} onRetry={() => timeline.refetch()} />
            ) : timeline.data.groups.length === 0 ? (
              <EmptyState title={t("di.timeline.empty")} icon={<Calendar className="h-8 w-8" />} />
            ) : (
              <div className="space-y-5">
                {timeline.data.groups.map((group) => (
                  <div key={group.groupKey} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{group.groupLabel}</p>
                    <div className="space-y-2">
                      {group.events.map((event) => (
                        <TimelineEventCard key={`${group.groupKey}-${event.caseId}`} event={event} onSelect={() => setSelectedEvent(event)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : geographic.isPending ? (
            <LoadingState rows={6} />
          ) : geographic.isError ? (
            <ErrorState message={t("di.timeline.errorLoad")} onRetry={() => geographic.refetch()} />
          ) : geographic.data.rows.length === 0 ? (
            <EmptyState title={t("di.timeline.empty")} icon={<MapPin className="h-8 w-8" />} />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">{t("di.timeline.geographicProvinceColumn")}</th>
                    <th className="px-4 py-3">{t("di.timeline.geographicDistrictColumn")}</th>
                    <th className="px-4 py-3">{t("di.timeline.geographicCaseCountColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {geographic.data.rows.map((row) => (
                    <tr key={`${row.province}-${row.district ?? ""}`} className="border-b border-border last:border-0 hover:bg-neutral-bg/40">
                      <td className="px-4 py-3 font-medium text-foreground">{row.province}</td>
                      <td className="px-4 py-3 text-muted">{row.district ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground">{row.caseCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <Drawer open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} titleId="drug-timeline-event-detail" title={t("di.timeline.eventDetailTitle")}>
        {selectedEvent ? <TimelineEventDetail event={selectedEvent} returnTo={returnTo} /> : null}
      </Drawer>
    </div>
  );
}

function TimelineEventCard({ event, onSelect }: { event: DrugTimelineEvent; onSelect: () => void }) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-2">
        <button type="button" onClick={onSelect} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
          <div className="space-y-1">
            <p className="font-medium text-foreground hover:underline">{event.caseNumber}</p>
            <p className="text-xs text-muted">{event.title}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {event.hasUnreviewedAlert ? (
              <span title={t("di.timeline.hasAlert")}>
                <BellRing className="h-4 w-4 text-warning" aria-hidden="true" />
              </span>
            ) : null}
            {!event.hasCoordinates ? <Badge tone="neutral">{t("di.timeline.noCoordinates")}</Badge> : null}
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {event.arrestDate ? new Date(event.arrestDate).toLocaleDateString("th-TH") : "—"}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {event.province ?? "—"}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {event.personCount}
          </span>
          {event.phoneCount > 0 ? (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {event.phoneCount}
            </span>
          ) : null}
          {event.deviceCount > 0 ? (
            <span className="flex items-center gap-1">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              {event.deviceCount}
            </span>
          ) : null}
          {event.vehicleCount > 0 ? (
            <span className="flex items-center gap-1">
              <Car className="h-3.5 w-3.5" aria-hidden="true" />
              {event.vehicleCount}
            </span>
          ) : null}
          {event.seizedItemCount > 0 ? (
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              {event.seizedItemsSummary}
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function TimelineEventDetail({ event, returnTo }: { event: DrugTimelineEvent; returnTo: string | null }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{event.caseNumber}</p>
        <p className="text-sm text-muted">{event.title}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted">{t("di.field.arrestDate")}</p>
        <p className="text-sm text-foreground">{event.arrestDate ? toGregorianDateInputValue(event.arrestDate) : "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted">{t("di.field.province")}</p>
        <p className="text-sm text-foreground">
          {[event.province, event.district, event.subdistrict].filter(Boolean).join(" / ") || "—"}
        </p>
        <p className="mt-1 text-xs text-muted">{event.hasCoordinates ? t("di.timeline.coordinateAvailable") : t("di.timeline.coordinateUnavailable")}</p>
      </div>
      {event.persons.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted">{t("di.timeline.personCount")}</p>
          <ul className="mt-1 space-y-1">
            {event.persons.map((p) => (
              <li key={p.personId} className="text-sm">
                <Link href={`/drug-intelligence/persons/${encodeURIComponent(p.personId)}`} className="text-accent hover:underline">
                  {p.primaryFullName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {event.leadUnitText || event.participatingUnitCount > 0 || event.officerCount > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted">{t("di.review.leadUnitLabel")}</p>
          <p className="text-sm text-foreground">{event.leadUnitText || "—"}</p>
          {event.participatingUnitCount > 0 || event.officerCount > 0 ? (
            <p className="mt-1 text-xs text-muted">
              {event.participatingUnitCount > 0 ? `${t("di.review.participatingUnitsLabel")}: ${event.participatingUnitCount}` : ""}
              {event.participatingUnitCount > 0 && event.officerCount > 0 ? " · " : ""}
              {event.officerCount > 0 ? `${t("di.review.arrestTeamLabel")}: ${event.officerCount}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      {event.seizedItemCount > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted">{t("di.timeline.seizedSummary")}</p>
          <p className="text-sm text-foreground">{event.seizedItemsSummary}</p>
        </div>
      ) : null}
      {event.hasUnreviewedAlert ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
          <BellRing className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("di.timeline.hasAlert")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button asChild size="sm" variant="outline">
          <Link href={withReturnTo(`/drug-intelligence/cases/${encodeURIComponent(event.caseId)}`, returnTo)}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            {t("di.timeline.openCase")}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={withReturnTo(`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(event.caseId)}`, returnTo)}>
            <NetworkIcon className="h-4 w-4" aria-hidden="true" />
            {t("di.timeline.openNetwork")}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/drug-intelligence/map?caseId=${encodeURIComponent(event.caseId)}`}>
            <MapPinned className="h-4 w-4" aria-hidden="true" />
            {t("di.map.actionOpenOnMap")}
          </Link>
        </Button>
        {event.hasUnreviewedAlert ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/drug-intelligence/alerts?currentCaseId=${encodeURIComponent(event.caseId)}`}>
              <BellRing className="h-4 w-4" aria-hidden="true" />
              {t("di.alert.viewDetail")}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: number | undefined; tone?: "critical" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-semibold ${tone === "critical" ? "text-critical" : "text-foreground"}`}>{value !== undefined ? value.toLocaleString() : "—"}</p>
    </div>
  );
}
