"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlagBadge, PriorityBadge, PromotionStatusBadge, RetirementStatusBadge } from "@/components/intelligence/intelligence_badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommanderDashboard, OfficerFlagCode, OfficerPriority } from "@/lib/intelligence";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/ui/cn";

type FilterKey = "ALL" | OfficerFlagCode | `PRIORITY_${Uppercase<OfficerPriority>}`;

const FILTERS: Array<{ key: FilterKey; labelKey: TranslationKey }> = [
  { key: "ALL", labelKey: "dashboard.filterAll" },
  { key: "PROMOTION_READY", labelKey: "dashboard.filterPromotionReady" },
  { key: "RETIRING_SOON", labelKey: "dashboard.filterRetiringSoon" },
  { key: "DOCUMENTS_MISSING", labelKey: "dashboard.filterDocumentsMissing" },
  { key: "MISSING_OFFICIAL_PORTRAIT", labelKey: "dashboard.filterMissingPortrait" },
  { key: "NEEDS_TRAINING", labelKey: "dashboard.filterNeedsTraining" },
  { key: "PRIORITY_HIGH", labelKey: "dashboard.filterHighPriority" },
  { key: "PRIORITY_CRITICAL", labelKey: "dashboard.filterCritical" },
];

function matchesFilter(card: CommanderDashboard["officers"][number], filter: FilterKey): boolean {
  if (filter === "ALL") return true;
  if (filter.startsWith("PRIORITY_")) return card.priority === filter.replace("PRIORITY_", "").toLowerCase();
  return card.flags.some((flag) => flag.code === filter);
}

export function CommanderDashboardPanel({ dashboard }: { dashboard: CommanderDashboard }) {
  const { t } = useT();
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const filtered = useMemo(
    () => dashboard.officers.filter((card) => matchesFilter(card, filter)),
    [dashboard.officers, filter]
  );

  return (
    <div className="space-y-5">
      {/* Phase 48A: the KPI row moved to the page level (DashboardKpiSection,
          built on the shared KpiCard/KpiGrid) as part of the enterprise
          workspace header/KPI composition — this panel now owns only the
          filter + officer-intelligence-list body. */}
      <section className="space-y-3" aria-label={t("dashboard.filtersAria")}>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                filter === item.key
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-surface text-foreground hover:bg-neutral-bg"
              )}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-label={t("dashboard.officerListAria")}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{t("dashboard.officerIntelligence")}</h2>
          <p className="text-sm text-muted">{filtered.length.toLocaleString()} {t("dashboard.officersCount")}</p>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-muted">{t("dashboard.noOfficersMatch")}</p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.slice(0, 12).map((card) => (
              <Card key={card.officerId} className="transition-colors hover:border-accent">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">
                      <Link href={`/officers/${encodeURIComponent(card.officerId)}`} className="text-accent hover:underline">
                        {card.displayName}
                      </Link>
                    </CardTitle>
                    <p className="text-xs text-muted">{card.officerId}</p>
                  </div>
                  <PriorityBadge priority={card.priority} />
                </CardHeader>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <PromotionStatusBadge status={card.promotionStatus} />
                    <RetirementStatusBadge status={card.retirementStatus} />
                  </div>
                  {card.flags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {card.flags.slice(0, 4).map((flag) => (
                        <FlagBadge key={flag.code} flag={flag} />
                      ))}
                    </div>
                  ) : null}
                  <p className="line-clamp-2 text-sm text-muted">
                    {card.recommendations[0] ?? "No immediate recommendations."}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
