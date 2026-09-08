/**
 * DI-10E.5B — Bounded Geographic Report query foundation.
 *
 * Dedicated server-side loader for the future MAP_DATA HTML_PRINT report.
 * Does not call the interactive Map geo service, does not use an unbounded
 * page size, and does not fetch-all-then-slice via the case list repository.
 *
 * Category and person filters are Prisma relation EXISTS (`seizedItems.some`,
 * `persons.some`) on DrugCase — they never materialize an unbounded seized-item
 * or case-person allowlist. Arrest-date bounds go in Prisma `where`.
 * After the matching-count hard gate, one bounded case select plus batched
 * location/seizure queries (fixed query count, not O(cases)).
 *
 * This module does not activate MAP_DATA, emit HTML, or change the Map UI.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import {
  DRUG_EXPORT_MAP_HARD_LIMIT,
  DRUG_EXPORT_MAP_SOFT_LIMIT,
} from "@/lib/drug_intelligence/drug_export_limits";
import {
  parseExportIsoEnd,
  parseExportIsoStart,
  resolveExportPeriod,
  type AppliedExportPeriod,
} from "@/lib/drug_intelligence/drug_export_period";
import { isValidDrugCaseStatus, type DrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import { resolveDrugGeoCoordinate } from "@/lib/drug_intelligence/drug_geo_marker";
import {
  isValidDrugCategory,
  isValidDrugMeasurementKind,
  type DrugCategory,
  type DrugMeasurementKind,
} from "@/lib/drug_intelligence/drug_seized_item_options";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ARREST_LOCATION_ROLE = "ARREST_LOCATION";

export const GEOGRAPHIC_REPORT_MATCHING_SOFT_LIMIT = DRUG_EXPORT_MAP_SOFT_LIMIT;
export const GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT = DRUG_EXPORT_MAP_HARD_LIMIT;
export const GEOGRAPHIC_REPORT_CASE_LIST_SOFT_LIMIT = 100;
export const GEOGRAPHIC_REPORT_CASE_LIST_HARD_LIMIT = 1_000;
export const GEOGRAPHIC_REPORT_NO_COORDINATE_LIST_SOFT_LIMIT = 50;
export const GEOGRAPHIC_REPORT_NO_COORDINATE_LIST_HARD_LIMIT = 500;
export const GEOGRAPHIC_REPORT_PROVINCE_RANKING_SOFT_LIMIT = 20;
export const GEOGRAPHIC_REPORT_PROVINCE_RANKING_HARD_LIMIT = 100;
export const GEOGRAPHIC_REPORT_DISTRICT_RANKING_SOFT_LIMIT = 30;
export const GEOGRAPHIC_REPORT_DISTRICT_RANKING_HARD_LIMIT = 200;
export const GEOGRAPHIC_REPORT_TREND_MAX_MONTHS = 36;

export type GeographicReportWarningCode =
  | "SOFT_LIMIT"
  | "CASE_LIST_TRUNCATED"
  | "NO_COORDINATE_LIST_TRUNCATED"
  | "PROVINCE_RANKING_TRUNCATED"
  | "DISTRICT_RANKING_TRUNCATED"
  | "TREND_CLAMPED";

export interface GeographicReportQueryFilter {
  dateFrom?: string;
  dateTo?: string;
  fiscalYearBe?: number;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  leadHeadquartersId?: number;
  leadRegionId?: number;
  leadBattalionId?: number;
  leadCompanyId?: number;
  province?: string;
  district?: string;
  status?: DrugCaseStatus;
  drugCategory?: DrugCategory;
  personId?: string;
}

export interface GeographicReportAreaRankRow {
  /** Recorded text as stored. Null means unspecified/blank. */
  value: string | null;
  unspecified: boolean;
  caseCount: number;
}

export interface GeographicReportSeizureGroup {
  drugCategory: DrugCategory;
  measurementKind: DrugMeasurementKind;
  totalCount: number | null;
  totalWeightGrams: number | null;
  displayUnit: string | null;
}

export interface GeographicReportTrendBucket {
  monthKey: string;
  year: number;
  month: number;
  caseCount: number;
}

