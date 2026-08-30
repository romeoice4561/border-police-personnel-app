/**
 * Person Matching Service (Phase DI-2 — Sections 10-13, 19).
 *
 * Orchestrates the pure matching engine (drug_person_matching.ts) against
 * real repository data: builds a comparable DrugMatchableIdentity for an
 * existing DrugPerson (or a not-yet-created draft identity), runs pairwise
 * comparison against the active-person pool, and applies persisted
 * NOT_SAME/CONFIRMED_DUPLICATE decisions so a reviewer's past call is never
 * re-surfaced by a later matching pass (Section 19).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import {
  DrugPersonMatchReviewRepository,
  orderPersonPair,
  type DrugPersonMatchDecisionValue,
} from "@/lib/database/repositories/drug_person_match_review_repository";
import {
  computeDrugMatchSignals,
  deriveMatchConfidence,
  toNormalizedPhoneKey,
  type DrugMatchableIdentity,
  type DrugMatchSignal,
  type DrugMatchConfidence,
} from "@/lib/drug_intelligence/drug_person_matching";

export interface DrugPersonMatchCandidate {
  personId: string;
  primaryFullName: string;
  status: string;
  signals: DrugMatchSignal[];
  confidence: DrugMatchConfidence;
  /** Present only when a reviewer already made a persisted call on this exact pair — the caller (UI/API) uses this to suppress re-showing an already-NOT_SAME pair as a fresh warning (Section 19), while still returning it in the review-queue's "all pairs" listing. */
  existingDecision: DrugPersonMatchDecisionValue | null;
}

/** Duplicate Review Queue row (Section 13): a DrugPersonMatchCandidate plus the OTHER half of the pair's id/name, since the queue always needs to display both sides. */
export interface DrugUnresolvedMatchPair extends DrugPersonMatchCandidate {
  pairPersonId: string;
  pairPersonName: string;
}

export class DrugPersonMatchingService {
  private readonly personRepo: DrugPersonRepository;
  private readonly entityRepo: DrugEntityRepository;
  private readonly casePersonRepo: DrugCasePersonRepository;
  private readonly reviewRepo: DrugPersonMatchReviewRepository;

  constructor(private readonly db: DatabaseClient) {
    this.personRepo = new DrugPersonRepository(db);
    this.entityRepo = new DrugEntityRepository(db);
    this.casePersonRepo = new DrugCasePersonRepository(db);
    this.reviewRepo = new DrugPersonMatchReviewRepository(db);
  }

  /** Builds the comparable identity for an EXISTING DrugPerson from its related rows. */
  async buildIdentityForPerson(personId: string): Promise<DrugMatchableIdentity | null> {
    const person = await this.personRepo.findById(personId);
    if (!person) return null;

    const [identifierRows, aliasRows, caseLinks, casePhones, personDevices, personVehicles] = await Promise.all([
      this.personRepo.identifiersForPerson(personId),
      this.personRepo.aliasesForPerson(personId),
      this.casePersonRepo.forPerson(personId),
      this.personRepo.casePhonesForPerson(personId),
      this.entityRepo.personDevicesForPerson(personId),
      this.entityRepo.personVehiclesForPerson(personId),
    ]);

    const normalizedPhones: string[] = [];
    for (const link of casePhones as Array<{ phoneNumberId: string }>) {
      const phone = await this.entityRepo.findPhoneNumberById(link.phoneNumberId);
      if (phone) normalizedPhones.push(phone.normalizedNumber);
    }

    const deviceImeis: string[] = [];
    for (const link of personDevices as Array<{ deviceId: string }>) {
      const device = await this.entityRepo.findDeviceById(link.deviceId);
      if (device?.imei1) deviceImeis.push(device.imei1);
      if (device?.imei2) deviceImeis.push(device.imei2);
    }

    const vehicleVins: string[] = [];
    for (const link of personVehicles as Array<{ vehicleId: string }>) {
      const vehicle = await this.entityRepo.findVehicleById(link.vehicleId);
      if (vehicle?.vin) vehicleVins.push(vehicle.vin);
    }

    return {
      identifiers: (identifierRows as Array<{ type: string; value: string }>).map((r) => ({ type: r.type, value: r.value })),
      primaryFullName: person.primaryFullName,
      aliases: (aliasRows as Array<{ fullName: string }>).map((r) => r.fullName),
      dateOfBirth: person.dateOfBirth,
      normalizedPhones: Array.from(new Set(normalizedPhones)),
      deviceImeis: Array.from(new Set(deviceImeis.filter((v): v is string => Boolean(v)))),
      vehicleVins: Array.from(new Set(vehicleVins.filter((v): v is string => Boolean(v)))),
      caseIds: (caseLinks as Array<{ caseId: string }>).map((r) => r.caseId),
    };
  }

