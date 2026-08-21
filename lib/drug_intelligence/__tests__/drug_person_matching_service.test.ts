/**
 * Unit tests for DrugPersonMatchingService (Phase DI-2, Sections 10-13, 19)
 * over the in-memory fake DatabaseClient — builds real identities from
 * created persons/cases and exercises findCandidates/findUnresolvedPairs
 * end-to-end, including NOT_SAME suppression.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { DrugPersonMatchReviewService } from "@/lib/drug_intelligence/drug_person_match_review_service";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

/**
 * DI-1's createCase() blocks a SECOND new person from being created with a
 * matching identifier/name+DOB in the same submission stream (Section 14) —
 * exactly the "already existing duplicate persons" scenario these matching-
 * engine tests need to set up. Real-world equivalent: two officers
 * independently entered the same person into two different cases before any
 * matching pass ever ran. Seeding directly through the repositories (as the
 * already-blocked create path itself would have written, had it not been
 * blocked) reproduces that state without going through the guard meant to
 * PREVENT it at creation time — this is a test fixture, not a bypass of any
 * production code path.
 */
async function seedCaseWithPerson(
  db: InMemoryDatabaseClient,
  caseNumber: string,
  primaryFullName: string,
  identifiers: Array<{ type: string; value: string }>
): Promise<{ caseId: string; personId: string }> {
  const caseRepo = new DrugCaseRepository(db);
  const personRepo = new DrugPersonRepository(db);
  const casePersonRepo = new DrugCasePersonRepository(db);

  const caseId = generateDrugId();
  await caseRepo.create({
    id: caseId,
    caseNumber,
    title: caseNumber,
    status: "OPEN",
    arrestDate: null,
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: null,
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    createdBy: "mock:admin",
    createdByName: "Administrator",
  });

  const personId = generateDrugId();
  await personRepo.create({ id: personId, primaryFullName, nationality: null, dateOfBirth: null, notes: null, createdBy: "mock:admin", createdByName: "Administrator" });
  await personRepo.addAlias(personId, primaryFullName, true, "mock:admin");
  for (const identifier of identifiers) {
    await personRepo.addIdentifier(personId, identifier.type, identifier.value, null, "mock:admin");
  }
  await casePersonRepo.create({ caseId, personId, role: "SUSPECT", linkedOfficerId: null, notes: null, createdBy: "mock:admin" });

  return { caseId, personId };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "TEST-CASE",
    title: "คดีทดสอบ",
    status: "OPEN",
    arrestDate: null,
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: null,
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

test("findCandidates(): identifier match surfaces the other person with a HIGH confidence explainable signal", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "A", persons: [{ newPerson: { primaryFullName: "คนที่หนึ่ง", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "5555555555555", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;

  const matchingService = new DrugPersonMatchingService(db);
  const draftIdentity = matchingService.buildIdentityForDraft({
    identifiers: [{ type: "THAI_ID", value: "5555555555555" }],
    primaryFullName: "คนที่หนึ่ง ชื่อสะกดต่าง",
    dateOfBirth: null,
  });

  const candidates = await matchingService.findCandidates(draftIdentity);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].personId, personAId);
  assert.equal(candidates[0].confidence, "HIGH");
  assert.ok(candidates[0].signals.some((s) => s.kind === "IDENTIFIER_THAI_ID"));
});

test("findCandidates() excludes the identity's own person when excludePersonId is given", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "A", persons: [{ newPerson: { primaryFullName: "ตัวเอง", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;

  const matchingService = new DrugPersonMatchingService(db);
  const identity = await matchingService.buildIdentityForPerson(personAId);
  const candidates = await matchingService.findCandidates(identity!, personAId);
  assert.equal(candidates.length, 0, "a person must never appear as its own duplicate candidate");
});

test("findUnresolvedPairs(): a pair with a signal and no persisted review decision appears in the queue", async () => {
  const db = new InMemoryDatabaseClient();
  await seedCaseWithPerson(db, "QUEUE-A", "ซ้ำหนึ่ง", [{ type: "PASSPORT", value: "P123" }]);
  await seedCaseWithPerson(db, "QUEUE-B", "ซ้ำสอง", [{ type: "PASSPORT", value: "P123" }]);

  const matchingService = new DrugPersonMatchingService(db);
  const pairs = await matchingService.findUnresolvedPairs();
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].confidence, "HIGH");
  assert.ok(pairs[0].primaryFullName, "the queue row's own person must have a name");
  assert.ok(pairs[0].pairPersonName, "the other half of the pair must also carry a name — the UI needs both to label the pair");
  assert.notEqual(pairs[0].primaryFullName, pairs[0].pairPersonName);
});

test("NOT_SAME suppression: after a reviewer marks a pair NOT_SAME, it never resurfaces in findUnresolvedPairs()", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId: personAId } = await seedCaseWithPerson(db, "NS-A", "คนหนึ่ง", [{ type: "OTHER", value: "shared-code" }]);
  const { personId: personBId } = await seedCaseWithPerson(db, "NS-B", "คนสอง", [{ type: "OTHER", value: "shared-code" }]);

  const matchingService = new DrugPersonMatchingService(db);
  const beforeReview = await matchingService.findUnresolvedPairs();
  assert.equal(beforeReview.length, 1);

  const reviewService = new DrugPersonMatchReviewService(db);
  await reviewService.recordDecision({ personAId, personBId, decision: "NOT_SAME", signals: [], notes: "confirmed different people", actorId: "mock:admin", actorName: "Administrator" });

  const afterReview = await matchingService.findUnresolvedPairs();
  assert.equal(afterReview.length, 0, "a NOT_SAME pair must never be re-suggested by the matching engine");
});

