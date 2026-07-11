/**
 * OrganizationRepository (Phase 20A).
 *
 * The persistence CONTRACT for the Region/Battalion/Company master hierarchy
 * plus the unresolved-code review queue, and two implementations:
 *   - PrismaOrganizationRepository: production, backed by a narrow
 *     OrganizationDbClient delegate (mirrors the Gallery's AssetDbClient
 *     pattern) so it is decoupled from Prisma's generated types.
 *   - InMemoryOrganizationRepository: reference/test implementation.
 *
 * Idempotent: seeding upserts by unique code, so re-running the seed never
 * duplicates rows. No OCR, no AI, no officer tables, no globals, no singleton.
 */

import type { Battalion, Company, CompanyWithAncestry, OrganizationAliasEntry, Region, UnresolvedOrganizationCode } from "@/lib/organization/organization_types";

export interface OrganizationRepository {
  upsertRegion(code: string, nameTh: string, displayOrder: number): Promise<Region>;
  upsertBattalion(code: string, nameTh: string, regionId: number, displayOrder: number): Promise<Battalion>;
  upsertCompany(code: string, nameTh: string, battalionId: number, displayOrder: number): Promise<Company>;

  findRegionByCode(code: string): Promise<Region | null>;
  findBattalionByCode(code: string): Promise<Battalion | null>;
  findCompanyByCode(code: string): Promise<CompanyWithAncestry | null>;

  listRegions(): Promise<Region[]>;
  listBattalions(regionCode?: string): Promise<Battalion[]>;
  listCompanies(battalionCode?: string): Promise<Company[]>;

  /** Records a raw code that couldn't be mapped to the hierarchy, for manual review. */
  recordUnresolved(raw: string, reason: string, sourceModule: string): Promise<UnresolvedOrganizationCode>;
  listUnresolved(sourceModule?: string): Promise<UnresolvedOrganizationCode[]>;

  /** Phase 27: every registered alias (legacy/OCR-variant/unofficial text -> canonical Region/Battalion/Company). */
  listAliases(): Promise<OrganizationAliasEntry[]>;
  /** Records a new alias. Additive — never overwrites an existing alias for the same text. */
  createAlias(aliasText: string, canonical: { regionId?: number; battalionId?: number; companyId?: number }, source: string): Promise<OrganizationAliasEntry>;
}

// ---------------------------------------------------------------------------
// In-memory reference implementation (tests / DI default outside production).
// ---------------------------------------------------------------------------

export class InMemoryOrganizationRepository implements OrganizationRepository {
  private regions = new Map<string, Region>();
  private battalions = new Map<string, Battalion>();
  private companies = new Map<string, Company>();
  private unresolved: UnresolvedOrganizationCode[] = [];
  private aliases: OrganizationAliasEntry[] = [];
  private nextId = 1;

  private now(): string {
    return new Date().toISOString();
  }

  async upsertRegion(code: string, nameTh: string, displayOrder: number): Promise<Region> {
    const existing = this.regions.get(code);
    const ts = this.now();
    const region: Region = existing
      ? { ...existing, nameTh, displayOrder, updatedAt: ts }
      : { id: this.nextId++, code, nameTh, displayOrder, createdAt: ts, updatedAt: ts };
    this.regions.set(code, region);
    return region;
  }

  async upsertBattalion(code: string, nameTh: string, regionId: number, displayOrder: number): Promise<Battalion> {
    const existing = this.battalions.get(code);
    const ts = this.now();
    const battalion: Battalion = existing
      ? { ...existing, nameTh, regionId, displayOrder, updatedAt: ts }
      : { id: this.nextId++, code, nameTh, regionId, displayOrder, createdAt: ts, updatedAt: ts };
    this.battalions.set(code, battalion);
    return battalion;
  }

  async upsertCompany(code: string, nameTh: string, battalionId: number, displayOrder: number): Promise<Company> {
    const existing = this.companies.get(code);
    const ts = this.now();
    const company: Company = existing
      ? { ...existing, nameTh, battalionId, displayOrder, updatedAt: ts }
      : { id: this.nextId++, code, nameTh, battalionId, displayOrder, createdAt: ts, updatedAt: ts };
    this.companies.set(code, company);
    return company;
  }

  async findRegionByCode(code: string): Promise<Region | null> {
    return this.regions.get(code) ?? null;
  }

  async findBattalionByCode(code: string): Promise<Battalion | null> {
    return this.battalions.get(code) ?? null;
  }

  async findCompanyByCode(code: string): Promise<CompanyWithAncestry | null> {
    const company = this.companies.get(code);
    if (!company) return null;
    const battalion = [...this.battalions.values()].find((b) => b.id === company.battalionId);
    if (!battalion) return null;
    const region = [...this.regions.values()].find((r) => r.id === battalion.regionId);
    if (!region) return null;
    return { ...company, battalion, region };
  }

  async listRegions(): Promise<Region[]> {
    return [...this.regions.values()].sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  }

  async listBattalions(regionCode?: string): Promise<Battalion[]> {
    let items = [...this.battalions.values()];
    if (regionCode !== undefined) {
      const region = this.regions.get(regionCode);
      items = region ? items.filter((b) => b.regionId === region.id) : [];
    }
    return items.sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  }

  async listCompanies(battalionCode?: string): Promise<Company[]> {
    let items = [...this.companies.values()];
    if (battalionCode !== undefined) {
      const battalion = this.battalions.get(battalionCode);
      items = battalion ? items.filter((c) => c.battalionId === battalion.id) : [];
    }
    return items.sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  }

  async recordUnresolved(raw: string, reason: string, sourceModule: string): Promise<UnresolvedOrganizationCode> {
    const entry: UnresolvedOrganizationCode = { id: this.nextId++, raw, reason, sourceModule, createdAt: this.now() };
    this.unresolved.push(entry);
    return entry;
  }

  async listUnresolved(sourceModule?: string): Promise<UnresolvedOrganizationCode[]> {
    return sourceModule === undefined
      ? [...this.unresolved]
      : this.unresolved.filter((u) => u.sourceModule === sourceModule);
  }

  async listAliases(): Promise<OrganizationAliasEntry[]> {
    return [...this.aliases];
  }

  async createAlias(
    aliasText: string,
    canonical: { regionId?: number; battalionId?: number; companyId?: number },
    source: string
  ): Promise<OrganizationAliasEntry> {
    const entry: OrganizationAliasEntry = {
      id: this.nextId++,
      aliasText,
      regionId: canonical.regionId ?? null,
      battalionId: canonical.battalionId ?? null,
      companyId: canonical.companyId ?? null,
      source,
      createdAt: this.now(),
    };
    this.aliases.push(entry);
    return entry;
  }
}
