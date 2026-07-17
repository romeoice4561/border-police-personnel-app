/**
 * DashboardRetirementAwareness (Phase 42 — Commander Dashboard
 * Intelligence, Task 6).
 *
 * A concise dashboard awareness summary only — NOT a redesign of the full
 * retirement analytics page. Three clickable KPI cards (1/3/5-year
 * horizons) expand an inline drill-down list. Every displayed value
 * (displayRetirementDateTh, displayRetirementYearTh, displayRemainingTh,
 * displayAgeTh) comes from RetirementSummary/AgeSummary
 * (lib/intelligence/{retirement,age}) via RetirementOfficerViewModel — this
 * component performs no retirement or age math itself.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderDashboardViewModel, RetirementOfficerViewModel } from "@/lib/commander_dashboard/types";

type RetirementHorizon = "within-1-year" | "within-3-years" | "within-5-years";

const HORIZON_DAYS: Record<RetirementHorizon, number> = {
  "within-1-year": 365,
  "within-3-years": 365 * 3,
  "within-5-years": 365 * 5,
};

/** Filters the (already Intelligence-computed) candidate list to the selected horizon, sorted soonest-first. Does not recalculate remainingDays — it is read directly from RetirementSummary via RetirementOfficerViewModel. */
function candidatesWithinHorizon(candidates: RetirementOfficerViewModel[], horizon: RetirementHorizon): RetirementOfficerViewModel[] {
  const maxDays = HORIZON_DAYS[horizon];
  return candidates.filter((candidate) => candidate.remainingDays <= maxDays).sort((a, b) => a.remainingDays - b.remainingDays);
}

function RetirementRow({ officer }: { officer: RetirementOfficerViewModel }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {officer.rank ? `${officer.rank} ` : ""}
          {officer.displayName}
        </p>
        <p className="text-xs text-muted">{officer.currentUnit ?? "—"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span>
          {t("dashboard.retirementColumnAge")}: {officer.displayAgeTh ?? "ไม่มีข้อมูลเพียงพอ"}
        </span>
        <span>
          {t("dashboard.retirementColumnDate")}: {officer.displayRetirementDateTh}
        </span>
        <span>
          {t("dashboard.retirementColumnRemaining")}: {officer.displayRemainingTh}
        </span>
        {officer.displayPromotionStatusTh ? <Badge tone="accent">{officer.displayPromotionStatusTh}</Badge> : null}
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link href={officer.href}>{t("dashboard.priorityColumnAction")}</Link>
      </Button>
    </div>
  );
}

export function DashboardRetirementAwareness({ retirement }: { retirement: CommanderDashboardViewModel["retirement"] }) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<RetirementHorizon | null>(null);

  const activeCandidates = activeTab ? candidatesWithinHorizon(retirement.candidates, activeTab) : null;

  return (
    <section aria-label={t("dashboard.retirementTitle")} className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t("dashboard.retirementTitle")}</h2>
      <KpiGrid className="lg:grid-cols-3">
        <KpiCard
          label={t("dashboard.retirementWithinOneYear")}
          value={retirement.withinOneYear.toLocaleString()}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={retirement.withinOneYear > 0 ? "warning" : "neutral"}
          onClick={() => setActiveTab((current) => (current === "within-1-year" ? null : "within-1-year"))}
        />
        <KpiCard
          label={t("dashboard.retirementWithinThreeYears")}
          value={retirement.withinThreeYears.toLocaleString()}
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={() => setActiveTab((current) => (current === "within-3-years" ? null : "within-3-years"))}
        />
        <KpiCard
          label={t("dashboard.retirementWithinFiveYears")}
          value={retirement.withinFiveYears.toLocaleString()}
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={() => setActiveTab((current) => (current === "within-5-years" ? null : "within-5-years"))}
        />
      </KpiGrid>

      {activeTab ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {activeTab === "within-1-year"
                ? t("dashboard.retirementWithinOneYear")
                : activeTab === "within-3-years"
                  ? t("dashboard.retirementWithinThreeYears")
                  : t("dashboard.retirementWithinFiveYears")}
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`/commander-search?retirement=${activeTab}`}>{t("dashboard.priorityViewAll")}</Link>
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {activeCandidates && activeCandidates.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">{t("dashboard.retirementEmpty")}</p>
            ) : (
              <div>{activeCandidates?.map((officer) => <RetirementRow key={officer.officerId} officer={officer} />)}</div>
            )}
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}
