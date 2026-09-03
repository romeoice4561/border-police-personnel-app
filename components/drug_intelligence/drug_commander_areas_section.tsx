/**
 * CommanderAreasSection (Phase 2B).
 *
 * Top-10 provinces by case count.
 * Bar visualization for quick comparison.
 */
"use client";

import Link from "next/link";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderAreasData } from "@/lib/drug_intelligence/drug_commander_dashboard_types";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderMapHref } from "@/lib/drug_intelligence/drug_commander_drilldown";

interface Props {
  data: CommanderAreasData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  filter: CommanderDashboardFilter;
}

export function CommanderAreasSection({ data, isLoading, isError, onRetry, filter }: Props) {
  const { t } = useT();

  const maxCount = data && data.rows.length > 0 ? data.rows[0].caseCount : 1;

  return (
    <section aria-labelledby="areas-heading">
      <CardHeader className="mb-4 px-0">
        <CardTitle id="areas-heading">{t("di.command.areasTitle")}</CardTitle>
      </CardHeader>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message={t("di.command.loadError")} onRetry={onRetry} />
      )}

      {!isLoading && !isError && data && (
        data.rows.length === 0 ? (
          <p className="text-sm text-muted py-4">{t("di.command.areasEmpty")}</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto] text-xs font-medium text-muted border-b border-border pb-2 px-1">
              <span>{t("di.command.areasColProvince")}</span>
              <span className="text-right">{t("di.command.areasColCases")}</span>
            </div>
            {data.rows.slice(0, 5).map((row, idx) => (
              <Link
                key={row.province}
                href={commanderMapHref(filter, { province: row.province })}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md px-1 py-1 hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted w-5 shrink-0">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{row.province}</div>
                    <div className="h-1.5 w-full rounded-full bg-neutral-bg mt-1">
                      <div
                        className="h-1.5 rounded-full bg-accent"
                        style={{ width: `${Math.round((row.caseCount / maxCount) * 100)}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{row.caseCount.toLocaleString("th-TH")}</span>
              </Link>
            ))}
          </div>
        )
      )}
    </section>
  );
}
