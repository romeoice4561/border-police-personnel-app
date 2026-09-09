/**
 * DI-10E.6A — Bounded interactive Map V2 query foundation.
 *
 * Dedicated loader for the future live Drug Intelligence Map. Not wired to
 * GET /api/drug-intelligence/map. Does not call the live Map loader, the
 * geographic report query service, or the shared case-list repository.
 *
 * Dates, category, and person filters are Prisma `where` predicates
 * (`arrestDate` gte/lte, `seizedItems.some`, `persons.some`). Reporting and
 * lead-arrest org columns stay independent. Coordinate-capable count matches
 * marker resolution exactly: complete DrugCase pair, otherwise the first
 * ARREST_LOCATION by id ASC if THAT location has a complete pair. Later
 * ARREST_LOCATION rows are never alternative fallbacks.
 *
 * Query count is fixed with respect to matching N (counts + groupBy + at
 * most one bounded marker select + one list page + batched locations).
 */

import type { DatabaseClient, PrismaOrderDirection } from "@/lib/database/database_types";
import { parseExportIsoEnd, parseExportIsoStart } from "@/lib/drug_intelligence/drug_export_period";
import { isValidDrugCaseStatus, type DrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import { resolveDrugGeoCoordinate } from "@/lib/drug_intelligence/drug_geo_marker";
import { isValidDrugCategory, type DrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ARREST_LOCATION_ROLE = "ARREST_LOCATION";

export const MAP_MARKER_SOFT_LIMIT = 500;
export const MAP_MARKER_HARD_LIMIT = 2000;
export const MAP_LIST_DEFAULT_PAGE_SIZE = 50;
export const MAP_LIST_MAX_PAGE_SIZE = 100;
export const MAP_UNKNOWN_PROVINCE_LABEL = "ไม่ระบุจังหวัด";
/** Full foundation `load()` must stay at or under this many DB calls. */
export const MAP_QUERY_MAX_DB_CALLS = 15;

export type DrugMapWarningCode = "MARKER_SOFT_LIMIT" | "MARKER_LIMIT";

export interface DrugMapQueryInput {
  dateFrom?: string;
  dateTo?: string;
  status?: DrugCaseStatus;
  drugCategory?: DrugCategory;
  province?: string;
  district?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  leadHeadquartersId?: number;
  leadRegionId?: number;
  leadBattalionId?: number;
  leadCompanyId?: number;
  personId?: string;
  page?: number;
  pageSize?: number;
}

export interface DrugMapMarkerRow {
  caseId: string;
  latitude: number;
  longitude: number;
  coordinateSource: "CASE" | "ARREST_LOCATION";
  caseNumber: string;
  arrestDate: string | null;
  province: string | null;
  district: string | null;
  status: string;
  locationName: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
}

export interface DrugMapListRow {
  caseId: string;
  caseNumber: string;
  arrestDate: string | null;
  province: string | null;
  district: string | null;
  locationName: string | null;
  status: string;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  hasCoordinates: boolean;
}

export interface DrugMapProvinceRow {
  province: string;
  unspecified: boolean;
  caseCount: number;
  withCoordinates: number;
}

export interface DrugMapQueryResult {
  summary: {
    totalCases: number;
    withCoordinates: number;
    withoutCoordinates: number;
    markerCount: number;
    markerLimitReached: boolean;
    /** Named provinces only — unknown/blank is visible in `provinces[]` but does not increment this KPI. */
    provinceCount: number;
  };
  markers: DrugMapMarkerRow[];
  list: {
    items: DrugMapListRow[];
    page: number;
    pageSize: number;
    total: number;
  };
  provinces: DrugMapProvinceRow[];
  warnings: DrugMapWarningCode[];
  limits: {
    markerSoft: number;
    markerHard: number;
    listDefaultPageSize: number;
    listMaxPageSize: number;
  };
}

export class DrugMapQueryInvalidFilterError extends Error {
  constructor(message = "Invalid map query filter") {
    super(message);
    this.name = "DrugMapQueryInvalidFilterError";
  }
}

const CASE_SELECT = {
  id: true,
  caseNumber: true,
  arrestDate: true,
  province: true,
  district: true,
  locationName: true,
  status: true,
  reportingUnitText: true,
  leadUnitText: true,
  latitude: true,
  longitude: true,
} as const;

interface CaseSelectRow {
  id: unknown;
  caseNumber: string;
  arrestDate: Date | string | null;
  province: string | null;
  district: string | null;
  locationName: string | null;
  status: string;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  latitude: unknown;
  longitude: unknown;
}

/**
 * V2 order: arrestDate DESC, null last, caseNumber ASC, id ASC.
 * Prisma `{ sort, nulls }` — not createdAt.
 */
const MAP_CASE_ORDER_BY: Array<Record<string, PrismaOrderDirection>> = [
  { arrestDate: { sort: "desc", nulls: "last" } },
  { caseNumber: "asc" },
  { id: "asc" },
];

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const y = year ?? 0;
  const m = month;
  const d = day;
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date.getUTCFullYear() === y && date.getUTCMonth() === (m ?? 1) - 1 && date.getUTCDate() === d;
}

function optionalPositiveInt(value: number | undefined): number | undefined {
  if (value == null) return undefined;
  if (!Number.isInteger(value) || value <= 0) throw new DrugMapQueryInvalidFilterError();
  return value;
}

function optionalText(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function normalizeDrugMapQueryInput(input: DrugMapQueryInput): DrugMapQueryInput {
  const dateFrom = optionalText(input.dateFrom);
  const dateTo = optionalText(input.dateTo);
  if (dateFrom && !isValidIsoDate(dateFrom)) throw new DrugMapQueryInvalidFilterError();
  if (dateTo && !isValidIsoDate(dateTo)) throw new DrugMapQueryInvalidFilterError();
  if (dateFrom && dateTo && dateFrom > dateTo) throw new DrugMapQueryInvalidFilterError();

  const status = input.status;
  if (status != null && !isValidDrugCaseStatus(status)) throw new DrugMapQueryInvalidFilterError();
  const drugCategory = input.drugCategory;
  if (drugCategory != null && !isValidDrugCategory(drugCategory)) throw new DrugMapQueryInvalidFilterError();

  const personId = optionalText(input.personId);
  if (personId && (/[\\/]/.test(personId) || personId.length > 64)) throw new DrugMapQueryInvalidFilterError();

  const normalized: DrugMapQueryInput = {};
  if (dateFrom) normalized.dateFrom = dateFrom;
  if (dateTo) normalized.dateTo = dateTo;
  if (status) normalized.status = status;
  if (drugCategory) normalized.drugCategory = drugCategory;
  const headquartersId = optionalPositiveInt(input.headquartersId);
  const regionId = optionalPositiveInt(input.regionId);
  const battalionId = optionalPositiveInt(input.battalionId);
  const companyId = optionalPositiveInt(input.companyId);
  const leadHeadquartersId = optionalPositiveInt(input.leadHeadquartersId);
  const leadRegionId = optionalPositiveInt(input.leadRegionId);
  const leadBattalionId = optionalPositiveInt(input.leadBattalionId);
  const leadCompanyId = optionalPositiveInt(input.leadCompanyId);
  if (headquartersId != null) normalized.headquartersId = headquartersId;
  if (regionId != null) normalized.regionId = regionId;
  if (battalionId != null) normalized.battalionId = battalionId;
  if (companyId != null) normalized.companyId = companyId;
  if (leadHeadquartersId != null) normalized.leadHeadquartersId = leadHeadquartersId;
  if (leadRegionId != null) normalized.leadRegionId = leadRegionId;
  if (leadBattalionId != null) normalized.leadBattalionId = leadBattalionId;
  if (leadCompanyId != null) normalized.leadCompanyId = leadCompanyId;
  const province = optionalText(input.province);
  const district = optionalText(input.district);
  if (province) normalized.province = province;
  if (district) normalized.district = district;
  if (personId) normalized.personId = personId;
  return normalized;
}

export function normalizeDrugMapListPage(input: DrugMapQueryInput): { page: number; pageSize: number } {
  const page = Number.isInteger(input.page) && (input.page as number) >= 1 ? (input.page as number) : 1;
  const requested = input.pageSize;
  const pageSize =
    !Number.isInteger(requested) || (requested as number) < 1
      ? MAP_LIST_DEFAULT_PAGE_SIZE
      : Math.min(requested as number, MAP_LIST_MAX_PAGE_SIZE);
  return { page, pageSize };
}

/**
 * Prisma DrugCase `where`: scalar/org/date plus relation EXISTS for
 * category and person. One-sided date ranges are allowed (current Map).
 */
export function buildDrugMapCaseWhere(filter: DrugMapQueryInput): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filter.dateFrom && filter.dateTo) {
    where.arrestDate = { gte: parseExportIsoStart(filter.dateFrom), lte: parseExportIsoEnd(filter.dateTo) };
  } else if (filter.dateFrom) {
    where.arrestDate = { gte: parseExportIsoStart(filter.dateFrom) };
  } else if (filter.dateTo) {
    where.arrestDate = { lte: parseExportIsoEnd(filter.dateTo) };
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

/** Complete DrugCase lat/lng pair — step 1 of resolveDrugGeoCoordinate. */
export function buildDrugMapDirectCoordinateWhere(): Record<string, unknown> {
  return {
    AND: [{ latitude: { not: null } }, { longitude: { not: null } }],
  };
}

/** Inverse of a complete DrugCase pair (partial or missing). */
export function buildDrugMapIncompleteCoordinateWhere(): Record<string, unknown> {
  return {
    OR: [{ latitude: null }, { longitude: null }],
  };
}

export function andWhere(...clauses: Record<string, unknown>[]): Record<string, unknown> {
  const compact = clauses.filter((clause) => Object.keys(clause).length > 0);
  if (compact.length === 0) return {};
  if (compact.length === 1) return compact[0] as Record<string, unknown>;
  return { AND: compact };
}

function toCoordNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoArrestDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function isUnspecifiedProvince(value: string | null | undefined): boolean {
  return (value?.trim() ?? "") === "";
}

function groupCount(row: Record<string, unknown>): number {
  const count = row._count;
  if (typeof count === "number") return count;
  if (count && typeof count === "object" && "_all" in count) return Number((count as { _all: unknown })._all) || 0;
  return 0;
}

function compareProvinces(a: DrugMapProvinceRow, b: DrugMapProvinceRow): number {
  if (a.caseCount !== b.caseCount) return b.caseCount - a.caseCount;
  if (a.unspecified !== b.unspecified) return a.unspecified ? 1 : -1;
  return a.province.localeCompare(b.province, "th");
}


export class DrugMapQueryService {
  constructor(private readonly db: DatabaseClient) {}

  async load(input: DrugMapQueryInput = {}): Promise<DrugMapQueryResult> {
    const filters = normalizeDrugMapQueryInput(input);
    const { page, pageSize } = normalizeDrugMapListPage(input);
    const where = buildDrugMapCaseWhere(filters);
    const directWhere = andWhere(where, buildDrugMapDirectCoordinateWhere());
    const incompleteWhere = andWhere(where, buildDrugMapIncompleteCoordinateWhere());

    const [totalCases, directCount, provinceGroups, provinceDirectGroups] = await Promise.all([
      this.db.drugCase.count({ where }),
      this.db.drugCase.count({ where: directWhere }),
      this.groupByProvince(where),
      this.groupByProvince(directWhere),
    ]);

    const firstArrestByCase =
      totalCases - directCount > 0 ? await this.loadFirstArrestLocations(incompleteWhere) : new Map<string, { latitude: unknown; longitude: unknown }>();
    const fallbackCompleteIds: string[] = [];
    for (const [caseId, arrest] of firstArrestByCase) {
      if (toCoordNumber(arrest.latitude) !== null && toCoordNumber(arrest.longitude) !== null) {
        fallbackCompleteIds.push(caseId);
      }
    }

    const withCoordinates = directCount + fallbackCompleteIds.length;
    const withoutCoordinates = totalCases - withCoordinates;

    const warnings: DrugMapWarningCode[] = [];
    const markerLimitReached = withCoordinates > MAP_MARKER_HARD_LIMIT;
    if (markerLimitReached) warnings.push("MARKER_LIMIT");
    else if (withCoordinates > MAP_MARKER_SOFT_LIMIT) warnings.push("MARKER_SOFT_LIMIT");

    const markerWhere =
      fallbackCompleteIds.length === 0
        ? directWhere
        : { OR: [directWhere, { id: { in: fallbackCompleteIds } }] };

    const markerPromise =
      !markerLimitReached && withCoordinates > 0
        ? this.db.drugCase.findMany({
            where: markerWhere,
            orderBy: MAP_CASE_ORDER_BY,
            take: Math.min(withCoordinates, MAP_MARKER_HARD_LIMIT),
            select: CASE_SELECT,
          })
        : Promise.resolve([]);

    const listPromise = this.db.drugCase.findMany({
      where,
      orderBy: MAP_CASE_ORDER_BY,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: CASE_SELECT,
    });

    const fallbackProvincePromise =
      fallbackCompleteIds.length > 0
        ? this.groupByProvince({ id: { in: fallbackCompleteIds } })
        : Promise.resolve([] as Array<Record<string, unknown>>);

    const [rawMarkers, rawList, provinceFallbackGroups] = await Promise.all([markerPromise, listPromise, fallbackProvincePromise]);
    const markerRows = rawMarkers as unknown as CaseSelectRow[];
    const listRows = rawList as unknown as CaseSelectRow[];

    const markers: DrugMapMarkerRow[] = [];
    if (!markerLimitReached) {
      for (const row of markerRows) {
        const marker = this.toMarker(row, firstArrestByCase.get(String(row.id)));
        if (marker) markers.push(marker);
      }
    }

    const listItems = listRows.map((row) => this.toListRow(row, firstArrestByCase.get(String(row.id))));
    const provinces = this.mergeProvinceAggregates(provinceGroups, [...provinceDirectGroups, ...provinceFallbackGroups]);

    return {
      summary: {
        totalCases,
        withCoordinates,
        withoutCoordinates,
        markerCount: markers.length,
        markerLimitReached,
        provinceCount: provinces.filter((row) => !row.unspecified).length,
      },
      markers,
      list: {
        items: listItems,
        page,
        pageSize,
        total: totalCases,
      },
      provinces,
      warnings,
      limits: {
        markerSoft: MAP_MARKER_SOFT_LIMIT,
        markerHard: MAP_MARKER_HARD_LIMIT,
        listDefaultPageSize: MAP_LIST_DEFAULT_PAGE_SIZE,
        listMaxPageSize: MAP_LIST_MAX_PAGE_SIZE,
      },
    };
  }

  private async groupByProvince(where: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    const groupBy = this.db.drugCase.groupBy;
    if (!groupBy) {
      throw new Error("DatabaseClient.drugCase.groupBy is required for DrugMapQueryService");
    }
    return groupBy.call(this.db.drugCase, { by: ["province"], where, _count: { _all: true } });
  }

  /**
   * First ARREST_LOCATION per matching incomplete-pair case, ordered by
   * DrugCaseLocation.id ASC. One link query + one location IN query.
   * Later ARREST_LOCATION rows are ignored.
   */
  private async loadFirstArrestLocations(
    incompleteMatchingWhere: Record<string, unknown>
  ): Promise<Map<string, { latitude: unknown; longitude: unknown }>> {
    const links = (await this.db.drugCaseLocation.findMany({
      where: { role: ARREST_LOCATION_ROLE, case: incompleteMatchingWhere },
      orderBy: [{ caseId: "asc" }, { id: "asc" }],
      select: { id: true, caseId: true, locationId: true },
    })) as Array<{ caseId: unknown; locationId: unknown }>;

    const firstLinkByCase = new Map<string, unknown>();
    for (const link of links) {
      const caseId = String(link.caseId);
      if (!firstLinkByCase.has(caseId)) firstLinkByCase.set(caseId, link.locationId);
    }
    const locationIds = [...new Set([...firstLinkByCase.values()].filter((id) => id != null))];
    if (locationIds.length === 0) return new Map();

    const locations = (await this.db.drugLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, latitude: true, longitude: true },
    })) as Array<{ id: unknown; latitude: unknown; longitude: unknown }>;
    const locationById = new Map(locations.map((loc) => [String(loc.id), loc]));

    const arrestByCase = new Map<string, { latitude: unknown; longitude: unknown }>();
    for (const [caseId, locationId] of firstLinkByCase) {
      const loc = locationById.get(String(locationId));
      if (loc) arrestByCase.set(caseId, loc);
    }
    return arrestByCase;
  }

  private resolvedCoordinate(row: CaseSelectRow, arrest: { latitude: unknown; longitude: unknown } | undefined) {
    return resolveDrugGeoCoordinate({
      caseLatitude: toCoordNumber(row.latitude),
      caseLongitude: toCoordNumber(row.longitude),
      arrestLocationLatitude: toCoordNumber(arrest?.latitude),
      arrestLocationLongitude: toCoordNumber(arrest?.longitude),
    });
  }

  private toMarker(row: CaseSelectRow, arrest: { latitude: unknown; longitude: unknown } | undefined): DrugMapMarkerRow | null {
    const coord = this.resolvedCoordinate(row, arrest);
    if (!coord) return null;
    return {
      caseId: String(row.id),
      latitude: coord.latitude,
      longitude: coord.longitude,
      coordinateSource: coord.source,
      caseNumber: row.caseNumber,
      arrestDate: isoArrestDate(row.arrestDate),
      province: row.province,
      district: row.district,
      status: row.status,
      locationName: row.locationName,
      reportingUnitText: row.reportingUnitText,
      leadUnitText: row.leadUnitText,
    };
  }

  private toListRow(row: CaseSelectRow, arrest: { latitude: unknown; longitude: unknown } | undefined): DrugMapListRow {
    return {
      caseId: String(row.id),
      caseNumber: row.caseNumber,
      arrestDate: isoArrestDate(row.arrestDate),
      province: row.province,
      district: row.district,
      locationName: row.locationName,
      status: row.status,
      reportingUnitText: row.reportingUnitText,
      leadUnitText: row.leadUnitText,
      hasCoordinates: this.resolvedCoordinate(row, arrest) !== null,
    };
  }

  private mergeProvinceAggregates(
    allGroups: Array<Record<string, unknown>>,
    coordGroups: Array<Record<string, unknown>>
  ): DrugMapProvinceRow[] {
    const coordByKey = new Map<string, number>();
    for (const row of coordGroups) {
      const key = isUnspecifiedProvince(row.province as string | null) ? "" : String(row.province);
      coordByKey.set(key, (coordByKey.get(key) ?? 0) + groupCount(row));
    }

    const merged = new Map<string, DrugMapProvinceRow>();
    for (const row of allGroups) {
      const unspecified = isUnspecifiedProvince(row.province as string | null);
      const key = unspecified ? "" : String(row.province);
      const existing = merged.get(key);
      const caseCount = groupCount(row);
      if (existing) {
        existing.caseCount += caseCount;
        continue;
      }
      merged.set(key, {
        province: unspecified ? MAP_UNKNOWN_PROVINCE_LABEL : key,
        unspecified,
        caseCount,
        withCoordinates: 0,
      });
    }
    for (const [key, withCoordinates] of coordByKey) {
      const existing = merged.get(key);
      if (existing) existing.withCoordinates = withCoordinates;
    }
    return [...merged.values()].sort(compareProvinces);
  }
}
