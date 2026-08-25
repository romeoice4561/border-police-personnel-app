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
    const identities = new Map<string, DrugMatchableIdentity>();
    for (const person of pool) {
      const identity = await this.buildIdentityForPerson(person.id);
      if (identity) identities.set(person.id, identity);
    }

    const allReviews = await this.reviewRepo.findAll();
    const notSamePairs = new Set(
      (allReviews as Array<{ personAId: string; personBId: string; decision: string }>)
        .filter((r) => r.decision === "NOT_SAME")
        .map((r) => `${r.personAId}:${r.personBId}`)
    );

    const firstCandidate = new Map<string, string>(); // personId → first candidate's id
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
   * the pool?" — computing that via per-row findCandidates() calls was
   * O(n²) *identity rebuilds* (each findCandidates() call re-derives every
   * other person's identity from scratch), which measured ~54s at just 26
   * seeded persons. This method builds every active person's identity
   * exactly ONCE (O(n) identity builds), then does the O(n²) PAIRWISE
   * SIGNAL COMPARISON (cheap — pure in-memory signal matching, no DB calls
   * per pair) — the same shape as findUnresolvedPairs() but returning a
   * flat Set the directory can look up in O(1) per row instead of a full
   * candidate list. A NOT_SAME-reviewed pair still counts as "not flagged"
   * here (matching findCandidates()'s own semantics), but unlike
   * findUnresolvedPairs() this intentionally does NOT filter out
   * CONFIRMED_DUPLICATE/MERGED pairs — a person already confirmed-but-not-
   * yet-merged should still show the directory badge so the confirmation
   * doesn't silently disappear from view.
   */
  async findPersonIdsWithPotentialDuplicates(): Promise<Set<string>> {
    const pool = await this.personRepo.findAllActive();
    const identities = new Map<string, DrugMatchableIdentity>();
    for (const person of pool) {
      const identity = await this.buildIdentityForPerson(person.id);
      if (identity) identities.set(person.id, identity);
    }

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
        if (flagged.has(personA.id) && flagged.has(personB.id)) continue; // both already flagged — skip the (still cheap) comparison
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
}
