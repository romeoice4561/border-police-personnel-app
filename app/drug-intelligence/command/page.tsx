/**
 * Commander Intelligence Dashboard (Phase 2B).
 *
 * Dedicated decision-support workspace. The operational landing at
 * /drug-intelligence is unchanged.
 */
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, Users, BellRing, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { CommanderFilterBar } from "@/components/drug_intelligence/drug_commander_filter_bar";
import { CommanderKpiCard } from "@/components/drug_intelligence/drug_commander_kpi_card";
import { CommanderSeizureSection } from "@/components/drug_intelligence/drug_commander_seizure_section";
import { CommanderTrendChart } from "@/components/drug_intelligence/drug_commander_trend_chart";
import { CommanderAreasSection } from "@/components/drug_intelligence/drug_commander_areas_section";
import { CommanderUnitsSection } from "@/components/drug_intelligence/drug_commander_units_section";
import { CommanderSignalsSection } from "@/components/drug_intelligence/drug_commander_signals_section";
import { CommanderActionsSection } from "@/components/drug_intelligence/drug_commander_actions_section";
import {
  useCommanderOverview,
  useCommanderSeizures,
  useCommanderTrend,
  useCommanderAreas,
  useCommanderUnits,
  useCommanderSignals,
} from "@/lib/drug_intelligence/drug_commander_hooks";
import type { CommanderQueryParams } from "@/lib/drug_intelligence/drug_commander_client";
import { resolveCommanderFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import {
  commanderAlertsHref,
  commanderCasesHref,
  commanderDuplicatesHref,
  commanderPersonsHref,
} from "@/lib/drug_intelligence/drug_commander_drilldown";

export default function CommanderDashboardPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CommanderDashboardContent />
    </Suspense>
  );
}

function CommanderDashboardContent() {
  const { user } = useAuth();
  const { t } = useT();
  const searchParams = useSearchParams();
  const actorId = user?.id ?? null;
  const filter = resolveCommanderFilter(searchParams);

  const queryParams: Omit<CommanderQueryParams, "actorId"> = {
    fy: searchParams.get("fy") ? Number(searchParams.get("fy")) : undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    hqId: searchParams.get("hqId") ? Number(searchParams.get("hqId")) : undefined,
    regionId: searchParams.get("regionId") ? Number(searchParams.get("regionId")) : undefined,
    battalionId: searchParams.get("battalionId") ? Number(searchParams.get("battalionId")) : undefined,
    companyId: searchParams.get("companyId") ? Number(searchParams.get("companyId")) : undefined,
    province: searchParams.get("province") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };

  const cleanParams = Object.fromEntries(
    Object.entries(queryParams).filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(v))
  ) as Omit<CommanderQueryParams, "actorId">;

  const overview = useCommanderOverview(actorId, cleanParams);
  const seizures = useCommanderSeizures(actorId, cleanParams);
  const trend = useCommanderTrend(actorId, cleanParams);
  const areas = useCommanderAreas(actorId, cleanParams);
  const units = useCommanderUnits(actorId, cleanParams);
  const signals = useCommanderSignals(actorId);

  const filterState = {
    fy: searchParams.get("fy") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    hqId: searchParams.get("hqId") ?? undefined,
    regionId: searchParams.get("regionId") ?? undefined,
    battalionId: searchParams.get("battalionId") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
    province: searchParams.get("province") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };

  const overviewData = overview.data;
  const displayFiscalYearTh = overviewData?.filter.displayFiscalYearTh ?? filter.displayFiscalYearTh;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("di.command.title")}
        description={t("di.command.description")}
      />

      <CommanderFilterBar
        filterState={filterState}
        displayFiscalYearTh={displayFiscalYearTh}
      />

      <section className="order-1" aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="mb-4 text-lg font-semibold">
          {t("di.command.overviewTitle")}
        </h2>
        {overview.isError ? (
          <ErrorState
            message={t("di.command.loadError")}
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CommanderKpiCard
              label={t("di.command.kpiCases")}
              value={overviewData?.caseCount ?? 0}
              description={t("di.command.kpiCasesDesc")}
              subtitle={displayFiscalYearTh}
              icon={FileSpreadsheet}
              href={commanderCasesHref(filter)}
              loading={overview.isLoading}
            />
            <CommanderKpiCard
              label={t("di.command.kpiArrested")}
              value={overviewData?.arrestedPersonCount ?? 0}
              description={t("di.command.kpiArrestedDesc")}
              icon={Users}
              href={commanderPersonsHref(filter)}
              loading={overview.isLoading}
            />
            <CommanderKpiCard
              label={t("di.command.kpiAlerts")}
              value={overviewData?.newAlertsCount ?? 0}
              description={t("di.command.kpiAlertsDesc")}
              icon={BellRing}
              href={commanderAlertsHref({ status: "NEW" }, filter)}
              loading={overview.isLoading}
            />
            <CommanderKpiCard
              label={t("di.command.kpiDuplicates")}
              value={overviewData?.pendingDuplicatesCount ?? 0}
              description={t("di.command.kpiDuplicatesDesc")}
              icon={ClipboardCheck}
              href={commanderDuplicatesHref(filter)}
              loading={overview.isLoading}
            />
          </div>
        )}
      </section>

      <div className="order-7 md:order-2">
        <CommanderSeizureSection
          data={seizures.data}
          isLoading={seizures.isLoading}
          isError={seizures.isError}
          onRetry={() => void seizures.refetch()}
          filter={filter}
        />
      </div>

      <div className="order-4 md:order-3">
        <CommanderTrendChart
          data={trend.data}
          isLoading={trend.isLoading}
          isError={trend.isError}
          onRetry={() => void trend.refetch()}
          filter={filter}
        />
      </div>

      <div className="order-5 grid grid-cols-1 gap-8 md:order-4 lg:grid-cols-2">
        <CommanderAreasSection
          data={areas.data}
          isLoading={areas.isLoading}
          isError={areas.isError}
          onRetry={() => void areas.refetch()}
          filter={filter}
        />
        <div className="order-6 md:order-none">
          <CommanderUnitsSection
            data={units.data}
            isLoading={units.isLoading}
            isError={units.isError}
            onRetry={() => void units.refetch()}
            filter={filter}
          />
        </div>
      </div>

      <div className="order-2 md:order-6">
        <CommanderSignalsSection
          data={signals.data}
          isLoading={signals.isLoading}
          isError={signals.isError}
          onRetry={() => void signals.refetch()}
          filter={filter}
        />
      </div>

      <div className="order-3 md:order-7">
        <CommanderActionsSection
          pendingDuplicates={overviewData?.pendingDuplicatesCount}
          newAlerts={overviewData?.newAlertsCount}
          filter={filter}
        />
      </div>
    </div>
  );
}
