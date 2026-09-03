/**
 * CommanderTrendChart (Phase 2B / 2B.2.1).
 *
 * Monthly case-count trend. CSS columns (not stretched SVG text) so all 12
 * Thai FY month labels stay readable at 100% zoom. Bars remain clickable
 * and navigate to Cases for that month's exact date range.
 */
"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/language_provider";
import { ErrorState } from "@/components/common/states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommanderTrendData } from "@/lib/drug_intelligence/drug_commander_dashboard_types";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderMonthCasesHref } from "@/lib/drug_intelligence/drug_commander_drilldown";
import { commanderMonthLabel } from "@/lib/drug_intelligence/drug_commander_trend_labels";
import type { CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";

interface Props {
  data: CommanderTrendData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  filter: CommanderDashboardFilter;
  urlState?: CommanderUrlState;
}

export function CommanderTrendChart({ data, isLoading, isError, onRetry, filter, urlState }: Props) {
  const { t, language } = useT();

  return (
    <section aria-labelledby="trend-heading">
      <CardHeader className="mb-4 px-0">
        <CardTitle id="trend-heading">{t("di.command.trendTitle")}</CardTitle>
      </CardHeader>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium text-muted">{t("di.command.trendChartTitle")}</p>

        {isLoading && <div className="h-32 animate-pulse rounded bg-neutral-bg" />}
        {isError && <ErrorState message={t("di.command.loadError")} onRetry={onRetry} />}

        {!isLoading && !isError && data && (
          data.buckets.length === 0 ? (
            <p className="py-4 text-sm text-muted">{t("di.command.trendEmpty")}</p>
          ) : (
            (() => {
              const maxCount = Math.max(...data.buckets.map((b) => b.caseCount), 1);
              const summary = data.buckets
                .map((b) => `${commanderMonthLabel(b.month, language)} ${b.caseCount}`)
                .join(", ");
              const ariaLabel = `${t("di.command.trendChartTitle")}: ${summary}`;

              return (
                <div role="img" aria-label={ariaLabel}>
                  <div className="-mx-1 overflow-x-auto px-1">
                    <div className="flex items-end gap-0.5 sm:gap-1" data-testid="commander-trend-chart">
                    {data.buckets.map((b) => {
                      const href = commanderMonthCasesHref(filter, b.year, b.month, urlState);
                      const label = commanderMonthLabel(b.month, language);
                      const barPct = (b.caseCount / maxCount) * 100;
                      const tooltipCount = t("di.command.trendTooltip").replace("{count}", String(b.caseCount));
                      return (
                        <Link
                          key={b.monthKey}
                          href={href}
                          aria-label={`${label}: ${b.caseCount} คดี`}
                          className="group relative flex min-w-0 flex-1 flex-col items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-[9rem] rounded-md border border-border bg-surface px-2 py-1 text-left text-[12px] text-foreground shadow-sm group-hover:block group-focus-visible:block">
                            <span className="block font-medium">{label}</span>
                            <span className="block text-muted">{tooltipCount}</span>
                          </span>
                          <div className="flex h-24 w-full flex-col items-center justify-end sm:h-28">
                            {b.caseCount > 0 ? (
                              <span className="mb-1 text-[11px] font-medium tabular-nums text-foreground sm:text-xs">
                                {b.caseCount}
                              </span>
                            ) : null}
                            <span
                              className="w-[70%] max-w-[2.25rem] rounded-t-sm bg-accent/90"
                              style={{ height: `${Math.max(barPct, b.caseCount > 0 ? 6 : 2)}%` }}
                            />
                          </div>
                          <span className="mt-2 w-full text-center text-[12px] leading-tight text-foreground sm:text-[13px]">
                            {label}
                          </span>
                        </Link>
                      );
                    })}
                    </div>
                  </div>
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
