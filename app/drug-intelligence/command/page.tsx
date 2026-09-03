/**
 * Commander Intelligence Dashboard (Phase 2B / 2C / 2D).
 *
 * Decision-support workspace. The operational landing at
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
import { CommanderComparisonText } from "@/components/drug_intelligence/drug_commander_comparison_text";
import { CommanderSituationSection } from "@/components/drug_intelligence/drug_commander_situation_section";
import { CommanderSeizureSection } from "@/components/drug_intelligence/drug_commander_seizure_section";
import { CommanderTrendChart } from "@/components/drug_intelligence/drug_commander_trend_chart";
import { CommanderAreasSection } from "@/components/drug_intelligence/drug_commander_areas_section";
import { CommanderUnitsSection } from "@/components/drug_intelligence/drug_commander_units_section";
import { CommanderSignalsSection } from "@/components/drug_intelligence/drug_commander_signals_section";
import { CommanderActionsSection } from "@/components/drug_intelligence/drug_commander_actions_section";
import { CommanderReadinessSection } from "@/components/drug_intelligence/drug_commander_readiness_section";
import {
  useCommanderOverview,
  useCommanderSeizures,
  useCommanderTrend,
  useCommanderAreas,
  useCommanderUnits,
  useCommanderSignals,
  useCommanderDecision,
} from "@/lib/drug_intelligence/drug_commander_hooks";
import type { CommanderQueryParams } from "@/lib/drug_intelligence/drug_commander_client";
import { resolveCommanderFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import {
  commanderPeriodApiDates,
  commanderPeriodQueryEnabled,
  type CommanderUrlState,
} from "@/lib/drug_intelligence/drug_commander_scope";
import {
  commanderAlertsHref,
  commanderCasesHref,
  commanderDuplicatesHref,
  commanderMapHref,
  commanderPersonsHref,
} from "@/lib/drug_intelligence/drug_commander_drilldown";
import {
  buildCommanderSituationObservations,
  compareCommanderMetric,
  formatCommanderDeltaCopy,
} from "@/lib/drug_intelligence/drug_commander_comparison";

export default function CommanderDashboardPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CommanderDashboardContent />
    </Suspense>
  );
}

function CommanderDashboardContent() {
  const { user } = useAuth();
  const { t, language } = useT();
  const searchParams = useSearchParams();
  const actorId = user?.id ?? null;
  const filter = resolveCommanderFilter(searchParams);

  const urlState: CommanderUrlState = {
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

  const periodEnabled = commanderPeriodQueryEnabled(urlState);
  const apiDates = commanderPeriodApiDates(urlState);

  const queryParams: Omit<CommanderQueryParams, "actorId"> = {
    fy: apiDates.fy,
    from: apiDates.from,
    to: apiDates.to,
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

  const overview = useCommanderOverview(actorId, cleanParams, periodEnabled);
  const seizures = useCommanderSeizures(actorId, cleanParams, periodEnabled);
  const trend = useCommanderTrend(actorId, cleanParams, periodEnabled);
  const areas = useCommanderAreas(actorId, cleanParams, periodEnabled);
  const units = useCommanderUnits(actorId, cleanParams, periodEnabled);
  const signals = useCommanderSignals(actorId);
  const decision = useCommanderDecision(actorId, cleanParams, periodEnabled);

  const overviewData = periodEnabled ? overview.data : undefined;
  const decisionData = periodEnabled ? decision.data : undefined;
  const displayFiscalYearTh = overviewData?.filter.displayFiscalYearTh ?? filter.displayFiscalYearTh;
  const periodLoading = periodEnabled && (overview.isPending || overview.isFetching);
  const completenessCount = overviewData?.casesWithoutArrestedRoleCount ?? 0;
  const alertsCount = overviewData?.newAlertsCount ?? signals.data?.totalNewAlerts;
  const queueLoading = periodEnabled ? overview.isFetching : signals.isFetching;
  const comparisonLabel = decisionData
    ? (language === "en" ? decisionData.comparisonPeriod.labelEn : decisionData.comparisonPeriod.labelTh)
    : t("di.command.comparisonPrevious");

  const caseDelta = overviewData
    ? compareCommanderMetric(overviewData.caseCount, decisionData?.previousCaseCount ?? 0)
    : null;
  const arrestedDelta = overviewData
    ? compareCommanderMetric(overviewData.arrestedPersonCount, decisionData?.previousArrestedPersonCount ?? 0)
    : null;

  const topCountSeizure = (seizures.data?.items ?? [])
    .filter((item) => item.measurementKind === "COUNT" && (item.totalQuantity ?? 0) > 0)
    .slice()
    .sort((a, b) => (b.totalQuantity ?? 0) - (a.totalQuantity ?? 0))[0];

  const situationRows = periodEnabled && overviewData && caseDelta
    ? buildCommanderSituationObservations({
        caseCount: overviewData.caseCount,
        caseDelta,
        topProvince: areas.data?.rows[0],
        topCountSeizure: topCountSeizure
          ? {
              labelTh: topCountSeizure.labelTh,
              totalQuantity: topCountSeizure.totalQuantity ?? 0,
              displayUnit: topCountSeizure.displayUnit,
            }
          : undefined,
        newAlertsCount: alertsCount ?? 0,
        casesWithoutArrestedRoleCount: completenessCount,
      }).map((obs) => ({
        ...obs,
        actionHref:
          obs.href === "map"
            ? commanderMapHref(filter, obs.hrefProvince ? { province: obs.hrefProvince } : undefined, urlState)
            : obs.href === "alerts"
              ? commanderAlertsHref({ status: "NEW" }, filter, urlState)
              : obs.href === "persons"
                ? commanderPersonsHref(filter, urlState)
                : obs.href === "duplicates"
                  ? commanderDuplicatesHref(filter, urlState)
                  : commanderCasesHref(filter, undefined, urlState),
      }))
    : [];

  const readinessTotal = decisionData?.readiness.totalCases ?? overviewData?.caseCount ?? 0;

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-8 overflow-x-hidden">
      <PageHeader
        title={t("di.command.title")}
        description={t("di.command.description")}
      />

      <CommanderFilterBar
        filterState={urlState}
        displayFiscalYearTh={displayFiscalYearTh}
      />

      {periodEnabled ? (
        <CommanderSituationSection observations={situationRows} />
      ) : (
        <p className="text-sm text-muted">{t("di.command.periodBlocked")}</p>
      )}

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="mb-2 text-lg font-semibold">
          {t("di.command.overviewTitle")}
        </h2>
        {decisionData && (
          <p className="mb-4 text-xs text-muted" data-testid="commander-comparison-scope">
            {t("di.command.comparisonScope")}: {comparisonLabel}
          </p>
        )}
        {periodEnabled && overview.isError ? (
          <ErrorState
            message={t("di.command.loadError")}
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CommanderKpiCard
              label={t("di.command.kpiCases")}
              value={periodEnabled ? (overviewData?.caseCount ?? 0) : "—"}
              description={t("di.command.kpiCasesDesc")}
              subtitle={t("di.command.kpiPeriodBadge")}
              icon={FileSpreadsheet}
              href={periodEnabled ? commanderCasesHref(filter, undefined, urlState) : undefined}
              loading={periodLoading}
              comparison={
                periodEnabled && caseDelta && decisionData ? (
                  <CommanderComparisonText
                    copy={formatCommanderDeltaCopy(caseDelta, t("di.command.unitsColCases"), language)}
                    previousLabel={comparisonLabel}
                  />
                ) : undefined
              }
            />
            <CommanderKpiCard
              label={t("di.command.kpiArrested")}
              value={periodEnabled ? (overviewData?.arrestedPersonCount ?? 0) : "—"}
              description={t("di.command.kpiArrestedDesc")}
              subtitle={t("di.command.kpiPeriodBadge")}
              footnote={
                periodEnabled && completenessCount > 0
                  ? t("di.command.kpiArrestedCompleteness").replace("{count}", String(completenessCount))
                  : undefined
              }
              icon={Users}
              href={periodEnabled ? commanderPersonsHref(filter, urlState) : undefined}
              loading={periodLoading}
              comparison={
                periodEnabled && arrestedDelta && decisionData ? (
                  <CommanderComparisonText
                    copy={formatCommanderDeltaCopy(arrestedDelta, t("di.command.unitsColPersons"), language)}
                    previousLabel={comparisonLabel}
                  />
                ) : undefined
              }
            />
            <CommanderKpiCard
              label={t("di.command.kpiAlerts")}
              value={alertsCount ?? 0}
              description={t("di.command.kpiAlertsDesc")}
              subtitle={t("di.command.kpiQueueBadge")}
              footnote={t("di.command.kpiQueueHint")}
              icon={BellRing}
              href={commanderAlertsHref({ status: "NEW" }, filter, urlState)}
              loading={queueLoading && alertsCount === undefined}
            />
            <CommanderKpiCard
              label={t("di.command.kpiDuplicates")}
              value={overviewData?.pendingDuplicatesCount ?? (periodEnabled ? 0 : "—")}
              description={t("di.command.kpiDuplicatesDesc")}
              subtitle={t("di.command.kpiQueueBadge")}
              footnote={t("di.command.kpiQueueHint")}
              icon={ClipboardCheck}
              href={commanderDuplicatesHref(filter, urlState)}
              loading={periodEnabled && periodLoading}
            />
          </div>
        )}
      </section>

      <div>
        {periodEnabled ? (
          <CommanderSeizureSection
            data={seizures.data}
            previousItems={decisionData?.previousSeizures}
            comparisonLabel={comparisonLabel}
            isLoading={seizures.isPending || seizures.isFetching}
            isError={seizures.isError}
            onRetry={() => void seizures.refetch()}
            filter={filter}
            urlState={urlState}
          />
        ) : (
          <p className="text-sm text-muted">{t("di.command.periodBlocked")}</p>
        )}
      </div>

      <div>
        {periodEnabled ? (
          <CommanderTrendChart
            data={trend.data}
            isLoading={trend.isPending || trend.isFetching}
            isError={trend.isError}
            onRetry={() => void trend.refetch()}
            filter={filter}
            urlState={urlState}
          />
        ) : (
          <p className="text-sm text-muted">{t("di.command.periodBlocked")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {periodEnabled ? (
          <CommanderAreasSection
            data={areas.data}
            previousAreas={decisionData?.previousAreas}
            totalCases={overviewData?.caseCount}
            comparisonLabel={comparisonLabel}
            isLoading={areas.isPending || areas.isFetching}
            isError={areas.isError}
            onRetry={() => void areas.refetch()}
            filter={filter}
            urlState={urlState}
          />
        ) : (
          <p className="text-sm text-muted">{t("di.command.periodBlocked")}</p>
        )}
        {periodEnabled ? (
          <CommanderUnitsSection
            data={units.data}
            previousUnits={decisionData?.previousUnits}
            isLoading={units.isPending || units.isFetching}
            isError={units.isError}
            onRetry={() => void units.refetch()}
            filter={filter}
            urlState={urlState}
          />
        ) : (
          <p className="text-sm text-muted">{t("di.command.periodBlocked")}</p>
        )}
      </div>

      <CommanderSignalsSection
        data={signals.data}
        isLoading={signals.isLoading}
        isError={signals.isError}
        onRetry={() => void signals.refetch()}
        filter={filter}
        urlState={urlState}
      />

      <CommanderActionsSection
        items={[
          {
            id: "new-alerts",
            href: commanderAlertsHref({ status: "NEW" }, filter, urlState),
            label: t("di.command.actionNewSignals"),
            why: t("di.command.actionNewSignalsWhy"),
            actionLabel: t("di.command.situationOpenSignals"),
            count: alertsCount,
            queueScope: true,
          },
          {
            id: "duplicates",
            href: commanderDuplicatesHref(filter, urlState),
            label: t("di.command.actionDuplicates"),
            why: t("di.command.actionDuplicatesWhy"),
            actionLabel: t("di.command.situationOpenDuplicates"),
            count: overviewData?.pendingDuplicatesCount,
            queueScope: true,
          },
          {
            id: "missing-arrested",
            href: commanderCasesHref(filter, undefined, urlState),
            label: t("di.command.actionMissingArrested"),
            why: t("di.command.actionMissingArrestedWhy"),
            actionLabel: t("di.command.situationOpenCases"),
            count: completenessCount,
          },
          {
            id: "unassigned-unit",
            href: commanderCasesHref(filter, undefined, urlState),
            label: t("di.command.actionUnassignedUnit"),
            why: t("di.command.actionUnassignedUnitWhy"),
            actionLabel: t("di.command.situationOpenCases"),
            count: units.data?.unassignedCaseCount,
          },
          {
            id: "missing-coords",
            href: commanderMapHref(filter, undefined, urlState),
            label: t("di.command.actionMissingCoords"),
            why: t("di.command.actionMissingCoordsWhy"),
            actionLabel: t("di.command.situationOpenMap"),
            count: decisionData?.readiness.casesMissingCoordinates,
          },
        ]}
      />

      {periodEnabled && (
        <CommanderReadinessSection
          totalCases={readinessTotal}
          rows={[
            {
              id: "missing-unit",
              label: t("di.command.readinessMissingUnit"),
              count: decisionData?.readiness.casesMissingReportingUnit ?? units.data?.unassignedCaseCount ?? 0,
              href: commanderCasesHref(filter, undefined, urlState),
            },
            {
              id: "missing-coords",
              label: t("di.command.readinessMissingCoords"),
              count: decisionData?.readiness.casesMissingCoordinates ?? 0,
              href: commanderMapHref(filter, undefined, urlState),
            },
            {
              id: "missing-arrested",
              label: t("di.command.readinessMissingArrested"),
              count: completenessCount,
              href: commanderCasesHref(filter, undefined, urlState),
            },
            {
              id: "incomplete-seizure",
              label: t("di.command.readinessIncompleteSeizure"),
              count: decisionData?.readiness.casesWithIncompleteSeizureCategory ?? 0,
              href: commanderCasesHref(filter, undefined, urlState),
            },
          ]}
        />
      )}
    </div>
  );
}
