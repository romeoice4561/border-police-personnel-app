/**
 * OrganizationService (Phase 20A).
 *
 * The single entry point every future module (Officers, Gallery, Portfolio,
 * Awards, Training, Timeline, Dashboards, Permissions) should use to read the
 * Region -> Battalion -> Company master hierarchy, and to resolve a raw unit
 * string (OCR/folder text) against it. Dependency-injected over an
 * OrganizationRepository — no singleton, no globals.
 *
 * `resolveCode` never invents an organization record for a code that isn't
 * registered: an unrecognized-but-well-formed code, or one that fails the
 * region/battalion/company digit relationship, is recorded via
 * `recordUnresolved` and returned as unresolved, so callers (importers) can
 * flag it for manual review instead of polluting the master data.
 */

import type { OrganizationRepository } from "@/lib/organization/organization_repository";
import type { Battalion, Company, CompanyWithAncestry, Region, UnresolvedOrganizationCode } from "@/lib/organization/organization_types";
import { parseOrganizationCode, isBattalionConsistentWithRegion, isCompanyConsistentWithBattalion } from "@/lib/organization/organization_helpers";

export interface OrganizationServiceDependencies {
  repository: OrganizationRepository;
}

/** Outcome of resolving a raw unit-reference string against the seeded master hierarchy. */
export type OrganizationResolution =
  | { status: "resolved"; level: "company"; company: CompanyWithAncestry }
  | { status: "resolved"; level: "battalion"; battalion: Battalion; region: Region }
  | { status: "resolved"; level: "region"; region: Region }
  | { status: "unresolved"; raw: string; reason: string };

export class OrganizationService {
  private readonly repository: OrganizationRepository;

  constructor(dependencies: OrganizationServiceDependencies) {
    this.repository = dependencies.repository;
  }

  getRegions(): Promise<Region[]> {
    return this.repository.listRegions();
  }

  getBattalions(regionCode?: string): Promise<Battalion[]> {
    return this.repository.listBattalions(regionCode);
  }

  getCompanies(battalionCode?: string): Promise<Company[]> {
    return this.repository.listCompanies(battalionCode);
  }

  findCompany(code: string): Promise<CompanyWithAncestry | null> {
    return this.repository.findCompanyByCode(code);
  }

  findBattalion(code: string): Promise<Battalion | null> {
    return this.repository.findBattalionByCode(code);
  }

  findRegion(code: string): Promise<Region | null> {
    return this.repository.findRegionByCode(code);
  }

  listUnresolved(sourceModule?: string): Promise<UnresolvedOrganizationCode[]> {
    return this.repository.listUnresolved(sourceModule);
  }

  /**
   * Resolves a raw unit-reference string (e.g. a Gallery folder name or an
   * officer's OCR'd unit text) to the most specific registered organization
   * record it names. Falls back level-by-level (company -> battalion ->
   * region) and only reports "unresolved" — recording it for manual review —
   * when nothing registered matches. Never creates a new organization row.
   */
  async resolveCode(raw: string, sourceModule: string): Promise<OrganizationResolution> {
    const parsed = parseOrganizationCode(raw);

    if (parsed.status === "unresolved") {
      await this.repository.recordUnresolved(raw, parsed.reason, sourceModule);
      return { status: "unresolved", raw, reason: parsed.reason };
    }

    if (parsed.level === "company") {
      if (!isCompanyConsistentWithBattalion(parsed.companyCode, parsed.battalionCode)) {
        const reason = `Company code ${parsed.companyCode} inconsistent with battalion ${parsed.battalionCode}`;
        await this.repository.recordUnresolved(raw, reason, sourceModule);
        return { status: "unresolved", raw, reason };
      }
      const company = await this.repository.findCompanyByCode(parsed.companyCode);
      if (company) return { status: "resolved", level: "company", company };
      const reason = `Company code ${parsed.companyCode} is not a registered organization`;
      await this.repository.recordUnresolved(raw, reason, sourceModule);
      return { status: "unresolved", raw, reason };
    }

    if (parsed.level === "battalion") {
      if (!isBattalionConsistentWithRegion(parsed.battalionCode, parsed.regionCode)) {
        const reason = `Battalion code ${parsed.battalionCode} inconsistent with region ${parsed.regionCode}`;
        await this.repository.recordUnresolved(raw, reason, sourceModule);
        return { status: "unresolved", raw, reason };
      }
      const battalion = await this.repository.findBattalionByCode(parsed.battalionCode);
      const region = battalion ? await this.repository.findRegionByCode(parsed.regionCode) : null;
      if (battalion && region) return { status: "resolved", level: "battalion", battalion, region };
      const reason = `Battalion code ${parsed.battalionCode} is not a registered organization`;
      await this.repository.recordUnresolved(raw, reason, sourceModule);
      return { status: "unresolved", raw, reason };
    }

    const region = await this.repository.findRegionByCode(parsed.regionCode);
    if (region) return { status: "resolved", level: "region", region };
    const reason = `Region code ${parsed.regionCode} is not a registered organization`;
    await this.repository.recordUnresolved(raw, reason, sourceModule);
    return { status: "unresolved", raw, reason };
  }
}
