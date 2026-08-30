/**
 * DrugIntelligenceSearchService (Phase DI-3 — Sections 2, 7-9, 19-20, 24-26).
 *
 * ONE SEARCH BOX → MULTIPLE ENTITY TYPES → CLEAR RESULT GROUPING (Section
 * 2). Coordinates the existing DI-1/DI-2 repositories — never SQL/search
 * orchestration in a React component (Section 7's explicit flow: UI → API →
 * Search Service → Repositories → DB). Framework-agnostic (no React, no
 * Next.js Request type) so DI-4's future Telegram integration can call it
 * directly (Section 35).
 *
 * Performance discipline (Section 25/41 — DI-2's O(n²) identity-rebuild bug
 * must never repeat here): this service NEVER calls
 * DrugPersonMatchingService.findCandidates() or any other per-result
 * identity-rebuilding function inside a loop over search results. The one
 * per-person expensive computation it needs (hasPotentialDuplicate) is
 * fetched via DrugPersonMatchingService.findPersonIdsWithPotentialDuplicates()
 * — which already builds every identity exactly ONCE — called at most once
 * per search request, never per row.
 *
 * Ranking strategy (Section 19, deterministic, no fake AI score): each
 * entity-type branch below tries an INDEXED EXACT lookup first (phone by
 * normalizedNumber, IMEI by imei1/imei2, ICCID by unique constraint,
 * registration/VIN by indexed field, identifier by [type,value] index) —
 * these become EXACT-strength results. Only PERSON name/alias and free
 * CASE-number/title text fall back to the broader in-memory substring scan
 * (PARTIAL-strength) — the same "findMany({}) + JS .includes()" shape
 * DI-1/DI-2 already use everywhere else, since the ModelDelegate contract
 * has no `contains` operator (see the DI-3 baseline audit).
 */

import type { DatabaseClient, DrugPerson, DrugCase } from "@/lib/database/database_types";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { classifyDrugSearchQuery, type DrugSearchQueryClassification } from "@/lib/drug_intelligence/search_query_classifier";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";
import { normalizeImeiMatchingKey, normalizeSerialMatchingKey } from "@/lib/drug_intelligence/imei_matching_key";
import { normalizeVehicleRegistrationMatchingKey, normalizeVinMatchingKey } from "@/lib/drug_intelligence/vehicle_matching_key";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import type {
  DrugSearchResult,
  DrugSearchGroupedResults,
  DrugSearchRequest,
  DrugSearchByTypeRequest,
  DrugSearchEntityType,
  DrugSearchFilters,
} from "@/lib/drug_intelligence/drug_search_types";

const DEFAULT_PER_GROUP_LIMIT = 5;
const ALL_ENTITY_TYPES: DrugSearchEntityType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE"];

export interface DrugIntelligenceSearchServiceOptions {
  /** Section 9/27: whether the caller may see full sensitive values — always `can("drug.edit")` at every call site, same gate as the rest of the module. */
  canViewFull: boolean;
  /** Section 28: identifies who searched, for the audit row `searchGrouped` writes. Omit only from tests that don't care about auditing (no row is written without both). */
  actorId?: string;
  actorName?: string;
}

export class DrugIntelligenceSearchService {
  private readonly personRepo: DrugPersonRepository;
  private readonly entityRepo: DrugEntityRepository;
  private readonly caseRepo: DrugCaseRepository;
  private readonly casePersonRepo: DrugCasePersonRepository;
  private readonly matchingService: DrugPersonMatchingService;
  private readonly auditRepo: DrugAuditLogRepository;

  constructor(private readonly db: DatabaseClient) {
    this.personRepo = new DrugPersonRepository(db);
    this.entityRepo = new DrugEntityRepository(db);
    this.caseRepo = new DrugCaseRepository(db);
    this.casePersonRepo = new DrugCasePersonRepository(db);
    this.matchingService = new DrugPersonMatchingService(db);
    this.auditRepo = new DrugAuditLogRepository(db);
  }

