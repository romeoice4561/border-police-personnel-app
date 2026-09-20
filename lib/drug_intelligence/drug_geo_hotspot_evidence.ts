/**
 * DI-8.2B — Cross-case evidence *within* a geographic hotspot.
 *
 * Geographic proximity alone is NEVER treated as DIRECT evidence.
 * Only shared PERSON / PHONE / SIM / DEVICE / VEHICLE / LOCATION entity ids.
 *
 * Pure — no I/O. Uses inverted entity→cases index (not pairwise O(N²) cases).
 */

import {
  evidenceTypeLabelTh,
  mergeEvidenceByTargetCase,
  sortCasesChronologically,
  toDateOnly,
  type CrossCaseConnection,
  type CrossCaseConnectionCaseSummary,
  type CrossCaseEntityType,
  type CrossCaseEvidenceItem,
} from "@/lib/drug_intelligence/drug_cross_case_connection";

export interface HotspotCaseEntityMembership {
  caseId: string;
  caseNumber: string;
  arrestDate: string | null;
  arrestTime: string | null;
  province: string | null;
  district: string | null;
  locationName: string | null;
  status: string | null;
  personIds: string[];
  phoneIds: string[];
  simIds: string[];
  deviceIds: string[];
  vehicleIds: string[];
  locationIds: string[];
  /** Display names keyed by personId when available. */
  personLabels?: Record<string, string>;
  phoneLabels?: Record<string, string>;
  vehicleLabels?: Record<string, string>;
}

export interface HotspotEntityCounts {
  uniquePersonCount: number;
  uniquePhoneCount: number;
  uniqueVehicleCount: number;
  uniqueSimCount: number;
  uniqueDeviceCount: number;
  uniqueLocationCount: number;
}

export interface HotspotCaseChronologyRow {
  caseId: string;
  caseNumber: string;
  arrestDate: string | null;
  arrestTime: string | null;
  province: string | null;
  district: string | null;
  personNames: string[];
}

export interface HotspotPairEvidence {
  caseAId: string;
  caseBId: string;
  caseANumber: string;
  caseBNumber: string;
  /** True only when shared-entity evidence exists. */
  hasDirectEvidence: boolean;
  evidenceLabels: string[];
  connectionsFromA: CrossCaseConnection[];
}

export interface HotspotCrossCaseAnalysis {
  counts: HotspotEntityCounts;
  chronology: HotspotCaseChronologyRow[];
  pairs: HotspotPairEvidence[];
  /** Pairs with no shared entity — geographic only. */
  proximityOnlyPairCount: number;
  linkedPairCount: number;
}

export function countHotspotEntities(memberships: readonly HotspotCaseEntityMembership[]): HotspotEntityCounts {
  const persons = new Set<string>();
  const phones = new Set<string>();
  const vehicles = new Set<string>();
  const sims = new Set<string>();
  const devices = new Set<string>();
  const locations = new Set<string>();
  for (const m of memberships) {
    for (const id of m.personIds) persons.add(id);
    for (const id of m.phoneIds) phones.add(id);
    for (const id of m.vehicleIds) vehicles.add(id);
    for (const id of m.simIds) sims.add(id);
    for (const id of m.deviceIds) devices.add(id);
    for (const id of m.locationIds) locations.add(id);
  }
  return {
    uniquePersonCount: persons.size,
    uniquePhoneCount: phones.size,
    uniqueVehicleCount: vehicles.size,
    uniqueSimCount: sims.size,
    uniqueDeviceCount: devices.size,
    uniqueLocationCount: locations.size,
  };
}

function caseSummary(m: HotspotCaseEntityMembership): CrossCaseConnectionCaseSummary {
  return {
    caseId: m.caseId,
    caseNumber: m.caseNumber,
    arrestDate: toDateOnly(m.arrestDate),
    arrestTime: m.arrestTime,
    province: m.province,
    locationName: m.locationName,
    status: m.status,
  };
}

type EntityBucket = { type: CrossCaseEntityType; id: string; label: string; value: string };

function collectEntities(m: HotspotCaseEntityMembership): EntityBucket[] {
  const out: EntityBucket[] = [];
  for (const id of m.personIds) {
    out.push({
      type: "PERSON",
      id,
      label: evidenceTypeLabelTh("PERSON"),
      value: m.personLabels?.[id] ?? id,
    });
  }
  for (const id of m.phoneIds) {
    out.push({
      type: "PHONE",
      id,
      label: evidenceTypeLabelTh("PHONE"),
      value: m.phoneLabels?.[id] ?? id,
    });
  }
  for (const id of m.simIds) {
    out.push({ type: "SIM", id, label: evidenceTypeLabelTh("SIM"), value: id });
  }
  for (const id of m.deviceIds) {
    out.push({ type: "DEVICE", id, label: evidenceTypeLabelTh("DEVICE"), value: id });
  }
  for (const id of m.vehicleIds) {
    out.push({
      type: "VEHICLE",
      id,
      label: evidenceTypeLabelTh("VEHICLE"),
      value: m.vehicleLabels?.[id] ?? id,
    });
  }
  for (const id of m.locationIds) {
    out.push({ type: "LOCATION", id, label: evidenceTypeLabelTh("LOCATION"), value: id });
  }
  return out;
}

