/**
 * CommanderSignalsSection (Phase 2D).
 *
 * Existing alert data only. Cautious wording — shared identifiers are not
 * treated as proven criminal association.
 */
"use client";

import Link from "next/link";
import { Users, Phone, CreditCard, Smartphone, Car } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import type { CommanderSignalsData } from "@/lib/drug_intelligence/drug_commander_dashboard_types";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import {
  commanderAlertsHref,
  commanderSearchHref,
  commanderSignalNetworkHref,
} from "@/lib/drug_intelligence/drug_commander_drilldown";
import type { CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";
import type { TranslationKey } from "@/lib/i18n/dictionary";

interface Props {
  data: CommanderSignalsData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  filter: CommanderDashboardFilter;
  urlState?: CommanderUrlState;
}

const SIGNAL_TYPE_META: Record<string, { icon: typeof Users; labelKey: TranslationKey }> = {
  REPEAT_PERSON: { icon: Users, labelKey: "di.command.signalRepeatPerson" },
  REPEAT_PHONE: { icon: Phone, labelKey: "di.command.signalRepeatPhone" },
  REPEAT_SIM: { icon: CreditCard, labelKey: "di.command.signalRepeatSim" },
  REPEAT_DEVICE: { icon: Smartphone, labelKey: "di.command.signalRepeatDevice" },
  REPEAT_VEHICLE: { icon: Car, labelKey: "di.command.signalRepeatVehicle" },
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "bg-serious/10 text-serious border-serious/20",
  NOTICE: "bg-warning/10 text-warning border-warning/20",
  INFO: "bg-accent/10 text-accent border-accent/20",
};

export function CommanderSignalsSection({ data, isLoading, isError, onRetry, filter, urlState }: Props) {
  const { t } = useT();

  return (
    <section aria-labelledby="signals-heading" data-testid="commander-signals-review">
      <CardHeader className="mb-1 px-0">
        <CardTitle id="signals-heading">{t("di.command.signalsReviewTitle")}</CardTitle>
      </CardHeader>
      <p className="text-xs text-muted mb-2">{t("di.command.signalsQueueBadge")}</p>
      <p className="text-xs text-muted mb-4">{t("di.command.signalsNote")}</p>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message={t("di.command.loadError")} onRetry={onRetry} />
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.signalCounts.map((sc) => {
              const meta = SIGNAL_TYPE_META[sc.alertType];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <Link
                  key={sc.alertType}
                  href={commanderAlertsHref({ status: "NEW", alertType: sc.alertType }, filter, urlState)}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                <Card className="flex items-center gap-3 p-3 transition-colors hover:border-accent/50 hover:bg-neutral-bg">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-lg font-bold tabular-nums">{sc.count.toLocaleString("th-TH")}</span>
                    <span className="block truncate text-xs text-muted">{t(meta.labelKey)}</span>
                  </div>
                </Card>
                </Link>
              );
            })}
          </div>

          {data.topSignals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted mb-3">{t("di.command.signalTopTitle")}</h3>
              <div className="space-y-2">
                {data.topSignals.slice(0, 5).map((signal) => (
                  <div
                    key={signal.id}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm",
                      SEVERITY_COLORS[signal.severity] ?? "bg-neutral-bg border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{signal.title}</div>
                        <div className="mt-0.5 text-xs leading-snug break-words text-muted">{t("di.command.signalEvidenceCaution")}</div>
                        {signal.occurrenceCount > 1 && (
                          <div className="mt-1 text-xs text-muted tabular-nums">
                            {t("di.command.signalRelatedCases").replace("{count}", String(signal.occurrenceCount))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-medium">
                        {t("di.command.signalStatusNew")}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <Link
                        href={commanderAlertsHref({ status: "NEW", alertType: signal.alertType }, filter, urlState)}
                        className="text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                      >
                        {t("di.command.signalViewDetail")}
                      </Link>
                      <Link
                        href={commanderSignalNetworkHref(signal.entityType, signal.entityId, filter, urlState)}
                        className="text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                      >
                        {t("di.command.openNetwork")}
                      </Link>
                      <Link
                        href={commanderSearchHref(filter, urlState)}
                        className="text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                      >
                        {t("di.command.openSearch")}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Link
                  href={commanderAlertsHref({ status: "NEW" }, filter, urlState)}
                  className="text-sm text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                >
                  {t("di.command.signalViewAll")} →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
