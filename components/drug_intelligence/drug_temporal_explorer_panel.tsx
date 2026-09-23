/**
 * DI-8.7 V1.5A — Temporal Explorer / "นาฬิกาอาชญากรรม" workspace panel.
 * VISUAL HOTFIX 2 — readability pass: LEFT (large clock) / CENTER
 * (selected-range summary + Top time periods) / RIGHT (coverage +
 * entity summary), a full-width 24-hour histogram below the clock row,
 * and a matching-case table at the bottom with its live count in the
 * heading. One TemporalSelection drives every control (date pickers,
 * weekday chips, clock, histogram, start/end time selects) — no
 * duplicate filter state.
 *
 * Rendered as an in-page toggleable full-width panel inside the Network
 * workspace (app/drug-intelligence/network/page.tsx), reusing the SAME
 * "showFindConnection"-style inline <Card> toggle pattern already
 * established there — NOT a new route, NOT a new sidebar item, NOT
 * squeezed into the small right-side node Inspector (Section 21 audit
 * from the original V1.5A round).
 *
 * Scope (Section 20): operates ONLY on the CASE nodes already present in
 * the currently loaded Network neighborhood (`neighborhood.data`) — no
 * new query, no global aggregation. All filtering/aggregation math is
 * delegated to the pure lib/drug_intelligence/drug_temporal_explorer.ts
 * engine; this file is presentation + local TemporalSelection state only.
 *
 * Dataset is always "ข้อมูลตามเวลาจับกุม" (arrest-time based) — never
 * "เวลาเกิดเหตุ" (incident/offense time), since no such field exists in
 * the canonical schema.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n/language_provider";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";
import { DrugCrimeClock } from "@/components/drug_intelligence/drug_crime_clock";
import { DrugCrimeClockHistogram } from "@/components/drug_intelligence/drug_crime_clock_histogram";
import { ThaiDatePicker, THAI_EXPIRY_YEAR_BE_MIN, THAI_EXPIRY_YEAR_BE_MAX } from "@/components/ui/thai_date_picker";
import {
  ISO_WEEKDAYS,
  ISO_WEEKDAY_SHORT_TH,
  type IsoWeekday,
} from "@/lib/drug_intelligence/drug_map_temporal";
import {
  type TemporalCaseRecord,
  type TemporalSelection,
  emptyTemporalSelection,
  isTimeFilterActive,
  computeTemporalSelectionResult,
  computeTopHourlyBuckets,
} from "@/lib/drug_intelligence/drug_temporal_explorer";
import { formatThaiCompactDate, formatThaiClockLabel } from "@/lib/drug_intelligence/di_date_helpers";
import { drugEntityDetailHref } from "@/lib/drug_intelligence/drug_entity_routes";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";

/** Extracts CASE records from the currently loaded neighborhood. Pure. */
export function extractTemporalCasesFromNeighborhood(
  neighborhood: DrugGraphNeighborhoodResponse | undefined | null,
): TemporalCaseRecord[] {
  if (!neighborhood) return [];
  const records: TemporalCaseRecord[] = [];
  for (const node of neighborhood.nodes) {
    if (node.metadata.type !== "CASE") continue;
    records.push({
      id: node.id,
      caseNumber: node.metadata.caseNumber,
      status: node.metadata.status,
      arrestDate: node.metadata.arrestDate,
      arrestTime: node.metadata.arrestTime,
      province: node.metadata.province,
      reportingUnitText: node.metadata.reportingUnitText,
    });
  }
  return records;
}

