/**
 * Commander Dashboard URL/filter state → Export Context V1.
 * One adapter so Dashboard, preview, and generate share the same scope.
 * Server reconstructs CommanderDashboardFilter via resolveCommanderFilter.
 */

import type { DrugExportContextV1Input, ResolvedDrugExportContextV1 } from "@/lib/drug_intelligence/drug_export_context";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import {
  resolveCommanderFilter,
  type CommanderDashboardFilter,
} from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderPeriodApiDates, type CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";
import { resolveExportPeriod } from "@/lib/drug_intelligence/drug_export_period";
import type { Language } from "@/lib/i18n/dictionary";

function optionalPositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function optionalStatus(value: string | undefined): (typeof DRUG_CASE_STATUSES)[number] | undefined {
  if (!value) return undefined;
  return (DRUG_CASE_STATUSES as readonly string[]).includes(value)
    ? (value as (typeof DRUG_CASE_STATUSES)[number])
    : undefined;
}

export function commanderUrlStateToExportContext(
  state: CommanderUrlState,
  locale: Language
): DrugExportContextV1Input {
  const dates = commanderPeriodApiDates(state);
  const period =
    dates.from && dates.to
      ? { dateFrom: dates.from, dateTo: dates.to }
      : dates.fy != null
        ? { fiscalYearBe: dates.fy }
        : undefined;
  return {
    schemaVersion: 1,
    locale,
    sourceRoute: "/drug-intelligence/command",
    period,
    organization: {
      hqId: optionalPositiveInt(state.hqId),
      regionId: optionalPositiveInt(state.regionId),
      battalionId: optionalPositiveInt(state.battalionId),
      companyId: optionalPositiveInt(state.companyId),
    },
    geo: {
      province: state.province?.trim() || undefined,
      status: optionalStatus(state.status),
    },
  };
}

export function exportContextToCommanderSearchParams(
  context: DrugExportContextV1Input | ResolvedDrugExportContextV1
): URLSearchParams {
  const params = new URLSearchParams();
  const applied = resolveExportPeriod(context.period);
  if (applied.source === "EXPLICIT_DATES" && applied.dateFrom && applied.dateTo) {
    params.set("from", applied.dateFrom);
    params.set("to", applied.dateTo);
  } else if (applied.source === "FISCAL_YEAR" && applied.appliedFiscalYearBe != null) {
    params.set("fy", String(applied.appliedFiscalYearBe));
  }
  if (context.organization?.hqId != null) params.set("hqId", String(context.organization.hqId));
  if (context.organization?.regionId != null) params.set("regionId", String(context.organization.regionId));
  if (context.organization?.battalionId != null) params.set("battalionId", String(context.organization.battalionId));
  if (context.organization?.companyId != null) params.set("companyId", String(context.organization.companyId));
  if (context.geo?.province) params.set("province", context.geo.province);
  if (context.geo?.status) params.set("status", context.geo.status);
  return params;
}

export function exportContextToCommanderFilter(
  context: DrugExportContextV1Input | ResolvedDrugExportContextV1
): CommanderDashboardFilter {
  return resolveCommanderFilter(exportContextToCommanderSearchParams(context));
}
