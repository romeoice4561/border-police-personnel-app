/**
 * DrugEntityDetailService (Phase DI-3 — Sections 12-16).
 *
 * The entity-detail aggregate for Phone/SIM/Device/Vehicle — the DI-3
 * equivalent of DrugPersonProfileService.getProfile() but for non-Person
 * entities. Read-only. Reuses the SAME provenance-derived firstSeen/lastSeen
 * pattern DrugPersonProfileService already established (never just
 * `createdAt`), and the SAME centralized masking helper — never a new
 * masking rule per entity type.
 *
 * Section 17's wording rule: relationships are always phrased as "found
 * associated" (พบเกี่ยวข้องกับ), never "owner" (เจ้าของ) — none of the
 * underlying schema relationships (DrugPersonDevice, DrugCasePhone, etc.)
 * carry an ownership semantic, so this service never manufactures one in
 * its labels either.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";

export class DrugPhoneNotFoundError extends Error {
  constructor(id: string) {
    super(`Phone number '${id}' not found`);
    this.name = "DrugPhoneNotFoundError";
  }
}
export class DrugSimNotFoundError extends Error {
  constructor(id: string) {
    super(`SIM '${id}' not found`);
    this.name = "DrugSimNotFoundError";
  }
}
export class DrugDeviceNotFoundError extends Error {
  constructor(id: string) {
    super(`Device '${id}' not found`);
    this.name = "DrugDeviceNotFoundError";
  }
}
export class DrugVehicleNotFoundError extends Error {
  constructor(id: string) {
    super(`Vehicle '${id}' not found`);
    this.name = "DrugVehicleNotFoundError";
  }
}

function deriveProvenanceDates(links: Array<{ firstSeenAt?: Date | null; lastSeenAt?: Date | null }>, fallback: Date): { firstSeenAt: Date; lastSeenAt: Date } {
  const firsts = links.map((l) => l.firstSeenAt).filter((d): d is Date => Boolean(d));
  const lasts = links.map((l) => l.lastSeenAt).filter((d): d is Date => Boolean(d));
  return {
    firstSeenAt: firsts.length > 0 ? new Date(Math.min(...firsts.map((d) => d.getTime()))) : fallback,
    lastSeenAt: lasts.length > 0 ? new Date(Math.max(...lasts.map((d) => d.getTime()))) : fallback,
  };
}

export class DrugEntityDetailService {
  private readonly entityRepo: DrugEntityRepository;
  private readonly personRepo: DrugPersonRepository;
  private readonly caseRepo: DrugCaseRepository;

  constructor(private readonly db: DatabaseClient) {
    this.entityRepo = new DrugEntityRepository(db);
    this.personRepo = new DrugPersonRepository(db);
    this.caseRepo = new DrugCaseRepository(db);
  }

  /** Section 13: Phone detail — normalized number, first/last seen, linked persons, source cases, provenance. */
  async getPhoneDetail(phoneNumberId: string) {
    const phone = await this.entityRepo.findPhoneNumberById(phoneNumberId);
    if (!phone) throw new DrugPhoneNotFoundError(phoneNumberId);

    const caseLinks = await this.entityRepo.casePhonesForPhoneNumber(phoneNumberId);
    const typedLinks = caseLinks as Array<{ id: string; caseId: string; personId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; recordedBy: string; originalInput: string | null }>;

    const personIds = [...new Set(typedLinks.map((l) => l.personId))];
    const caseIds = [...new Set(typedLinks.map((l) => l.caseId))];
    const [persons, cases] = await Promise.all([
      Promise.all(personIds.map((id) => this.personRepo.findById(id))),
      Promise.all(caseIds.map((id) => this.caseRepo.findById(id))),
    ]);
    const personById = new Map(persons.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]));
    const caseById = new Map(cases.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c.id, c]));

    const relatedPersons = personIds.map((id) => personById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const sourceCases = caseIds.map((id) => caseById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

    const dates = deriveProvenanceDates(typedLinks, phone.createdAt);

    return {
      phone,
      caseLinks: typedLinks.map((l) => ({ ...l, person: personById.get(l.personId) ?? null, case: caseById.get(l.caseId) ?? null })),
      relatedPersons,
      sourceCases,
      relatedPersonCount: relatedPersons.length,
      caseCount: sourceCases.length,
      firstSeenAt: dates.firstSeenAt,
      lastSeenAt: dates.lastSeenAt,
    };
  }

  /** Section 14: SIM detail — ICCID/IMSI, linked phone/device history, persons/cases via provenance. */
  async getSimDetail(simId: string) {
    const sim = await this.entityRepo.findSimById(simId);
    if (!sim) throw new DrugSimNotFoundError(simId);

    const caseLinks = await this.entityRepo.caseSimsForSim(simId);
    const typedLinks = caseLinks as Array<{ id: string; caseId: string; personId: string | null; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; recordedBy: string }>;

    const personIds = [...new Set(typedLinks.map((l) => l.personId).filter((id): id is string => id !== null))];
    const caseIds = [...new Set(typedLinks.map((l) => l.caseId))];
    const [persons, cases] = await Promise.all([
      Promise.all(personIds.map((id) => this.personRepo.findById(id))),
      Promise.all(caseIds.map((id) => this.caseRepo.findById(id))),
    ]);
    const personById = new Map(persons.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]));
    const caseById = new Map(cases.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c.id, c]));

    const relatedPersons = personIds.map((id) => personById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const sourceCases = caseIds.map((id) => caseById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

    const dates = deriveProvenanceDates(typedLinks, sim.createdAt);

    return {
      sim,
      caseLinks: typedLinks.map((l) => ({ ...l, person: l.personId ? (personById.get(l.personId) ?? null) : null, case: caseById.get(l.caseId) ?? null })),
      relatedPersons,
      sourceCases,
      relatedPersonCount: relatedPersons.length,
      caseCount: sourceCases.length,
      firstSeenAt: dates.firstSeenAt,
      lastSeenAt: dates.lastSeenAt,
    };
  }

  /** Section 15: Device detail — brand/model/IMEI1/IMEI2/serial, linked persons, SIM history, cases, provenance. */
  async getDeviceDetail(deviceId: string) {
    const device = await this.entityRepo.findDeviceById(deviceId);
    if (!device) throw new DrugDeviceNotFoundError(deviceId);

    const [personLinks, caseLinks] = await Promise.all([this.entityRepo.personDevicesForDevice(deviceId), this.entityRepo.caseDevicesForDevice(deviceId)]);
    const typedPersonLinks = personLinks as Array<{ id: string; personId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null; recordedBy: string }>;
    const typedCaseLinks = caseLinks as Array<{ id: string; caseId: string; personId: string | null; status: string; recordedBy: string }>;

    const personIds = [...new Set([...typedPersonLinks.map((l) => l.personId), ...typedCaseLinks.map((l) => l.personId).filter((id): id is string => id !== null)])];
    const caseIds = [...new Set(typedCaseLinks.map((l) => l.caseId))];
    const [persons, cases] = await Promise.all([
      Promise.all(personIds.map((id) => this.personRepo.findById(id))),
      Promise.all(caseIds.map((id) => this.caseRepo.findById(id))),
    ]);
    const personById = new Map(persons.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]));
    const caseById = new Map(cases.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c.id, c]));

    const relatedPersons = personIds.map((id) => personById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const sourceCases = caseIds.map((id) => caseById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

    const dates = deriveProvenanceDates(typedPersonLinks, device.createdAt);

    return {
      device,
      personLinks: typedPersonLinks.map((l) => ({ ...l, person: personById.get(l.personId) ?? null })),
      caseLinks: typedCaseLinks.map((l) => ({ ...l, person: l.personId ? (personById.get(l.personId) ?? null) : null, case: caseById.get(l.caseId) ?? null })),
      relatedPersons,
      sourceCases,
      relatedPersonCount: relatedPersons.length,
      caseCount: sourceCases.length,
      firstSeenAt: dates.firstSeenAt,
      lastSeenAt: dates.lastSeenAt,
    };
  }

  /** Section 16: Vehicle detail — registration/province/VIN/brand/model/color, linked persons, cases, provenance. */
  async getVehicleDetail(vehicleId: string) {
    const vehicle = await this.entityRepo.findVehicleById(vehicleId);
    if (!vehicle) throw new DrugVehicleNotFoundError(vehicleId);

    const [personLinks, caseLinks] = await Promise.all([this.entityRepo.personVehiclesForVehicle(vehicleId), this.entityRepo.caseVehiclesForVehicle(vehicleId)]);
    const typedPersonLinks = personLinks as Array<{ id: string; personId: string; status: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null; recordedBy: string }>;
    const typedCaseLinks = caseLinks as Array<{ id: string; caseId: string; personId: string | null; status: string; recordedBy: string }>;

    const personIds = [...new Set([...typedPersonLinks.map((l) => l.personId), ...typedCaseLinks.map((l) => l.personId).filter((id): id is string => id !== null)])];
    const caseIds = [...new Set(typedCaseLinks.map((l) => l.caseId))];
    const [persons, cases] = await Promise.all([
      Promise.all(personIds.map((id) => this.personRepo.findById(id))),
      Promise.all(caseIds.map((id) => this.caseRepo.findById(id))),
    ]);
    const personById = new Map(persons.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]));
    const caseById = new Map(cases.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c.id, c]));

    const relatedPersons = personIds.map((id) => personById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const sourceCases = caseIds.map((id) => caseById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

    const dates = deriveProvenanceDates(typedPersonLinks, vehicle.createdAt);

    return {
      vehicle,
      personLinks: typedPersonLinks.map((l) => ({ ...l, person: personById.get(l.personId) ?? null })),
      caseLinks: typedCaseLinks.map((l) => ({ ...l, person: l.personId ? (personById.get(l.personId) ?? null) : null, case: caseById.get(l.caseId) ?? null })),
      relatedPersons,
      sourceCases,
      relatedPersonCount: relatedPersons.length,
      caseCount: sourceCases.length,
      firstSeenAt: dates.firstSeenAt,
      lastSeenAt: dates.lastSeenAt,
    };
  }
}