  /**
   * Section 3/10: the Global Search page's grouped overview — top-N per
   * entity type. Section 28: writes ONE `search_performed` DrugAuditLog row
   * per non-empty query when `options.actorId`/`actorName` are supplied —
   * detail carries the query's CLASSIFICATION and result COUNT only, never
   * the raw query text (a search query may itself be a national ID or phone
   * number, so it is never logged verbatim).
   */
  async searchGrouped(request: DrugSearchRequest, options: DrugIntelligenceSearchServiceOptions): Promise<DrugSearchGroupedResults> {
    const query = request.query.trim();
    const classification = classifyDrugSearchQuery(query);
    const perGroupLimit = request.perGroupLimit ?? DEFAULT_PER_GROUP_LIMIT;

    if (!query) {
      return { query, classification, totalCount: 0, groups: [] };
    }

    const requestedTypes = request.filters?.entityType ? [request.filters.entityType] : ALL_ENTITY_TYPES;

    const allResultsByType = await Promise.all(
      requestedTypes.map(async (entityType) => {
        const results = await this.searchOneType(query, classification, entityType, request.filters, options);
        return { entityType, results };
      })
    );

    const groups = allResultsByType
      .map(({ entityType, results }) => ({
        entityType,
        count: results.length,
        results: results.slice(0, perGroupLimit),
      }))
      .filter((g) => g.count > 0);

    const totalCount = groups.reduce((sum, g) => sum + g.count, 0);

    if (options.actorId && options.actorName) {
      await this.auditRepo.record({
        entityType: "DrugSearch",
        entityId: "global",
        action: "search_performed",
        actorId: options.actorId,
        actorName: options.actorName,
        detail: `classification=${classification} results=${totalCount}`,
      });
    }

    return { query, classification, totalCount, groups };
  }

  /** Section 24: single-entity-type paginated search backing each group's "ดูทั้งหมด" drill-in. */
  async searchByType(request: DrugSearchByTypeRequest, options: DrugIntelligenceSearchServiceOptions): Promise<{ rows: DrugSearchResult[]; total: number }> {
    const query = request.query.trim();
    const classification = classifyDrugSearchQuery(query);
    const all = query ? await this.searchOneType(query, classification, request.entityType, request.filters, options) : [];

    const start = (request.page - 1) * request.pageSize;
    return { rows: all.slice(start, start + request.pageSize), total: all.length };
  }

  private async searchOneType(
    query: string,
    classification: DrugSearchQueryClassification,
    entityType: DrugSearchEntityType,
    filters: DrugSearchFilters | undefined,
    options: DrugIntelligenceSearchServiceOptions
  ): Promise<DrugSearchResult[]> {
    let results: DrugSearchResult[];
    switch (entityType) {
      case "PERSON":
        results = await this.searchPersons(query, filters, options);
        break;
      case "PHONE":
        results = await this.searchPhones(query, options);
        break;
      case "SIM":
        results = await this.searchSims(query, options);
        break;
      case "DEVICE":
        results = await this.searchDevices(query, classification, options);
        break;
      case "VEHICLE":
        results = await this.searchVehicles(query, options);
        break;
      case "CASE":
        results = await this.searchCases(query, filters);
        break;
      default:
        results = [];
    }
    return rankDrugSearchResults(results);
  }