/** Distinct entity-type counts among nodes DIRECTLY connected to the matching case ids. Pure, derived only from already-loaded data. */
function computeEntitySummaryForCases(
  neighborhood: DrugGraphNeighborhoodResponse,
  matchingCaseIds: readonly string[],
): { PERSON: number; PHONE: number; SIM: number; DEVICE: number; VEHICLE: number } {
  const caseIdSet = new Set(matchingCaseIds);
  const counted = { PERSON: new Set<string>(), PHONE: new Set<string>(), SIM: new Set<string>(), DEVICE: new Set<string>(), VEHICLE: new Set<string>() };
  for (const edge of neighborhood.edges) {
    const sourceIsCase = caseIdSet.has(edge.source);
    const targetIsCase = caseIdSet.has(edge.target);
    if (!sourceIsCase && !targetIsCase) continue;
    const otherId = sourceIsCase ? edge.target : edge.source;
    const otherNode = neighborhood.nodes.find((n) => n.id === otherId);
    if (!otherNode) continue;
    if (otherNode.type in counted) {
      (counted as Record<string, Set<string>>)[otherNode.type].add(otherNode.id);
    }
  }
  return {
    PERSON: counted.PERSON.size,
    PHONE: counted.PHONE.size,
    SIM: counted.SIM.size,
    DEVICE: counted.DEVICE.size,
    VEHICLE: counted.VEHICLE.size,
  };
}

const ISO_WEEKDAY_FULL_TH: Record<IsoWeekday, string> = {
  1: "จันทร์", 2: "อังคาร", 3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์", 7: "อาทิตย์",
};

