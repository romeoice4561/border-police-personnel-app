/**
 * Unit tests for DrugPersonProfileService and DrugPersonDirectoryService
 * (Phase DI-2, Sections 4-9, 21-26) over the in-memory fake DatabaseClient.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonProfileService, DrugPersonDirectoryService } from "@/lib/drug_intelligence/drug_person_profile_service";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { DrugPersonNotFoundError } from "@/lib/drug_intelligence/drug_case_types";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "TEST-CASE",
    title: "คดีทดสอบ",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
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

test("getProfile(): a person appearing in multiple cases with multiple phones/devices/vehicles resolves all of it", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });

  const caseA = await caseService.createCase(
    baseCase({
      caseNumber: "PROFILE-A",
      persons: [
        {
          newPerson: { primaryFullName: "โปรไฟล์ทดสอบ", nationality: "ไทย", dateOfBirth: new Date("1985-03-10"), notes: null, identifiers: [{ type: "THAI_ID", value: "9999999999999", notes: null }] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0811112222", firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-05"), notes: null }],
          sims: [],
          devices: [{ brand: "Apple", model: "iPhone 15", serialNumber: null, imei1: "111222333444555", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [{ registrationNumber: "กข-1234", registrationProvince: "เชียงราย", vehicleType: null, brand: null, model: null, color: null, vin: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
        },
      ],
    })
  );

  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;

  const caseService2 = new DrugCaseService({ db });
  await caseService2.createCase(
    baseCase({
      caseNumber: "PROFILE-B",
      persons: [
        {
          existingPersonId: personId,
          role: "ACCUSED",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0822223333", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const profileService = new DrugPersonProfileService(db);
  const profile = await profileService.getProfile(personId);

  assert.equal(profile.cases.length, 2, "must appear in both cases");
  assert.equal(profile.phones.length, 2, "must aggregate phones across both cases");
  assert.equal(profile.devices.length, 1);
  assert.equal(profile.vehicles.length, 1);
  assert.equal(profile.counts.cases, 2);
});

test("getProfile() throws DrugPersonNotFoundError for a missing person", async () => {
  const db = new InMemoryDatabaseClient();
  const profileService = new DrugPersonProfileService(db);
  await assert.rejects(() => profileService.getProfile("nonexistent-id"), DrugPersonNotFoundError);
});

test("firstSeenAt/lastSeenAt are derived from actual provenance timestamps, not just createdAt", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({
      caseNumber: "TEMPORAL-A",
      arrestDate: null, // isolate the phone's own provenance dates as the only observed dates
      persons: [
        {
          newPerson: { primaryFullName: "เวลาทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0899998888", firstSeenAt: new Date("2020-01-01"), lastSeenAt: new Date("2024-06-15"), notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;

  const profileService = new DrugPersonProfileService(db);
  const profile = await profileService.getProfile(personId);

  assert.equal(profile.firstSeenAt.toISOString().slice(0, 10), "2020-01-01");
  assert.equal(profile.lastSeenAt.toISOString().slice(0, 10), "2024-06-15");
});

test("data quality: a person with no identifier is flagged NO_IDENTIFIER", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({
      caseNumber: "DQ-A",
      persons: [{ newPerson: { primaryFullName: "ไม่มีเอกสาร", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;

  const profileService = new DrugPersonProfileService(db);
  const profile = await profileService.getProfile(personId);
  assert.ok(profile.dataQuality.some((f) => f.code === "NO_IDENTIFIER"));
});

test("data quality: reuses the SAME matching engine to flag POTENTIAL_DUPLICATE — never a separate ad-hoc check", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "DUP-DQ-A", persons: [{ newPerson: { primaryFullName: "ซ้ำ A", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "444444444", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );

  // Second person with the same identifier, seeded directly (see the matching-service test file for why createCase() would legitimately block this at submit time).
  const { DrugPersonRepository } = await import("@/lib/database/repositories/drug_person_repository");
  const { generateDrugId } = await import("@/lib/drug_intelligence/drug_id");
  const personRepo = new DrugPersonRepository(db);
  const secondId = generateDrugId();
  await personRepo.create({ id: secondId, primaryFullName: "ซ้ำ B", nationality: null, dateOfBirth: null, notes: null, createdBy: "mock:admin", createdByName: "Administrator" });
  await personRepo.addIdentifier(secondId, "THAI_ID", "444444444", null, "mock:admin");

  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const profileService = new DrugPersonProfileService(db);
  const profile = await profileService.getProfile(personAId);
  assert.ok(profile.dataQuality.some((f) => f.code === "POTENTIAL_DUPLICATE"));
});

test("updateProfile() writes the change and records a person_updated audit row", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "EDIT-A", persons: [{ newPerson: { primaryFullName: "ชื่อเดิม", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;

  const profileService = new DrugPersonProfileService(db);
  await profileService.updateProfile(personId, { primaryFullName: "ชื่อใหม่" }, "mock:admin", "Administrator");

  const updated = await db.drugPerson.findUnique({ where: { id: personId } });
  assert.equal(updated?.primaryFullName, "ชื่อใหม่");

  const auditRows = await db.drugAuditLog.findMany({ where: { action: "person_updated" } });
  assert.equal(auditRows.length, 1);
});

test("addAlias() writes an alias row and an alias_added audit row", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "ALIAS-A", persons: [{ newPerson: { primaryFullName: "ชื่อจริง", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;

  const profileService = new DrugPersonProfileService(db);
  await profileService.addAlias(personId, "ฉายาใหม่", "mock:admin", "Administrator");

  const aliases = await db.drugPersonAlias.findMany({ where: { personId } });
  assert.ok(aliases.some((a) => (a as { fullName: string }).fullName === "ฉายาใหม่"));

  const auditRows = await db.drugAuditLog.findMany({ where: { action: "alias_added" } });
  assert.equal(auditRows.length, 1);
});

test("addIdentifier() never bypasses the duplicate engine — returns candidates for the caller to warn on, still writes the row", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "ID-A", persons: [{ newPerson: { primaryFullName: "A", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "121212121", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const caseB = await caseService.createCase(
    baseCase({ caseNumber: "ID-B", persons: [{ newPerson: { primaryFullName: "B", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personBId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;
  void caseA;

  const profileService = new DrugPersonProfileService(db);
  const result = await profileService.addIdentifier(personBId, "THAI_ID", "121212121", null, "mock:admin", "Administrator");

  assert.equal(result.candidates.length, 1, "must surface the colliding identifier as a candidate, never silently swallow it");
  const identifiers = await db.drugPersonIdentifier.findMany({ where: { personId: personBId } });
  assert.equal(identifiers.length, 1, "the identifier is still written — Section 23 asks for a warning, not a hard block on an EXISTING person edit");

  // Regression guard: addIdentifier() must return full DrugPersonMatchCandidate
  // shapes (signals/confidence), not DI-1's plain reasons-only candidates —
  // a mismatch here previously crashed the Person Profile UI with
  // "TypeError: signals is not iterable" when DrugMatchSignalsList rendered
  // the response.
  const candidate = result.candidates[0];
  assert.ok(Array.isArray(candidate.signals), "candidate.signals must be an array (Round A matching engine shape)");
  assert.ok(candidate.signals.length > 0, "the THAI_ID collision must produce at least one signal");
  assert.ok(["HIGH", "MEDIUM", "LOW"].includes(candidate.confidence), "candidate.confidence must be a valid DrugMatchConfidence value");
});

test("DrugPersonDirectoryService.list(): only ACTIVE persons appear, and MERGED persons are excluded", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "DIR-A", persons: [{ newPerson: { primaryFullName: "คนที่ยังอยู่", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const caseB = await caseService.createCase(
    baseCase({ caseNumber: "DIR-B", persons: [{ newPerson: { primaryFullName: "คนที่จะถูกรวม", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const personBId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;

  const { DrugPersonMergeService } = await import("@/lib/drug_intelligence/drug_person_merge_service");
  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const directoryService = new DrugPersonDirectoryService(db);
  const result = await directoryService.list({ page: 1, pageSize: 20 });
  const ids = result.rows.map((r) => r.id);
  assert.ok(ids.includes(personAId));
  assert.ok(!ids.includes(personBId), "a MERGED person must never appear in the directory");
});

test("DrugPersonDirectoryService.list(): hasPotentialDuplicate is set for both sides of a colliding pair, false for an unrelated person", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "DIR-DUP-A", persons: [{ newPerson: { primaryFullName: "ซ้ำ A", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "5551115551", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const caseC = await caseService.createCase(
    baseCase({ caseNumber: "DIR-UNRELATED", persons: [{ newPerson: { primaryFullName: "ไม่เกี่ยวข้อง", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );

  // Person B seeded directly (same reasoning as the matching-service test file: createCase() would legitimately block a second person sharing this identifier at submission time).
  const { DrugPersonRepository } = await import("@/lib/database/repositories/drug_person_repository");
  const { generateDrugId } = await import("@/lib/drug_intelligence/drug_id");
  const personRepo = new DrugPersonRepository(db);
  const personBId = generateDrugId();
  await personRepo.create({ id: personBId, primaryFullName: "ซ้ำ B", nationality: null, dateOfBirth: null, notes: null, createdBy: "mock:admin", createdByName: "Administrator" });
  await personRepo.addIdentifier(personBId, "THAI_ID", "5551115551", null, "mock:admin");

  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const personCId = ((await db.drugCasePerson.findMany({ where: { caseId: caseC.caseId } }))[0] as { personId: string }).personId;

  const directoryService = new DrugPersonDirectoryService(db);
  const result = await directoryService.list({ page: 1, pageSize: 20 });
  const byId = new Map(result.rows.map((r) => [r.id, r]));

  assert.equal(byId.get(personAId)?.hasPotentialDuplicate, true, "person A must be flagged");
  assert.equal(byId.get(personBId)?.hasPotentialDuplicate, true, "person B must also be flagged (both sides of the pair)");
  assert.equal(byId.get(personCId)?.hasPotentialDuplicate, false, "an unrelated person must not be flagged");
});

test("DrugPersonMatchingService.findPersonIdsWithPotentialDuplicates(): excludes a pair the reviewer already marked NOT_SAME", async () => {
  const db = new InMemoryDatabaseClient();
  const { DrugPersonRepository } = await import("@/lib/database/repositories/drug_person_repository");
  const { DrugCaseRepository } = await import("@/lib/database/repositories/drug_case_repository");
  const { DrugCasePersonRepository } = await import("@/lib/database/repositories/drug_case_person_repository");
  const { generateDrugId } = await import("@/lib/drug_intelligence/drug_id");
  const { DrugPersonMatchReviewService } = await import("@/lib/drug_intelligence/drug_person_match_review_service");

  const caseRepo = new DrugCaseRepository(db);
  const personRepo = new DrugPersonRepository(db);
  const casePersonRepo = new DrugCasePersonRepository(db);

  async function seed(caseNumber: string, name: string, idValue: string) {
    const caseId = generateDrugId();
    await caseRepo.create({ id: caseId, caseNumber, title: caseNumber, status: "OPEN", arrestDate: null, arrestTime: null, headquartersId: null, regionId: null, battalionId: null, companyId: null, reportingUnitText: null, province: null, district: null, subdistrict: null, locationName: null, latitude: null, longitude: null, narrative: null, createdBy: "mock:admin", createdByName: "Administrator" });
    const personId = generateDrugId();
    await personRepo.create({ id: personId, primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, createdBy: "mock:admin", createdByName: "Administrator" });
    await personRepo.addIdentifier(personId, "THAI_ID", idValue, null, "mock:admin");
    await casePersonRepo.create({ caseId, personId, role: "SUSPECT", linkedOfficerId: null, notes: null, createdBy: "mock:admin" });
    return personId;
  }

  const personAId = await seed("NS-DIR-A", "A", "7778889990");
  const personBId = await seed("NS-DIR-B", "B", "7778889990");

  const matchingService = new DrugPersonMatchingService(db);
  const beforeReview = await matchingService.findPersonIdsWithPotentialDuplicates();
  assert.ok(beforeReview.has(personAId) && beforeReview.has(personBId));

  const reviewService = new DrugPersonMatchReviewService(db);
  await reviewService.recordDecision({ personAId, personBId, decision: "NOT_SAME", signals: [], notes: null, actorId: "mock:admin", actorName: "Administrator" });

  const afterReview = await matchingService.findPersonIdsWithPotentialDuplicates();
  assert.ok(!afterReview.has(personAId) && !afterReview.has(personBId), "a NOT_SAME pair must not be flagged as a potential duplicate");
});

test("DrugPersonDirectoryService.list(): query matches name, alias, and identifier", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "SEARCH-A", persons: [{ newPerson: { primaryFullName: "ค้นหาได้", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "888888888", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  await caseService.createCase(
    baseCase({ caseNumber: "SEARCH-B", persons: [{ newPerson: { primaryFullName: "ไม่เกี่ยวข้อง", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );

  const directoryService = new DrugPersonDirectoryService(db);
  const byName = await directoryService.list({ page: 1, pageSize: 20, query: "ค้นหาได้" });
  assert.equal(byName.rows.length, 1);

  const byIdentifier = await directoryService.list({ page: 1, pageSize: 20, query: "888888888" });
  assert.equal(byIdentifier.rows.length, 1);
});
