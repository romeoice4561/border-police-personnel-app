/**
 * DrugGeoTimeTrendChart (Phase DI-8.2, Section 12) — compact monthly
 * case-count trend for the currently filtered map result.
 *
 * Hand-rolled inline SVG bar chart, matching this codebase's existing
 * convention for small visualizations (components/officer/
 * salary_utilization_gauge.tsx) — no charting library exists or is
 * introduced here (Section 12: "use existing project chart conventions;
 * do not add a charting library if one already exists" — none does).
 * role="img" + aria-label + a visually-hidden textual summary, same as
 * the gauge, so the chart has an accessible textual summary (Section 21).
 *
 * Metric is case COUNT only — never a seizure-quantity axis (Section 12
 * explicitly forbids charting incompatible seizure units on one axis).
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import { drugGeoTrendMonthLabel, type DrugGeoTimeTrendBucket } from "@/lib/drug_intelligence/drug_geo_time_trend";

const CHART_HEIGHT = 64;
const BAR_GAP = 4;

export function DrugGeoTimeTrendChart({ buckets }: { buckets: DrugGeoTimeTrendBucket[] }) {
  const { t, language } = useT();

  if (buckets.length === 0) {
    return <p className="text-xs text-muted">{t("di.map.trendEmpty")}</p>;
  }

  const maxCount = Math.max(...buckets.map((b) => b.caseCount));
  const barWidth = 100 / buckets.length;

  const summary = buckets.map((b) => `${drugGeoTrendMonthLabel(b, language)} ${b.caseCount.toLocaleString("th-TH")}`).join(", ");
  const ariaLabel = `${t("di.map.trendTitle")}: ${summary}`;

  return (
    <div role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden="true">
        {buckets.map((b, i) => {
          const barHeight = maxCount > 0 ? (b.caseCount / maxCount) * (CHART_HEIGHT - 14) : 0;
          const x = i * barWidth + BAR_GAP / 2;
          const width = Math.max(barWidth - BAR_GAP, 1);
          return (
            <g key={b.monthKey}>
              <rect x={x} y={CHART_HEIGHT - 14 - barHeight} width={width} height={Math.max(barHeight, 1)} rx={1} fill="var(--accent)" />
              <text x={x + width / 2} y={CHART_HEIGHT - 2} textAnchor="middle" fontSize={6} fill="var(--muted)">
                {drugGeoTrendMonthLabel(b, language)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="sr-only">{ariaLabel}</p>
    </div>
  );
}
