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
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  /**
   * Phase 26B Part 6 Part M: matches officers with AT LEAST ONE timeline row
   * at this verification status (not necessarily their most-recent row —
   * finding "any REJECTED/NEEDS_REVIEW row to triage" is the useful list
   * query; identifying each officer's single "current" row would need a
   * correlated-max subquery Prisma's relation filters can't express, and is
   * out of scope for a list filter).
   */
  verificationStatus?: string;
  /** True officer has EITHER an official portrait pin OR the Phase 17B Drive-import photo identity — a coarse, cheap proxy for "resolves to a real portrait" that doesn't require running the full tiered resolver (lib/server/officer_portrait_service.ts) per row just to filter a list. */
  hasPortrait?: boolean;
  hasPhone?: boolean;
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

/**
 * Phase 26B Part B: Global Search parameters — a single free-text query `q`
 * OR-matched across every Officer field the spec lists (name/surname,
 * phone, officerId, rank, position, region, unit) in ONE query, always
 * `contains`+case-insensitive (Global Search is never exact/startsWith —
 * "should behave similar to Google search"). Additional officerIds found by
 * OTHER search providers (Drive filename, future document titles/GP7 — see
 * lib/search/) are unioned in via `extraOfficerIds`, so this repository
 * never needs to know about ProfilePhoto or any other table.
 */
export interface GlobalSearchParams {
  q: string;
  /** officerIds found by other search providers (e.g. Drive filename match), unioned into the result. */
  extraOfficerIds?: readonly string[];
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
    if (typeof params.headquartersId === "number") where.headquartersId = params.headquartersId;
    if (typeof params.regionId === "number") where.regionId = params.regionId;
    if (typeof params.battalionId === "number") where.battalionId = params.battalionId;
    if (typeof params.companyId === "number") where.companyId = params.companyId;
    if (params.verificationStatus) where.timeline = { some: { verificationStatus: params.verificationStatus } };
    if (params.hasPortrait === true) where.OR = [{ officialPortraitId: { not: null } }, { driveFileId: { not: null } }];
    if (params.hasPortrait === false) where.AND = [{ officialPortraitId: null }, { driveFileId: null }];
    if (params.hasPhone === true) where.phone = { not: null };
    if (params.hasPhone === false) where.phone = null;

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

  /**
   * Phase 26B Part B: Global Search — one free-text query OR-matched across
   * every Officer field the spec lists in a single query (always
   * contains+case-insensitive): first/last name, phone, officerId, rank,
   * position, region, unit, plus the linked Region/Battalion/Company
   * display names (so typing "434" finds an officer whose COMPANY is
   * "ตชด.434" even when the officer's own free-text `currentUnit` says
   * something else). `extraOfficerIds` (from other search providers, e.g.
   * Drive filename) are unioned in via a plain `officerId IN (...)` OR
   * branch, so this repository stays ignorant of ProfilePhoto/other tables.
   */
  async globalSearch(params: GlobalSearchParams): Promise<PaginatedOfficers> {
    const q = params.q.trim();
    const contains = { contains: q, mode: "insensitive" as const };

    const or: Array<Record<string, unknown>> = [
      { firstName: contains },
      { lastName: contains },
      { officerId: contains },
      { rank: contains },
      { currentPosition: contains },
      { currentUnit: contains },
      { phone: contains },
      { region: contains },
      { regionRef: { nameTh: contains } },
      { battalionRef: { nameTh: contains } },
      { companyRef: { nameTh: contains } },
    ];

    if (params.extraOfficerIds && params.extraOfficerIds.length > 0) {
      or.push({ officerId: { in: [...params.extraOfficerIds] } });
    }

    const where = q.length > 0 || (params.extraOfficerIds?.length ?? 0) > 0 ? { OR: or } : {};
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
