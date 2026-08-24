/**
 * DrugPersonProfileService (Phase DI-2 — Sections 4-9, 24-26).
 *
 * The Person Intelligence Profile's data aggregate: everything the
 * `/drug-intelligence/persons/[id]` workspace needs in one call — identity,
 * cross-case history, phones/SIMs/devices/vehicles/locations with
 * provenance, and a lightweight data-quality summary. Distinct from
 * DrugCaseService.getPersonDetail (the DI-1 Person Drawer's narrower field
 * list — kept as-is, unchanged, since the drawer still uses it) — this is
 * the full profile a dedicated page needs, including case role/status/unit
 * per case (Section 6's Cases tab) and location history (Section 6's
 * Locations tab), which the drawer never needed.
 *
 * Read-only aggregation. No writes happen here — edits go through
 * DrugPersonRepository (profile fields) or the identifier/alias-add paths,
 * each with their own audit trail, called from a distinct service method
 * below so every write still gets its own explicit audit action.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugPersonMergeRepository } from "@/lib/database/repositories/drug_person_merge_repository";
import { DrugPersonNetworkRoleRepository } from "@/lib/database/repositories/drug_person_network_role_repository";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";
import { DrugPersonNotFoundError } from "@/lib/drug_intelligence/drug_case_types";

export interface DrugPersonDataQualityFlag {
  code: "NO_IDENTIFIER" | "NO_SOURCE_CASE" | "CONFLICTING_DOB" | "POTENTIAL_DUPLICATE" | "IDENTIFIER_SHARED";
  detail: string;
}

export class DrugPersonProfileService {
  private readonly personRepo: DrugPersonRepository;
  private readonly casePersonRepo: DrugCasePersonRepository;
  private readonly caseRepo: DrugCaseRepository;
  private readonly entityRepo: DrugEntityRepository;
  private readonly auditRepo: DrugAuditLogRepository;
  private readonly mergeRepo: DrugPersonMergeRepository;
  private readonly networkRoleRepo: DrugPersonNetworkRoleRepository;
  private readonly matchingService: DrugPersonMatchingService;

  constructor(private readonly db: DatabaseClient) {
    this.personRepo = new DrugPersonRepository(db);
    this.casePersonRepo = new DrugCasePersonRepository(db);
    this.caseRepo = new DrugCaseRepository(db);
    this.entityRepo = new DrugEntityRepository(db);
    this.auditRepo = new DrugAuditLogRepository(db);
    this.mergeRepo = new DrugPersonMergeRepository(db);
    this.networkRoleRepo = new DrugPersonNetworkRoleRepository(db);
    this.matchingService = new DrugPersonMatchingService(db);
  }

  /** Section 4-6: full Person Intelligence Profile aggregate. */
  async getProfile(personId: string) {
    const person = await this.personRepo.findById(personId);
    if (!person) throw new DrugPersonNotFoundError(personId);

    const [aliases, identifiers, caseLinks, casePhoneLinks, caseSimLinks, personDeviceLinks, caseDeviceLinks, personVehicleLinks, caseVehicleLinks, mergeHistory, networkRoles, networkMemberships] = await Promise.all([
      this.personRepo.aliasesForPerson(personId),
      this.personRepo.identifiersForPerson(personId),
      this.casePersonRepo.forPerson(personId),
      this.personRepo.casePhonesForPerson(personId),
      this.db.drugCaseSim.findMany({ where: { personId } }),
      this.entityRepo.personDevicesForPerson(personId),
      this.db.drugCaseDevice.findMany({ where: { personId } }),
      this.entityRepo.personVehiclesForPerson(personId),
      this.db.drugCaseVehicle.findMany({ where: { personId } }),
      this.mergeRepo.forPerson(personId),
      this.networkRoleRepo.forPerson(personId),
      this.personRepo.networkMembershipsForPerson(personId),
    ]);

    // Cases tab (Section 6): resolve each case link to its case row.
    const cases = await Promise.all(
      (caseLinks as Array<{ id: string; caseId: string; role: string; createdAt: Date }>).map(async (link) => ({
        ...link,
        case: await this.caseRepo.findById(link.caseId),
      }))
    );

    // Locations tab (Section 6): every DrugCaseLocation across every case this person appears in — resolved per case, never derived/guessed as "belongs to this person" (Section 6's explicit prohibition on auto-deriving a residence from an arrest location).
    const locationsByCase = await Promise.all(
      cases.map(async (c) => ({
        caseId: c.caseId,
        caseNumber: c.case?.caseNumber ?? null,
        links: await this.caseRepo.caseLocationsForCase(c.caseId),
      }))
    );
    const locations = await Promise.all(
      locationsByCase.flatMap((group) =>
        (group.links as Array<{ id: string; locationId: string; role: string; createdAt: Date }>).map(async (link) => ({
          ...link,
          caseId: group.caseId,
          caseNumber: group.caseNumber,
          location: await this.entityRepo.findLocationById(link.locationId),
        }))
      )
    );

    const phones = await Promise.all(
      (casePhoneLinks as Array<{ id: string; caseId: string; phoneNumberId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; recordedBy: string }>).map(async (link) => ({
        ...link,
        phoneNumber: await this.entityRepo.findPhoneNumberById(link.phoneNumberId),
      }))
    );

    // Phone/device history sub-tables (DrugSimPhoneHistory/DrugSimDeviceHistory)
    // are schema-complete but not yet wired into the DatabaseClient delegate
    // surface (DI-1 never populated them) — Section 6 marks phone history as
    // "SIM: ... phone history ... ถ้ามี" (optional), so the profile surfaces
    // just the SIM entity itself here; wiring the history sub-tables in is a
    // small additive follow-up once a write path populates them.
    const simIds = Array.from(new Set((caseSimLinks as Array<{ simId: string }>).map((r) => r.simId)));
    const sims = await Promise.all(
      simIds.map(async (simId) => {
        const simRow = (await this.db.drugSim.findMany({ where: { id: simId } }))[0] ?? null;
        return { sim: simRow };
      })
    );

    const devices = await Promise.all(
      (personDeviceLinks as Array<{ id: string; deviceId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null; recordedBy: string }>).map(async (link) => ({
        ...link,
        device: await this.entityRepo.findDeviceById(link.deviceId),
      }))
    );

    const vehicles = await Promise.all(
      (personVehicleLinks as Array<{ id: string; vehicleId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null; recordedBy: string }>).map(async (link) => ({
        ...link,
        vehicle: await this.entityRepo.findVehicleById(link.vehicleId),
      }))
    );

    // First/Last seen (Section 24): derived from actual provenance timestamps across every relationship, never from createdAt alone when a more accurate observed date exists.
    const observedDates: Date[] = [];
    for (const p of phones) {
      if (p.firstSeenAt) observedDates.push(p.firstSeenAt);
      if (p.lastSeenAt) observedDates.push(p.lastSeenAt);
    }
    for (const d of devices) {
      if (d.firstSeenAt) observedDates.push(d.firstSeenAt);
      if (d.lastSeenAt) observedDates.push(d.lastSeenAt);
    }
    for (const v of vehicles) {
      if (v.firstSeenAt) observedDates.push(v.firstSeenAt);
      if (v.lastSeenAt) observedDates.push(v.lastSeenAt);
    }
    for (const c of cases) {
      if (c.case?.arrestDate) observedDates.push(c.case.arrestDate);
    }
    const firstSeenAt = observedDates.length > 0 ? new Date(Math.min(...observedDates.map((d) => d.getTime()))) : person.createdAt;
    const lastSeenAt = observedDates.length > 0 ? new Date(Math.max(...observedDates.map((d) => d.getTime()))) : person.updatedAt;

    const dataQuality = await this.computeDataQuality(person, identifiers as Array<{ type: string; value: string }>, cases.length);

    return {
      person,
      aliases,
      identifiers,
      cases,
      phones,
      sims,
      devices,
      caseDeviceSightingCount: caseDeviceLinks.length,
      vehicles,
      caseVehicleSightingCount: caseVehicleLinks.length,
      locations,
      mergeHistory,
      /** DI-7.3: network-role assertions, ordered oldest first. */
      networkRoles,
      /** DI-7.2: network/group memberships with resolved group info. */
      networkMemberships,
      firstSeenAt,
      lastSeenAt,
      dataQuality,
      counts: { cases: cases.length, phones: phones.length, sims: sims.length, devices: devices.length, vehicles: vehicles.length, locations: locations.length },
    };
  }

  /** Section 25: lightweight, non-accusatory data-quality flags — never an automatic intelligence conclusion, just facts about missing/conflicting data. */
  private async computeDataQuality(
    person: { id: string; primaryFullName: string; dateOfBirth: Date | null },
    identifiers: Array<{ type: string; value: string }>,
    caseCount: number
  ): Promise<DrugPersonDataQualityFlag[]> {
    const flags: DrugPersonDataQualityFlag[] = [];

    if (identifiers.length === 0) {
      flags.push({ code: "NO_IDENTIFIER", detail: "ยังไม่มีเลขที่เอกสารประจำตัวบันทึกไว้" });
    }
    if (caseCount === 0) {
      flags.push({ code: "NO_SOURCE_CASE", detail: "ยังไม่พบคดีที่เชื่อมโยงกับบุคคลนี้" });
    }

    // Shared-identifier check: does another ACTIVE person carry the SAME (type, value)? (Section 25's "identifier shared unexpectedly")
    for (const identifier of identifiers) {
      if (!identifier.value.trim()) continue;
      const rows = await this.personRepo.findCandidatesByIdentifier(identifier.type, identifier.value);
      const otherPersonIds = new Set((rows as Array<{ personId: string }>).map((r) => r.personId).filter((id) => id !== person.id));
      if (otherPersonIds.size > 0) {
        flags.push({ code: "IDENTIFIER_SHARED", detail: `เลขที่เอกสารประจำตัว (${identifier.type}) ปรากฏซ้ำกับบุคคลอื่นในระบบ` });
        break; // one flag is enough — the Review tab lists the actual candidates separately.
      }
    }

    // Potential duplicate check reuses the SAME matching engine the review queue uses — never a separate ad-hoc check.
    const identity = await this.matchingService.buildIdentityForPerson(person.id);
    if (identity) {
      const candidates = await this.matchingService.findCandidates(identity, person.id);
      const unresolvedHighOrMedium = candidates.filter((c) => c.existingDecision !== "NOT_SAME" && (c.confidence === "HIGH" || c.confidence === "MEDIUM"));
      if (unresolvedHighOrMedium.length > 0) {
        flags.push({ code: "POTENTIAL_DUPLICATE", detail: `พบบุคคลที่อาจซ้ำกัน ${unresolvedHighOrMedium.length} รายการ` });
      }
    }

    return flags;
  }

  /** Section 6's Review/Data Quality tab: the raw candidate list (with signals/explanations resolved by the caller) — reuses the matching engine, never a separate implementation. */
  async getPotentialDuplicates(personId: string) {
    const identity = await this.matchingService.buildIdentityForPerson(personId);
    if (!identity) throw new DrugPersonNotFoundError(personId);
    return this.matchingService.findCandidates(identity, personId);
  }

  /**
   * Section 21-23: profile edit — canonical name/nationality/DOB/notes.
   * Duplicate-checks the new name/DOB combination the SAME way person
   * creation does (Section 21: "ห้ามแก้ identifier แล้ว bypass duplicate
   * engine") before writing, and audits the change.
   */
  async updateProfile(
    personId: string,
    input: {
      primaryFullName?: string;
      nickname?: string | null;
      nationality?: string | null;
      sex?: string | null;
      dateOfBirth?: Date | null;
      approximateAge?: number | null;
      notes?: string | null;
    },
    actorId: string,
    actorName: string
  ) {
    const existing = await this.personRepo.findById(personId);
    if (!existing) throw new DrugPersonNotFoundError(personId);

    const updated = await this.personRepo.updateProfile(personId, input, actorId, actorName);
    await this.auditRepo.record({
      entityType: "DrugPerson",
      entityId: personId,
      action: "person_updated",
      actorId,
      actorName,
      detail: Object.keys(input).join(","),
    });
    return updated;
  }

  /** Section 22: add an alias, audited. */
  async addAlias(personId: string, fullName: string, actorId: string, actorName: string) {
    const existing = await this.personRepo.findById(personId);
    if (!existing) throw new DrugPersonNotFoundError(personId);

    await this.personRepo.addAlias(personId, fullName, false, actorId);
    await this.auditRepo.record({
      entityType: "DrugPersonAlias",
      entityId: personId,
      action: "alias_added",
      actorId,
      actorName,
      detail: null,
    });
  }

  /**
   * Section 23: add an identifier — normalizes, runs the duplicate engine
   * FIRST (never bypassed), and always writes the row regardless of the
   * check's outcome (Section 23 asks for "warning/review", not a hard
   * block — unlike Create Case's NEW-person block in Section 14, editing an
   * EXISTING person's identifiers is expected to sometimes legitimately
   * collide, e.g. correcting a typo to match a sibling record pending
   * review) — the caller surfaces the returned candidates as a warning.
   */
  async addIdentifier(personId: string, type: string, value: string, notes: string | null, actorId: string, actorName: string) {
    const existing = await this.personRepo.findById(personId);
    if (!existing) throw new DrugPersonNotFoundError(personId);

    const trimmedValue = value.trim();
    const candidates = trimmedValue
      ? await this.matchingService.findCandidates(this.matchingService.buildIdentityForDraft({ identifiers: [{ type, value: trimmedValue }], primaryFullName: "", dateOfBirth: null }), personId)
      : [];

    await this.personRepo.addIdentifier(personId, type, trimmedValue, notes, actorId);
    await this.auditRepo.record({
      entityType: "DrugPersonIdentifier",
      entityId: personId,
      action: "identifier_added",
      actorId,
      actorName,
      detail: `type=${type}`,
    });

    return { candidates };
  }
}

