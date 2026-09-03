/**
 * CommanderTrendChart (Phase 2B).
 *
 * Monthly case-count trend bar chart for the Commander Dashboard.
 * Inline SVG — no charting library. Same convention as DrugGeoTimeTrendChart.
 * Bars are clickable: navigate to the cases list with that month's date range.
 *
 * Month labels in Thai (ม.ค., ก.พ., ...) or English abbreviations depending
 * on UI language.
 */
"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/language_provider";
import { ErrorState } from "@/components/common/states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommanderTrendData, CommanderTrendBucket } from "@/lib/drug_intelligence/drug_commander_dashboard_types";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderMonthCasesHref } from "@/lib/drug_intelligence/drug_commander_drilldown";

const CHART_HEIGHT = 80;
const BAR_GAP = 3;

const MONTH_LABEL_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTH_LABEL_EN = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(bucket: CommanderTrendBucket, language: string): string {
  return language === "th" ? MONTH_LABEL_TH[bucket.month] : MONTH_LABEL_EN[bucket.month];
}

interface Props {
  data: CommanderTrendData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  filter: CommanderDashboardFilter;
}

export function CommanderTrendChart({ data, isLoading, isError, onRetry, filter }: Props) {
  const { t, language } = useT();
  const router = useRouter();

  return (
    <section aria-labelledby="trend-heading">
      <CardHeader className="mb-4 px-0">
        <CardTitle id="trend-heading">{t("di.command.trendTitle")}</CardTitle>
      </CardHeader>

      <Card className="p-4">
        <p className="text-sm font-medium text-muted mb-3">{t("di.command.trendChartTitle")}</p>

        {isLoading && <div className="h-20 animate-pulse rounded bg-neutral-bg" />}
        {isError && (
          <ErrorState message={t("di.command.loadError")} onRetry={onRetry} />
        )}

        {!isLoading && !isError && data && (
          data.buckets.length === 0 ? (
            <p className="text-sm text-muted py-4">{t("di.command.trendEmpty")}</p>
          ) : (
            (() => {
              const maxCount = Math.max(...data.buckets.map((b) => b.caseCount), 1);
              const barWidth = 100 / data.buckets.length;
              const summary = data.buckets
                .map((b) => `${monthLabel(b, language)} ${b.caseCount}`)
                .join(", ");
              const ariaLabel = `${t("di.command.trendChartTitle")}: ${summary}`;

              return (
                <div role="img" aria-label={ariaLabel}>
                  <svg
                    viewBox={`0 0 100 ${CHART_HEIGHT}`}
                    preserveAspectRatio="none"
                    className="h-20 w-full"
                    aria-hidden="true"
                  >
                    {data.buckets.map((b, i) => {
                      const barH = (b.caseCount / maxCount) * (CHART_HEIGHT - 16);
                      const x = i * barWidth + BAR_GAP / 2;
                      const w = Math.max(barWidth - BAR_GAP, 1);
                      const href = commanderMonthCasesHref(filter, b.year, b.month);
                      return (
                        <g
                          key={b.monthKey}
                          role="button"
                          tabIndex={0}
                          aria-label={`${monthLabel(b, language)}: ${b.caseCount} คดี`}
                          onClick={() => router.push(href)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(href);
                            }
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            x={x}
                            y={CHART_HEIGHT - 16 - barH}
                            width={w}
                            height={Math.max(barH, 1)}
                            rx={1}
                            fill="var(--accent)"
                            opacity={0.85}
                          />
                          <text
                            x={x + w / 2}
                            y={CHART_HEIGHT - 2}
                            textAnchor="middle"
                            fontSize={5.5}
                            fill="var(--muted)"
                          >
                            {monthLabel(b, language)}
                          </text>
                          {b.caseCount > 0 && (
                            <text
                              x={x + w / 2}
                              y={CHART_HEIGHT - 18 - barH}
                              textAnchor="middle"
                              fontSize={5}
                              fill="var(--foreground)"
                            >
                              {b.caseCount}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  <p className="sr-only">{ariaLabel}</p>
                </div>
              );
            })()
          )
        )}
      </Card>
    </section>
  );
}