export function DrugTemporalExplorerPanel({
  neighborhood,
  returnPath,
  className,
}: {
  neighborhood: DrugGraphNeighborhoodResponse;
  /** Navigation-only return path for case-detail / timeline links. */
  returnPath?: string | null;
  className?: string;
}) {
  const { t } = useT();
  const [selection, setSelection] = useState<TemporalSelection>(emptyTemporalSelection());

  const cases = useMemo(() => extractTemporalCasesFromNeighborhood(neighborhood), [neighborhood]);
  const result = useMemo(() => computeTemporalSelectionResult(cases, selection), [cases, selection]);
  const matchingCaseSet = useMemo(() => new Set(result.matchingCaseIds), [result.matchingCaseIds]);
  const matchingCases = useMemo(
    () => cases.filter((c) => matchingCaseSet.has(c.id)),
    [cases, matchingCaseSet],
  );
  const entitySummary = useMemo(
    () => computeEntitySummaryForCases(neighborhood, result.matchingCaseIds),
    [neighborhood, result.matchingCaseIds],
  );
  const topHours = useMemo(() => computeTopHourlyBuckets(result.hourlyDistribution, 3), [result.hourlyDistribution]);
  const topHoursMax = Math.max(1, ...topHours.map((b) => b.count));

  const timeActive = isTimeFilterActive(selection);

  function selectedRangeTimeLabel(): string | null {
    if (!timeActive || selection.startMinute == null || selection.endMinute == null) return null;
    const startH = String(Math.floor(selection.startMinute / 60)).padStart(2, "0");
    const startM = String(selection.startMinute % 60).padStart(2, "0");
    const endMinuteDisplay = selection.endMinute === 24 * 60 ? 0 : selection.endMinute;
    const endH = String(Math.floor(endMinuteDisplay / 60)).padStart(2, "0");
    const endM = String(endMinuteDisplay % 60).padStart(2, "0");
    return `${startH}:${startM}–${endH}:${endM} น.`;
  }

  function selectedRangeLabel(): string {
    const parts: string[] = [];
    if (selection.weekday != null) parts.push(`วัน${ISO_WEEKDAY_FULL_TH[selection.weekday]}`);
    const timeLabel = selectedRangeTimeLabel();
    if (timeLabel) parts.push(timeLabel);
    return parts.length > 0 ? parts.join(" / ") : t("di.temporal.selectedRangeNone");
  }

  // ── Synchronized start/end HH:MM selects — same TemporalSelection ──
  const startHourValue = selection.startMinute != null ? Math.floor(selection.startMinute / 60) : null;
  const endHourInclusiveValue =
    selection.endMinute != null ? Math.floor(((selection.endMinute - 1 + 1440) % 1440) / 60) : null;
  const hourOptions = Array.from({ length: 24 }, (_, h) => h);

  function commitRange(startHour: number, endHourInclusive: number) {
    const start = startHour * 60;
    const end = ((endHourInclusive + 1) % 24) * 60 || 24 * 60;
    setSelection((s) => ({ ...s, startMinute: start, endMinute: end === 0 ? 24 * 60 : end }));
  }

  function clearTimeRange() {
    setSelection((s) => {
      const { startMinute: _s, endMinute: _e, ...rest } = s;
      return rest;
    });
  }

  return (
    <Card className={className} data-testid="temporal-explorer-panel">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{t("di.temporal.title")}</p>
            <p className="text-xs text-muted">{t("di.temporal.subtitleShort")}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border bg-neutral-bg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface"
            onClick={() => setSelection(emptyTemporalSelection())}
            data-testid="temporal-reset-all"
          >
            {t("di.temporal.resetAll")}
          </button>
        </div>

        {/* Filter strip: date range | weekday | clear */}
        <div className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{t("di.temporal.dateFrom")}</span>
            <ThaiDatePicker
              value={selection.dateFrom ?? ""}
              onChange={(value) => setSelection((s) => ({ ...s, dateFrom: value || undefined }))}
              outputFormat="iso"
              displayFormat="short"
              yearRangeBE={{ min: THAI_EXPIRY_YEAR_BE_MIN, max: THAI_EXPIRY_YEAR_BE_MAX }}
              placeholder={t("di.temporal.dateFrom")}
              aria-label={t("di.temporal.dateFrom")}
              data-testid="temporal-date-from"
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{t("di.temporal.dateTo")}</span>
            <ThaiDatePicker
              value={selection.dateTo ?? ""}
              onChange={(value) => setSelection((s) => ({ ...s, dateTo: value || undefined }))}
              outputFormat="iso"
              displayFormat="short"
              yearRangeBE={{ min: THAI_EXPIRY_YEAR_BE_MIN, max: THAI_EXPIRY_YEAR_BE_MAX }}
              placeholder={t("di.temporal.dateTo")}
              aria-label={t("di.temporal.dateTo")}
              data-testid="temporal-date-to"
              className="w-40"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{t("di.temporal.weekday")}</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t("di.temporal.weekday")}>
              <button
                type="button"
                className={cn(
                  "rounded-lg border px-2 py-1 text-xs font-medium",
                  selection.weekday == null ? "border-accent bg-accent text-accent-fg" : "border-border bg-neutral-bg text-foreground hover:bg-surface",
                )}
                onClick={() => setSelection((s) => ({ ...s, weekday: undefined }))}
                data-testid="temporal-weekday-all"
              >
                {t("di.temporal.weekdayAll")}
              </button>
              {ISO_WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={cn(
                    "rounded-lg border px-2 py-1 text-xs font-medium",
                    selection.weekday === day ? "border-accent bg-accent text-accent-fg" : "border-border bg-neutral-bg text-foreground hover:bg-surface",
                  )}
                  onClick={() => setSelection((s) => ({ ...s, weekday: s.weekday === day ? undefined : day }))}
                  data-testid={`temporal-weekday-${day}`}
                  title={`${result.weekdayFrequency[day]}`}
                >
                  {ISO_WEEKDAY_SHORT_TH[day]} ({result.weekdayFrequency[day]})
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="ml-auto rounded-lg border border-border bg-neutral-bg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface"
            onClick={() => setSelection(emptyTemporalSelection())}
            data-testid="temporal-clear-filters"
          >
            {t("di.temporal.clearFilters")}
          </button>
        </div>

        {/* Main: LEFT large clock | CENTER selected-range summary + Top 3 | RIGHT coverage + entity summary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr_1fr]">
          <div className="flex flex-col items-center gap-3">
            <DrugCrimeClock
              hourlyDistribution={result.hourlyDistribution}
              startMinute={selection.startMinute}
              endMinute={selection.endMinute}
              matchingCaseCount={result.matchingCaseCount}
              totalCaseCount={result.coverage.total}
              onSelectRange={(startMinute, endMinute) => setSelection((s) => ({ ...s, startMinute, endMinute }))}
            />

            {/* Precise-accessibility fallback controls (Section 19) — same TemporalSelection as the dial. */}
            <div className="flex w-full max-w-xs flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">{t("di.temporal.startTime")}</span>
                  <select
                    className="rounded-lg border border-border bg-neutral-bg px-2 py-1.5 text-sm text-foreground"
                    value={startHourValue ?? ""}
                    onChange={(e) => commitRange(Number(e.target.value), endHourInclusiveValue ?? Number(e.target.value))}
                    data-testid="crime-clock-start-select"
                  >
                    <option value="" disabled>--:--</option>
                    {hourOptions.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">{t("di.temporal.endTime")}</span>
                  <select
                    className="rounded-lg border border-border bg-neutral-bg px-2 py-1.5 text-sm text-foreground"
                    value={endHourInclusiveValue ?? ""}
                    onChange={(e) => commitRange(startHourValue ?? Number(e.target.value), Number(e.target.value))}
                    data-testid="crime-clock-end-select"
                  >
                    <option value="" disabled>--:--</option>
                    {hourOptions.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:59</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="rounded-lg border border-border bg-neutral-bg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                onClick={clearTimeRange}
                data-testid="crime-clock-clear-time"
                disabled={!timeActive}
              >
                {t("di.temporal.actionClearTimeRange")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-neutral-bg/40 p-3">
              <p className="text-xs font-medium text-muted">{t("di.temporal.selectedRangeLabel")}</p>
              <p className="text-base font-semibold text-foreground" data-testid="temporal-selected-range-label">
                {selectedRangeLabel()}
              </p>
              <p className="mt-1 text-sm text-accent" data-testid="temporal-matching-count">
                {t("di.temporal.matchingCaseCount").replace("{count}", String(result.matchingCaseCount))}
              </p>
              <p className="text-xs text-muted" data-testid="temporal-matching-count-base">
                {t("di.temporal.selectedRangeCoverageLine").replace("{withTime}", String(result.coverage.withTime))}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href="#temporal-results-table-anchor"
                  className="rounded-lg border border-border bg-neutral-bg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface"
                  data-testid="temporal-action-view-cases"
                >
                  {t("di.temporal.actionViewCasesInRange")}
                </a>
                {timeActive ? (
                  <button
                    type="button"
                    className="rounded-lg border border-border bg-neutral-bg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface"
                    onClick={clearTimeRange}
                    data-testid="temporal-action-clear-range"
                  >
                    {t("di.temporal.actionClearTimeRange")}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-neutral-bg/40 p-3" data-testid="temporal-top-hours">
              <p className="mb-1.5 text-xs font-medium text-muted">{t("di.temporal.topHoursTitle")}</p>
              {topHours.length === 0 ? (
                <p className="text-xs text-muted" data-testid="temporal-top-hours-empty">{t("di.temporal.topHoursEmpty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {topHours.map((bucket) => (
                    <li key={bucket.hour} className="flex items-center gap-2 text-xs" data-testid={`temporal-top-hour-${bucket.hour}`}>
                      <span className="w-20 shrink-0 font-medium text-foreground">
                        {String(bucket.hour).padStart(2, "0")}:00–{String(bucket.hour).padStart(2, "0")}:59
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(10, (bucket.count / topHoursMax) * 100)}%` }}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-right text-muted">
                        {t("di.temporal.matchingCaseCount").replace("{count}", String(bucket.count))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-neutral-bg/40 p-3" data-testid="temporal-coverage">
              <p className="mb-1.5 text-xs font-medium text-muted">{t("di.temporal.coverageTitle")}</p>
              <dl className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">{t("di.temporal.coverageTotalRow")}</dt>
                  <dd className="font-medium text-foreground">{result.coverage.total}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">{t("di.temporal.coverageDateRow")}</dt>
                  <dd className="font-medium text-foreground">{result.coverage.withDate} ({result.coverage.total > 0 ? Math.round((result.coverage.withDate / result.coverage.total) * 1000) / 10 : 0}%)</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">{t("di.temporal.coverageTimeRow")}</dt>
                  <dd className="font-medium text-foreground">{result.coverage.withTime} ({result.coverage.coveragePercent}%)</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">{t("di.temporal.coverageMissingRow")}</dt>
                  <dd className="font-medium text-foreground">{result.coverage.withoutTime}</dd>
                </div>
              </dl>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${result.coverage.coveragePercent}%` }}
                />
              </div>
              <p className="mt-1 italic text-[11px] text-muted">{t("di.temporal.scopeNote")}</p>
            </div>

            <div className="rounded-lg border border-border bg-neutral-bg/40 p-3" data-testid="temporal-entity-summary">
              <p className="mb-1.5 text-xs font-medium text-muted">{t("di.temporal.entitySummaryTitleV2")}</p>
              <dl className="grid grid-cols-2 gap-1.5 text-xs text-foreground sm:grid-cols-1">
                <div className="flex items-center justify-between"><dt>{t("di.temporal.entityPersons")}</dt><dd className="font-medium">{entitySummary.PERSON}</dd></div>
                <div className="flex items-center justify-between"><dt>{t("di.temporal.entityPhones")}</dt><dd className="font-medium">{entitySummary.PHONE}</dd></div>
                <div className="flex items-center justify-between"><dt>{t("di.temporal.entitySims")}</dt><dd className="font-medium">{entitySummary.SIM}</dd></div>
                <div className="flex items-center justify-between"><dt>{t("di.temporal.entityDevices")}</dt><dd className="font-medium">{entitySummary.DEVICE}</dd></div>
                <div className="flex items-center justify-between"><dt>{t("di.temporal.entityVehicles")}</dt><dd className="font-medium">{entitySummary.VEHICLE}</dd></div>
              </dl>
            </div>
          </div>
        </div>

        {/* 24-hour histogram — full width, same hourlyDistribution + same TemporalSelection as the clock */}
        <div className="border-t border-border pt-3">
          <DrugCrimeClockHistogram
            hourlyDistribution={result.hourlyDistribution}
            startMinute={selection.startMinute}
            endMinute={selection.endMinute}
            onSelectRange={(startMinute, endMinute) => setSelection((s) => ({ ...s, startMinute, endMinute }))}
          />
        </div>

        {/* Results table */}
        <div className="border-t border-border pt-3" id="temporal-results-table-anchor">
          <p className="mb-2 text-sm font-semibold text-foreground" data-testid="temporal-results-title">
            {t("di.temporal.resultsTitleWithCount").replace("{count}", String(result.matchingCaseCount))}
          </p>
          {matchingCases.length === 0 ? (
            <p className="text-xs text-muted" data-testid="temporal-results-empty">
              {timeActive ? t("di.temporal.resultsEmptyTime") : t("di.temporal.resultsEmptyGeneral")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="temporal-results-table">
                <thead>
                  <tr className="text-muted">
                    <th className="px-2 py-1 font-medium">{t("di.temporal.colTime")}</th>
                    <th className="px-2 py-1 font-medium">{t("di.temporal.colCase")}</th>
                    <th className="px-2 py-1 font-medium">{t("di.temporal.colDate")}</th>
                    <th className="px-2 py-1 font-medium">{t("di.temporal.colProvince")}</th>
                    <th className="px-2 py-1 font-medium">{t("di.temporal.colUnit")}</th>
                    <th className="px-2 py-1 font-medium">{t("di.temporal.colAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {matchingCases.map((c) => (
                    <tr key={c.id} className="border-t border-border" data-testid={`temporal-result-row-${c.id}`}>
                      <td className="px-2 py-1.5">
                        {formatThaiClockLabel(c.arrestTime) ?? (
                          <span className="text-muted" data-testid={`temporal-result-no-time-${c.id}`}>
                            {t("di.temporal.noTimeBadge")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">{c.caseNumber}</td>
                      <td className="px-2 py-1.5">{formatThaiCompactDate(c.arrestDate)}</td>
                      <td className="px-2 py-1.5">{c.province ?? "—"}</td>
                      <td className="px-2 py-1.5">{c.reportingUnitText ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <Link
                          href={drugEntityDetailHref("CASE", c.id, returnPath)}
                          className="text-accent hover:underline"
                          data-testid={`temporal-result-link-${c.id}`}
                        >
                          {t("di.temporal.actionViewDetail")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