  // ── PERSON (Section 8) — canonical name, aliases, identifiers, linked phone/IMEI/vehicle ──
  private async searchPersons(query: string, filters: DrugSearchFilters | undefined, options: DrugIntelligenceSearchServiceOptions): Promise<DrugSearchResult[]> {
    const lower = query.toLowerCase();
    const matches = new Map<string, { person: DrugPerson; matchedField: DrugSearchResult["matchedField"]; matchedValue: string; strength: DrugSearchResult["strength"] }>();

    function record(person: DrugPerson, matchedField: DrugSearchResult["matchedField"], matchedValue: string, strength: DrugSearchResult["strength"]) {
      if (!matches.has(person.id)) matches.set(person.id, { person, matchedField, matchedValue, strength });
    }

    // Exact identifier value match tried first (Section 19 priority 1) — DB equality.
    const identifierRows = await this.personRepo.findIdentifiersByValue(query);
    if (identifierRows.length > 0) {
      const personIds = [...new Set(identifierRows.map((r) => r.personId))];
      const persons = await this.personRepo.findByIds(personIds);
      for (const p of persons) {
        if (p.status === "ACTIVE") record(p, "IDENTIFIER", query, "EXACT");
      }
    }

    // DI-9.4.3B: DB-side name/alias contains (Thai contiguous substring preserved).
    const [byName, aliasHits] = await Promise.all([
      this.db.drugPerson.findMany({
        where: { status: "ACTIVE", primaryFullName: { contains: query, mode: "insensitive" } },
      }),
      this.personRepo.findAliasesContaining(query),
    ]);
    for (const person of byName) {
      if (person.primaryFullName.toLowerCase() === lower) {
        record(person, "PRIMARY_NAME", person.primaryFullName, "EXACT");
      } else {
        record(person, "PRIMARY_NAME", person.primaryFullName, "PARTIAL");
      }
    }
    if (aliasHits.length > 0) {
      const aliasPersonIds = [...new Set(aliasHits.map((a) => a.personId))];
      const aliasPersons = await this.personRepo.findByIds(aliasPersonIds);
      const byId = new Map(aliasPersons.filter((p) => p.status === "ACTIVE").map((p) => [p.id, p]));
      for (const alias of aliasHits) {
        if (matches.has(alias.personId)) continue;
        const person = byId.get(alias.personId);
        if (!person) continue;
        record(person, "ALIAS", alias.fullName, alias.fullName.toLowerCase() === lower ? "EXACT" : "PARTIAL");
      }
    }

    if (matches.size === 0) return [];

    const potentialDuplicateIds = await this.matchingService.findPersonIdsWithPotentialDuplicates();
    const matchedList = [...matches.values()];
    const matchedIds = matchedList.map((m) => m.person.id);
    const [allCaseLinks, allAliases] = await Promise.all([
      this.personRepo.casePersonsForPersons(matchedIds),
      this.personRepo.aliasesForPersons(matchedIds),
    ]);
    const caseCountBy = new Map<string, number>();
    for (const link of allCaseLinks as Array<{ personId: string }>) {
      caseCountBy.set(link.personId, (caseCountBy.get(link.personId) ?? 0) + 1);
    }
    const aliasesBy = new Map<string, Array<{ fullName: string; isPrimary: boolean }>>();
    for (const row of allAliases as Array<{ personId: string; fullName: string; isPrimary: boolean }>) {
      const list = aliasesBy.get(row.personId) ?? [];
      list.push(row);
      aliasesBy.set(row.personId, list);
    }

    const results = await Promise.all(
      matchedList.map(async ({ person, matchedField, matchedValue, strength }) => {
        const personAliases = aliasesBy.get(person.id) ?? [];
        const primaryAlias = personAliases.find((a) => !a.isPrimary)?.fullName ?? null;
        const canonicalTarget =
          person.status === "MERGED" && person.mergedIntoPersonId
            ? await this.resolveCanonicalPersonLabel(person.mergedIntoPersonId)
            : null;
        return this.buildPersonResult(
          person,
          matchedField,
          matchedValue,
          strength,
          caseCountBy.get(person.id) ?? 0,
          primaryAlias,
          potentialDuplicateIds.has(person.id),
          canonicalTarget,
          options
        );
      })
    );

    return this.applyFilters(results, filters);
  }

  private async resolveCanonicalPersonLabel(personId: string): Promise<{ entityId: string; primaryLabel: string } | null> {
    const survivor = await this.personRepo.findById(personId);
    if (!survivor) return null;
    return { entityId: survivor.id, primaryLabel: survivor.primaryFullName };
  }

  private buildPersonResult(
    person: DrugPerson,
    matchedField: DrugSearchResult["matchedField"],
    matchedValue: string,
    strength: DrugSearchResult["strength"],
    caseCount: number,
    primaryAlias: string | null,
    hasPotentialDuplicate: boolean,
    canonicalTarget: { entityId: string; primaryLabel: string } | null,
    options: DrugIntelligenceSearchServiceOptions
  ): DrugSearchResult {
    const isIdentifierMatch = matchedField === "IDENTIFIER";
    return {
      entityType: "PERSON",
      entityId: person.id,
      primaryLabel: person.primaryFullName,
      secondaryLabel: primaryAlias,
      matchedField,
      matchedValueMasked: isIdentifierMatch ? presentIdentifierValue(matchedValue, options.canViewFull) : matchedValue,
      strength,
      firstSeen: person.createdAt,
      lastSeen: person.updatedAt,
      caseCount,
      hasPotentialDuplicate,
      canonicalTarget,
    };
  }

