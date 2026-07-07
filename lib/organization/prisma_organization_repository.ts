/**
 * PrismaOrganizationRepository (Phase 20A).
 *
 * The production OrganizationRepository, backed by the Region/Battalion/
 * Company/UnresolvedOrganizationCode tables in Supabase/PostgreSQL. Depends
 * on a narrow, hand-written OrganizationDbClient delegate (mirrors the
 * Gallery's AssetDbClient pattern) rather than the concrete PrismaClient, so
 * it stays decoupled from Prisma's generated types and testable with a fake.
 *
 * Idempotent: every upsert is keyed on the model's unique `code`.
 */

import type { Battalion, Company, CompanyWithAncestry, Region, UnresolvedOrganizationCode } from "@/lib/organization/organization_types";
import type { OrganizationRepository } from "@/lib/organization/organization_repository";

interface RegionRow {
  id: number;
  code: string;
  nameTh: string;
  displayOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface BattalionRow {
  id: number;
  code: string;
  nameTh: string;
  regionId: number;
  displayOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface CompanyRow {
  id: number;
  code: string;
  nameTh: string;
  battalionId: number;
  displayOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface UnresolvedRow {
  id: number;
  raw: string;
  reason: string;
  sourceModule: string;
  createdAt: Date | string;
}

interface RegionDelegate {
  findUnique(args: { where: { code: string } }): Promise<RegionRow | null>;
  findMany(args?: { orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">> }): Promise<RegionRow[]>;
  upsert(args: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<RegionRow>;
}

interface BattalionDelegate {
  findUnique(args: { where: { code: string } }): Promise<BattalionRow | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  }): Promise<BattalionRow[]>;
  upsert(args: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<BattalionRow>;
}

interface CompanyDelegate {
  findUnique(args: { where: { code: string } }): Promise<CompanyRow | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  }): Promise<CompanyRow[]>;
  upsert(args: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<CompanyRow>;
}

interface UnresolvedDelegate {
  create(args: { data: Record<string, unknown> }): Promise<UnresolvedRow>;
  findMany(args?: { where?: Record<string, unknown> }): Promise<UnresolvedRow[]>;
}

/** The client surface this repository depends on. Structurally satisfied by PrismaClient and by fakes. */
export interface OrganizationDbClient {
  region: RegionDelegate;
  battalion: BattalionDelegate;
  company: CompanyDelegate;
  unresolvedOrganizationCode: UnresolvedDelegate;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function rowToRegion(row: RegionRow): Region {
  return { id: row.id, code: row.code, nameTh: row.nameTh, displayOrder: row.displayOrder, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
}

function rowToBattalion(row: BattalionRow): Battalion {
  return { id: row.id, code: row.code, nameTh: row.nameTh, regionId: row.regionId, displayOrder: row.displayOrder, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
}

function rowToCompany(row: CompanyRow): Company {
  return { id: row.id, code: row.code, nameTh: row.nameTh, battalionId: row.battalionId, displayOrder: row.displayOrder, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
}

function rowToUnresolved(row: UnresolvedRow): UnresolvedOrganizationCode {
  return { id: row.id, raw: row.raw, reason: row.reason, sourceModule: row.sourceModule, createdAt: toIso(row.createdAt) };
}

export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: OrganizationDbClient) {}

  async upsertRegion(code: string, nameTh: string, displayOrder: number): Promise<Region> {
    const row = await this.db.region.upsert({
      where: { code },
      create: { code, nameTh, displayOrder },
      update: { nameTh, displayOrder },
    });
    return rowToRegion(row);
  }

  async upsertBattalion(code: string, nameTh: string, regionId: number, displayOrder: number): Promise<Battalion> {
    const row = await this.db.battalion.upsert({
      where: { code },
      create: { code, nameTh, regionId, displayOrder },
      update: { nameTh, regionId, displayOrder },
    });
    return rowToBattalion(row);
  }

  async upsertCompany(code: string, nameTh: string, battalionId: number, displayOrder: number): Promise<Company> {
    const row = await this.db.company.upsert({
      where: { code },
      create: { code, nameTh, battalionId, displayOrder },
      update: { nameTh, battalionId, displayOrder },
    });
    return rowToCompany(row);
  }

  async findRegionByCode(code: string): Promise<Region | null> {
    const row = await this.db.region.findUnique({ where: { code } });
    return row ? rowToRegion(row) : null;
  }

  async findBattalionByCode(code: string): Promise<Battalion | null> {
    const row = await this.db.battalion.findUnique({ where: { code } });
    return row ? rowToBattalion(row) : null;
  }

  async findCompanyByCode(code: string): Promise<CompanyWithAncestry | null> {
    const companyRow = await this.db.company.findUnique({ where: { code } });
    if (!companyRow) return null;
    const battalionRows = await this.db.battalion.findMany({ where: { id: companyRow.battalionId } });
    const battalionRow = battalionRows[0];
    if (!battalionRow) return null;
    const regionRows = await this.db.region.findMany();
    const regionRow = regionRows.find((r) => r.id === battalionRow.regionId);
    if (!regionRow) return null;
    return { ...rowToCompany(companyRow), battalion: rowToBattalion(battalionRow), region: rowToRegion(regionRow) };
  }

  async listRegions(): Promise<Region[]> {
    const rows = await this.db.region.findMany({ orderBy: [{ displayOrder: "asc" }, { code: "asc" }] });
    return rows.map(rowToRegion);
  }

  async listBattalions(regionCode?: string): Promise<Battalion[]> {
    if (regionCode !== undefined) {
      const region = await this.findRegionByCode(regionCode);
      if (!region) return [];
      const rows = await this.db.battalion.findMany({ where: { regionId: region.id }, orderBy: [{ displayOrder: "asc" }, { code: "asc" }] });
      return rows.map(rowToBattalion);
    }
    const rows = await this.db.battalion.findMany({ orderBy: [{ displayOrder: "asc" }, { code: "asc" }] });
    return rows.map(rowToBattalion);
  }

  async listCompanies(battalionCode?: string): Promise<Company[]> {
    if (battalionCode !== undefined) {
      const battalion = await this.findBattalionByCode(battalionCode);
      if (!battalion) return [];
      const rows = await this.db.company.findMany({ where: { battalionId: battalion.id }, orderBy: [{ displayOrder: "asc" }, { code: "asc" }] });
      return rows.map(rowToCompany);
    }
    const rows = await this.db.company.findMany({ orderBy: [{ displayOrder: "asc" }, { code: "asc" }] });
    return rows.map(rowToCompany);
  }

  async recordUnresolved(raw: string, reason: string, sourceModule: string): Promise<UnresolvedOrganizationCode> {
    const row = await this.db.unresolvedOrganizationCode.create({ data: { raw, reason, sourceModule } });
    return rowToUnresolved(row);
  }

  async listUnresolved(sourceModule?: string): Promise<UnresolvedOrganizationCode[]> {
    const rows = await this.db.unresolvedOrganizationCode.findMany(
      sourceModule !== undefined ? { where: { sourceModule } } : undefined
    );
    return rows.map(rowToUnresolved);
  }
}
