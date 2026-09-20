/**
 * DI-8.2B — Batch load entity memberships for hotspot inspector.
 *
 * Fixed query shape vs hotspot size N (bounded batch IN queries), not N+1.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { presentPhoneNumber, formatPhoneForDisplay } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import {
  analyzeHotspotCrossCaseEvidence,
  type HotspotCaseEntityMembership,
  type HotspotCrossCaseAnalysis,
} from "@/lib/drug_intelligence/drug_geo_hotspot_evidence";
import { toDateOnly } from "@/lib/drug_intelligence/drug_cross_case_connection";
import { parseThaiClockHhMm } from "@/lib/drug_intelligence/di_date_helpers";

export const HOTSPOT_CONTEXT_MAX_CASES = 80;
export const HOTSPOT_CONTEXT_MAX_DB_CALLS = 12;

export class DrugGeoHotspotContextInvalidError extends Error {
  constructor(message = "Invalid hotspot context request") {
    super(message);
    this.name = "DrugGeoHotspotContextInvalidError";
  }
}

export interface DrugGeoHotspotContextResult {
  caseIds: string[];
  truncated: boolean;
  analysis: HotspotCrossCaseAnalysis;
}

function isoDate(value: unknown): string | null {
  return toDateOnly(value as string | Date | null | undefined);
}

export class DrugGeoHotspotContextService {
  constructor(private readonly db: DatabaseClient) {}

  async load(rawCaseIds: string[], options: { canViewFull: boolean }): Promise<DrugGeoHotspotContextResult> {
    const cleaned = [...new Set(rawCaseIds.map((id) => id.trim()).filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)))];
    if (cleaned.length === 0) throw new DrugGeoHotspotContextInvalidError("caseIds required");
    const truncated = cleaned.length > HOTSPOT_CONTEXT_MAX_CASES;
    const caseIds = truncated ? cleaned.slice(0, HOTSPOT_CONTEXT_MAX_CASES) : cleaned;

    const cases = (await this.db.drugCase.findMany({
      where: { id: { in: caseIds } },
      select: {
        id: true,
        caseNumber: true,
        arrestDate: true,
        arrestTime: true,
        province: true,
        district: true,
        locationName: true,
        status: true,
      },
    })) as Array<{
      id: unknown;
      caseNumber: string;
      arrestDate: Date | string | null;
      arrestTime: string | null;
      province: string | null;
      district: string | null;
      locationName: string | null;
      status: string;
    }>;

    const caseById = new Map(cases.map((c) => [String(c.id), c]));

    const [personLinks, phoneLinks, simLinks, deviceLinks, vehicleLinks, locationLinks] = await Promise.all([
      this.db.drugCasePerson.findMany({ where: { caseId: { in: caseIds } }, select: { caseId: true, personId: true } }),
      this.db.drugCasePhone.findMany({ where: { caseId: { in: caseIds } }, select: { caseId: true, phoneNumberId: true } }),
      this.db.drugCaseSim.findMany({ where: { caseId: { in: caseIds } }, select: { caseId: true, simId: true } }),
      this.db.drugCaseDevice.findMany({ where: { caseId: { in: caseIds } }, select: { caseId: true, deviceId: true } }),
      this.db.drugCaseVehicle.findMany({ where: { caseId: { in: caseIds } }, select: { caseId: true, vehicleId: true } }),
      this.db.drugCaseLocation.findMany({ where: { caseId: { in: caseIds } }, select: { caseId: true, locationId: true } }),
    ]);

    const personIds = [...new Set((personLinks as Array<{ personId: unknown }>).map((r) => String(r.personId)))];
    const phoneIds = [...new Set((phoneLinks as Array<{ phoneNumberId: unknown }>).map((r) => String(r.phoneNumberId)))];
    const vehicleIds = [...new Set((vehicleLinks as Array<{ vehicleId: unknown }>).map((r) => String(r.vehicleId)))];

    const [persons, phones, vehicles] = await Promise.all([
      personIds.length
        ? this.db.drugPerson.findMany({ where: { id: { in: personIds } }, select: { id: true, primaryFullName: true } })
        : Promise.resolve([]),
      phoneIds.length
        ? this.db.drugPhoneNumber.findMany({ where: { id: { in: phoneIds } }, select: { id: true, normalizedNumber: true } })
        : Promise.resolve([]),
      vehicleIds.length
        ? this.db.drugVehicle.findMany({
            where: { id: { in: vehicleIds } },
            select: { id: true, registrationNumber: true, brand: true, model: true },
          })
        : Promise.resolve([]),
    ]);

    const personLabel = new Map(
      (persons as Array<{ id: unknown; primaryFullName: string }>).map((p) => [String(p.id), p.primaryFullName]),
    );
    const phoneLabel = new Map(
      (phones as Array<{ id: unknown; normalizedNumber: string }>).map((p) => {
        const raw = p.normalizedNumber;
        const display = options.canViewFull ? formatPhoneForDisplay(raw) : presentPhoneNumber(raw, false);
        return [String(p.id), display] as const;
      }),
    );
    const vehicleLabel = new Map(
      (
        vehicles as Array<{
          id: unknown;
          registrationNumber: string | null;
          brand: string | null;
          model: string | null;
        }>
      ).map((v) => {
        const parts = [v.registrationNumber, v.brand, v.model].filter(Boolean);
        return [String(v.id), parts.join(" ") || String(v.id)] as const;
      }),
    );

    const personsByCase = groupIds(personLinks as Array<{ caseId: unknown; personId: unknown }>, "personId");
    const phonesByCase = groupIds(phoneLinks as Array<{ caseId: unknown; phoneNumberId: unknown }>, "phoneNumberId");
    const simsByCase = groupIds(simLinks as Array<{ caseId: unknown; simId: unknown }>, "simId");
    const devicesByCase = groupIds(deviceLinks as Array<{ caseId: unknown; deviceId: unknown }>, "deviceId");
    const vehiclesByCase = groupIds(vehicleLinks as Array<{ caseId: unknown; vehicleId: unknown }>, "vehicleId");
    const locationsByCase = groupIds(locationLinks as Array<{ caseId: unknown; locationId: unknown }>, "locationId");

    const memberships: HotspotCaseEntityMembership[] = [];
    for (const caseId of caseIds) {
      const row = caseById.get(caseId);
      if (!row) continue;
      const pIds = personsByCase.get(caseId) ?? [];
      const phIds = phonesByCase.get(caseId) ?? [];
      const vIds = vehiclesByCase.get(caseId) ?? [];
      const personLabels: Record<string, string> = {};
      for (const id of pIds) {
        const name = personLabel.get(id);
        if (name) personLabels[id] = name;
      }
      const phoneLabels: Record<string, string> = {};
      for (const id of phIds) {
        const label = phoneLabel.get(id);
        if (label) phoneLabels[id] = label;
      }
      const vehicleLabels: Record<string, string> = {};
      for (const id of vIds) {
        const label = vehicleLabel.get(id);
        if (label) vehicleLabels[id] = label;
      }
      memberships.push({
        caseId,
        caseNumber: row.caseNumber,
        arrestDate: isoDate(row.arrestDate),
        arrestTime: parseThaiClockHhMm(row.arrestTime),
        province: row.province,
        district: row.district,
        locationName: row.locationName,
        status: row.status,
        personIds: pIds,
        phoneIds: phIds,
        simIds: simsByCase.get(caseId) ?? [],
        deviceIds: devicesByCase.get(caseId) ?? [],
        vehicleIds: vIds,
        locationIds: locationsByCase.get(caseId) ?? [],
        personLabels,
        phoneLabels,
        vehicleLabels,
      });
    }

    return {
      caseIds,
      truncated,
      analysis: analyzeHotspotCrossCaseEvidence(memberships),
    };
  }
}

function groupIds<T extends Record<string, unknown>>(rows: T[], idKey: keyof T): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const caseId = String(row.caseId);
    const id = String(row[idKey]);
    const list = map.get(caseId);
    if (list) {
      if (!list.includes(id)) list.push(id);
    } else map.set(caseId, [id]);
  }
  return map;
}