  // ── PHONE (Section 8) — normalized number ──
  private async searchPhones(query: string, options: DrugIntelligenceSearchServiceOptions): Promise<DrugSearchResult[]> {
    const normalizedQuery = normalizePhoneMatchingKey(query);
    const results: DrugSearchResult[] = [];
    const seen = new Set<string>();

    if (normalizedQuery) {
      const exact = await this.entityRepo.findPhoneNumberByNormalized(normalizedQuery);
      if (exact) {
        seen.add(exact.id);
        results.push(await this.buildPhoneResult(exact.id, exact.normalizedNumber, "EXACT", options));
      }
    }

    if (normalizedQuery && normalizedQuery.length >= 4) {
      const partial = await this.entityRepo.findPhoneNumbersContaining(normalizedQuery);
      for (const phone of partial) {
        if (seen.has(phone.id)) continue;
        seen.add(phone.id);
        results.push(await this.buildPhoneResult(phone.id, phone.normalizedNumber, "PARTIAL", options));
      }
    }

    return results;
  }

  private async buildPhoneResult(phoneNumberId: string, normalizedNumber: string, strength: DrugSearchResult["strength"], options: DrugIntelligenceSearchServiceOptions): Promise<DrugSearchResult> {
    const [caseCount, caseLinks] = await Promise.all([
      this.entityRepo.countCasePhonesForPhoneNumber(phoneNumberId),
      this.entityRepo.casePhonesForPhoneNumber(phoneNumberId),
    ]);
    const dates = this.extractProvenanceDates(caseLinks as Array<{ firstSeenAt: Date | null; lastSeenAt: Date | null }>);
    return {
      entityType: "PHONE",
      entityId: phoneNumberId,
      primaryLabel: presentPhoneNumber(normalizedNumber, options.canViewFull),
      secondaryLabel: null,
      matchedField: "PHONE_NUMBER",
      matchedValueMasked: presentPhoneNumber(normalizedNumber, options.canViewFull),
      strength,
      firstSeen: dates.firstSeen,
      lastSeen: dates.lastSeen,
      caseCount,
      hasPotentialDuplicate: null,
      canonicalTarget: null,
    };
  }

  // ── SIM (Section 8) — ICCID, IMSI ──
  private async searchSims(query: string, options: DrugIntelligenceSearchServiceOptions): Promise<DrugSearchResult[]> {
    const results: DrugSearchResult[] = [];
    const seen = new Set<string>();

    const exactByIccid = await this.entityRepo.findSimByIccid(query);
    if (exactByIccid) {
      seen.add(exactByIccid.id);
      results.push(await this.buildSimResult(exactByIccid.id, exactByIccid.iccid, exactByIccid.imsi, "ICCID", "EXACT", options));
    }

    const exactByImsi = await this.entityRepo.findSimsByImsi(query);
    for (const sim of exactByImsi) {
      if (seen.has(sim.id)) continue;
      seen.add(sim.id);
      results.push(await this.buildSimResult(sim.id, sim.iccid, sim.imsi, "IMSI", "EXACT", options));
    }

    if (query.length >= 4) {
      const partial = await this.entityRepo.findSimsContaining(query);
      for (const sim of partial) {
        if (seen.has(sim.id)) continue;
        seen.add(sim.id);
        results.push(await this.buildSimResult(sim.id, sim.iccid, sim.imsi, sim.iccid?.includes(query) ? "ICCID" : "IMSI", "PARTIAL", options));
      }
    }

    return results;
  }

  private async buildSimResult(
    simId: string,
    iccid: string | null,
    imsi: string | null,
    matchedField: DrugSearchResult["matchedField"],
    strength: DrugSearchResult["strength"],
    options: DrugIntelligenceSearchServiceOptions
  ): Promise<DrugSearchResult> {
    const [caseCount, caseLinks] = await Promise.all([this.entityRepo.countCaseSimsForSim(simId), this.entityRepo.caseSimsForSim(simId)]);
    const dates = this.extractProvenanceDates(caseLinks as Array<{ firstSeenAt: Date | null; lastSeenAt: Date | null }>);
    const matchedRaw = matchedField === "ICCID" ? (iccid ?? "") : (imsi ?? "");
    return {
      entityType: "SIM",
      entityId: simId,
      primaryLabel: iccid ? presentIdentifierValue(iccid, options.canViewFull) : "SIM",
      secondaryLabel: imsi ? presentIdentifierValue(imsi, options.canViewFull) : null,
      matchedField,
      matchedValueMasked: presentIdentifierValue(matchedRaw, options.canViewFull),
      strength,
      firstSeen: dates.firstSeen,
      lastSeen: dates.lastSeen,
      caseCount,
      hasPotentialDuplicate: null,
      canonicalTarget: null,
    };
  }

