/**
 * Commander Dashboard drill-down URLs (Phase 2B / 2B.2.1).
 *
 * Only emit query keys that destination pages/APIs actually apply.
 * Drill-downs attach a safe `returnTo` pointing at the originating
 * Commander Dashboard URL so destinations can show contextual back.
 * Pure — no I/O, no React.
 */

import { toCommanderIsoDate, type CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import {
  commanderReturnPathFromState,
  type CommanderUrlState,
} from "@/lib/drug_intelligence/drug_commander_scope";
import { withReturnTo } from "@/lib/ui/return_context";

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

/**
 * Reconstructs the Commander Dashboard URL from the active filter so
 * drill-down destinations can return to the exact same scope.
 * Query values are left unencoded here; `withReturnTo` encodes the path once.
 */
export function commanderReturnPath(filter: CommanderDashboardFilter, urlState?: CommanderUrlState): string {
  if (urlState) return commanderReturnPathFromState(urlState);
  const parts: string[] = [];
  if (filter.fiscalYearBe) {
    parts.push(`fy=${filter.fiscalYearBe}`);
  } else {
    parts.push(`from=${toCommanderIsoDate(filter.arrestDateFrom)}`);
    parts.push(`to=${toCommanderIsoDate(filter.arrestDateTo)}`);
  }
  if (filter.reportingHeadquartersId) parts.push(`hqId=${filter.reportingHeadquartersId}`);
  if (filter.reportingRegionId) parts.push(`regionId=${filter.reportingRegionId}`);
  if (filter.reportingBattalionId) parts.push(`battalionId=${filter.reportingBattalionId}`);
  if (filter.reportingCompanyId) parts.push(`companyId=${filter.reportingCompanyId}`);
  if (filter.province) parts.push(`province=${filter.province}`);
  if (filter.status) parts.push(`status=${filter.status}`);
  return parts.length > 0 ? `/drug-intelligence/command?${parts.join("&")}` : "/drug-intelligence/command";
}

function withCommanderReturn(
  targetPath: string,
  filter: CommanderDashboardFilter,
  urlState?: CommanderUrlState
): string {
  return withReturnTo(targetPath, commanderReturnPath(filter, urlState));
}

function buildCommanderCasesPath(
  filter: CommanderDashboardFilter,
  overrides?: { arrestDateFrom?: string; arrestDateTo?: string; province?: string }
): string {
  const params = new URLSearchParams();
  setIf(params, "arrestDateFrom", overrides?.arrestDateFrom ?? toCommanderIsoDate(filter.arrestDateFrom));
  setIf(params, "arrestDateTo", overrides?.arrestDateTo ?? toCommanderIsoDate(filter.arrestDateTo));
  setIf(params, "province", overrides?.province ?? filter.province);
  setIf(params, "status", filter.status);
  const org = reportingOrgParams(filter);
  setIf(params, "headquartersId", org.headquartersId);
  setIf(params, "regionId", org.regionId);
  setIf(params, "battalionId", org.battalionId);
  setIf(params, "companyId", org.companyId);
  const q = params.toString();
  return q ? `/drug-intelligence/cases?${q}` : "/drug-intelligence/cases";
}

export function commanderCasesHref(
  filter: CommanderDashboardFilter,
  overrides?: { arrestDateFrom?: string; arrestDateTo?: string; province?: string },
  urlState?: CommanderUrlState
): string {
  return withCommanderReturn(buildCommanderCasesPath(filter, overrides), filter, urlState);
}

export function commanderPersonsHref(filter: CommanderDashboardFilter, urlState?: CommanderUrlState): string {
  const params = new URLSearchParams();
  setIf(params, "dateFrom", toCommanderIsoDate(filter.arrestDateFrom));
  setIf(params, "dateTo", toCommanderIsoDate(filter.arrestDateTo));
  setIf(params, "province", filter.province);
  setIf(params, "battalionId", filter.reportingBattalionId);
  setIf(params, "companyId", filter.reportingCompanyId);
  params.set("caseRoles", "ARRESTED_PERSON,ACCUSED");
  return withCommanderReturn(`/drug-intelligence/persons?${params.toString()}`, filter, urlState);
}

export function commanderMapHref(
  filter: CommanderDashboardFilter,
  overrides?: { province?: string; drugCategory?: string },
  urlState?: CommanderUrlState
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
  const href = q ? `/drug-intelligence/map?${q}` : "/drug-intelligence/map";
  return withCommanderReturn(href, filter, urlState);
}

export function commanderMonthCasesHref(
  filter: CommanderDashboardFilter,
  year: number,
  month: number,
  urlState?: CommanderUrlState
): string {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = lastDayOfMonth(year, month);
  return commanderCasesHref(filter, { arrestDateFrom: from, arrestDateTo: to }, urlState);
}

export function commanderUnitCasesHref(
  filter: CommanderDashboardFilter,
  unitId: number | null,
  groupBy: string,
  urlState?: CommanderUrlState
): string {
  const next: CommanderDashboardFilter = { ...filter };
  if (unitId !== null) {
    if (groupBy === "company") next.reportingCompanyId = unitId;
    else if (groupBy === "region") next.reportingRegionId = unitId;
    else next.reportingBattalionId = unitId;
  }
  return withCommanderReturn(buildCommanderCasesPath(next), filter, urlState);
}

export function commanderAlertsHref(
  opts?: { status?: string; alertType?: string },
  filter?: CommanderDashboardFilter,
  urlState?: CommanderUrlState
): string {
  const params = new URLSearchParams();
  setIf(params, "status", opts?.status ?? "NEW");
  setIf(params, "alertType", opts?.alertType);
  const q = params.toString();
  const href = q ? `/drug-intelligence/alerts?${q}` : "/drug-intelligence/alerts";
  return filter ? withCommanderReturn(href, filter, urlState) : href;
}

export function commanderDuplicatesHref(filter?: CommanderDashboardFilter, urlState?: CommanderUrlState): string {
  const href = "/drug-intelligence/review/duplicates";
  return filter ? withCommanderReturn(href, filter, urlState) : href;
}

export function commanderSignalNetworkHref(
  entityType: string,
  entityId: string,
  filter?: CommanderDashboardFilter,
  urlState?: CommanderUrlState
): string {
  const href = `/drug-intelligence/network?focusType=${encodeURIComponent(entityType)}&focusId=${encodeURIComponent(entityId)}&depth=2`;
  return filter ? withCommanderReturn(href, filter, urlState) : href;
}

export function commanderSearchHref(filter: CommanderDashboardFilter, urlState?: CommanderUrlState): string {
  return withCommanderReturn("/drug-intelligence/search?mode=relationship", filter, urlState);
}

export function commanderNetworkWorkspaceHref(filter: CommanderDashboardFilter, urlState?: CommanderUrlState): string {
  return withCommanderReturn("/drug-intelligence/network", filter, urlState);
}