export interface GeographicReportCaseRow {
  caseId: string;
  caseNumber: string;
  arrestDate: string | null;
  province: string | null;
  district: string | null;
  locationName: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  status: string;
  hasCoordinates: boolean;
}

export interface GeographicReportQueryResult {
  filters: GeographicReportQueryFilter;
  effectivePeriod: AppliedExportPeriod;
  limits: {
    matchingSoft: number;
    matchingHard: number;
    caseListSoft: number;
    caseListHard: number;
    noCoordinateListSoft: number;
    noCoordinateListHard: number;
    provinceRankingSoft: number;
    provinceRankingHard: number;
    districtRankingSoft: number;
    districtRankingHard: number;
    trendMaxMonths: number;
  };
  warnings: GeographicReportWarningCode[];
  truncation: {
    cases: boolean;
    noCoordinateCases: boolean;
    provinceRanking: boolean;
    districtRanking: boolean;
    monthlyTrend: boolean;
  };
  summary: {
    totalCases: number;
    casesWithCoordinates: number;
    casesWithoutCoordinates: number;
    distinctProvinceCount: number;
    distinctDistrictCount: number;
  };
  provinceRanking: GeographicReportAreaRankRow[];
  districtRanking: GeographicReportAreaRankRow[];
  seizureGroups: GeographicReportSeizureGroup[];
  monthlyTrend: GeographicReportTrendBucket[];
  cases: GeographicReportCaseRow[];
  noCoordinateCases: GeographicReportCaseRow[];
}

export class GeographicReportTooManyRowsError extends Error {
  readonly code = "TOO_MANY_ROWS";
  constructor() {
    super("too many rows");
    this.name = "GeographicReportTooManyRowsError";
  }
}

export class GeographicReportInvalidFilterError extends Error {
  readonly code = "INVALID_FILTER";
  constructor(message = "invalid geographic report filter") {
    super(message);
    this.name = "GeographicReportInvalidFilterError";
  }
}

const CASE_SELECT = {
  id: true,
  caseNumber: true,
  arrestDate: true,
  province: true,
  district: true,
  locationName: true,
  reportingUnitText: true,
  leadUnitText: true,
  status: true,
  latitude: true,
  longitude: true,
} as const;

interface CaseSelectRow {
  id: string;
  caseNumber: string;
  arrestDate: Date | string | null;
  province: string | null;
  district: string | null;
  locationName: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  status: string;
  latitude: unknown;
  longitude: unknown;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date.getUTCFullYear() === y && date.getUTCMonth() === (m ?? 1) - 1 && date.getUTCDate() === d;
}

function optionalPositiveInt(value: number | undefined): number | undefined {
  if (value == null) return undefined;
  if (!Number.isInteger(value) || value <= 0) throw new GeographicReportInvalidFilterError();
  return value;
}

