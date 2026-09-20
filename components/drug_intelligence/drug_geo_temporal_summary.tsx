/**
 * Compact temporal coverage + frequency facets for Map (DI-8.2.1).
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import type { DrugMapTemporalView } from "@/lib/drug_intelligence/drug_geo_client";
import type { DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";
import {
  ISO_WEEKDAYS,
  ISO_WEEKDAY_SHORT_TH,
  MAP_TIME_BUCKETS,
  type IsoWeekday,
  type MapTimeBucketId,
} from "@/lib/drug_intelligence/drug_map_temporal";

function chipClass(active: boolean): string {
  return active
    ? "flex min-w-0 flex-col items-stretch rounded-md bg-accent px-1.5 py-1 text-accent-fg"
    : "flex min-w-0 flex-col items-stretch rounded-md border border-border px-1.5 py-1 text-foreground hover:border-accent/50";
}

export function DrugGeoTemporalSummary({
  temporal,
  filters,
  onApply,
}: {
  temporal: DrugMapTemporalView;
  filters: DrugGeoFilterState;
  onApply: (patch: Partial<DrugGeoFilterState>) => void;
}) {
  const { t } = useT();
  const { coverage, weekdayFrequency, timeBucketFrequency, timeFilterActive } = temporal;
  const maxWeekday = Math.max(1, ...ISO_WEEKDAYS.map((d) => weekdayFrequency[d] ?? 0));
  const maxBucket = Math.max(1, ...MAP_TIME_BUCKETS.map((b) => timeBucketFrequency[b.id] ?? 0));

  function toggleWeekday(day: IsoWeekday) {
    const selected = filters.weekdays.includes(day);
    const next = selected ? filters.weekdays.filter((d) => d !== day) : [...filters.weekdays, day].sort((a, b) => a - b);
    onApply({ weekdays: next as IsoWeekday[] });
  }

  function applyTimeBucket(id: MapTimeBucketId) {
    if (filters.timePreset === id) {
      onApply({ timePreset: "ALL_DAY", timeFrom: "", timeTo: "" });
      return;
    }
    onApply({ timePreset: id, timeFrom: "", timeTo: "" });
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-neutral-bg/40 p-3" data-testid="map-temporal-summary">
      <p className="text-[11px] text-muted">{t("di.map.frequencyNeutralNote")}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="map-temporal-coverage">
        <CoverageTile label={t("di.map.temporalTotal")} value={coverage.total} />
        <CoverageTile label={t("di.map.temporalWithTime")} value={coverage.withTime} />
        <CoverageTile label={t("di.map.temporalWithoutTime")} value={coverage.withoutTime} />
        <CoverageTile label={t("di.map.temporalCoveragePercent")} valueLabel={`${coverage.coveragePercent.toLocaleString("th-TH")}%`} />
      </div>

      {timeFilterActive ? (
        <p className="text-[11px] text-muted" data-testid="map-temporal-time-filter-note">
          {t("di.map.temporalTimeFilterNote")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div data-testid="map-weekday-frequency">
          <p className="mb-1 text-xs font-semibold text-foreground">{t("di.map.weekdayFrequencyTitle")}</p>
          <div className="flex flex-wrap gap-1">
            {ISO_WEEKDAYS.map((day) => {
              const count = weekdayFrequency[day] ?? 0;
              const active = filters.weekdays.includes(day);
              const heightPct = Math.round((count / maxWeekday) * 100);
              return (
                <button key={day} type="button" onClick={() => toggleWeekday(day)} className={`${chipClass(active)} w-[2.6rem]`} aria-pressed={active}>
                  <span className="text-center text-[10px] opacity-80">{ISO_WEEKDAY_SHORT_TH[day]}</span>
                  <span className="mx-auto mt-0.5 h-5 w-2.5 overflow-hidden rounded-sm bg-current/15">
                    <span className="block w-full rounded-sm bg-current" style={{ height: `${Math.max(count > 0 ? 10 : 0, heightPct)}%`, marginTop: `${100 - Math.max(count > 0 ? 10 : 0, heightPct)}%` }} />
                  </span>
                  <span className="mt-0.5 text-center text-[11px] font-semibold tabular-nums">{count.toLocaleString("th-TH")}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div data-testid="map-time-frequency">
          <p className="mb-1 text-xs font-semibold text-foreground">{t("di.map.timeFrequencyTitle")}</p>
          <p className="mb-1 text-[11px] text-muted">
            {t("di.map.temporalWithTime")} {coverage.withTime.toLocaleString("th-TH")} / {t("di.map.temporalTotal")} {coverage.total.toLocaleString("th-TH")}
          </p>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-4 md:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8">
            {MAP_TIME_BUCKETS.map((bucket) => {
              const count = timeBucketFrequency[bucket.id] ?? 0;
              const active = filters.timePreset === bucket.id;
              const widthPct = Math.round((count / maxBucket) * 100);
              return (
                <button key={bucket.id} type="button" onClick={() => applyTimeBucket(bucket.id)} className={chipClass(active)} aria-pressed={active}>
                  <span className="text-center text-[10px] opacity-80">{bucket.labelTh}</span>
                  <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-current/15">
                    <span className="block h-full rounded-full bg-current" style={{ width: `${widthPct}%` }} />
                  </span>
                  <span className="mt-0.5 text-center text-[11px] font-semibold tabular-nums">{count.toLocaleString("th-TH")}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoverageTile({ label, value, valueLabel }: { label: string; value?: number; valueLabel?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-1.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {valueLabel ?? (value ?? 0).toLocaleString("th-TH")}
      </p>
    </div>
  );
}
