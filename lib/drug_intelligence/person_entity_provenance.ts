/**
 * Person-entity case provenance helpers (C-INTEL).
 *
 * Pure aggregation over already-loaded junction rows. Callers must pass
 * factual DrugCase* links — never inferred associations. first/last seen
 * are taken only from officer-recorded observation dates on those links
 * (or left null). createdAt/updatedAt are never used as operational seen
 * dates. DrugCase.arrestDate is attached on each case ref as case arrest
 * date, not as entity first/last seen.
 */

export interface PersonProvenanceCaseRef {
  caseId: string;
  caseNumber: string | null;
  arrestDate: Date | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
}

export interface PersonRelatedEntity {
  entityId: string;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  cases: PersonProvenanceCaseRef[];
}

export interface PersonCaseSummary {
  caseNumber?: string | null;
  arrestDate?: Date | string | null;
}

export function uniquePreserveOrder(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function minTimestamp(values: Array<Date | string | null | undefined>): Date | null {
  let min: number | null = null;
  for (const value of values) {
    if (value == null || value === "") continue;
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) continue;
    if (min === null || ms < min) min = ms;
  }
  return min === null ? null : new Date(min);
}

export function maxTimestamp(values: Array<Date | string | null | undefined>): Date | null {
  let max: number | null = null;
  for (const value of values) {
    if (value == null || value === "") continue;
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) continue;
    if (max === null || ms > max) max = ms;
  }
  return max === null ? null : new Date(max);
}

function toArrestDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function toProvenanceCaseRef(
  caseId: string,
  caseById: ReadonlyMap<string, PersonCaseSummary>,
  extras?: { firstSeenAt?: Date | string | null; lastSeenAt?: Date | string | null },
): PersonProvenanceCaseRef {
  const row = caseById.get(caseId);
  return {
    caseId,
    caseNumber: row?.caseNumber ?? null,
    arrestDate: toArrestDate(row?.arrestDate),
    firstSeenAt: minTimestamp([extras?.firstSeenAt ?? null]),
    lastSeenAt: maxTimestamp([extras?.lastSeenAt ?? null]),
  };
}

interface LinkWithCase {
  caseId: string;
}

/**
 * Groups junction rows by entity id, collapsing duplicate rows for the same
 * entity+case into one provenance case ref (no double-count).
 */
export function aggregateLinksByEntity<T extends LinkWithCase>(
  links: T[],
  entityIdOf: (link: T) => string | null | undefined,
  observedDatesOf: (link: T) => { firstSeenAt?: Date | string | null; lastSeenAt?: Date | string | null },
  caseById: ReadonlyMap<string, PersonCaseSummary>,
): PersonRelatedEntity[] {
  const grouped = new Map<string, T[]>();
  for (const link of links) {
    const entityId = entityIdOf(link);
    if (!entityId) continue;
    const list = grouped.get(entityId);
    if (list) list.push(link);
    else grouped.set(entityId, [link]);
  }

  const entities: PersonRelatedEntity[] = [];
  for (const [entityId, entityLinks] of grouped) {
    const byCase = new Map<string, T[]>();
    for (const link of entityLinks) {
      const list = byCase.get(link.caseId);
      if (list) list.push(link);
      else byCase.set(link.caseId, [link]);
    }
    const cases: PersonProvenanceCaseRef[] = [];
    const allFirst: Array<Date | string | null | undefined> = [];
    const allLast: Array<Date | string | null | undefined> = [];
    for (const [caseId, caseLinks] of byCase) {
      const firstSeenAt = minTimestamp(caseLinks.map((link) => observedDatesOf(link).firstSeenAt));
      const lastSeenAt = maxTimestamp(caseLinks.map((link) => observedDatesOf(link).lastSeenAt));
      allFirst.push(firstSeenAt);
      allLast.push(lastSeenAt);
      cases.push(toProvenanceCaseRef(caseId, caseById, { firstSeenAt, lastSeenAt }));
    }
    entities.push({
      entityId,
      firstSeenAt: minTimestamp(allFirst),
      lastSeenAt: maxTimestamp(allLast),
      cases,
    });
  }
  return entities;
}

export function splitRelatedByCurrentCase<T extends { cases: Array<{ caseId: string }> }>(
  entities: T[],
  currentCaseId: string | null,
): { inCurrentCase: T[]; inOtherCases: T[]; withoutCaseProvenance: T[] } {
  const inCurrentCase: T[] = [];
  const inOtherCases: T[] = [];
  const withoutCaseProvenance: T[] = [];
  for (const entity of entities) {
    if (currentCaseId && entity.cases.some((row) => row.caseId === currentCaseId)) {
      inCurrentCase.push(entity);
    } else if (entity.cases.length > 0) {
      inOtherCases.push(entity);
    } else {
      withoutCaseProvenance.push(entity);
    }
  }
  return { inCurrentCase, inOtherCases, withoutCaseProvenance };
}

