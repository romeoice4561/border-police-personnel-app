/**
 * DI-8.2A — Cross-case connection evidence service.
 *
 * Strategy: source case → entity memberships → other cases sharing those
 * entities (shared-entity fan-out). Avoids pairwise O(N²) case comparison.
 *
 * Meaningful DIRECT evidence:
 * - same PERSON (canonical ACTIVE after merge resolution)
 * - same PHONE / SIM / DEVICE / VEHICLE / LOCATION entity id
 *
 * NOT evidence: same province text, same drug category alone.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import {
  evidenceTypeLabelTh,
  mergeEvidenceByTargetCase,
  toDateOnly,
  type CrossCaseConnectionCaseSummary,
  type CrossCaseConnectionResult,
  type CrossCaseEvidenceItem,
} from "@/lib/drug_intelligence/drug_cross_case_connection";

export class DrugCrossCaseConnectionNotFoundError extends Error {
  constructor(message = "Case not found") {
    super(message);
    this.name = "DrugCrossCaseConnectionNotFoundError";
  }
}

export interface DrugCrossCaseConnectionServiceOptions {
  canViewFull: boolean;
}

function caseSummary(row: {
  id: string;
  caseNumber: string;
  arrestDate: Date | string | null;
  arrestTime?: string | null;
  province: string | null;
  locationName?: string | null;
  status?: string | null;
}): CrossCaseConnectionCaseSummary {
  return {
    caseId: row.id,
    caseNumber: row.caseNumber,
    arrestDate: toDateOnly(row.arrestDate),
    arrestTime: row.arrestTime ?? null,
    province: row.province,
    locationName: row.locationName ?? null,
    status: row.status ?? null,
  };
}

export class DrugCrossCaseConnectionService {
  private readonly caseRepo: DrugCaseRepository;
  private readonly casePersonRepo: DrugCasePersonRepository;
  private readonly entityRepo: DrugEntityRepository;
  private readonly personRepo: DrugPersonRepository;

  constructor(private readonly db: DatabaseClient) {
    this.caseRepo = new DrugCaseRepository(db);
    this.casePersonRepo = new DrugCasePersonRepository(db);
    this.entityRepo = new DrugEntityRepository(db);
    this.personRepo = new DrugPersonRepository(db);
  }

  async loadForCase(caseId: string, options: DrugCrossCaseConnectionServiceOptions): Promise<CrossCaseConnectionResult> {
    const source = await this.caseRepo.findById(caseId);
    if (!source) throw new DrugCrossCaseConnectionNotFoundError();

    const sourceSummary = caseSummary(source as Parameters<typeof caseSummary>[0]);

    const [personLinks, phoneLinks, simLinks, deviceLinks, vehicleLinks, locationLinks] = await Promise.all([
      this.casePersonRepo.forCase(caseId),
      this.caseRepo.casePhonesForCase(caseId),
      this.caseRepo.caseSimsForCase(caseId),
      this.caseRepo.caseDevicesForCase(caseId),
      this.caseRepo.caseVehiclesForCase(caseId),
      this.caseRepo.caseLocationsForCase(caseId),
    ]);

    const typedPersons = personLinks as Array<{ personId: string; role: string }>;
    const typedPhones = phoneLinks as Array<{ phoneNumberId: string }>;
    const typedSims = simLinks as Array<{ simId: string }>;
    const typedDevices = deviceLinks as Array<{ deviceId: string }>;
    const typedVehicles = vehicleLinks as Array<{ vehicleId: string }>;
    const typedLocations = locationLinks as Array<{ locationId: string }>;

    const rawPersonIds = [...new Set(typedPersons.map((p) => p.personId))];
    const canonicalPersonIds = await this.resolveCanonicalPersonIds(rawPersonIds);

    const phoneIds = [...new Set(typedPhones.map((p) => p.phoneNumberId))];
    const simIds = [...new Set(typedSims.map((p) => p.simId))];
    const deviceIds = [...new Set(typedDevices.map((p) => p.deviceId))];
    const vehicleIds = [...new Set(typedVehicles.map((p) => p.vehicleId))];
    const locationIds = [...new Set(typedLocations.map((p) => p.locationId))];

    const [otherPersonLinks, otherPhoneLinks, otherSimLinks, otherDeviceLinks, otherVehicleLinks, otherLocationLinks] =
      await Promise.all([
        canonicalPersonIds.length ? this.personRepo.casePersonsForPersons(canonicalPersonIds) : Promise.resolve([]),
        phoneIds.length ? this.entityRepo.casePhonesForPhones(phoneIds) : Promise.resolve([]),
        simIds.length ? this.entityRepo.caseSimsForSims(simIds) : Promise.resolve([]),
        deviceIds.length ? this.entityRepo.caseDevicesForDevices(deviceIds) : Promise.resolve([]),
        vehicleIds.length ? this.entityRepo.caseVehiclesForVehicles(vehicleIds) : Promise.resolve([]),
        locationIds.length ? this.entityRepo.caseLocationsForLocations(locationIds) : Promise.resolve([]),
      ]);

    const targetCaseIds = new Set<string>();
    for (const row of otherPersonLinks as Array<{ caseId: string }>) if (row.caseId !== caseId) targetCaseIds.add(row.caseId);
    for (const row of otherPhoneLinks as Array<{ caseId: string }>) if (row.caseId !== caseId) targetCaseIds.add(row.caseId);
    for (const row of otherSimLinks as Array<{ caseId: string }>) if (row.caseId !== caseId) targetCaseIds.add(row.caseId);
    for (const row of otherDeviceLinks as Array<{ caseId: string }>) if (row.caseId !== caseId) targetCaseIds.add(row.caseId);
    for (const row of otherVehicleLinks as Array<{ caseId: string }>) if (row.caseId !== caseId) targetCaseIds.add(row.caseId);
    for (const row of otherLocationLinks as Array<{ caseId: string }>) if (row.caseId !== caseId) targetCaseIds.add(row.caseId);

    const targetCases = targetCaseIds.size ? await this.caseRepo.findByIds([...targetCaseIds]) : [];
    const targetById = new Map(
      (targetCases as Array<{ id: string }>).map((c) => [c.id, caseSummary(c as Parameters<typeof caseSummary>[0])]),
    );

    const [persons, phones, sims, devices, vehicles, locations] = await Promise.all([
      canonicalPersonIds.length ? this.personRepo.findByIds(canonicalPersonIds) : Promise.resolve([]),
      phoneIds.length ? this.entityRepo.findByIdsPhones(phoneIds) : Promise.resolve([]),
      simIds.length ? this.entityRepo.findByIdsSims(simIds) : Promise.resolve([]),
      deviceIds.length ? this.entityRepo.findByIdsDevices(deviceIds) : Promise.resolve([]),
      vehicleIds.length ? this.entityRepo.findByIdsVehicles(vehicleIds) : Promise.resolve([]),
      locationIds.length ? this.entityRepo.findByIdsLocations(locationIds) : Promise.resolve([]),
    ]);

    const personById = new Map((persons as Array<{ id: string; primaryFullName: string }>).map((p) => [p.id, p]));
    const phoneById = new Map((phones as Array<{ id: string; normalizedNumber: string }>).map((p) => [p.id, p]));
    const simById = new Map((sims as Array<{ id: string; iccid: string | null }>).map((p) => [p.id, p]));
    const deviceById = new Map(
      (devices as Array<{ id: string; brand: string | null; model: string | null; imei1: string | null }>).map((p) => [p.id, p]),
    );
    const vehicleById = new Map(
      (
        vehicles as Array<{
          id: string;
          brand: string | null;
          model: string | null;
          registrationNumber: string | null;
          registrationProvince: string | null;
        }>
      ).map((p) => [p.id, p]),
    );
    const locationById = new Map(
      (locations as Array<{ id: string; name: string | null; addressText: string | null; province: string | null }>).map((p) => [
        p.id,
        p,
      ]),
    );

    type Row = { targetCase: CrossCaseConnectionCaseSummary; evidence: CrossCaseEvidenceItem };
    const rows: Row[] = [];

    for (const link of otherPersonLinks as Array<{ caseId: string; personId: string }>) {
      if (link.caseId === caseId) continue;
      const target = targetById.get(link.caseId);
      const person = personById.get(link.personId);
      if (!target || !person) continue;
      rows.push({
        targetCase: target,
        evidence: {
          entityType: "PERSON",
          entityId: person.id,
          displayLabel: evidenceTypeLabelTh("PERSON"),
          displayValue: person.primaryFullName,
          relationshipType: "PERSON_CASE",
          provenance: "SHARED_ENTITY",
          href: `/drug-intelligence/persons/${encodeURIComponent(person.id)}`,
        },
      });
    }

    for (const link of otherPhoneLinks as Array<{ caseId: string; phoneNumberId: string }>) {
      if (link.caseId === caseId) continue;
      const target = targetById.get(link.caseId);
      const phone = phoneById.get(link.phoneNumberId);
      if (!target || !phone) continue;
      rows.push({
        targetCase: target,
        evidence: {
          entityType: "PHONE",
          entityId: phone.id,
          displayLabel: evidenceTypeLabelTh("PHONE"),
          displayValue: presentPhoneNumber(phone.normalizedNumber, options.canViewFull),
          relationshipType: "CASE_PHONE",
          provenance: "SHARED_ENTITY",
          href: drugEntityDetailPath("PHONE", phone.id),
        },
      });
    }

    for (const link of otherSimLinks as Array<{ caseId: string; simId: string }>) {
      if (link.caseId === caseId) continue;
      const target = targetById.get(link.caseId);
      const sim = simById.get(link.simId);
      if (!target || !sim) continue;
      rows.push({
        targetCase: target,
        evidence: {
          entityType: "SIM",
          entityId: sim.id,
          displayLabel: evidenceTypeLabelTh("SIM"),
          displayValue: sim.iccid ? presentIdentifierValue(sim.iccid, options.canViewFull) : "SIM",
          relationshipType: "CASE_SIM",
          provenance: "SHARED_ENTITY",
          href: drugEntityDetailPath("SIM", sim.id),
        },
      });
    }

    for (const link of otherDeviceLinks as Array<{ caseId: string; deviceId: string }>) {
      if (link.caseId === caseId) continue;
      const target = targetById.get(link.caseId);
      const device = deviceById.get(link.deviceId);
      if (!target || !device) continue;
      const brandModel = [device.brand, device.model].filter(Boolean).join(" ");
      const imei = device.imei1 ? presentIdentifierValue(device.imei1, options.canViewFull) : null;
      rows.push({
        targetCase: target,
        evidence: {
          entityType: "DEVICE",
          entityId: device.id,
          displayLabel: evidenceTypeLabelTh("DEVICE"),
          displayValue: [brandModel || null, imei].filter(Boolean).join(" • ") || "Device",
          relationshipType: "CASE_DEVICE",
          provenance: "SHARED_ENTITY",
          href: drugEntityDetailPath("DEVICE", device.id),
        },
      });
    }

    for (const link of otherVehicleLinks as Array<{ caseId: string; vehicleId: string }>) {
      if (link.caseId === caseId) continue;
      const target = targetById.get(link.caseId);
      const vehicle = vehicleById.get(link.vehicleId);
      if (!target || !vehicle) continue;
      const brandModel = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
      const plate = vehicle.registrationNumber
        ? presentIdentifierValue(vehicle.registrationNumber, options.canViewFull)
        : null;
      rows.push({
        targetCase: target,
        evidence: {
          entityType: "VEHICLE",
          entityId: vehicle.id,
          displayLabel: evidenceTypeLabelTh("VEHICLE"),
          displayValue: [brandModel || null, plate, vehicle.registrationProvince].filter(Boolean).join(" • ") || "Vehicle",
          relationshipType: "CASE_VEHICLE",
          provenance: "SHARED_ENTITY",
          href: drugEntityDetailPath("VEHICLE", vehicle.id),
        },
      });
    }

    for (const link of otherLocationLinks as Array<{ caseId: string; locationId: string }>) {
      if (link.caseId === caseId) continue;
      const target = targetById.get(link.caseId);
      const location = locationById.get(link.locationId);
      if (!target || !location) continue;
      rows.push({
        targetCase: target,
        evidence: {
          entityType: "LOCATION",
          entityId: location.id,
          displayLabel: evidenceTypeLabelTh("LOCATION"),
          displayValue: location.name || location.addressText || location.province || "Location",
          relationshipType: "CASE_LOCATION",
          provenance: "SHARED_ENTITY",
          href: null,
        },
      });
    }

    return {
      sourceCase: sourceSummary,
      connections: mergeEvidenceByTargetCase(sourceSummary, rows),
    };
  }

  private async resolveCanonicalPersonIds(personIds: string[]): Promise<string[]> {
    if (!personIds.length) return [];
    const persons = (await this.personRepo.findByIds(personIds)) as Array<{
      id: string;
      status?: string;
      mergedIntoPersonId?: string | null;
    }>;
    const out = new Set<string>();
    for (const p of persons) {
      if (!p) continue;
      if (p.status === "MERGED" && p.mergedIntoPersonId) out.add(p.mergedIntoPersonId);
      else out.add(p.id);
    }
    return [...out];
  }
}
