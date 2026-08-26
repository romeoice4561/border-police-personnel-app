/**
 * DrugCaseRepository (Phase DI-1 — Drug Intelligence Core Data Model).
 *
 * Repository-pattern data access for DrugCase and its directly-owned child
 * rows (DrugCasePerson/DrugCasePhone/DrugCaseSim/DrugCaseDevice/
 * DrugCaseVehicle/DrugSeizedItem/DrugCaseLocation) over an injected
 * DatabaseClient. Mirrors OfficerRepository/TimelineRepository's conventions
 * exactly: constructor-injected client, no globals, no SQL — only Prisma
 * delegate calls.
 *
 * Pure data access only — no permission checks, no audit writes (the
 * service layer above this does both). No OCR, no AI, no Google Drive
 * coupling — this module is completely independent of the import pipeline.
 */

import type { DatabaseClient, DrugCase } from "@/lib/database/database_types";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";

export interface DrugCaseCreateInput {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: Date | null;
  arrestTime: string | null;
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  reportingUnitText: string | null;
  /** Phase DI-7.6: หน่วยจับกุมหลัก — distinct from the reporting-unit fields above. Optional (defaults to null) so pre-DI-7.6 callers/tests keep compiling unchanged. */
  leadHeadquartersId?: number | null;
  leadRegionId?: number | null;
  leadBattalionId?: number | null;
  leadCompanyId?: number | null;
  leadUnitText?: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  narrative: string | null;
  createdBy: string;
  createdByName: string;
}

export interface DrugCasePatch {
  caseNumber?: string;
  title?: string;
  status?: string;
  arrestDate?: Date | null;
  arrestTime?: string | null;
  headquartersId?: number | null;
  regionId?: number | null;
  battalionId?: number | null;
  companyId?: number | null;
  reportingUnitText?: string | null;
  leadHeadquartersId?: number | null;
  leadRegionId?: number | null;
  leadBattalionId?: number | null;
  leadCompanyId?: number | null;
  leadUnitText?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  narrative?: string | null;
  updatedBy: string;
  updatedByName: string;
}

export interface DrugCaseListParams {
  page: number;
  pageSize: number;
  caseNumber?: string;
  /**
   * Section 5's single search box also matches person name and phone number
   * — NOT a full Global Intelligence Search (DI-3's scope: cross-Case/
   * Person/Phone/SIM/IMEI/Vehicle free text with ranking); this is a
   * bounded, list-page-only extension of the existing caseNumber filter, so
   * `query` is matched against caseNumber OR any linked person's name OR
   * any linked phone's normalized number for the SAME case.
   */
  query?: string;
  status?: string;
  province?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  arrestDateFrom?: Date;
  arrestDateTo?: Date;
  /**
   * Phase DI-7.6 Section 13: backend filter foundation for the future
   * Commander Dashboard — not necessarily exposed in the current list UI.
   * Lead-unit filters match DrugCase's own lead* columns directly;
   * participatingUnitId/officerId/officerRole require joining the
   * DrugCaseParticipatingUnit/DrugCaseOfficer tables, resolved in the
   * service layer (see DrugCaseService.listCases) rather than here, since
   * this repository's `list()` only ever queries DrugCase's own columns.
   */
  leadHeadquartersId?: number;
  leadRegionId?: number;
  leadBattalionId?: number;
  leadCompanyId?: number;
}