test("findCandidates() reports existingDecision=NOT_SAME on a candidate so the UI can suppress the warning", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId: personAId } = await seedCaseWithPerson(db, "ED-A", "A", [{ type: "THAI_ID", value: "777" }]);
  const { personId: personBId } = await seedCaseWithPerson(db, "ED-B", "B", [{ type: "THAI_ID", value: "777" }]);

  const reviewService = new DrugPersonMatchReviewService(db);
  await reviewService.recordDecision({ personAId, personBId, decision: "NOT_SAME", signals: [], notes: null, actorId: "mock:admin", actorName: "Administrator" });

  const matchingService = new DrugPersonMatchingService(db);
  const identity = await matchingService.buildIdentityForPerson(personAId);
  const candidates = await matchingService.findCandidates(identity!, personAId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].existingDecision, "NOT_SAME");
});

test("recording a decision on a pair that already has one is rejected (Section 32 concurrency)", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "C1-A", persons: [{ newPerson: { primaryFullName: "A", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const caseB = await caseService.createCase(
    baseCase({ caseNumber: "C1-B", persons: [{ newPerson: { primaryFullName: "B", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const personBId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;

  const reviewService = new DrugPersonMatchReviewService(db);
  await reviewService.recordDecision({ personAId, personBId, decision: "NOT_SAME", signals: [], notes: null, actorId: "mock:admin", actorName: "Administrator" });

  await assert.rejects(() =>
    reviewService.recordDecision({ personAId: personBId, personBId: personAId, decision: "CONFIRMED_DUPLICATE", signals: [], notes: null, actorId: "mock:commander", actorName: "Commander" })
  );
});

test("recordDecision writes a DrugAuditLog row with the correct action per decision", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "AUD-A", persons: [{ newPerson: { primaryFullName: "A", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const caseB = await caseService.createCase(
    baseCase({ caseNumber: "AUD-B", persons: [{ newPerson: { primaryFullName: "B", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const personBId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;

  const reviewService = new DrugPersonMatchReviewService(db);
  await reviewService.recordDecision({ personAId, personBId, decision: "CONFIRMED_DUPLICATE", signals: [], notes: null, actorId: "mock:admin", actorName: "Administrator" });

  const auditRows = await db.drugAuditLog.findMany({ where: { action: "duplicate_reviewed" } });
  assert.equal(auditRows.length, 1);
});