  // ── DEVICE (Section 8) — IMEI1, IMEI2, serial number ──
  private async searchDevices(query: string, classification: DrugSearchQueryClassification, options: DrugIntelligenceSearchServiceOptions): Promise<DrugSearchResult[]> {
    const results: DrugSearchResult[] = [];
    const seen = new Set<string>();

    const normalizedImei = normalizeImeiMatchingKey(query);
    if (normalizedImei) {
      const byImei = await this.entityRepo.findDevicesByImei(normalizedImei);
      for (const device of byImei) {
        if (seen.has(device.id)) continue;
        seen.add(device.id);
        results.push(await this.buildDeviceResult(device.id, device.brand, device.model, device.imei1, device.imei2, "IMEI", "EXACT", options));
      }
      // Also try the raw (un-normalized) query, since DrugDevice.imei1/imei2 were stored WITHOUT normalization by DI-1 (no normalization step exists on write).
      if (normalizedImei !== query) {
        const byRawImei = await this.entityRepo.findDevicesByImei(query);
        for (const device of byRawImei) {
          if (seen.has(device.id)) continue;
          seen.add(device.id);
          results.push(await this.buildDeviceResult(device.id, device.brand, device.model, device.imei1, device.imei2, "IMEI", "EXACT", options));
        }
      }
    }

    const normalizedSerial = normalizeSerialMatchingKey(query);
    if (normalizedSerial && classification !== "PERSON_NAME") {
      const bySerial = await this.entityRepo.findDevicesBySerialNumber(query);
      for (const device of bySerial) {
        if (seen.has(device.id)) continue;
        seen.add(device.id);
        results.push(await this.buildDeviceResult(device.id, device.brand, device.model, device.imei1, device.imei2, "SERIAL_NUMBER", "EXACT", options));
      }
    }

    if (query.length >= 4) {
      const partial = await this.entityRepo.findDevicesContaining(query);
      for (const device of partial) {
        if (seen.has(device.id)) continue;
        const imei1Match = device.imei1?.includes(query);
        const imei2Match = device.imei2?.includes(query);
        const serialMatch = device.serialNumber?.toUpperCase().includes(normalizedSerial);
        if (imei1Match || imei2Match || serialMatch) {
          seen.add(device.id);
          results.push(
            await this.buildDeviceResult(
              device.id,
              device.brand,
              device.model,
              device.imei1,
              device.imei2,
              imei1Match || imei2Match ? "IMEI" : "SERIAL_NUMBER",
              "PARTIAL",
              options
            )
          );
        }
      }
    }

    return results;
  }

  private async buildDeviceResult(
    deviceId: string,
    brand: string | null,
    model: string | null,
    imei1: string | null,
    imei2: string | null,
    matchedField: DrugSearchResult["matchedField"],
    strength: DrugSearchResult["strength"],
    options: DrugIntelligenceSearchServiceOptions
  ): Promise<DrugSearchResult> {
    const [caseCount, caseLinks, personLinks] = await Promise.all([
      this.entityRepo.countCaseDevicesForDevice(deviceId),
      this.entityRepo.caseDevicesForDevice(deviceId),
      this.entityRepo.personDevicesForDevice(deviceId),
    ]);
    const dates = this.extractProvenanceDates(personLinks as Array<{ firstSeenAt: Date | null; lastSeenAt: Date | null }>);
    void caseLinks;
    const label = [brand, model].filter(Boolean).join(" ") || "อุปกรณ์";
    const matchedRaw = matchedField === "IMEI" ? (imei1 ?? imei2 ?? "") : "";
    return {
      entityType: "DEVICE",
      entityId: deviceId,
      primaryLabel: label,
      secondaryLabel: imei1 ? presentIdentifierValue(imei1, options.canViewFull) : null,
      matchedField,
      matchedValueMasked: matchedRaw ? presentIdentifierValue(matchedRaw, options.canViewFull) : "",
      strength,
      firstSeen: dates.firstSeen,
      lastSeen: dates.lastSeen,
      caseCount,
      hasPotentialDuplicate: null,
      canonicalTarget: null,
    };
  }

