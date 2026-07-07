/**
 * OfficerQueryRepository (Phase 13, read-only).
 *
 * Repository-pattern READ access for the API over an injected
 * ReadDatabaseClient. New repository (Phase 12 write repositories untouched);
 * follows the same pattern. No SQL — only Prisma delegate calls. Supports
 * pagination (skip/take), filtering, sorting, and search with contains/
 * startsWith/exact + case-insensitivity, all backed by the schema's indexes.
 *
 * Constructor-injected client; no globals, no singleton.
 */

import type {
  MatchMode,
  Officer,
  OfficerWithRelations,
  ReadDatabaseClient,
} from "@/lib/database/query_types";

/** Fields officers may be sorted by (whitelisted — never a raw client-supplied column). */
export type OfficerSortField =
  | "lastName"
  | "firstName"
  | "rank"
  | "careerYears"
  | "qualityScore"
  | "knowledgeScore"
  | "createdAt";

export interface OfficerListParams {
  page: number;
  pageSize: number;
  sortBy: OfficerSortField;
  sortOrder: "asc" | "desc";
  rank?: string;
  unit?: string;
  region?: string;
  minQuality?: number;
  minCareerYears?: number;
  /** Phase 20C: optional Organization master-data filters (helper references — additive). */
  regionId?: number;
  battalionId?: number;
  companyId?: number;
}

/** Search parameters — each optional; provided fields are AND-combined. */
export interface OfficerSearchParams {
  name?: string;
  rank?: string;
  unit?: string;
  phone?: string;
  position?: string;
  region?: string;
  minCareerYears?: number;
  minQuality?: number;
  /** Phase 20C: optional Organization master-data filters (helper references — additive). */
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  match: MatchMode;
  page: number;
  pageSize: number;
  sortBy: OfficerSortField;
  sortOrder: "asc" | "desc";
}

export interface PaginatedOfficers {
  data: Officer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Builds a Prisma string filter for the given match mode (always case-insensitive). */
function stringFilter(value: string, match: MatchMode): Record<string, unknown> {
  if (match === "exact") return { equals: value, mode: "insensitive" };
  if (match === "startsWith") return { startsWith: value, mode: "insensitive" };
  return { contains: value, mode: "insensitive" };
}

export class OfficerQueryRepository {
  constructor(private readonly db: ReadDatabaseClient) {}

  /** Lists officers with pagination, filtering, and sorting. */
  async list(params: OfficerListParams): Promise<PaginatedOfficers> {
    const where: Record<string, unknown> = {};
    if (params.rank) where.rank = stringFilter(params.rank, "exact");
    if (params.unit) where.currentUnit = stringFilter(params.unit, "contains");
    if (params.region) where.region = stringFilter(params.region, "exact");
    if (typeof params.minQuality === "number") where.qualityScore = { gte: params.minQuality };
    if (typeof params.minCareerYears === "number") where.careerYears = { gte: params.minCareerYears };
    if (typeof params.regionId === "number") where.regionId = params.regionId;
    if (typeof params.battalionId === "number") where.battalionId = params.battalionId;
    if (typeof params.companyId === "number") where.companyId = params.companyId;

    return this.paginate(where, params.page, params.pageSize, params.sortBy, params.sortOrder);
  }

  /**
   * Searches officers across name/rank/unit/phone/position/region + numeric
   * thresholds, with the given text match mode. `name` matches either first or
   * last name.
   */
  async search(params: OfficerSearchParams): Promise<PaginatedOfficers> {
    const and: Array<Record<string, unknown>> = [];

    if (params.name) {
      and.push({
        OR: [
          { firstName: stringFilter(params.name, params.match) },
          { lastName: stringFilter(params.name, params.match) },
        ],
      });
    }
    if (params.rank) and.push({ rank: stringFilter(params.rank, params.match) });
    if (params.unit) and.push({ currentUnit: stringFilter(params.unit, params.match) });
    if (params.phone) and.push({ phone: stringFilter(params.phone, params.match) });
    if (params.position) and.push({ currentPosition: stringFilter(params.position, params.match) });
    if (params.region) and.push({ region: stringFilter(params.region, params.match) });
    if (typeof params.minCareerYears === "number") and.push({ careerYears: { gte: params.minCareerYears } });
    if (typeof params.minQuality === "number") and.push({ qualityScore: { gte: params.minQuality } });
    if (typeof params.regionId === "number") and.push({ regionId: params.regionId });
    if (typeof params.battalionId === "number") and.push({ battalionId: params.battalionId });
    if (typeof params.companyId === "number") and.push({ companyId: params.companyId });

    const where = and.length > 0 ? { AND: and } : {};
    return this.paginate(where, params.page, params.pageSize, params.sortBy, params.sortOrder);
  }

  /** Fetches one officer with its timeline (ordered by sequence), phones, education, and training. */
  async findByOfficerId(officerId: string): Promise<OfficerWithRelations | null> {
    const officer = await this.db.officer.findUnique({
      where: { officerId },
      include: {
        timeline: { orderBy: { sequence: "asc" } },
        phones: true,
        education: { orderBy: { id: "asc" } },
        training: { orderBy: { id: "asc" } },
      },
    });
    return (officer as OfficerWithRelations) ?? null;
  }

  private async paginate(
    where: Record<string, unknown>,
    page: number,
    pageSize: number,
    sortBy: OfficerSortField,
    sortOrder: "asc" | "desc"
  ): Promise<PaginatedOfficers> {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.db.officer.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take: pageSize }),
      this.db.officer.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    };
  }
}
