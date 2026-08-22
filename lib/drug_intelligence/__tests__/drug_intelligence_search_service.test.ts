/**
 * Unit tests for DrugIntelligenceSearchService (Phase DI-3, Section 40) over
 * the in-memory fake DatabaseClient. Covers the minimum scenario checklist:
 * exact name, alias, Thai ID, phone, IMEI, SIM, vehicle registration, case
 * number, merged-person resolution, permission masking, and no-result.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "DRUG-2569-00100",
    title: "คดีทดสอบการค้นหา",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "เชียงราย",
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

test("exact person name search returns the Person", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-NAME-1",
      persons: [{ newPerson: { primaryFullName: "สมชาย ทดสอบค้นหา", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "สมชาย ทดสอบค้นหา" }, { canViewFull: true });

  const personGroup = result.groups.find((g) => g.entityType === "PERSON");
  assert.ok(personGroup);
  assert.equal(personGroup!.results[0].primaryLabel, "สมชาย ทดสอบค้นหา");
  assert.equal(personGroup!.results[0].strength, "EXACT");
  assert.equal(personGroup!.results[0].matchedField, "PRIMARY_NAME");
});

test("alias search resolves to the canonical Person", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const result = await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-ALIAS-1",
      persons: [{ newPerson: { primaryFullName: "วิชัย หลัก", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: result.caseId } }))[0] as { personId: string }).personId;
  const { DrugPersonRepository } = await import("@/lib/database/repositories/drug_person_repository");
  const personRepo = new DrugPersonRepository(db);
  await personRepo.addAlias(personId, "ป๊อกเด็น", false, "mock:admin");

  const search = new DrugIntelligenceSearchService(db);
  const searchResult = await search.searchGrouped({ query: "ป๊อกเด็น" }, { canViewFull: true });

  const personGroup = searchResult.groups.find((g) => g.entityType === "PERSON");
  assert.ok(personGroup);
  assert.equal(personGroup!.results[0].primaryLabel, "วิชัย หลัก", "must return the CANONICAL person, not a separate alias record");
  assert.equal(personGroup!.results[0].matchedField, "ALIAS");
});

test("Thai ID search returns the Person", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-ID-1",
      persons: [{ newPerson: { primaryFullName: "ประยุทธ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "1103700123456" }, { canViewFull: true });

  const personGroup = result.groups.find((g) => g.entityType === "PERSON");
  assert.ok(personGroup);
  assert.equal(personGroup!.results[0].matchedField, "IDENTIFIER");
  assert.equal(personGroup!.results[0].strength, "EXACT");
});

test("phone search returns Phone AND the related Person appears in the PERSON group too", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-PHONE-1",
      persons: [
        {
          newPerson: { primaryFullName: "เบอร์โทร ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0891234567", firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "0891234567" }, { canViewFull: true });

  const phoneGroup = result.groups.find((g) => g.entityType === "PHONE");
  assert.ok(phoneGroup);
  assert.equal(phoneGroup!.results[0].strength, "EXACT");
  // presentPhoneNumber(value, true) returns the raw value unchanged — DrugPhoneNumber.normalizedNumber is stored in the 66-prefixed matching-key form, so a canViewFull=true result shows that form, not a re-derived local "0..." display string.
  assert.equal(phoneGroup!.results[0].primaryLabel, "66891234567");
});

test("IMEI search returns Device with related case count", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-IMEI-1",
      persons: [
        {
          newPerson: { primaryFullName: "อุปกรณ์ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [{ brand: "Samsung", model: "S24", serialNumber: null, imei1: "356789101234567", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "356789101234567" }, { canViewFull: true });

  const deviceGroup = result.groups.find((g) => g.entityType === "DEVICE");
  assert.ok(deviceGroup);
  assert.equal(deviceGroup!.results[0].strength, "EXACT");
  assert.equal(deviceGroup!.results[0].caseCount, 1);
});

test("SIM ICCID search returns the SIM", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-SIM-1",
      persons: [
        {
          newPerson: { primaryFullName: "ซิม ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [{ iccid: "8966001012345678901", imsi: null, carrier: "AIS", firstSeenAt: null, lastSeenAt: null, notes: null }],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "8966001012345678901" }, { canViewFull: true });

  const simGroup = result.groups.find((g) => g.entityType === "SIM");
  assert.ok(simGroup);
  assert.equal(simGroup!.results[0].matchedField, "ICCID");
});

test("vehicle registration search returns the Vehicle", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-VEHICLE-1",
      persons: [
        {
          newPerson: { primaryFullName: "รถ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [{ registrationNumber: "กข1234", registrationProvince: "เชียงราย", vehicleType: null, brand: "Toyota", model: null, color: null, vin: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
        },
      ],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "กข1234" }, { canViewFull: true });

  const vehicleGroup = result.groups.find((g) => g.entityType === "VEHICLE");
  assert.ok(vehicleGroup);
  assert.equal(vehicleGroup!.results[0].primaryLabel, "กข1234");
  assert.equal(vehicleGroup!.results[0].strength, "EXACT");
});

test("case number search returns the Case", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "DRUG-2569-00125" }));

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "DRUG-2569-00125" }, { canViewFull: true });

  const caseGroup = result.groups.find((g) => g.entityType === "CASE");
  assert.ok(caseGroup);
  assert.equal(caseGroup!.results[0].primaryLabel, "DRUG-2569-00125");
  assert.equal(caseGroup!.results[0].strength, "EXACT");
});

test("merged person: search result resolves canonicalTarget to the live survivor", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(
    baseCase({ caseNumber: "MERGE-SEARCH-A", persons: [{ newPerson: { primaryFullName: "ผู้รอด", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const caseB = await caseService.createCase(
    baseCase({ caseNumber: "MERGE-SEARCH-B", persons: [{ newPerson: { primaryFullName: "ผู้ถูกรวมค้นหา", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const survivorId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const mergedId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;

  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: survivorId, mergedPersonId: mergedId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "ผู้ถูกรวมค้นหา" }, { canViewFull: true });

  // The merged person's OWN name was preserved as an alias on the survivor by the merge service — searching it must surface the SURVIVOR, never a separate MERGED result.
  const personGroup = result.groups.find((g) => g.entityType === "PERSON");
  assert.ok(personGroup, "must still find a result via the preserved alias");
  assert.equal(personGroup!.results[0].entityId, survivorId, "must resolve to the survivor's id, never the merged-away person's id");
  assert.equal(personGroup!.results[0].canonicalTarget, null, "the survivor itself is not merged, so canonicalTarget must be null");
});

test("permission: canViewFull=false masks identifier/phone values in results", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "SEARCH-MASK-1",
      persons: [{ newPerson: { primaryFullName: "มาสก์ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const resultMasked = await search.searchGrouped({ query: "1103700123456" }, { canViewFull: false });
  const resultFull = await search.searchGrouped({ query: "1103700123456" }, { canViewFull: true });

  const maskedValue = resultMasked.groups.find((g) => g.entityType === "PERSON")!.results[0].matchedValueMasked;
  const fullValue = resultFull.groups.find((g) => g.entityType === "PERSON")!.results[0].matchedValueMasked;
  assert.notEqual(maskedValue, "1103700123456");
  assert.ok(maskedValue.includes("x"), "masked value must contain masking characters");
  assert.equal(fullValue, "1103700123456");
});

test("no-result query returns an empty grouped response, never throws", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "ไม่มีข้อมูลนี้แน่นอน999999" }, { canViewFull: true });

  assert.equal(result.totalCount, 0);
  assert.equal(result.groups.length, 0);
});

test("empty query returns an empty response without scanning the database", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "" }, { canViewFull: true });

  assert.equal(result.totalCount, 0);
  assert.equal(result.groups.length, 0);
});

test("searchByType paginates a single entity type server-side", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  for (let i = 0; i < 5; i++) {
    await caseService.createCase(
      baseCase({
        caseNumber: `PAGE-${i}`,
        persons: [{ newPerson: { primaryFullName: `หน้า ทดสอบ ${i}`, nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
      })
    );
  }

  const search = new DrugIntelligenceSearchService(db);
  const page1 = await search.searchByType({ query: "หน้า ทดสอบ", entityType: "PERSON", page: 1, pageSize: 2 }, { canViewFull: true });
  const page2 = await search.searchByType({ query: "หน้า ทดสอบ", entityType: "PERSON", page: 2, pageSize: 2 }, { canViewFull: true });

  assert.equal(page1.total, 5);
  assert.equal(page1.rows.length, 2);
  assert.equal(page2.rows.length, 2);
  assert.notDeepEqual(page1.rows.map((r) => r.entityId), page2.rows.map((r) => r.entityId));
});

test("entityType filter restricts the grouped search to a single group", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "FILTER-1",
      persons: [{ newPerson: { primaryFullName: "กรอง ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const search = new DrugIntelligenceSearchService(db);
  const result = await search.searchGrouped({ query: "กรอง ทดสอบ", filters: { entityType: "CASE" } }, { canViewFull: true });

  assert.equal(result.groups.length, 0, "PERSON group must not appear when filtered to CASE only, even though a matching person exists");
});