  // ── VEHICLE (Section 8) — registration number, VIN ──
  private async searchVehicles(query: string, options: DrugIntelligenceSearchServiceOptions): Promise<DrugSearchResult[]> {
    const results: DrugSearchResult[] = [];
    const seen = new Set<string>();

    const normalizedReg = normalizeVehicleRegistrationMatchingKey(query);
    const byReg = await this.entityRepo.findVehiclesByRegistrationNumber(query);
    for (const vehicle of byReg) {
      if (seen.has(vehicle.id)) continue;
      seen.add(vehicle.id);
      results.push(await this.buildVehicleResult(vehicle.id, vehicle.registrationNumber, vehicle.registrationProvince, vehicle.brand, vehicle.model, "REGISTRATION_NUMBER", "EXACT", options));
    }

    const normalizedVin = normalizeVinMatchingKey(query);
    if (normalizedVin) {
      const byVin = await this.entityRepo.findVehiclesByVin(query);
      for (const vehicle of byVin) {
        if (seen.has(vehicle.id)) continue;
        seen.add(vehicle.id);
        results.push(await this.buildVehicleResult(vehicle.id, vehicle.registrationNumber, vehicle.registrationProvince, vehicle.brand, vehicle.model, "VIN", "EXACT", options));
      }
    }

    if (normalizedReg.length >= 2) {
      const partial = await this.entityRepo.findVehiclesContaining(query);
      for (const vehicle of partial) {
        if (seen.has(vehicle.id)) continue;
        const regMatch = vehicle.registrationNumber?.toLowerCase().includes(normalizedReg.toLowerCase()) || vehicle.registrationNumber?.includes(normalizedReg);
        const vinMatch = Boolean(normalizedVin) && Boolean(vehicle.vin?.toUpperCase().includes(normalizedVin));
        if (regMatch || vinMatch) {
          seen.add(vehicle.id);
          results.push(
            await this.buildVehicleResult(vehicle.id, vehicle.registrationNumber, vehicle.registrationProvince, vehicle.brand, vehicle.model, regMatch ? "REGISTRATION_NUMBER" : "VIN", "PARTIAL", options)
          );
        }
      }
    }

    return results;
  }

  private async buildVehicleResult(
    vehicleId: string,
    registrationNumber: string | null,
    registrationProvince: string | null,
    brand: string | null,
    model: string | null,
    matchedField: DrugSearchResult["matchedField"],
    strength: DrugSearchResult["strength"],
    options: DrugIntelligenceSearchServiceOptions
  ): Promise<DrugSearchResult> {
    void options;
    const [caseCount, personLinks] = await Promise.all([this.entityRepo.countCaseVehiclesForVehicle(vehicleId), this.entityRepo.personVehiclesForVehicle(vehicleId)]);
    const dates = this.extractProvenanceDates(personLinks as Array<{ firstSeenAt: Date | null; lastSeenAt: Date | null }>);
    return {
      entityType: "VEHICLE",
      entityId: vehicleId,
      primaryLabel: registrationNumber || "ยานพาหนะ",
      secondaryLabel: [registrationProvince, brand, model].filter(Boolean).join(" · ") || null,
      matchedField,
      matchedValueMasked: matchedField === "REGISTRATION_NUMBER" ? registrationNumber || "" : "",
      strength,
      firstSeen: dates.firstSeen,
      lastSeen: dates.lastSeen,
      caseCount,
      hasPotentialDuplicate: null,
      canonicalTarget: null,
    };
  }

