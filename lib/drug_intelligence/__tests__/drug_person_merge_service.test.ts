/**
 * Unit tests for DrugPersonMergeService (Phase DI-2, Sections 15-19).
 * Covers: basic merge, both-already-linked-same-case dedup, shared
 * phone/device, alias/identifier union, provenance preservation, merged
 * person redirect/resolution (status/mergedIntoPersonId), audit creation,
 * already-merged rejection, self-merge rejection.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonMergeService, DrugPersonAlreadyMergedError, DrugCannotMergeSamePersonError } from "@/lib/drug_intelligence/drug_person_merge_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "TEST-CASE-001",
    title: "คดีทดสอบการรวมบุคคล",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "14:30",
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

async function seedTwoPersons(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({
      caseNumber: "CASE-A",
      persons: [
        {
          newPerson: { primaryFullName: "สมชาย ทดสอบ", nationality: "ไทย", dateOfBirth: new Date("1990-01-01"), notes: null, identifiers: [{ type: "THAI_ID", value: "1111111111111", notes: null }] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0811111111", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [{ brand: "Apple", model: "iPhone", serialNumber: null, imei1: "111111111111111", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
    })
  );
  const caseB = await caseService.createCase(
    baseCase({
      caseNumber: "CASE-B",
      persons: [
        {
          newPerson: { primaryFullName: "สมชาย ทดสอบ ซ้ำ", nationality: "ไทย", dateOfBirth: new Date("1990-01-01"), notes: null, identifiers: [{ type: "PASSPORT", value: "AA999999", notes: null }] },
          role: "ACCUSED",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0822222222", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const casePersonsA = await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } });
  const casePersonsB = await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } });
  return {
    caseAId: caseA.caseId,
    caseBId: caseB.caseId,
    personAId: (casePersonsA[0] as { personId: string }).personId,
    personBId: (casePersonsB[0] as { personId: string }).personId,
  };
}

test("basic merge: B's case link, phone, and identifier all move onto survivor A", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseAId, caseBId, personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: "confirmed duplicate", actorId: "mock:admin", actorName: "Administrator" });

  const survivorCaseLinks = await db.drugCasePerson.findMany({ where: { personId: personAId } });
  const caseIds = survivorCaseLinks.map((r) => (r as { caseId: string }).caseId);
  assert.ok(caseIds.includes(caseAId));
  assert.ok(caseIds.includes(caseBId));

  const survivorPhones = await db.drugCasePhone.findMany({ where: { personId: personAId } });
  assert.equal(survivorPhones.length, 2);

  const survivorIdentifiers = await db.drugPersonIdentifier.findMany({ where: { personId: personAId } });
  assert.ok(survivorIdentifiers.some((i) => (i as { type: string }).type === "THAI_ID"));
  assert.ok(survivorIdentifiers.some((i) => (i as { type: string }).type === "PASSPORT"));
});

test("merged person is marked MERGED with mergedIntoPersonId pointing at the survivor — never hard-deleted", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const mergedRow = await db.drugPerson.findUnique({ where: { id: personBId } });
  assert.ok(mergedRow, "merged person row must still exist");
  assert.equal(mergedRow?.status, "MERGED");
  assert.equal(mergedRow?.mergedIntoPersonId, personAId);
});

test("both persons already linked to the SAME case: merge never creates a duplicate DrugCasePerson row", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const shared = await caseService.createCase(
    baseCase({
      caseNumber: "SHARED-CASE",
      persons: [
        { newPerson: { primaryFullName: "บุคคลเอ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] },
        { newPerson: { primaryFullName: "บุคคลบี", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "WITNESS", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] },
      ],
    })
  );
  const links = await db.drugCasePerson.findMany({ where: { caseId: shared.caseId } });
  const personAId = (links[0] as { personId: string }).personId;
  const personBId = (links[1] as { personId: string }).personId;

  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const survivorLinksForCase = (await db.drugCasePerson.findMany({ where: { caseId: shared.caseId, personId: personAId } })) as unknown[];
  assert.equal(survivorLinksForCase.length, 1, "must never have two DrugCasePerson rows for the same (caseId, personId) pair");
});

test("shared device: merge does not create a second DrugPersonDevice link to the same device", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({
      caseNumber: "DEVICE-CASE-A",
      persons: [
        {
          newPerson: { primaryFullName: "บุคคลเอ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [{ brand: "Samsung", model: "S24", serialNumber: null, imei1: "999888777666555", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
    })
  );
  const caseB = await caseService.createCase(
    baseCase({
      caseNumber: "DEVICE-CASE-B",
      persons: [
        {
          newPerson: { primaryFullName: "บุคคลบี", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [{ brand: "Samsung", model: "S24", serialNumber: null, imei1: "999888777666555", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
    })
  );

  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const personBId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;

  const devices = await db.drugDevice.findMany({ where: { imei1: "999888777666555" } });
  assert.equal(devices.length, 1, "the SAME device row should already be reused across both cases (DI-1 find-or-create)");

  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const survivorDeviceLinks = await db.drugPersonDevice.findMany({ where: { personId: personAId } });
  assert.equal(survivorDeviceLinks.length, 1, "must never have two DrugPersonDevice rows for the same (personId, deviceId) pair");
});

test("aliases union: merged person's aliases AND primary name are preserved as aliases on the survivor", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const survivorAliases = await db.drugPersonAlias.findMany({ where: { personId: personAId } });
  const aliasNames = survivorAliases.map((a) => (a as { fullName: string }).fullName);
  assert.ok(aliasNames.includes("สมชาย ทดสอบ ซ้ำ"), "merged person's primary name must survive as an alias on the survivor");
});

test("provenance preserved: moved phone link keeps its original firstSeenAt/recordedBy, not overwritten by the merge", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "PROV-A", persons: [{ newPerson: { primaryFullName: "A", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const caseB = await caseService.createCase(
    baseCase({
      caseNumber: "PROV-B",
      persons: [
        {
          newPerson: { primaryFullName: "B", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0833333333", firstSeenAt: new Date("2025-06-01"), lastSeenAt: new Date("2025-07-01"), notes: "seen at raid" }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const personBId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;

  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const movedPhone = (await db.drugCasePhone.findMany({ where: { personId: personAId } }))[0] as { firstSeenAt: Date; notes: string };
  assert.equal(new Date(movedPhone.firstSeenAt).toISOString().slice(0, 10), "2025-06-01");
  assert.equal(movedPhone.notes, "seen at raid");
});

test("merged person redirect/resolution: mergedIntoPersonId chains resolve to the live survivor", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const mergedRow = await db.drugPerson.findUnique({ where: { id: personBId } });
  const resolved = await db.drugPerson.findUnique({ where: { id: mergedRow!.mergedIntoPersonId as string } });
  assert.equal(resolved?.id, personAId);
  assert.equal(resolved?.status, "ACTIVE");
});

test("audit: a DrugPersonMerge history row and a DrugAuditLog 'person_merged' row are both created", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  const { mergeId } = await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: "same person confirmed", actorId: "mock:admin", actorName: "Administrator" });

  const mergeRow = await db.drugPersonMerge.findUnique({ where: { id: mergeId } });
  assert.ok(mergeRow);
  assert.equal(mergeRow?.survivorPersonId, personAId);
  assert.equal(mergeRow?.mergedPersonId, personBId);
  assert.equal(mergeRow?.reason, "same person confirmed");

  const auditRows = await db.drugAuditLog.findMany({ where: { entityType: "DrugPerson", action: "person_merged" } });
  assert.equal(auditRows.length, 1);
  assert.equal((auditRows[0] as { entityId: string }).entityId, personAId);
});

test("a persistent DrugPersonMatchReview row with decision=MERGED is created for the pair", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const reviews = await db.drugPersonMatchReview.findMany({ where: {} });
  assert.equal(reviews.length, 1);
  assert.equal((reviews[0] as { decision: string }).decision, "MERGED");
});

test("second merge attempt on an already-merged person is rejected — never double-merged", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  await assert.rejects(
    () => mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" }),
    DrugPersonAlreadyMergedError
  );
});

test("merging a third person into the already-merged mergedPersonId is rejected (cannot merge INTO a merged record)", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const caseService = new DrugCaseService({ db });
  const caseC = await caseService.createCase(
    baseCase({ caseNumber: "CASE-C", persons: [{ newPerson: { primaryFullName: "บุคคลซี", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const personCId = ((await db.drugCasePerson.findMany({ where: { caseId: caseC.caseId } }))[0] as { personId: string }).personId;

  await assert.rejects(
    () => mergeService.merge({ survivorPersonId: personCId, mergedPersonId: personBId, reason: null, actorId: "mock:admin", actorName: "Administrator" }),
    DrugPersonAlreadyMergedError
  );
});

test("cannot merge a person into itself", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  await assert.rejects(
    () => mergeService.merge({ survivorPersonId: personAId, mergedPersonId: personAId, reason: null, actorId: "mock:admin", actorName: "Administrator" }),
    DrugCannotMergeSamePersonError
  );
});

test("preview() computes moved counts and skipped-duplicate-case-links without writing anything", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  const preview = await mergeService.preview(personAId, personBId);
  assert.equal(preview.movedCounts.cases, 1);
  assert.equal(preview.movedCounts.phones, 1);
  assert.equal(preview.movedCounts.identifiers, 1);
  assert.equal(preview.skippedDuplicateCaseLinks, 0);

  // Nothing should have been written.
  const mergedRow = await db.drugPerson.findUnique({ where: { id: personBId } });
  assert.equal(mergedRow?.status, "ACTIVE");
  const mergeHistoryRows = await db.drugPersonMerge.findMany({ where: {} });
  assert.equal(mergeHistoryRows.length, 0);
});
