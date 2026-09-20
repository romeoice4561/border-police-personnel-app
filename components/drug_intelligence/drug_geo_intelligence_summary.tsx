/**
 * Compact geo×temporal intelligence strip for the map workspace (DI-8.2B).
 */

"use client";

import { useT } from "@/components/i18n/language_provider";
import type { DrugGeoHotspot } from "@/lib/drug_intelligence/drug_geo_hotspot";
import { formatRadiusKm } from "@/lib/drug_intelligence/drug_geo_hotspot";
import type { DrugMapTemporalView } from "@/lib/drug_intelligence/drug_geo_client";
import { ISO_WEEKDAY_SHORT_TH, MAP_TIME_BUCKETS, type IsoWeekday } from "@/lib/drug_intelligence/drug_map_temporal";

export function DrugGeoIntelligenceSummary({
  temporal,
  hotspotCount,
  radiusKm,
  geoMode,
  selectedHotspot,
}: {
  temporal: DrugMapTemporalView;
  hotspotCount: number;
  radiusKm: number;
  geoMode: string;
  selectedHotspot: DrugGeoHotspot | null;
}) {
  const { t } = useT();

  let peakWeekday: IsoWeekday | null = null;
  let peakWeekdayN = 0;
  for (const d of [1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]) {
    const n = temporal.weekdayFrequency[d] ?? 0;
    if (n > peakWeekdayN) {
      peakWeekdayN = n;
      peakWeekday = d;
    }
  }
  let peakBucket = "";
  let peakBucketN = 0;
  for (const b of MAP_TIME_BUCKETS) {
    const n = temporal.timeBucketFrequency[b.id] ?? 0;
    if (n > peakBucketN) {
      peakBucketN = n;
      peakBucket = b.labelTh;
    }
  }

  return (
    <div
      data-testid="map-geo-intel-summary"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-neutral-bg px-3 py-2 text-xs text-foreground"
    >
      <span>
        {t("di.map.intelTimeCoverage")}:{" "}
        <strong className="tabular-nums">{temporal.coverage.coveragePercent}%</strong>
      </span>
      {peakWeekday && peakWeekdayN > 0 ? (
        <span>
          {t("di.map.intelPeakWeekday")}:{" "}
          <strong>
            {ISO_WEEKDAY_SHORT_TH[peakWeekday]} ({peakWeekdayN})
          </strong>
        </span>
      ) : null}
      {peakBucketN > 0 ? (
        <span>
          {t("di.map.intelPeakTime")}:{" "}
          <strong>
            {peakBucket} ({peakBucketN})
          </strong>
        </span>
      ) : null}
      {geoMode === "HOTSPOT" ? (
        <span>
          {t("di.map.intelHotspotCount")}:{" "}
          <strong className="tabular-nums">{hotspotCount}</strong> ({formatRadiusKm(radiusKm)})
        </span>
      ) : null}
      {selectedHotspot ? (
        <span className="text-accent">
          {t("di.map.intelSelectedHotspot")}: {selectedHotspot.eventCount} {t("di.map.intelEvents")}
        </span>
      ) : null}
    </div>
  );
}
