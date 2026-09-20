/**
 * DI-8.2B — Hotspot intelligence inspector panel (visual polish).
 *
 * Display-only hierarchy / width / scanability. Does not change hotspot
 * algorithm, evidence semantics, or fetch contracts.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import {
  deriveHotspotRepeatIndicators,
  formatRadiusKm,
  summarizeHotspotTemporal,
  type DrugGeoHotspot,
} from "@/lib/drug_intelligence/drug_geo_hotspot";
import {
  HOTSPOT_PROXIMITY_ONLY_MESSAGE_TH,
  type HotspotCrossCaseAnalysis,
} from "@/lib/drug_intelligence/drug_geo_hotspot_evidence";
import { fetchDrugGeoHotspotContext } from "@/lib/drug_intelligence/drug_geo_hotspot_context_client";
import { ISO_WEEKDAY_SHORT_TH, MAP_TIME_BUCKETS, type IsoWeekday } from "@/lib/drug_intelligence/drug_map_temporal";

function thaiDate(iso: string | null): string {
  if (!iso) return "—";
  return formatShortThaiDateTh(new Date(`${iso}T00:00:00.000Z`));
}

function FrequencyChip({ label, count }: { label: string; count: number }) {
  const quiet = count === 0;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${
        quiet ? "bg-transparent text-muted/50" : "bg-neutral-bg font-medium text-foreground"
      }`}
    >
      {label} {count}
    </span>
  );
}

export function DrugGeoHotspotInspector({
  hotspot,
  actorId,
  mapReturnUrl,
  onClose,
}: {
  hotspot: DrugGeoHotspot;
  actorId: string | null;
  mapReturnUrl: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const temporal = useMemo(() => summarizeHotspotTemporal(hotspot.events), [hotspot]);
  const indicators = useMemo(() => deriveHotspotRepeatIndicators(hotspot, temporal), [hotspot, temporal]);
  const [analysis, setAnalysis] = useState<HotspotCrossCaseAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!actorId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setAnalysis(null);
    fetchDrugGeoHotspotContext(actorId, hotspot.caseIds, controller.signal)
      .then((result) => setAnalysis(result.analysis))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : t("di.error.saveFailed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [actorId, hotspot.caseIds, hotspot.hotspotId, t]);

  const personCount = analysis?.counts.uniquePersonCount ?? hotspot.uniquePersonCount;
  const phoneCount = analysis?.counts.uniquePhoneCount ?? hotspot.uniquePhoneCount;
  const vehicleCount = analysis?.counts.uniqueVehicleCount ?? hotspot.uniqueVehicleCount;
  const chronology = analysis?.chronology ?? [];

  const casesWithDirectEvidence = useMemo(() => {
    const set = new Set<string>();
    if (!analysis) return set;
    for (const pair of analysis.pairs) {
      if (!pair.hasDirectEvidence) continue;
      set.add(pair.caseAId);
      set.add(pair.caseBId);
    }
    return set;
  }, [analysis]);

  const areaLabel =
    [hotspot.provinces.join(", "), hotspot.districts.join(", ")].filter(Boolean).join(" / ") || "—";

  const caseRows =
    chronology.length > 0
      ? chronology
      : hotspot.events
          .slice()
          .sort((a, b) => {
            const da =
              typeof a.arrestDate === "string"
                ? a.arrestDate
                : (a.arrestDate?.toISOString().slice(0, 10) ?? "");
            const db =
              typeof b.arrestDate === "string"
                ? b.arrestDate
                : (b.arrestDate?.toISOString().slice(0, 10) ?? "");
            return da.localeCompare(db) || a.caseId.localeCompare(b.caseId);
          })
          .map((e) => ({
            caseId: e.caseId,
            caseNumber: e.caseNumber ?? e.caseId,
            arrestDate:
              typeof e.arrestDate === "string"
                ? e.arrestDate
                : e.arrestDate
                  ? e.arrestDate.toISOString().slice(0, 10)
                  : null,
            arrestTime: e.arrestTime ?? null,
            province: e.province ?? null,
            district: e.district ?? null,
            personNames: [] as string[],
          }));

  return (
    <div
      data-testid="map-hotspot-inspector"
      className="flex max-h-[70vh] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg xl:max-h-[calc(100vh-12rem)]"
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-2 border-b border-border bg-surface px-3.5 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">{t("di.map.hotspotInspectorTitle")}</p>
          <p className="text-xs text-muted">
            {t("di.map.hotspotRadius")}: {formatRadiusKm(hotspot.radiusKm)}
          </p>
          <p className="truncate text-sm text-foreground" title={areaLabel}>
            {areaLabel}
          </p>
          <p className="font-mono text-[11px] text-muted/70">
            {hotspot.centerLatitude.toFixed(5)}, {hotspot.centerLongitude.toFixed(5)}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onClose} aria-label={t("di.map.hotspotClose")}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden p-3.5 pr-4 text-sm [scrollbar-gutter:stable]">
        <dl className="grid grid-cols-2 gap-1.5 text-xs">
          <Stat label={t("di.map.hotspotEventCount")} value={hotspot.eventCount} />
          <Stat label={t("di.map.hotspotCaseCount")} value={hotspot.caseIds.length} />
          <Stat
            label={t("di.map.hotspotDateRange")}
            value={`${thaiDate(hotspot.earliestArrestDate)} – ${thaiDate(hotspot.latestArrestDate)}`}
            text
          />
          <Stat
            label={t("di.map.hotspotTimeCoverage")}
            value={`${temporal.coverage.coveragePercent}% (${temporal.coverage.withTime}/${temporal.coverage.total})`}
            text
          />
          <Stat label={t("di.map.hotspotPersons")} value={personCount == null ? "…" : personCount} text={personCount == null} />
          <Stat label={t("di.map.hotspotPhones")} value={phoneCount == null ? "…" : phoneCount} text={phoneCount == null} />
          <Stat label={t("di.map.hotspotVehicles")} value={vehicleCount == null ? "…" : vehicleCount} text={vehicleCount == null} />
        </dl>

        <section>
          <p className="mb-1.5 text-xs font-semibold text-foreground">{t("di.map.hotspotWeekdayTitle")}</p>
          <div className="flex flex-wrap gap-1">
            {([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]).map((d) => (
              <FrequencyChip key={d} label={ISO_WEEKDAY_SHORT_TH[d]} count={temporal.weekdayFrequency[d] ?? 0} />
            ))}
          </div>
        </section>

        <section>
          <p className="mb-1.5 text-xs font-semibold text-foreground">{t("di.map.hotspotTimeTitle")}</p>
          {temporal.coverage.withTime === 0 ? (
            <p className="text-xs text-muted">{t("di.map.hotspotNoTimeData")}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {MAP_TIME_BUCKETS.map((b) => (
                <FrequencyChip key={b.id} label={b.labelTh} count={temporal.timeBucketFrequency[b.id] ?? 0} />
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="mb-1 text-xs font-medium text-muted">{t("di.map.hotspotRepeatTitle")}</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground">
            {indicators.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold text-foreground">{t("di.map.hotspotEvidenceBetweenTitle")}</p>
          {loading ? <p className="text-xs text-muted">{t("di.map.hotspotEvidenceLoading")}</p> : null}
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          {analysis ? (
            <>
              {analysis.linkedPairCount === 0 ? (
                <p className="rounded-lg border border-border/80 bg-neutral-bg/80 px-2.5 py-2 text-xs leading-relaxed text-foreground">
                  {HOTSPOT_PROXIMITY_ONLY_MESSAGE_TH}
                </p>
              ) : (
                <ul className="space-y-2">
                  {analysis.pairs.map((pair) => (
                    <li key={`${pair.caseAId}-${pair.caseBId}`} className="rounded-lg border border-border px-2.5 py-2 text-xs">
                      <p className="font-medium text-foreground">
                        {pair.caseANumber} ↔ {pair.caseBNumber}
                      </p>
                      <p className="mt-0.5 text-muted">{t("di.map.hotspotSameArea")}</p>
                      <p className="mt-1.5 font-medium text-foreground">{t("di.map.hotspotDirectEvidence")}</p>
                      <ul className="mt-0.5 list-inside list-disc text-foreground">
                        {pair.evidenceLabels.map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
              {analysis.proximityOnlyPairCount > 0 && analysis.linkedPairCount > 0 ? (
                <p className="text-xs text-muted">
                  {t("di.map.hotspotProximityOnlyCount")}: {analysis.proximityOnlyPairCount}
                </p>
              ) : null}
            </>
          ) : null}
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold text-foreground">{t("di.map.hotspotCasesTitle")}</p>
          <ul className="space-y-2">
            {caseRows.map((row) => {
              const hasEvidence = casesWithDirectEvidence.has(row.caseId);
              const place = [row.province, row.district].filter(Boolean).join(" / ") || "—";
              return (
                <li key={row.caseId} className="rounded-lg border border-border px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-foreground">{row.caseNumber}</p>
                    {hasEvidence ? (
                      <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        {t("di.map.hotspotCaseHasEvidence")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-foreground">
                    <span className="tabular-nums">{thaiDate(row.arrestDate)}</span>
                    {row.arrestTime ? (
                      <span className="tabular-nums"> · {row.arrestTime}</span>
                    ) : (
                      <span className="text-muted"> · {t("di.map.hotspotTimeUnknown")}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted" title={place}>
                    {place}
                  </p>
                  {row.personNames.length > 0 ? (
                    <p className="mt-0.5 truncate text-xs text-foreground" title={row.personNames.join(", ")}>
                      {row.personNames.slice(0, 3).join(", ")}
                      {row.personNames.length > 3 ? ` +${row.personNames.length - 3}` : ""}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                      <Link href={`/drug-intelligence/cases/${row.caseId}?returnTo=${encodeURIComponent(mapReturnUrl)}`}>
                        {t("di.map.hotspotOpenCase")}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                      <Link href={`/drug-intelligence/network?focusCaseId=${row.caseId}&returnTo=${encodeURIComponent(mapReturnUrl)}`}>
                        {t("di.map.hotspotOpenNetwork")}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                      <Link href={`/drug-intelligence/cases/${row.caseId}?tab=connections&returnTo=${encodeURIComponent(mapReturnUrl)}`}>
                        {t("di.map.hotspotOpenConnections")}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, text }: { label: string; value: number | string; text?: boolean }) {
  return (
    <div className="rounded-md bg-neutral-bg px-2 py-1">
      <dt className="truncate text-[11px] leading-tight text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold leading-snug text-foreground ${text ? "" : "tabular-nums"}`}>
        {typeof value === "number" ? value.toLocaleString("th-TH") : value}
      </dd>
    </div>
  );
}
