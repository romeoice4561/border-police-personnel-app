/**
 * Commander Dashboard drill-down URLs (Phase 2B).
 *
 * Only emit query keys that destination pages/APIs actually apply.
 * Pure — no I/O, no React.
 */

import { toCommanderIsoDate, type CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";

function setIf(params: URLSearchParams, key: string, value: string | number | undefined): void {
  if (value === undefined || value === "") return;
  params.set(key, String(value));
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function reportingOrgParams(filter: CommanderDashboardFilter): Record<string, number | undefined> {
  return {
    headquartersId: filter.reportingHeadquartersId,
    regionId: filter.reportingRegionId,
    battalionId: filter.reportingBattalionId,
    companyId: filter.reportingCompanyId,
  };
}

export function commanderCasesHref(
  filter: CommanderDashboardFilter,
  overrides?: { arrestDateFrom?: string; arrestDateTo?: string }
): string {
  const params = new URLSearchParams();
  setIf(params, "arrestDateFrom", overrides?.arrestDateFrom ?? toCommanderIsoDate(filter.arrestDateFrom));
  setIf(params, "arrestDateTo", overrides?.arrestDateTo ?? toCommanderIsoDate(filter.arrestDateTo));
  setIf(params, "province", filter.province);
  setIf(params, "status", filter.status);
  const org = reportingOrgParams(filter);
  setIf(params, "headquartersId", org.headquartersId);
  setIf(params, "regionId", org.regionId);
  setIf(params, "battalionId", org.battalionId);
  setIf(params, "companyId", org.companyId);
  const q = params.toString();
  return q ? `/drug-intelligence/cases?${q}` : "/drug-intelligence/cases";
}

export function commanderPersonsHref(filter: CommanderDashboardFilter): string {
  const params = new URLSearchParams();
  setIf(params, "dateFrom", toCommanderIsoDate(filter.arrestDateFrom));
  setIf(params, "dateTo", toCommanderIsoDate(filter.arrestDateTo));
  setIf(params, "province", filter.province);
  setIf(params, "battalionId", filter.reportingBattalionId);
  setIf(params, "companyId", filter.reportingCompanyId);
  params.set("caseRoles", "ARRESTED_PERSON,ACCUSED");
  return `/drug-intelligence/persons?${params.toString()}`;
}

export function commanderMapHref(
  filter: CommanderDashboardFilter,
  overrides?: { province?: string; drugCategory?: string }
): string {
  const params = new URLSearchParams();
  setIf(params, "dateFrom", toCommanderIsoDate(filter.arrestDateFrom));
  setIf(params, "dateTo", toCommanderIsoDate(filter.arrestDateTo));
  setIf(params, "province", overrides?.province ?? filter.province);
  setIf(params, "status", filter.status);
  setIf(params, "drugCategory", overrides?.drugCategory ?? filter.drugCategory);
  const org = reportingOrgParams(filter);
  setIf(params, "headquartersId", org.headquartersId);
  setIf(params, "regionId", org.regionId);
  setIf(params, "battalionId", org.battalionId);
  setIf(params, "companyId", org.companyId);
  const q = params.toString();
  return q ? `/drug-intelligence/map?${q}` : "/drug-intelligence/map";
}

export function commanderMonthCasesHref(
  filter: CommanderDashboardFilter,
  year: number,
  month: number
): string {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = lastDayOfMonth(year, month);
  return commanderCasesHref(filter, { arrestDateFrom: from, arrestDateTo: to });
}

export function commanderUnitCasesHref(filter: CommanderDashboardFilter, unitId: number | null, groupBy: string): string {
  const next: CommanderDashboardFilter = { ...filter };
  if (unitId !== null) {
    if (groupBy === "company") next.reportingCompanyId = unitId;
    else if (groupBy === "region") next.reportingRegionId = unitId;
    else next.reportingBattalionId = unitId;
  }
  return commanderCasesHref(next);
}

export function commanderAlertsHref(opts?: { status?: string; alertType?: string }): string {
  const params = new URLSearchParams();
  setIf(params, "status", opts?.status ?? "NEW");
  setIf(params, "alertType", opts?.alertType);
  const q = params.toString();
  return q ? `/drug-intelligence/alerts?${q}` : "/drug-intelligence/alerts";
}

export function commanderDuplicatesHref(): string {
  return "/drug-intelligence/review/duplicates";
}

export function commanderSignalNetworkHref(entityType: string, entityId: string): string {
  return `/drug-intelligence/network?focusType=${encodeURIComponent(entityType)}&focusId=${encodeURIComponent(entityId)}&depth=2`;
}