  /** Builds the comparable identity for a not-yet-created draft person (Create Case's real-time duplicate check — Section 28). */
  buildIdentityForDraft(input: {
    identifiers: Array<{ type: string; value: string }>;
    primaryFullName: string;
    dateOfBirth: Date | null;
    phones?: string[];
    deviceImeis?: string[];
    vehicleVins?: string[];
  }): DrugMatchableIdentity {
    return {
      identifiers: input.identifiers,
      primaryFullName: input.primaryFullName,
      aliases: [],
      dateOfBirth: input.dateOfBirth,
      normalizedPhones: (input.phones ?? []).map(toNormalizedPhoneKey),
      deviceImeis: input.deviceImeis ?? [],
      vehicleVins: input.vehicleVins ?? [],
      caseIds: [],
    };
  }

  /**
   * Compares one identity against every OTHER active person and returns
   * every candidate with at least one signal — sorted strongest-first so a
   * caller displaying a limited list shows the most explainable matches.
   * `excludePersonId` omits the identity's own person row when comparing an
   * existing person against the rest of the pool (never compares a person
   * against itself).
   */
  async findCandidates(identity: DrugMatchableIdentity, excludePersonId?: string): Promise<DrugPersonMatchCandidate[]> {
    const pool = await this.personRepo.findAllActive();
    const candidates: DrugPersonMatchCandidate[] = [];

    for (const other of pool) {
      if (excludePersonId && other.id === excludePersonId) continue;
      const otherIdentity = await this.buildIdentityForPerson(other.id);
      if (!otherIdentity) continue;
      const signals = computeDrugMatchSignals(identity, otherIdentity);
      if (signals.length === 0) continue;

      const existingReview = excludePersonId ? await this.reviewRepo.findForPair(excludePersonId, other.id) : null;

      candidates.push({
        personId: other.id,
        primaryFullName: other.primaryFullName,
        status: other.status,
        signals,
        confidence: deriveMatchConfidence(signals),
        existingDecision: existingReview?.decision ?? null,
      });
    }

    const confidenceRank: Record<DrugMatchConfidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    candidates.sort((a, b) => confidenceRank[a.confidence] - confidenceRank[b.confidence]);
    return candidates;
  }