/**
 * Build inverted index entityKey → caseIds, then emit evidence for entities
 * shared by ≥2 cases inside the hotspot. Complexity O(E · c²) per entity with
 * c = cases sharing that entity — not O(N²) over all case pairs.
 */
export function analyzeHotspotCrossCaseEvidence(
  memberships: readonly HotspotCaseEntityMembership[],
): HotspotCrossCaseAnalysis {
  const byId = new Map(memberships.map((m) => [m.caseId, m]));
  const counts = countHotspotEntities(memberships);

  const chronology: HotspotCaseChronologyRow[] = sortCasesChronologically(
    memberships.map((m) => ({
      caseId: m.caseId,
      caseNumber: m.caseNumber,
      arrestDate: m.arrestDate,
      arrestTime: m.arrestTime,
    })),
  ).map((row) => {
    const m = byId.get(row.caseId)!;
    const personNames = m.personIds
      .map((id) => m.personLabels?.[id])
      .filter((n): n is string => Boolean(n));
    return {
      caseId: m.caseId,
      caseNumber: m.caseNumber,
      arrestDate: toDateOnly(m.arrestDate),
      arrestTime: m.arrestTime,
      province: m.province,
      district: m.district,
      personNames,
    };
  });

  // entityKey → set of caseIds
  const index = new Map<string, Set<string>>();
  const entityMeta = new Map<string, EntityBucket>();
  for (const m of memberships) {
    for (const ent of collectEntities(m)) {
      const key = `${ent.type}:${ent.id}`;
      entityMeta.set(key, ent);
      let set = index.get(key);
      if (!set) {
        set = new Set();
        index.set(key, set);
      }
      set.add(m.caseId);
    }
  }

  // pairKey (sorted caseA|caseB) → evidence items for caseA→caseB direction stored once
  const pairEvidence = new Map<
    string,
    {
      caseAId: string;
      caseBId: string;
      items: CrossCaseEvidenceItem[];
    }
  >();

  for (const [key, caseIds] of index) {
    if (caseIds.size < 2) continue;
    const ent = entityMeta.get(key)!;
    const ids = [...caseIds].sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const caseAId = ids[i]!;
        const caseBId = ids[j]!;
        const pairKey = `${caseAId}|${caseBId}`;
        const evidence: CrossCaseEvidenceItem = {
          entityType: ent.type,
          entityId: ent.id,
          displayLabel: ent.label,
          displayValue: ent.value,
          relationshipType: "SHARED_IN_HOTSPOT",
          provenance: "SHARED_ENTITY",
        };
        const existing = pairEvidence.get(pairKey);
        if (existing) {
          const dup = existing.items.some(
            (e) => e.entityType === evidence.entityType && e.entityId === evidence.entityId,
          );
          if (!dup) existing.items.push(evidence);
        } else {
          pairEvidence.set(pairKey, { caseAId, caseBId, items: [evidence] });
        }
      }
    }
  }

  const allCaseIds = [...byId.keys()].sort((a, b) => a.localeCompare(b));
  const totalPairs = (allCaseIds.length * (allCaseIds.length - 1)) / 2;
  const pairs: HotspotPairEvidence[] = [];

  for (const shared of pairEvidence.values()) {
    const a = byId.get(shared.caseAId)!;
    const b = byId.get(shared.caseBId)!;
    const connectionsFromA = mergeEvidenceByTargetCase(
      caseSummary(a),
      shared.items.map((evidence) => ({
        targetCase: caseSummary(b),
        evidence,
        directness: "DIRECT" as const,
        hopCount: 1,
      })),
    );
    pairs.push({
      caseAId: shared.caseAId,
      caseBId: shared.caseBId,
      caseANumber: a.caseNumber,
      caseBNumber: b.caseNumber,
      hasDirectEvidence: true,
      evidenceLabels: [...new Set(shared.items.map((e) => e.displayLabel))],
      connectionsFromA,
    });
  }

  pairs.sort((x, y) => x.caseANumber.localeCompare(y.caseANumber, "th") || x.caseBNumber.localeCompare(y.caseBNumber, "th"));

  const linkedPairCount = pairs.length;
  const proximityOnlyPairCount = Math.max(0, totalPairs - linkedPairCount);

  return { counts, chronology, pairs, proximityOnlyPairCount, linkedPairCount };
}

/** UI copy: proximity without shared-entity evidence. */
export const HOTSPOT_PROXIMITY_ONLY_MESSAGE_TH =
  "พบในพื้นที่ใกล้เคียงกัน แต่ยังไม่พบหลักฐานเชื่อมโยงโดยตรง";