  // ── CASE (Section 8) — case number, title ──
  private async searchCases(query: string, filters: DrugSearchFilters | undefined): Promise<DrugSearchResult[]> {
    const lower = query.toLowerCase();
    const hits = await this.db.drugCase.findMany({
      where: {
        OR: [
          { caseNumber: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
        ],
      },
    });
    const results: DrugSearchResult[] = [];

    for (const drugCase of hits) {
      const caseNumberLower = drugCase.caseNumber.toLowerCase();
      const titleLower = drugCase.title.toLowerCase();
      let matchedField: DrugSearchResult["matchedField"] | null = null;
      let strength: DrugSearchResult["strength"] = "PARTIAL";
      let matchedValue = "";

      if (caseNumberLower === lower) {
        matchedField = "CASE_NUMBER";
        strength = "EXACT";
        matchedValue = drugCase.caseNumber;
      } else if (caseNumberLower.includes(lower)) {
        matchedField = "CASE_NUMBER";
        matchedValue = drugCase.caseNumber;
      } else if (titleLower.includes(lower)) {
        matchedField = "CASE_TITLE";
        matchedValue = drugCase.title;
      }

      if (!matchedField) continue;
      results.push(this.buildCaseResult(drugCase, matchedField, matchedValue, strength));
    }

    return this.applyFilters(results, filters);
  }

  /** A CASE result's own `caseCount` is always 1 (it IS one case) — the field exists on every result type for a uniform card shape, but for CASE results the meaningful count (persons involved) is carried in `secondaryLabel`/the case detail page itself, not overloaded into `caseCount`. */
  private buildCaseResult(drugCase: DrugCase, matchedField: DrugSearchResult["matchedField"], matchedValue: string, strength: DrugSearchResult["strength"]): DrugSearchResult {
    return {
      entityType: "CASE",
      entityId: drugCase.id,
      primaryLabel: drugCase.caseNumber,
      secondaryLabel: drugCase.title,
      matchedField,
      matchedValueMasked: matchedValue,
      strength,
      firstSeen: drugCase.arrestDate,
      lastSeen: drugCase.arrestDate,
      caseCount: 1,
      hasPotentialDuplicate: null,
      canonicalTarget: null,
    };
  }

  private extractProvenanceDates(links: Array<{ firstSeenAt: Date | null; lastSeenAt: Date | null }>): { firstSeen: Date | null; lastSeen: Date | null } {
    const firsts = links.map((l) => l.firstSeenAt).filter((d): d is Date => d !== null);
    const lasts = links.map((l) => l.lastSeenAt).filter((d): d is Date => d !== null);
    return {
      firstSeen: firsts.length > 0 ? new Date(Math.min(...firsts.map((d) => d.getTime()))) : null,
      lastSeen: lasts.length > 0 ? new Date(Math.max(...lasts.map((d) => d.getTime()))) : null,
    };
  }

  private applyFilters(results: DrugSearchResult[], filters: DrugSearchFilters | undefined): DrugSearchResult[] {
    if (!filters) return results;
    return results.filter((r) => {
      if (filters.minCaseCount !== undefined && r.caseCount < filters.minCaseCount) return false;
      if (filters.dateFrom && (!r.lastSeen || r.lastSeen < filters.dateFrom)) return false;
      if (filters.dateTo && (!r.firstSeen || r.firstSeen > filters.dateTo)) return false;
      return true;
    });
  }
}

/**
 * Section 19's deterministic ranking, exported as a pure function so it can
 * be unit-tested independently of any repository/DB. Priority order (lower
 * number = ranked first): exact identifier(1) > exact phone(2) > exact
 * IMEI(3) > exact VIN/registration(4) > exact case number(5) > exact
 * canonical name(6) > exact alias(7) > any partial match(8). No numeric
 * relevance score anywhere — the UI renders `strength`/`matchedField`
 * directly (Section 18/19: "Do not show unexplained relevance scores").
 */
const FIELD_PRIORITY: Record<DrugSearchResult["matchedField"], number> = {
  IDENTIFIER: 1,
  PHONE_NUMBER: 2,
  ICCID: 2,
  IMSI: 2,
  IMEI: 3,
  SERIAL_NUMBER: 3,
  VIN: 4,
  REGISTRATION_NUMBER: 4,
  CASE_NUMBER: 5,
  PRIMARY_NAME: 6,
  ALIAS: 7,
  CASE_TITLE: 8,
};

export function rankDrugSearchResults(results: DrugSearchResult[]): DrugSearchResult[] {
  return [...results].sort((a, b) => {
    if (a.strength !== b.strength) return a.strength === "EXACT" ? -1 : 1;
    const priorityDiff = FIELD_PRIORITY[a.matchedField] - FIELD_PRIORITY[b.matchedField];
    if (priorityDiff !== 0) return priorityDiff;
    return a.primaryLabel.localeCompare(b.primaryLabel, "th");
  });
}
