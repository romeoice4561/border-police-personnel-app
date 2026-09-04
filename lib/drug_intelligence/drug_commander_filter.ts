/**
 * Commander Dashboard filter resolver (Phase 2B).
 *
 * Central scope seam: URL params → CommanderDashboardFilter → Prisma where.
 * Future authorized-org ACL injects in resolveCommanderDashboardScope()
 * BEFORE any aggregate query — APIs must not scatter org conditions.
 *
 * Default period: current Thai FY (1 Oct → 30 Sep). Always date-bounded.
 * Pure — no I/O, no React.
 */

import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { fiscalYearStart, fiscalYearEnd } from "@/lib/personnel_calendar/fiscal_year";
import { DRUG_CASE_STATUSES, type DrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CATEGORIES, type DrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";

export const COMMANDER_UNIT_TYPES = ["HQ", "REGION", "BATTALION", "COMPANY"] as const;
export type CommanderUnitType = (typeof COMMANDER_UNIT_TYPES)[number];

export interface CommanderDashboardFilter {
  arrestDateFrom: Date;
  arrestDateTo: Date;
  fiscalYear?: number;
  fiscalYearBe?: number;
  displayFiscalYearTh?: string;
  reportingHeadquartersId?: number;
  reportingRegionId?: number;
  reportingBattalionId?: number;
  reportingCompanyId?: number;
  province?: string;
  status?: DrugCaseStatus;
  drugCategory?: DrugCategory;
}

export interface CommanderActorRef {
  id: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCommanderIsoDate(value: string, endOfDay = false): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const d = new Date(`${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toCommanderIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function applyCurrentFiscalYear(filter: CommanderDashboardFilter): void {
  const fy = computeFiscalYearSummary();
  filter.arrestDateFrom = fy.start;
  filter.arrestDateTo = fy.end;
  filter.fiscalYear = fy.fiscalYear;
  filter.fiscalYearBe = fy.fiscalYearBe;
  filter.displayFiscalYearTh = fy.displayFiscalYearTh;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Parses URL search params → CommanderDashboardFilter.
 * Priority: from/to (override FY) → fy (BE year) → current FY.
 * Also accepts unitType+unitId as an alias for the reporting-unit id fields.
 */
export function resolveCommanderFilter(params: URLSearchParams): CommanderDashboardFilter {
  const filter: CommanderDashboardFilter = {
    arrestDateFrom: new Date(0),
    arrestDateTo: new Date(0),
  };
  applyCurrentFiscalYear(filter);

  const fromParam = params.get("from");
  const toParam = params.get("to");
  const fyParam = params.get("fy");

  const fromDate = fromParam ? parseCommanderIsoDate(fromParam, false) : null;
  const toDate = toParam ? parseCommanderIsoDate(toParam, true) : null;

  // Custom period is authoritative only when both bounds are valid and ordered.
  // Partial or inverted ranges keep FY analytics (the UI blocks inverted
  // requests; the API also 400s inverted ranges).
  if (fromDate && toDate && fromParam && toParam && fromParam <= toParam) {
    filter.arrestDateFrom = fromDate;
    filter.arrestDateTo = toDate;
    filter.fiscalYear = undefined;
    filter.fiscalYearBe = undefined;
    filter.displayFiscalYearTh = undefined;
  } else if (fyParam) {
    const beYear = Number.parseInt(fyParam, 10);
    if (Number.isFinite(beYear) && beYear >= 2400 && beYear <= 2700) {
      const gregYear = beYear - 543;
      filter.arrestDateFrom = fiscalYearStart(gregYear);
      filter.arrestDateTo = fiscalYearEnd(gregYear);
      filter.fiscalYear = gregYear;
      filter.fiscalYearBe = beYear;
      filter.displayFiscalYearTh = `ปีงบประมาณ ${beYear}`;
    }
  }

  const unitType = params.get("unitType");
  const unitId = parsePositiveInt(params.get("unitId"));
  if (unitType && unitId !== undefined && (COMMANDER_UNIT_TYPES as readonly string[]).includes(unitType)) {
    if (unitType === "HQ") filter.reportingHeadquartersId = unitId;
    if (unitType === "REGION") filter.reportingRegionId = unitId;
    if (unitType === "BATTALION") filter.reportingBattalionId = unitId;
    if (unitType === "COMPANY") filter.reportingCompanyId = unitId;
  }

  const hqId = parsePositiveInt(params.get("hqId") ?? params.get("headquartersId"));
  const regionId = parsePositiveInt(params.get("regionId"));
  const battalionId = parsePositiveInt(params.get("battalionId"));
  const companyId = parsePositiveInt(params.get("companyId"));
  if (hqId !== undefined) filter.reportingHeadquartersId = hqId;
  if (regionId !== undefined) filter.reportingRegionId = regionId;
  if (battalionId !== undefined) filter.reportingBattalionId = battalionId;
  if (companyId !== undefined) filter.reportingCompanyId = companyId;

  const province = params.get("province")?.trim();
  if (province) filter.province = province;

  const status = params.get("status");
  if (status && (DRUG_CASE_STATUSES as readonly string[]).includes(status)) {
    filter.status = status as DrugCaseStatus;
  }

  const category = params.get("category") ?? params.get("drugCategory");
  if (category && (DRUG_CATEGORIES as readonly string[]).includes(category)) {
    filter.drugCategory = category as DrugCategory;
  }

  return filter;
}

/** Server-side inverted-range guard. Returns a Thai message or null. */
export function commanderInvalidDateRangeMessage(params: URLSearchParams): string | null {
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to) return null;
  const fromDate = parseCommanderIsoDate(from, false);
  const toDate = parseCommanderIsoDate(to, false);
  if (!fromDate || !toDate) return null;
  if (from > to) return "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
  return null;
}

/**
 * Future ACL seam. Today drug.read is global — returns requested filters unchanged.
 * When per-user org scope arrives, intersect here before aggregation.
 */
export function resolveCommanderDashboardScope(
  _actor: CommanderActorRef | null,
  requested: CommanderDashboardFilter
): CommanderDashboardFilter {
  return requested;
}

export type CommanderUnitGroupBy = "battalion" | "company" | "region";

/**
 * Same grouping Commander Units / missing-unit readiness use: drill deeper
 * when a parent org filter is set. Default is battalion.
 */
export function resolveCommanderUnitGroup(filter: CommanderDashboardFilter): {
  groupField: "battalionId" | "companyId" | "regionId";
  groupBy: CommanderUnitGroupBy;
} {
  if (filter.reportingBattalionId !== undefined) return { groupField: "companyId", groupBy: "company" };
  if (filter.reportingRegionId !== undefined) return { groupField: "battalionId", groupBy: "battalion" };
  if (filter.reportingHeadquartersId !== undefined) return { groupField: "regionId", groupBy: "region" };
  return { groupField: "battalionId", groupBy: "battalion" };
}

/** Prisma DrugCase.where — the only place Commander org+date conditions are assembled. */
export function buildCommanderCaseWhere(filter: CommanderDashboardFilter): Record<string, unknown> {
  const where: Record<string, unknown> = {
    arrestDate: { gte: filter.arrestDateFrom, lte: filter.arrestDateTo },
  };
  if (filter.reportingHeadquartersId !== undefined) where.headquartersId = filter.reportingHeadquartersId;
  if (filter.reportingRegionId !== undefined) where.regionId = filter.reportingRegionId;
  if (filter.reportingBattalionId !== undefined) where.battalionId = filter.reportingBattalionId;
  if (filter.reportingCompanyId !== undefined) where.companyId = filter.reportingCompanyId;
  if (filter.province !== undefined) where.province = filter.province;
  if (filter.status !== undefined) where.status = filter.status;
  return where;
}