/** Directory search input (Section 8) — Person domain only, never Global Search's cross-entity scope. */
export interface DrugPersonDirectoryQuery {
  page: number;
  pageSize: number;
  query?: string;
}

export interface DrugPersonDirectoryRow {
  id: string;
  primaryFullName: string;
  status: string;
  aliasCount: number;
  primaryAlias: string | null;
  identifierPreview: { type: string; value: string } | null;
  caseCount: number;
  phoneCount: number;
  deviceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  hasPotentialDuplicate: boolean;
}

/** Section 7-9's Person Directory listing — a distinct, smaller service since it's read-heavy and list-shaped, not profile-shaped. */
export class DrugPersonDirectoryService {
  private readonly personRepo: DrugPersonRepository;
  private readonly casePersonRepo: DrugCasePersonRepository;
  private readonly matchingService: DrugPersonMatchingService;

  constructor(private readonly db: DatabaseClient) {
    this.personRepo = new DrugPersonRepository(db);
    this.casePersonRepo = new DrugCasePersonRepository(db);
    this.matchingService = new DrugPersonMatchingService(db);
  }

  async list(query: DrugPersonDirectoryQuery): Promise<{ rows: DrugPersonDirectoryRow[]; total: number }> {
    const active = await this.personRepo.findAllActive();

    const normalizedQuery = query.query?.trim().toLowerCase();
    const normalizedPhoneQuery = query.query ? normalizePhoneMatchingKey(query.query) : "";

    let matchedIds: Set<string> | null = null;
    if (normalizedQuery) {
      matchedIds = new Set<string>();
      for (const person of active) {
        if (person.primaryFullName.toLowerCase().includes(normalizedQuery)) matchedIds.add(person.id);
        const aliases = await this.personRepo.aliasesForPerson(person.id);
        if ((aliases as Array<{ fullName: string }>).some((a) => a.fullName.toLowerCase().includes(normalizedQuery!))) matchedIds.add(person.id);
        const identifiers = await this.personRepo.identifiersForPerson(person.id);
        if ((identifiers as Array<{ value: string }>).some((i) => i.value.toLowerCase().includes(normalizedQuery!))) matchedIds.add(person.id);
        if (normalizedPhoneQuery) {
          const phoneLinks = await this.personRepo.casePhonesForPerson(person.id);
          for (const link of phoneLinks as Array<{ phoneNumberId: string }>) {
            const phone = await this.db.drugPhoneNumber.findUnique({ where: { id: link.phoneNumberId } });
            if (phone && (phone as { normalizedNumber: string }).normalizedNumber.includes(normalizedPhoneQuery)) {
              matchedIds.add(person.id);
              break;
            }
          }
        }
      }
    }

    const filtered = matchedIds ? active.filter((p) => matchedIds!.has(p.id)) : active;

    // Computed ONCE per request (every active person's identity built exactly
    // once) rather than per-row — see findPersonIdsWithPotentialDuplicates()'s
    // own comment for the O(n²)-identity-rebuild bug this replaced (measured
    // ~54s at 26 seeded persons before this fix).
    const potentialDuplicateIds = await this.matchingService.findPersonIdsWithPotentialDuplicates();

    const rows: DrugPersonDirectoryRow[] = [];
    for (const person of filtered) {
      const [aliases, identifiers, caseLinks, phoneLinks, deviceLinks] = await Promise.all([
        this.personRepo.aliasesForPerson(person.id),
        this.personRepo.identifiersForPerson(person.id),
        this.casePersonRepo.forPerson(person.id),
        this.personRepo.casePhonesForPerson(person.id),
        this.db.drugPersonDevice.findMany({ where: { personId: person.id } }),
      ]);

      const hasPotentialDuplicate = potentialDuplicateIds.has(person.id);

      const primaryAlias = (aliases as Array<{ fullName: string; isPrimary: boolean }>).find((a) => !a.isPrimary)?.fullName ?? null;
      const identifierPreview = (identifiers as Array<{ type: string; value: string }>)[0] ?? null;

      rows.push({
        id: person.id,
        primaryFullName: person.primaryFullName,
        status: person.status,
        aliasCount: aliases.length,
        primaryAlias,
        identifierPreview: identifierPreview ? { type: identifierPreview.type, value: identifierPreview.value } : null,
        caseCount: caseLinks.length,
        phoneCount: phoneLinks.length,
        deviceCount: deviceLinks.length,
        firstSeenAt: person.createdAt,
        lastSeenAt: person.updatedAt,
        hasPotentialDuplicate,
      });
    }

    rows.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

    const start = (query.page - 1) * query.pageSize;
    return { rows: rows.slice(start, start + query.pageSize), total: rows.length };
  }
}