function optionalText(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function normalizeGeographicReportFilter(filter: GeographicReportQueryFilter): GeographicReportQueryFilter {
  const dateFrom = optionalText(filter.dateFrom);
  const dateTo = optionalText(filter.dateTo);
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) throw new GeographicReportInvalidFilterError();
  if (dateFrom && !isValidIsoDate(dateFrom)) throw new GeographicReportInvalidFilterError();
  if (dateTo && !isValidIsoDate(dateTo)) throw new GeographicReportInvalidFilterError();
  if (dateFrom && dateTo && dateFrom > dateTo) throw new GeographicReportInvalidFilterError();

  const fiscalYearBe = filter.fiscalYearBe;
  if (fiscalYearBe != null) {
    if (!Number.isInteger(fiscalYearBe) || fiscalYearBe < 2500 || fiscalYearBe > 2700) {
      throw new GeographicReportInvalidFilterError();
    }
  }

  const status = filter.status;
  if (status != null && !isValidDrugCaseStatus(status)) throw new GeographicReportInvalidFilterError();
  const drugCategory = filter.drugCategory;
  if (drugCategory != null && !isValidDrugCategory(drugCategory)) throw new GeographicReportInvalidFilterError();

  const personId = optionalText(filter.personId);
  if (personId && (/[\\/]/.test(personId) || personId.length > 64)) throw new GeographicReportInvalidFilterError();

  const normalized: GeographicReportQueryFilter = {};
  if (dateFrom) normalized.dateFrom = dateFrom;
  if (dateTo) normalized.dateTo = dateTo;
  if (fiscalYearBe != null) normalized.fiscalYearBe = fiscalYearBe;
  const headquartersId = optionalPositiveInt(filter.headquartersId);
  const regionId = optionalPositiveInt(filter.regionId);
  const battalionId = optionalPositiveInt(filter.battalionId);
  const companyId = optionalPositiveInt(filter.companyId);
  const leadHeadquartersId = optionalPositiveInt(filter.leadHeadquartersId);
  const leadRegionId = optionalPositiveInt(filter.leadRegionId);
  const leadBattalionId = optionalPositiveInt(filter.leadBattalionId);
  const leadCompanyId = optionalPositiveInt(filter.leadCompanyId);
  if (headquartersId != null) normalized.headquartersId = headquartersId;
  if (regionId != null) normalized.regionId = regionId;
  if (battalionId != null) normalized.battalionId = battalionId;
  if (companyId != null) normalized.companyId = companyId;
  if (leadHeadquartersId != null) normalized.leadHeadquartersId = leadHeadquartersId;
  if (leadRegionId != null) normalized.leadRegionId = leadRegionId;
  if (leadBattalionId != null) normalized.leadBattalionId = leadBattalionId;
  if (leadCompanyId != null) normalized.leadCompanyId = leadCompanyId;
  const province = optionalText(filter.province);
  const district = optionalText(filter.district);
  if (province) normalized.province = province;
  if (district) normalized.district = district;
  if (status) normalized.status = status;
  if (drugCategory) normalized.drugCategory = drugCategory;
  if (personId) normalized.personId = personId;
  return normalized;
}

/**
 * Prisma DrugCase `where` for scalar/org/date filters plus relation EXISTS
 * for category (`seizedItems.some`) and person (`persons.some`).
 * Dates are always `arrestDate` gte/lte when a period is applied.
 */
export function buildGeographicReportCaseWhere(
  filter: GeographicReportQueryFilter,
  period: AppliedExportPeriod
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (period.dateFrom && period.dateTo) {
    where.arrestDate = { gte: parseExportIsoStart(period.dateFrom), lte: parseExportIsoEnd(period.dateTo) };
  }
  if (filter.headquartersId != null) where.headquartersId = filter.headquartersId;
  if (filter.regionId != null) where.regionId = filter.regionId;
  if (filter.battalionId != null) where.battalionId = filter.battalionId;
  if (filter.companyId != null) where.companyId = filter.companyId;
  if (filter.leadHeadquartersId != null) where.leadHeadquartersId = filter.leadHeadquartersId;
  if (filter.leadRegionId != null) where.leadRegionId = filter.leadRegionId;
  if (filter.leadBattalionId != null) where.leadBattalionId = filter.leadBattalionId;
  if (filter.leadCompanyId != null) where.leadCompanyId = filter.leadCompanyId;
  if (filter.province) where.province = filter.province;
  if (filter.district) where.district = filter.district;
  if (filter.status) where.status = filter.status;
  if (filter.drugCategory) where.seizedItems = { some: { drugCategory: filter.drugCategory } };
  if (filter.personId) where.persons = { some: { personId: filter.personId } };
  return where;
}

function emptyResult(filters: GeographicReportQueryFilter, effectivePeriod: AppliedExportPeriod, warnings: GeographicReportWarningCode[] = []): GeographicReportQueryResult {
  return {
    filters,
    effectivePeriod,
    limits: resultLimits(),
    warnings,
    truncation: {
      cases: false,
      noCoordinateCases: false,
      provinceRanking: false,
      districtRanking: false,
      monthlyTrend: false,
    },
    summary: {
      totalCases: 0,
      casesWithCoordinates: 0,
      casesWithoutCoordinates: 0,
      distinctProvinceCount: 0,
      distinctDistrictCount: 0,
    },
    provinceRanking: [],
    districtRanking: [],
    seizureGroups: [],
    monthlyTrend: [],
    cases: [],
    noCoordinateCases: [],
  };
}

