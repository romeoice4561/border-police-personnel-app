/**
 * DI-8.5 — Area × Weekday × Time pattern panel ("รูปแบบพื้นที่ × วัน × เวลา").
 *
 * Compact FULL-WIDTH horizontal rows (not narrow cards in an empty grid) —
 * one row per province, a 3-column body (weekdays / time buckets / related
 * cases), and a compact action footer. Kept vertically short: the map still
 * starts immediately below this section (UX-refinement round).
 *
 * Derived purely from the already-fetched marker dataset (see
 * drug_geo_area_temporal_pattern.ts — zero new queries). Areas with as few
 * as 1 event are real, recorded data and are never discarded — only the
 * INITIAL on-screen row count is limited (AREA_TEMPORAL_INITIAL_LIMIT),
 * expandable via "ดูพื้นที่ทั้งหมด". This is a display limit, not an
 * intelligence/risk threshold.
 *
 * Each row offers three actions, ranked by hierarchy, all routed through
 * the page's single canonical filter/navigation mechanisms:
 *   PRIMARY (accent)   กรองพื้นที่นี้      — applies the province filter
 *   SECONDARY (outline) ดูเหตุการณ์        — province filter + List view
 *   TERTIARY (link)    เริ่มตรวจสอบความเชื่อมโยง — opens Network Graph
 *     focused on one real case from this area as an investigation
 *     starting point. Deliberately NOT phrased as "ดูความเชื่อมโยง" /
 *     "view connections" — being in the same province does not mean the
 *     cases are already linked (จังหวัดเดียวกัน ≠ เครือข่ายเดียวกัน).
 *
 * Descriptive recorded-data summarization only — never infers motive,
 * never claims future behavior, never labels an area "อันตราย"/"เสี่ยงสูง".
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import {
  computeAreaTemporalPatterns,
  AREA_TEMPORAL_INITIAL_LIMIT,
  type AreaTemporalSourceRow,
} from "@/lib/drug_intelligence/drug_geo_area_temporal_pattern";
import { ISO_WEEKDAY_SHORT_TH, mapTimeBucketChipLabel } from "@/lib/drug_intelligence/drug_map_temporal";

export function DrugGeoAreaTemporalPatternPanel({
  rows,
  mapReturnUrl,
  onFilterProvince,
  onViewEvents,
}: {
  rows: readonly AreaTemporalSourceRow[];
  mapReturnUrl: string;
  onFilterProvince: (province: string) => void;
  onViewEvents: (province: string) => void;
}) {
  const { t } = useT();
  const patterns = useMemo(() => computeAreaTemporalPatterns(rows), [rows]);
  const [expanded, setExpanded] = useState(false);
  const visiblePatterns = expanded ? patterns : patterns.slice(0, AREA_TEMPORAL_INITIAL_LIMIT);
  const hasMore = patterns.length > AREA_TEMPORAL_INITIAL_LIMIT;

  // Network Graph has no province-level focus concept (only focusType=CASE&focusId=<caseId>,
  // per app/drug-intelligence/network/page.tsx — audited, not redesigned per DI-8.5 Section 18).
  // Used purely as a real, navigable investigation starting point — never implies the
  // area's cases are already connected to each other.
  const caseIdByProvince = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const province = row.province?.trim();
      if (!province || map.has(province)) continue;
      map.set(province, row.id);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-neutral-bg/40 p-3" data-testid="map-area-temporal-pattern">
      <div>
        <p className="text-sm font-semibold text-foreground">{t("di.map.areaTemporalPatternTitle")}</p>
        <p className="text-[11px] text-muted">{t("di.map.areaTemporalPatternSubtitle")}</p>
      </div>

      {patterns.length === 0 ? (
        <p className="text-xs text-muted" data-testid="map-area-temporal-pattern-empty">
          {t("di.map.areaTemporalPatternEmpty")}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {visiblePatterns.map((pattern) => (
              <div
                key={pattern.province}
                className="min-w-0 rounded-lg border border-border bg-background px-3 py-2"
                data-testid="map-area-temporal-pattern-row"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 truncate text-sm font-semibold text-foreground" title={pattern.province}>
                    {pattern.province}
                  </p>
                  <p className="shrink-0 text-xs tabular-nums text-muted">
                    {pattern.eventCount.toLocaleString("th-TH")} {t("di.map.areaTemporalEventCount")}
                  </p>
                </div>

                <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted">{t("di.map.areaTemporalWeekdaysFound")}</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {pattern.topWeekdays.map((w) => (
                        <li key={w.day}>
                          <button
                            type="button"
                            onClick={() => onFilterProvince(pattern.province)}
                            className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-[11px] text-foreground hover:bg-accent/15"
                          >
                            <span>{ISO_WEEKDAY_SHORT_TH[w.day]}</span>
                            <span className="font-medium tabular-nums">{w.count.toLocaleString("th-TH")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted">{t("di.map.areaTemporalTimeFound")}</p>
                    {pattern.topTimeBuckets.length === 0 ? (
                      <p className="mt-0.5 text-[11px] text-muted">{t("di.map.areaTemporalNoTimeData")}</p>
                    ) : (
                      <ul className="mt-0.5 space-y-0.5">
                        {pattern.topTimeBuckets.map((b) => (
                          <li key={b.bucket}>
                            <button
                              type="button"
                              onClick={() => onFilterProvince(pattern.province)}
                              className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-[11px] tabular-nums text-foreground hover:bg-accent/15"
                            >
                              <span>{mapTimeBucketChipLabel(b.bucket)}</span>
                              <span className="font-medium">{b.count.toLocaleString("th-TH")}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted">
                      {t("di.map.areaTemporalCasesTitle")}{" "}
                      <span className="tabular-nums">
                        {pattern.uniqueCaseCount.toLocaleString("th-TH")} {t("di.map.areaTemporalCasesCount")}
                      </span>
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1" data-testid="map-area-temporal-case-chips">
                      {pattern.caseNumbers.map((caseNumber) => (
                        <span key={caseNumber} className="rounded bg-neutral-bg px-1.5 py-0.5 text-[11px] text-foreground">
                          {caseNumber}
                        </span>
                      ))}
                      {pattern.caseNumberOverflowCount > 0 ? (
                        <span className="rounded bg-neutral-bg px-1.5 py-0.5 text-[11px] text-muted">
                          +{pattern.caseNumberOverflowCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="accent" size="sm" className="h-7 px-2.5 text-xs" onClick={() => onFilterProvince(pattern.province)}>
                    {t("di.map.areaTemporalActionFilter")}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => onViewEvents(pattern.province)}>
                    {t("di.map.areaTemporalActionViewEvents")}
                  </Button>
                  {caseIdByProvince.has(pattern.province) ? (
                    <Link
                      href={`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(caseIdByProvince.get(pattern.province)!)}&returnTo=${encodeURIComponent(mapReturnUrl)}`}
                      className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                    >
                      {t("di.map.areaTemporalActionViewNetwork")}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-accent hover:underline"
              data-testid="map-area-temporal-toggle-all"
            >
              {expanded ? t("di.map.areaTemporalShowFewer") : t("di.map.areaTemporalShowAll").replace("{count}", String(patterns.length))}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