export class DrugCaseRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: string): Promise<DrugCase | null> {
    return this.db.drugCase.findUnique({ where: { id } });
  }

  create(input: DrugCaseCreateInput): Promise<DrugCase> {
    return this.db.drugCase.create({
      data: {
        ...input,
        leadHeadquartersId: input.leadHeadquartersId ?? null,
        leadRegionId: input.leadRegionId ?? null,
        leadBattalionId: input.leadBattalionId ?? null,
        leadCompanyId: input.leadCompanyId ?? null,
        leadUnitText: input.leadUnitText ?? null,
        updatedBy: null,
        updatedByName: null,
      },
    });
  }

  async update(id: string, patch: DrugCasePatch): Promise<DrugCase | null> {
    const existing = await this.db.drugCase.findUnique({ where: { id } });
    if (!existing) return null;
    return this.db.drugCase.update({ where: { id }, data: { ...patch } });
  }

  /**
   * Section 16's list page: filtered, paginated. `findMany`'s narrow
   * ModelDelegate contract has no built-in skip/take/orderBy-by-multiple-
   * fields, so pagination is done in-memory over the filtered set — the
   * table is expected to stay small in DI-1 (no case-load projection
   * suggests this needs cursor pagination yet); a future phase can swap this
   * for a real repository with raw skip/take if volume grows.
   *
   * `query` (Section 5's single search box) additionally matches any linked
   * person's name/alias or any linked phone's number for the case — resolved
   * as a set of matching caseIds BEFORE the main filter, kept bounded (never
   * a cross-entity ranked search — that is DI-3's Global Intelligence Search).
   */
  async list(params: DrugCaseListParams): Promise<{ rows: DrugCase[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.province) where.province = params.province;
    if (params.headquartersId !== undefined) where.headquartersId = params.headquartersId;
    if (params.regionId !== undefined) where.regionId = params.regionId;
    if (params.battalionId !== undefined) where.battalionId = params.battalionId;
    if (params.companyId !== undefined) where.companyId = params.companyId;
    if (params.leadHeadquartersId !== undefined) where.leadHeadquartersId = params.leadHeadquartersId;
    if (params.leadRegionId !== undefined) where.leadRegionId = params.leadRegionId;
    if (params.leadBattalionId !== undefined) where.leadBattalionId = params.leadBattalionId;
    if (params.leadCompanyId !== undefined) where.leadCompanyId = params.leadCompanyId;

    const all = await this.db.drugCase.findMany({ where, orderBy: { createdAt: "desc" } });

    let matchingCaseIdsFromQuery: Set<string> | null = null;
    const query = params.query?.trim();
    if (query) {
      matchingCaseIdsFromQuery = await this.findCaseIdsMatchingQuery(query);
    }

    const filtered = all.filter((row) => {
      if (query) {
        const caseNumberMatch = row.caseNumber.toLowerCase().includes(query.toLowerCase());
        const titleMatch = row.title.toLowerCase().includes(query.toLowerCase());
        const linkedMatch = matchingCaseIdsFromQuery?.has(row.id) ?? false;
        if (!caseNumberMatch && !titleMatch && !linkedMatch) return false;
      }
      if (params.caseNumber && !row.caseNumber.toLowerCase().includes(params.caseNumber.toLowerCase())) return false;
      if (params.arrestDateFrom && (!row.arrestDate || row.arrestDate < params.arrestDateFrom)) return false;
      if (params.arrestDateTo && (!row.arrestDate || row.arrestDate > params.arrestDateTo)) return false;
      return true;
    });

    const start = (params.page - 1) * params.pageSize;
    return { rows: filtered.slice(start, start + params.pageSize), total: filtered.length };
  }

  /**
   * Resolves `query` against person names/aliases and phone numbers, then
   * returns the distinct set of caseIds those matches are linked to.
   * Deliberately three small targeted queries (never one giant fuzzy scan) —
   * bounded to exactly what Section 5 asks for.
   */
  private async findCaseIdsMatchingQuery(query: string): Promise<Set<string>> {
    const caseIds = new Set<string>();
    const lower = query.toLowerCase();

    const [allPersons, allAliases] = await Promise.all([
      this.db.drugPerson.findMany({}),
      this.db.drugPersonAlias.findMany({}),
    ]);
    const matchingPersonIds = new Set<string>();
    for (const person of allPersons) {
      if (person.primaryFullName.toLowerCase().includes(lower)) matchingPersonIds.add(person.id);
    }
    for (const alias of allAliases) {
      if (alias.fullName.toLowerCase().includes(lower)) matchingPersonIds.add(alias.personId);
    }

    const normalizedQuery = normalizePhoneMatchingKey(query);
    const matchingPhoneNumberIds = new Set<string>();
    if (normalizedQuery) {
      const phoneMatches = await this.db.drugPhoneNumber.findMany({});
      for (const phone of phoneMatches) {
        if (phone.normalizedNumber.includes(normalizedQuery)) matchingPhoneNumberIds.add(phone.id);
      }
    }

    if (matchingPersonIds.size > 0 || matchingPhoneNumberIds.size > 0) {
      const casePersons = await this.db.drugCasePerson.findMany({});
      for (const cp of casePersons) {
        if (matchingPersonIds.has(cp.personId)) caseIds.add(cp.caseId);
      }
      if (matchingPhoneNumberIds.size > 0) {
        const casePhones = await this.db.drugCasePhone.findMany({});
        for (const cp of casePhones) {
          if (matchingPhoneNumberIds.has(cp.phoneNumberId)) caseIds.add(cp.caseId);
        }
      }
    }

    return caseIds;
  }

  countPersonsForCase(caseId: string): Promise<number> {
    return this.db.drugCasePerson.count({ where: { caseId } });
  }
  countPhonesForCase(caseId: string): Promise<number> {
    return this.db.drugCasePhone.count({ where: { caseId } });
  }
  countSimsForCase(caseId: string): Promise<number> {
    return this.db.drugCaseSim.count({ where: { caseId } });
  }
  countDevicesForCase(caseId: string): Promise<number> {
    return this.db.drugCaseDevice.count({ where: { caseId } });
  }
  countVehiclesForCase(caseId: string): Promise<number> {
    return this.db.drugCaseVehicle.count({ where: { caseId } });
  }
  countSeizedItemsForCase(caseId: string): Promise<number> {
    return this.db.drugSeizedItem.count({ where: { caseId } });
  }

  /** Section 12's list/workspace summary — raw seized-item rows for one case, for the caller to format (e.g. "ยาบ้า 20,000 เม็ด"). */
  seizedItemsForCase(caseId: string) {
    return this.db.drugSeizedItem.findMany({ where: { caseId } });
  }

  /** Section 13's location list — raw DrugCaseLocation link rows for one case (caller resolves the DrugLocation row per link). */
  caseLocationsForCase(caseId: string) {
    return this.db.drugCaseLocation.findMany({ where: { caseId } });
  }

  /** Section 9's phone list for the Case Workspace — raw DrugCasePhone link rows for one case. */
  casePhonesForCase(caseId: string) {
    return this.db.drugCasePhone.findMany({ where: { caseId } });
  }

  /** Section 7's SIM list for the Case Workspace. */
  caseSimsForCase(caseId: string) {
    return this.db.drugCaseSim.findMany({ where: { caseId } });
  }

  /** Section 10's device list for the Case Workspace. */
  caseDevicesForCase(caseId: string) {
    return this.db.drugCaseDevice.findMany({ where: { caseId } });
  }

  /** Section 11's vehicle list for the Case Workspace. */
  caseVehiclesForCase(caseId: string) {
    return this.db.drugCaseVehicle.findMany({ where: { caseId } });
  }

  /** DI-3 Section 8: every case, for Global Search's broad case-number/title in-memory scan — same "load then filter" shape `findCaseIdsMatchingQuery` above already uses. `caseNumber` has no unique constraint (Section 4: units may share numbering), so this can never be a single findUnique. */
  findAllCases(): Promise<DrugCase[]> {
    return this.db.drugCase.findMany({});
  }
}