function resultLimits() {
  return {
    matchingSoft: GEOGRAPHIC_REPORT_MATCHING_SOFT_LIMIT,
    matchingHard: GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT,
    caseListSoft: GEOGRAPHIC_REPORT_CASE_LIST_SOFT_LIMIT,
    caseListHard: GEOGRAPHIC_REPORT_CASE_LIST_HARD_LIMIT,
    noCoordinateListSoft: GEOGRAPHIC_REPORT_NO_COORDINATE_LIST_SOFT_LIMIT,
    noCoordinateListHard: GEOGRAPHIC_REPORT_NO_COORDINATE_LIST_HARD_LIMIT,
    provinceRankingSoft: GEOGRAPHIC_REPORT_PROVINCE_RANKING_SOFT_LIMIT,
    provinceRankingHard: GEOGRAPHIC_REPORT_PROVINCE_RANKING_HARD_LIMIT,
    districtRankingSoft: GEOGRAPHIC_REPORT_DISTRICT_RANKING_SOFT_LIMIT,
    districtRankingHard: GEOGRAPHIC_REPORT_DISTRICT_RANKING_HARD_LIMIT,
    trendMaxMonths: GEOGRAPHIC_REPORT_TREND_MAX_MONTHS,
  };
}

function toCoordNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoArrestDate(value: Date | string | null): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function areaKey(value: string | null | undefined): { value: string | null; unspecified: boolean } {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return { value: null, unspecified: true };
  return { value: trimmed, unspecified: false };
}

function rankAreas(values: Array<string | null | undefined>, hardLimit: number): { rows: GeographicReportAreaRankRow[]; truncated: boolean } {
  const counts = new Map<string, GeographicReportAreaRankRow>();
  for (const raw of values) {
    const key = areaKey(raw);
    const mapKey = key.unspecified ? "" : key.value!;
    const existing = counts.get(mapKey);
    if (existing) existing.caseCount += 1;
    else counts.set(mapKey, { value: key.value, unspecified: key.unspecified, caseCount: 1 });
  }
  const sorted = [...counts.values()].sort((a, b) => {
    if (a.caseCount !== b.caseCount) return b.caseCount - a.caseCount;
    if (a.unspecified !== b.unspecified) return a.unspecified ? 1 : -1;
    return (a.value ?? "").localeCompare(b.value ?? "", "th");
  });
  return { rows: sorted.slice(0, hardLimit), truncated: sorted.length > hardLimit };
}

function distinctNamedCount(values: Array<string | null | undefined>): number {
  const set = new Set<string>();
  for (const raw of values) {
    const key = areaKey(raw);
    if (!key.unspecified && key.value) set.add(key.value);
  }
  return set.size;
}