export function countEntitiesInCase<T extends { cases: Array<{ caseId: string }> }>(entities: T[], caseId: string): number {
  return entities.filter((entity) => entity.cases.some((row) => row.caseId === caseId)).length;
}

export function entityAppearsInMultipleCases<T extends { cases: Array<{ caseId: string }> }>(entity: T): boolean {
  return uniquePreserveOrder(entity.cases.map((row) => row.caseId)).length > 1;
}

export interface DrawerPhonePresentation {
  phoneNumberId: string;
  normalizedNumber: string | null;
  uniqueCaseCount: number;
  inCurrentCase: boolean;
}

/** Dedupes drawer phone rows by phoneNumberId using already-loaded DrugCasePhone links. No extra query. */
export function presentDrawerPhones(
  phones: Array<{ phoneNumberId: string; caseId: string; phoneNumber?: { normalizedNumber: string } | null }>,
  currentCaseId: string | null,
): DrawerPhonePresentation[] {
  const grouped = new Map<string, { phoneNumberId: string; normalizedNumber: string | null; caseIds: Set<string> }>();
  for (const phone of phones) {
    const existing = grouped.get(phone.phoneNumberId);
    if (existing) {
      existing.caseIds.add(phone.caseId);
      if (!existing.normalizedNumber && phone.phoneNumber?.normalizedNumber) {
        existing.normalizedNumber = phone.phoneNumber.normalizedNumber;
      }
    } else {
      grouped.set(phone.phoneNumberId, {
        phoneNumberId: phone.phoneNumberId,
        normalizedNumber: phone.phoneNumber?.normalizedNumber ?? null,
        caseIds: new Set([phone.caseId]),
      });
    }
  }
  return Array.from(grouped.values()).map((row) => ({
    phoneNumberId: row.phoneNumberId,
    normalizedNumber: row.normalizedNumber,
    uniqueCaseCount: row.caseIds.size,
    inCurrentCase: Boolean(currentCaseId && row.caseIds.has(currentCaseId)),
  }));
}

export type PersonIntelligenceFact =
  | { kind: "PERSON_IN_N_CASES"; caseCount: number }
  | { kind: "PHONE_MULTI_CASE"; phoneNumberId: string; caseCount: number }
  | { kind: "ADDITIONAL_PHONES"; count: number }
  | { kind: "ADDITIONAL_SIMS"; count: number }
  | { kind: "ADDITIONAL_DEVICES"; count: number }
  | { kind: "ADDITIONAL_VEHICLES"; count: number };

export function buildPersonIntelligenceFacts(input: {
  caseCount: number;
  currentCaseId: string | null;
  phones: Array<{ phoneNumberId: string; cases: Array<{ caseId: string }> }>;
  sims: Array<{ simId: string; cases: Array<{ caseId: string }> }>;
  devices: Array<{ deviceId: string; cases: Array<{ caseId: string }> }>;
  vehicles: Array<{ vehicleId: string; cases: Array<{ caseId: string }> }>;
}): PersonIntelligenceFact[] {
  const facts: PersonIntelligenceFact[] = [];
  if (input.caseCount > 0) {
    facts.push({ kind: "PERSON_IN_N_CASES", caseCount: input.caseCount });
  }
  for (const phone of input.phones) {
    const caseCount = uniquePreserveOrder(phone.cases.map((row) => row.caseId)).length;
    if (caseCount > 1) facts.push({ kind: "PHONE_MULTI_CASE", phoneNumberId: phone.phoneNumberId, caseCount });
  }
  if (!input.currentCaseId) return facts;
  const extraPhones = splitRelatedByCurrentCase(input.phones, input.currentCaseId).inOtherCases.length;
  const extraSims = splitRelatedByCurrentCase(input.sims, input.currentCaseId).inOtherCases.length;
  const extraDevices = splitRelatedByCurrentCase(input.devices, input.currentCaseId).inOtherCases.length;
  const extraVehicles = splitRelatedByCurrentCase(input.vehicles, input.currentCaseId).inOtherCases.length;
  if (extraPhones > 0) facts.push({ kind: "ADDITIONAL_PHONES", count: extraPhones });
  if (extraSims > 0) facts.push({ kind: "ADDITIONAL_SIMS", count: extraSims });
  if (extraDevices > 0) facts.push({ kind: "ADDITIONAL_DEVICES", count: extraDevices });
  if (extraVehicles > 0) facts.push({ kind: "ADDITIONAL_VEHICLES", count: extraVehicles });
  return facts;
}

export function otherCaseLabel(cases: Array<{ caseId: string; caseNumber?: string | null }>, currentCaseId: string | null): string | null {
  const other = cases.find((row) => row.caseId !== currentCaseId) ?? cases[0];
  if (!other) return null;
  return other.caseNumber ?? null;
}
