/**
 * CommanderSeizureSection (Phase 2B).
 *
 * Displays drug seizure aggregates per category.
 * One card per drug category that has data.
 * COUNT and MASS are shown as separate lines per the seizure rule:
 * NEVER add COUNT + MASS together.
 */
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderSeizuresData } from "@/lib/drug_intelligence/drug_commander_dashboard_types";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderMapHref } from "@/lib/drug_intelligence/drug_commander_drilldown";

interface Props {
  data: CommanderSeizuresData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  filter: CommanderDashboardFilter;
}

export function CommanderSeizureSection({ data, isLoading, isError, onRetry, filter }: Props) {
  const { t } = useT();

  return (
    <section aria-labelledby="seizures-heading">
      <CardHeader className="mb-4 px-0">
        <CardTitle id="seizures-heading">{t("di.command.seizuresTitle")}</CardTitle>
      </CardHeader>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message={t("di.command.loadError")} onRetry={onRetry} />
      )}

      {!isLoading && !isError && data && (
        data.items.length === 0 ? (
          <p className="text-sm text-muted py-4">{t("di.command.seizuresEmpty")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((item) => (
              <Link
                key={`${item.drugCategory}::${item.measurementKind}`}
                href={commanderMapHref(filter, { drugCategory: item.drugCategory })}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Card className="p-4 transition-colors hover:border-accent/50 hover:bg-neutral-bg">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      {item.labelTh}
                    </span>
                    {item.measurementKind === "COUNT" && item.totalQuantity !== null && (
                      <span className="text-xl font-bold tabular-nums text-foreground">
                        {item.totalQuantity.toLocaleString("th-TH")}
                        <span className="ml-1 text-sm font-normal text-muted">
                          {item.displayUnit ?? "เม็ด"}
                        </span>
                      </span>
                    )}
                    {item.measurementKind === "MASS" && item.totalWeightKg !== null && (
                      <span className="text-xl font-bold tabular-nums text-foreground">
                        {item.totalWeightKg.toLocaleString("th-TH", { maximumFractionDigits: 3 })}
                        <span className="ml-1 text-sm font-normal text-muted">กก.</span>
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )
      )}
    </section>
  );
}
