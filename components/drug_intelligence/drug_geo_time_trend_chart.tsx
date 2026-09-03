/**
 * DrugGeoTimeTrendChart (Phase DI-8.2, Section 12) — compact monthly
 * case-count trend for the currently filtered map result.
 *
 * Hand-rolled CSS-column bar chart, matching the Phase 2B.2.1 Commander
 * trend fix — NO stretched SVG text. The original implementation used an
 * inline SVG with preserveAspectRatio="none" and fontSize={6}, which caused
 * the Thai month abbreviations to be compressed/unreadable at 100% zoom when
 * the SVG was stretched to fill the analysis panel width.
 *
 * Fix: bars are HTML <div> columns inside a flex container; month labels are
 * real HTML text at text-[12px], identical visual language to CommanderTrendChart.
 * The SVG is kept ONLY for the bar geometry (no text inside it) — but actually
 * the simplest and most maintainable approach mirrors Commander exactly: pure
 * CSS flex columns with percentage heights. No SVG at all.
 *
 * role="img" + aria-label + visually-hidden textual summary, same as before.
 * No new dependency. Tooltip on hover/focus reuses the Commander pattern.
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import { drugGeoTrendMonthLabel, type DrugGeoTimeTrendBucket } from "@/lib/drug_intelligence/drug_geo_time_trend";

export function DrugGeoTimeTrendChart({ buckets }: { buckets: DrugGeoTimeTrendBucket[] }) {
  const { t, language } = useT();

  if (buckets.length === 0) {
    return <p className="text-xs text-muted">{t("di.map.trendEmpty")}</p>;
  }

  const maxCount = Math.max(...buckets.map((b) => b.caseCount), 1);
  const summary = buckets
    .map((b) => `${drugGeoTrendMonthLabel(b, language)} ${b.caseCount.toLocaleString("th-TH")}`)
    .join(", ");
  const ariaLabel = `${t("di.map.trendTitle")}: ${summary}`;

  return (
    <div role="img" aria-label={ariaLabel}>
      {/* Overflow-x scroll so narrow panels (≤320px) don't crush bars */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div
          className="flex items-end gap-0.5"
          data-testid="map-trend-chart"
          style={{ minWidth: `${buckets.length * 28}px` }}
        >
          {buckets.map((b) => {
            const label = drugGeoTrendMonthLabel(b, language);
            const barPct = (b.caseCount / maxCount) * 100;
            return (
              <div
                key={b.monthKey}
                className="group relative flex min-w-0 flex-1 flex-col items-center"
                aria-label={`${label}: ${b.caseCount} คดี`}
              >
                {/* Hover tooltip */}
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-[9rem] rounded-md border border-border bg-surface px-2 py-1 text-left text-[12px] text-foreground shadow-sm group-hover:block">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-muted">
                    {t("di.map.trendTooltip").replace("{count}", b.caseCount.toLocaleString("th-TH"))}
                  </span>
                </span>

                {/* Bar column */}
                <div className="flex h-16 w-full flex-col items-center justify-end">
                  {b.caseCount > 0 ? (
                    <span className="mb-0.5 text-[11px] font-medium tabular-nums text-foreground">
                      {b.caseCount.toLocaleString("th-TH")}
                    </span>
                  ) : null}
                  <span
                    className="w-[70%] max-w-[2rem] rounded-t-sm bg-accent/90"
                    style={{ height: `${Math.max(barPct, b.caseCount > 0 ? 8 : 2)}%` }}
                    aria-hidden="true"
                  />
                </div>

                {/* Month label — real HTML text, never inside a stretched SVG */}
                <span className="mt-1 w-full text-center text-[12px] leading-tight text-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="sr-only">{ariaLabel}</p>
    </div>
  );
}