  /**
   * Duplicate Review Queue (Section 13): every ACTIVE-person pair with at
   * least one signal AND no persisted decision yet — i.e. every pair still
   * in the live NEEDS_REVIEW state. O(n²) over the active-person pool, same
   * "acceptable at this module's current data scale" tradeoff DI-1 already
   * made for `search()`/`listCases()`'s in-memory scans; a future phase can
   * introduce precomputation if the pool grows large enough to matter.
   */
  async findUnresolvedPairs(): Promise<DrugUnresolvedMatchPair[]> {
    const pool = await this.personRepo.findAllActive();
    const identities = new Map<string, DrugMatchableIdentity>();
    for (const person of pool) {
      const identity = await this.buildIdentityForPerson(person.id);
      if (identity) identities.set(person.id, identity);
    }

    const seenPairs = new Set<string>();
    const results: DrugUnresolvedMatchPair[] = [];

    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const personA = pool[i];
        const personB = pool[j];
        const identityA = identities.get(personA.id);
        const identityB = identities.get(personB.id);
        if (!identityA || !identityB) continue;

        const [orderedA, orderedB] = orderPersonPair(personA.id, personB.id);
        const pairKey = `${orderedA}:${orderedB}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const signals = computeDrugMatchSignals(identityA, identityB);
        if (signals.length === 0) continue;

        const existingReview = await this.reviewRepo.findForPair(personA.id, personB.id);
        if (existingReview) continue; // already decided — never re-surfaced (Section 19)

        const sideB = pool.find((p) => p.id === orderedB)!;
        const sideA = pool.find((p) => p.id === orderedA)!;
        results.push({
          personId: orderedB,
          primaryFullName: sideB.primaryFullName,
          status: sideB.status,
          signals,
          confidence: deriveMatchConfidence(signals),
          existingDecision: null,
          pairPersonId: orderedA,
          pairPersonName: sideA.primaryFullName,
        });
      }
    }

    const confidenceRank: Record<DrugMatchConfidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    results.sort((a, b) => confidenceRank[a.confidence] - confidenceRank[b.confidence]);
    return results;
  }

  /**
   * Advanced Person Search (DI-7.4) supplement to
   * findPersonIdsWithPotentialDuplicates(). Returns the SAME flagged-person
   * set PLUS a Map<personId, firstCandidateId> so the search result card can
   * link directly to the existing DI-2 compare page (?a=&b=) rather than just
   * the generic review queue.
   *
   * Runs exactly the same O(n) identity-build + O(n²) comparison loop — so
   * callers who need both the Set and the Map should prefer this method and
   * derive the Set themselves (pairsMap.has(id)).
   */
  async findDuplicatePairFirstCandidateMap(): Promise<Map<string, string>> {
    const pool = await this.personRepo.findAllActive();
    const identities = await this.buildIdentitiesBatched(pool);

    const allReviews = await this.reviewRepo.findAll();
    const notSamePairs = new Set(
      (allReviews as Array<{ personAId: string; personBId: string; decision: string }>)
        .filter((r) => r.decision === "NOT_SAME")
        .map((r) => `${r.personAId}:${r.personBId}`)
    );

    const firstCandidate = new Map<string, string>();
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const personA = pool[i];
        const personB = pool[j];
        const identityA = identities.get(personA.id);
        const identityB = identities.get(personB.id);
        if (!identityA || !identityB) continue;

        const [orderedA, orderedB] = orderPersonPair(personA.id, personB.id);
        if (notSamePairs.has(`${orderedA}:${orderedB}`)) continue;

        const signals = computeDrugMatchSignals(identityA, identityB);
        if (signals.length === 0) continue;
        const confidence = deriveMatchConfidence(signals);
        if (confidence === "HIGH" || confidence === "MEDIUM") {
          if (!firstCandidate.has(personA.id)) firstCandidate.set(personA.id, personB.id);
          if (!firstCandidate.has(personB.id)) firstCandidate.set(personB.id, personA.id);
        }
      }
    }
    return firstCandidate;
  }

  /**
   * Person Directory's "อาจซ้ำ" badge (Section 9) needs, for EVERY row, "does
   * this person have at least one unresolved HIGH/MEDIUM match anywhere in
   * the pool?"
   *
   * DI-9.4.3B: identity hydration is BATCHED (fixed query count) instead of
   * per-person serial DB fan-out. Pairwise comparison remains O(n²) in memory
   * — that CPU cost is acceptable relative to DB RTT; production scale tests
   * assert query count stays bounded.
   */
  async findPersonIdsWithPotentialDuplicates(): Promise<Set<string>> {
    const pool = await this.personRepo.findAllActive();
    const identities = await this.buildIdentitiesBatched(pool);

    const allReviews = await this.reviewRepo.findAll();
    const notSamePairs = new Set(
      (allReviews as Array<{ personAId: string; personBId: string; decision: string }>)
        .filter((r) => r.decision === "NOT_SAME")
        .map((r) => `${r.personAId}:${r.personBId}`)
    );

    const flagged = new Set<string>();
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const personA = pool[i];
        const personB = pool[j];
        if (flagged.has(personA.id) && flagged.has(personB.id)) continue;
        const identityA = identities.get(personA.id);
        const identityB = identities.get(personB.id);
        if (!identityA || !identityB) continue;

        const [orderedA, orderedB] = orderPersonPair(personA.id, personB.id);
        if (notSamePairs.has(`${orderedA}:${orderedB}`)) continue;

        const signals = computeDrugMatchSignals(identityA, identityB);
        if (signals.length === 0) continue;
        const confidence = deriveMatchConfidence(signals);
        if (confidence === "HIGH" || confidence === "MEDIUM") {
          flagged.add(personA.id);
          flagged.add(personB.id);
        }
      }
    }

    return flagged;
  }

  /**
   * DI-9.4.3B: build matchable identities for a person set with a fixed number
   * of table scans (not N×7 queries). Used by duplicate-flag computation.
   */
  private async buildIdentitiesBatched(pool: Array<{ id: string; primaryFullName: string; dateOfBirth: Date | null }>): Promise<Map<string, DrugMatchableIdentity>> {
    const ids = pool.map((p) => p.id);
    if (ids.length === 0) return new Map();

    const [identifierRows, aliasRows, caseLinks, casePhones, personDevices, personVehicles] = await Promise.all([
      this.personRepo.identifiersForPersons(ids),
      this.personRepo.aliasesForPersons(ids),
      this.personRepo.casePersonsForPersons(ids),
      this.personRepo.casePhonesForPersons(ids),
      this.db.drugPersonDevice.findMany({ where: { personId: { in: ids } } }),
      this.db.drugPersonVehicle.findMany({ where: { personId: { in: ids } } }),
    ]);

    const phoneIds = [...new Set((casePhones as Array<{ phoneNumberId: string }>).map((l) => l.phoneNumberId))];
    const deviceIds = [...new Set((personDevices as Array<{ deviceId: string }>).map((l) => l.deviceId))];
    const vehicleIds = [...new Set((personVehicles as Array<{ vehicleId: string }>).map((l) => l.vehicleId))];

    const [phones, devices, vehicles] = await Promise.all([
      phoneIds.length ? this.db.drugPhoneNumber.findMany({ where: { id: { in: phoneIds } } }) : Promise.resolve([]),
      deviceIds.length ? this.db.drugDevice.findMany({ where: { id: { in: deviceIds } } }) : Promise.resolve([]),
      vehicleIds.length ? this.db.drugVehicle.findMany({ where: { id: { in: vehicleIds } } }) : Promise.resolve([]),
    ]);

    const phoneById = new Map((phones as Array<{ id: string; normalizedNumber: string }>).map((p) => [p.id, p]));
    const deviceById = new Map((devices as Array<{ id: string; imei1: string | null; imei2: string | null }>).map((d) => [d.id, d]));
    const vehicleById = new Map((vehicles as Array<{ id: string; vin: string | null }>).map((v) => [v.id, v]));

    const identifiersByPerson = groupByPersonId(identifierRows as Array<{ personId: string; type: string; value: string }>);
    const aliasesByPerson = groupByPersonId(aliasRows as Array<{ personId: string; fullName: string }>);
    const casesByPerson = groupByPersonId(caseLinks as Array<{ personId: string; caseId: string }>);
    const phonesByPerson = groupByPersonId(
      (casePhones as Array<{ personId: string | null; phoneNumberId: string }>)
        .filter((l): l is { personId: string; phoneNumberId: string } => Boolean(l.personId))
    );
    const devicesByPerson = groupByPersonId(personDevices as Array<{ personId: string; deviceId: string }>);
    const vehiclesByPerson = groupByPersonId(personVehicles as Array<{ personId: string; vehicleId: string }>);

    const identities = new Map<string, DrugMatchableIdentity>();
    for (const person of pool) {
      const normalizedPhones: string[] = [];
      for (const link of phonesByPerson.get(person.id) ?? []) {
        const phone = phoneById.get(link.phoneNumberId);
        if (phone) normalizedPhones.push(phone.normalizedNumber);
      }
      const deviceImeis: string[] = [];
      for (const link of devicesByPerson.get(person.id) ?? []) {
        const device = deviceById.get(link.deviceId);
        if (device?.imei1) deviceImeis.push(device.imei1);
        if (device?.imei2) deviceImeis.push(device.imei2);
      }
      const vehicleVins: string[] = [];
      for (const link of vehiclesByPerson.get(person.id) ?? []) {
        const vehicle = vehicleById.get(link.vehicleId);
        if (vehicle?.vin) vehicleVins.push(vehicle.vin);
      }
      identities.set(person.id, {
        identifiers: (identifiersByPerson.get(person.id) ?? []).map((r) => ({ type: r.type, value: r.value })),
        primaryFullName: person.primaryFullName,
        aliases: (aliasesByPerson.get(person.id) ?? []).map((r) => r.fullName),
        dateOfBirth: person.dateOfBirth,
        normalizedPhones: Array.from(new Set(normalizedPhones)),
        deviceImeis: Array.from(new Set(deviceImeis)),
        vehicleVins: Array.from(new Set(vehicleVins)),
        caseIds: (casesByPerson.get(person.id) ?? []).map((r) => r.caseId),
      });
    }
    return identities;
  }
}

function groupByPersonId<T extends { personId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.personId) ?? [];
    list.push(row);
    map.set(row.personId, list);
  }
  return map;
}