function buildTrend(cases: CaseSelectRow[]): { buckets: GeographicReportTrendBucket[]; clamped: boolean } {
  const buckets = new Map<string, GeographicReportTrendBucket>();
  for (const row of cases) {
    const iso = isoArrestDate(row.arrestDate);
    if (!iso) continue;
    const year = Number(iso.slice(0, 4));
    const month = Number(iso.slice(5, 7));
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const existing = buckets.get(monthKey);
    if (existing) existing.caseCount += 1;
    else buckets.set(monthKey, { monthKey, year, month, caseCount: 1 });
  }
  const sorted = [...buckets.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (sorted.length <= GEOGRAPHIC_REPORT_TREND_MAX_MONTHS) return { buckets: sorted, clamped: false };
  return { buckets: sorted.slice(sorted.length - GEOGRAPHIC_REPORT_TREND_MAX_MONTHS), clamped: true };
}

function aggregateSeizures(rows: Array<{
  drugCategory: unknown;
  measurementKind: unknown;
  quantity: unknown;
  weightGrams: unknown;
  unit: unknown;
}>): GeographicReportSeizureGroup[] {
  const groups = new Map<string, GeographicReportSeizureGroup>();
  for (const row of rows) {
    if (!isValidDrugCategory(String(row.drugCategory)) || !isValidDrugMeasurementKind(String(row.measurementKind))) continue;
    const drugCategory = row.drugCategory as DrugCategory;
    const measurementKind = row.measurementKind as DrugMeasurementKind;
    const displayUnit = measurementKind === "COUNT" ? (typeof row.unit === "string" && row.unit.trim() ? row.unit.trim() : null) : null;
    const key = `${drugCategory}::${measurementKind}::${displayUnit ?? ""}`;
    const existing = groups.get(key);
    if (measurementKind === "COUNT") {
      const n = row.quantity == null ? null : Number(row.quantity);
      if (n == null || !Number.isFinite(n)) continue;
      if (existing) existing.totalCount = (existing.totalCount ?? 0) + n;
      else groups.set(key, { drugCategory, measurementKind, totalCount: n, totalWeightGrams: null, displayUnit });
    } else {
      const n = row.weightGrams == null ? null : Number(row.weightGrams);
      if (n == null || !Number.isFinite(n)) continue;
      if (existing) existing.totalWeightGrams = (existing.totalWeightGrams ?? 0) + n;
      else groups.set(key, { drugCategory, measurementKind, totalCount: null, totalWeightGrams: n, displayUnit: null });
    }
  }
  return [...groups.values()].sort(
    (a, b) => a.drugCategory.localeCompare(b.drugCategory) || a.measurementKind.localeCompare(b.measurementKind) || (a.displayUnit ?? "").localeCompare(b.displayUnit ?? "")
  );
}

function compareMatchingCases(a: CaseSelectRow, b: CaseSelectRow): number {
  const aDate = isoArrestDate(a.arrestDate);
  const bDate = isoArrestDate(b.arrestDate);
  if (aDate && bDate && aDate !== bDate) return aDate < bDate ? 1 : -1;
  if (aDate && !bDate) return -1;
  if (!aDate && bDate) return 1;
  const byNumber = a.caseNumber.localeCompare(b.caseNumber, "th");
  if (byNumber !== 0) return byNumber;
  return String(a.id).localeCompare(String(b.id), "th");
}

function toCaseRow(row: CaseSelectRow, hasCoordinates: boolean): GeographicReportCaseRow {
  return {
    caseId: String(row.id),
    caseNumber: row.caseNumber,
    arrestDate: isoArrestDate(row.arrestDate),
    province: row.province,
    district: row.district,
    locationName: row.locationName,
    reportingUnitText: row.reportingUnitText,
    leadUnitText: row.leadUnitText,
    status: row.status,
    hasCoordinates,
  };
}

export class DrugGeographicReportQueryService {
  constructor(private readonly db: DatabaseClient) {}

  async load(input: GeographicReportQueryFilter): Promise<GeographicReportQueryResult> {
    const filters = normalizeGeographicReportFilter(input);
    const effectivePeriod = resolveExportPeriod({
      fiscalYearBe: filters.fiscalYearBe,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });

    const where = buildGeographicReportCaseWhere(filters, effectivePeriod);
    const totalCases = await this.db.drugCase.count({ where });
    if (totalCases > GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT) throw new GeographicReportTooManyRowsError();
    if (totalCases === 0) return emptyResult(filters, effectivePeriod);

    const warnings: GeographicReportWarningCode[] = [];
    if (totalCases > GEOGRAPHIC_REPORT_MATCHING_SOFT_LIMIT) warnings.push("SOFT_LIMIT");

    const rawCases = ((await this.db.drugCase.findMany({
      where,
      orderBy: [{ arrestDate: "desc" }, { caseNumber: "asc" }],
      take: GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT,
      select: CASE_SELECT,
    })) as unknown as CaseSelectRow[]).slice().sort(compareMatchingCases);

    const caseIds = rawCases.map((row) => row.id);
    const [locationLinks, seizedRows] = await Promise.all([
      this.db.drugCaseLocation.findMany({
        where: { caseId: { in: caseIds }, role: ARREST_LOCATION_ROLE },
        select: { caseId: true, locationId: true },
      }),
      this.db.drugSeizedItem.findMany({
        where: { caseId: { in: caseIds } },
        select: { caseId: true, drugCategory: true, measurementKind: true, quantity: true, weightGrams: true, unit: true },
      }),
    ]);

    const locationIds = [
      ...new Set((locationLinks as Array<{ locationId: unknown }>).map((link) => link.locationId).filter((id) => id != null)),
    ];
    const locations =
      locationIds.length === 0
        ? []
        : await this.db.drugLocation.findMany({
            where: { id: { in: locationIds } },
            select: { id: true, latitude: true, longitude: true },
          });

    const locationById = new Map(
      (locations as Array<{ id: unknown; latitude: unknown; longitude: unknown }>).map((loc) => [loc.id, loc])
    );
    const arrestLocationByCase = new Map<string, { latitude: unknown; longitude: unknown }>();
    for (const link of locationLinks as Array<{ caseId: unknown; locationId: unknown }>) {
      const caseId = String(link.caseId);
      if (arrestLocationByCase.has(caseId)) continue;
      const loc = locationById.get(link.locationId);
      if (loc) arrestLocationByCase.set(caseId, loc);
    }

    const presence = new Map<string, boolean>();
    for (const row of rawCases) {
      const arrest = arrestLocationByCase.get(String(row.id));
      const resolved = resolveDrugGeoCoordinate({
        caseLatitude: toCoordNumber(row.latitude),
        caseLongitude: toCoordNumber(row.longitude),
        arrestLocationLatitude: toCoordNumber(arrest?.latitude),
        arrestLocationLongitude: toCoordNumber(arrest?.longitude),
      });
      presence.set(String(row.id), resolved !== null);
    }

    const withCoords = rawCases.filter((row) => presence.get(String(row.id)) === true);
    const withoutCoords = rawCases.filter((row) => presence.get(String(row.id)) !== true);

    const provinceRank = rankAreas(
      rawCases.map((row) => row.province),
      GEOGRAPHIC_REPORT_PROVINCE_RANKING_HARD_LIMIT
    );
    const districtRank = rankAreas(
      rawCases.map((row) => row.district),
      GEOGRAPHIC_REPORT_DISTRICT_RANKING_HARD_LIMIT
    );
    const trend = buildTrend(rawCases);

    const caseRows = rawCases.map((row) => toCaseRow(row, presence.get(String(row.id)) === true));
    const listedCases = caseRows.slice(0, GEOGRAPHIC_REPORT_CASE_LIST_HARD_LIMIT);
    const listedNoCoord = withoutCoords
      .map((row) => toCaseRow(row, false))
      .slice(0, GEOGRAPHIC_REPORT_NO_COORDINATE_LIST_HARD_LIMIT);

    if (caseRows.length > GEOGRAPHIC_REPORT_CASE_LIST_HARD_LIMIT) warnings.push("CASE_LIST_TRUNCATED");
    if (withoutCoords.length > GEOGRAPHIC_REPORT_NO_COORDINATE_LIST_HARD_LIMIT) warnings.push("NO_COORDINATE_LIST_TRUNCATED");
    if (provinceRank.truncated) warnings.push("PROVINCE_RANKING_TRUNCATED");
    if (districtRank.truncated) warnings.push("DISTRICT_RANKING_TRUNCATED");
    if (trend.clamped) warnings.push("TREND_CLAMPED");

    return {
      filters,
      effectivePeriod,
      limits: resultLimits(),
      warnings,
      truncation: {
        cases: caseRows.length > GEOGRAPHIC_REPORT_CASE_LIST_HARD_LIMIT,
        noCoordinateCases: withoutCoords.length > GEOGRAPHIC_REPORT_NO_COORDINATE_LIST_HARD_LIMIT,
        provinceRanking: provinceRank.truncated,
        districtRanking: districtRank.truncated,
        monthlyTrend: trend.clamped,
      },
      summary: {
        totalCases,
        casesWithCoordinates: withCoords.length,
        casesWithoutCoordinates: withoutCoords.length,
        distinctProvinceCount: distinctNamedCount(rawCases.map((row) => row.province)),
        distinctDistrictCount: distinctNamedCount(rawCases.map((row) => row.district)),
      },
      provinceRanking: provinceRank.rows,
      districtRanking: districtRank.rows,
      seizureGroups: aggregateSeizures(seizedRows as Array<{
        drugCategory: unknown;
        measurementKind: unknown;
        quantity: unknown;
        weightGrams: unknown;
        unit: unknown;
      }>),
      monthlyTrend: trend.buckets,
      cases: listedCases,
      noCoordinateCases: listedNoCoord,
    };
  }
}
