/**
 * CommanderAreasSection (Phase 2D).
 *
 * Evidence panel for provinces to follow — counts, share, previous-period
 * comparison, Map + Cases drill-down. Never labels a province as high-risk.
 */
"use client";

import Link from "next/link";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderAreasData, CommanderPreviousAreaRow } from "@/lib/drug_intelligence/drug_commander_dashboard_types";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderCasesHref, commanderMapHref } from "@/lib/drug_intelligence/drug_commander_drilldown";
import type { CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";
import {
  commanderSharePercent,
  compareCommanderMetric,
  formatCommanderDeltaCopy,
} from "@/lib/drug_intelligence/drug_commander_comparison";
import { CommanderComparisonText } from "@/components/drug_intelligence/drug_commander_comparison_text";

interface Props {
  data: CommanderAreasData | undefined;
  previousAreas?: CommanderPreviousAreaRow[];
  totalCases?: number;
  comparisonLabel?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  filter: CommanderDashboardFilter;
  urlState?: CommanderUrlState;
}

export function CommanderAreasSection({
  data,
  previousAreas,
  totalCases,
  comparisonLabel,
  isLoading,
  isError,
  onRetry,
  filter,
  urlState,
}: Props) {
  const { t, language } = useT();
  const maxCount = data && data.rows.length > 0 ? data.rows[0].caseCount : 1;
  const previousByProvince = new Map((previousAreas ?? []).map((row) => [row.province, row.caseCount]));

  return (
    <section aria-labelledby="areas-heading" data-testid="commander-areas-follow">
      <CardHeader className="mb-1 px-0">
        <CardTitle id="areas-heading">{t("di.command.areasFollowTitle")}</CardTitle>
      </CardHeader>
      <p className="mb-4 text-xs text-muted">{t("di.command.areasFollowNote")}</p>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message={t("di.command.loadError")} onRetry={onRetry} />
      )}

      {!isLoading && !isError && data && (
        data.rows.length === 0 ? (
          <p className="text-sm text-muted py-4">{t("di.command.areasEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {data.rows.slice(0, 5).map((row, idx) => {
              const share = commanderSharePercent(row.caseCount, totalCases ?? 0);
              const delta = compareCommanderMetric(row.caseCount, previousByProvince.get(row.province) ?? 0);
              const copy = formatCommanderDeltaCopy(delta, t("di.command.unitsColCases"), language);
              return (
                <article
                  key={row.province}
                  className="rounded-lg border border-border px-3 py-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-5 shrink-0 text-xs text-muted">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-medium">{row.province}</h3>
                        <span className="text-sm font-semibold tabular-nums">
                          {row.caseCount.toLocaleString("th-TH")} {t("di.command.areasColCases")}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-neutral-bg mt-1">
                        <div
                          className="h-1.5 rounded-full bg-accent"
                          style={{ width: `${Math.round((row.caseCount / maxCount) * 100)}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {idx === 0
                          ? t("di.command.areasHighInPeriod")
                          : t("di.command.areasInPeriod")}
                        {share !== null ? ` · ${share.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%` : ""}
                      </p>
                      {previousAreas && (
                        <CommanderComparisonText
                          copy={copy}
                          previousLabel={comparisonLabel ?? t("di.command.comparisonPrevious")}
                        />
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <Link
                          href={commanderMapHref(filter, { province: row.province }, urlState)}
                          className="text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                        >
                          {t("di.command.viewMap")}
                        </Link>
                        <Link
                          href={commanderCasesHref(filter, { province: row.province }, urlState)}
                          className="text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                        >
                          {t("di.command.viewCases")}
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}
