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

/** True for a query that is 1-2 digits and nothing else — too short to be a safe unqualified substring match (Phase 27 Part 9). */
function isShortNumericQuery(q: string): boolean {
  return /^\d{1,2}$/.test(q);
}

const containsInsensitive = (q: string) => ({ contains: q, mode: "insensitive" as const });

/**
 * The full broad OR fan-out for globalSearch — every free-text field,
 * unqualified `contains`. Used for non-numeric queries and for numeric
 * queries of 3+ digits (a realistic company/battalion code length).
 */
function broadContainsQueryWhere(q: string): Array<Record<string, unknown>> {
  const contains = containsInsensitive(q);
  return [
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
}

/**
 * The restricted OR fan-out for a 1-2 digit all-numeric query (Phase 27 Part
 * 9). Never searches `phone` (a short digit run is near-guaranteed to
 * substring-match some phone number). Never runs a blanket `contains`
 * against free text (position/currentUnit) — only `startsWith`, since a real
 * organization code (company/battalion number) legitimately starting with
 * these digits is the one case worth matching; a code merely CONTAINING
 * these digits elsewhere is very likely incidental. The linked
 * Region/Battalion/Company display names and officerId are still matched via
 * `contains` — those are structured/short fields where a 1-2 digit
 * substring is meaningful (e.g. "4" inside "ภาค 4" or "ภาค4/79"), not noisy
 * free text like a phone number.
 */
function shortNumericQueryWhere(q: string): Array<Record<string, unknown>> {
  const contains = containsInsensitive(q);
  const startsWith = { startsWith: q, mode: "insensitive" as const };
  return [
    { officerId: contains },
    { currentPosition: startsWith },
    { currentUnit: startsWith },
    { region: contains },
    { regionRef: { nameTh: contains } },
    { battalionRef: { nameTh: contains } },
    { companyRef: { nameTh: contains } },
  ];
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
   * every Officer field the spec lists in a single query (contains+
   * case-insensitive): first/last name, phone, officerId, rank, position,
   * region, unit, plus the linked Region/Battalion/Company display names (so
   * typing "434" finds an officer whose COMPANY is "ตชด.434" even when the
   * officer's own free-text `currentUnit` says something else).
   * `extraOfficerIds` (from other search providers, e.g. Drive filename) are
   * unioned in via a plain `officerId IN (...)` OR branch, so this repository
   * stays ignorant of ProfilePhoto/other tables.
   *
   * Phase 27 Part 9 — short all-digit queries ("1"-"2" digits, e.g. "44") are
   * NOT run through the broad `contains` fan-out above: an unqualified
   * 1-2-digit substring is too short to be meaningful against free-text
   * fields — it matches incidentally inside a phone number, an officerId, or
   * any legacy currentUnit/position string, surfacing officers with no real
   * relationship to the query (e.g. querying "44" returning a Battalion 21
   * officer purely because their PHONE NUMBER happens to contain "44").
   * Instead, a short all-digit query only matches structured numeric-ish
   * fields precisely (currentUnit/position via startsWith, never phone, never
   * a blanket contains) — see shortNumericQueryWhere below. A 3+ digit
   * numeric query (e.g. "434", realistic for a company/battalion code) still
   * uses the full broad `contains` fan-out, preserving the existing "434
   * finds ตชด.434" behavior the test suite already locks in.
   */
  async globalSearch(params: GlobalSearchParams): Promise<PaginatedOfficers> {
    const q = params.q.trim();
    const or = isShortNumericQuery(q) ? shortNumericQueryWhere(q) : broadContainsQueryWhere(q);

    if (params.extraOfficerIds && params.extraOfficerIds.length > 0) {
      or.push({ officerId: { in: [...params.extraOfficerIds] } });
    }

    const where = q.length > 0 || (params.extraOfficerIds?.length ?? 0) > 0 ? { OR: or } : {};
    return this.paginate(where, params.page, params.pageSize, params.sortBy, params.sortOrder);
  }

  /** Fetches one officer with its timeline (ordered by sequence), phones, education, training, salary history (Phase 28A), and documents (Phase 29A). */
  async findByOfficerId(officerId: string): Promise<OfficerWithRelations | null> {
    const officer = await this.db.officer.findUnique({
      where: { officerId },
      include: {
        timeline: { orderBy: { sequence: "asc" } },
        phones: true,
        education: { orderBy: { id: "asc" } },
        training: { orderBy: { id: "asc" } },
        salaryHistory: { orderBy: { yearBE: "desc" } },
        documents: { orderBy: { createdAt: "desc" } },
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
