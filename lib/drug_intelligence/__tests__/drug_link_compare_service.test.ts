/**
 * LC-2A Link Compare service tests — QUERY-only pairwise paths, independent
 * shared-case intersection, triple intersection, and adversarial guards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugLinkCompareService } from "@/lib/drug_intelligence/drug_link_compare_service";
import { DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import {
  DRUG_LINK_COMPARE_NONE_KNOWN_KEY,
  DrugLinkCompareValidationError,
  type DrugLinkCompareRequest,
  type DrugLinkCompareSlotInput,
} from "@/lib/drug_intelligence/drug_link_compare_types";
import { translate } from "@/lib/i18n/dictionary";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "LC-2569-001",
    title: "คดีทดสอบเปรียบเทียบความเชื่อมโยง",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "สุราษฎร์ธานี",
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

function personEntry(
  name: string,
  extras: {
    existingPersonId?: string;
    phone?: string;
    vehicleReg?: string;
    vehicleProvince?: string;
  } = {}
) {
  return {
    existingPersonId: extras.existingPersonId,
    newPerson: extras.existingPersonId
      ? undefined
      : { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
    role: "SUSPECT" as const,
    linkedOfficerId: null,
    notes: null,
    phones: extras.phone
      ? [{ rawInput: extras.phone, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null }]
      : [],
    sims: [],
    devices: [],
    vehicles: extras.vehicleReg
      ? [
          {
            registrationNumber: extras.vehicleReg,
            registrationProvince: extras.vehicleProvince ?? "สุราษฎร์ธานี",
            vehicleType: null,
            brand: null,
            model: null,
            color: null,
            vin: null,
            firstSeenAt: null,
            lastSeenAt: null,
            notes: null,
          },
        ]
      : [],
  };
}

function databaseSlots(entries: Array<{ key: "A" | "B" | "C"; type: DrugLinkCompareRequest["slots"][number]["entityType"]; id: string }>): DrugLinkCompareSlotInput[] {
  return entries.map((entry) => ({
    key: entry.key,
    kind: "DATABASE" as const,
    entityType: entry.type,
    entityId: entry.id,
  }));
}

async function seedDemoTopology() {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "DI-TEST-001",
      persons: [personEntry("นายกิตติศักดิ์ ทดสอบระบบ", { phone: "0900001001" })],
    })
  );
  const personId = (await db.drugPerson.findMany({}))[0].id;
  await caseService.createCase(
    baseCase({
      caseNumber: "DI-TEST-002",
      persons: [personEntry("นายกิตติศักดิ์ ทดสอบระบบ", { existingPersonId: personId, phone: "0900001001" })],
    })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "DI-TEST-003",
      persons: [personEntry("นายกิตติศักดิ์ ทดสอบระบบ", { existingPersonId: personId, phone: "0900001001", vehicleReg: "TEST-9009" })],
    })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "DI-TEST-005",
      persons: [personEntry("นายศุภชัย ทดสอบระบบ", { vehicleReg: "TEST-9009" })],
    })
  );
  const phones = await db.drugPhoneNumber.findMany({});
  const vehicles = await db.drugVehicle.findMany({});
  const cases = await db.drugCase.findMany({});
  if (phones[0].normalizedNumber !== "66900001001") {
    throw new Error(`demo phone matching key was ${phones[0].normalizedNumber}`);
  }
  return {
    db,
    personId,
    phoneId: phones[0].id,
    vehicleId: vehicles[0].id,
    caseIds: Object.fromEntries(cases.map((row) => [row.caseNumber, row.id])) as Record<string, string>,
  };
}

test("NONE_KNOWN wording is absence of data, never proof of no relationship", () => {
  assert.equal(translate(DRUG_LINK_COMPARE_NONE_KNOWN_KEY, "th"), "ยังไม่พบความเชื่อมโยงจากข้อมูลที่มีในระบบ");
  assert.doesNotMatch(translate(DRUG_LINK_COMPARE_NONE_KNOWN_KEY, "th"), /ไม่เกี่ยวข้องกัน/);
});

test("demo A/B/C: DIRECT person-vehicle, DIRECT person-phone, 2-hop vehicle-phone, triple case 003 only", async () => {
  const { db, personId, phoneId, vehicleId, caseIds } = await seedDemoTopology();
  const service = new DrugLinkCompareService(db);
  const result = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "VEHICLE", id: vehicleId },
        { key: "C", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );

  assert.equal(result.interpretation.kind, "QUERY");
  assert.equal(result.bounds.maxPathDepth, 3);
  assert.equal(result.bounds.maxVisited, 150);
  assert.equal(result.bounds.maxEntities, 3);

  const ab = result.pairs.find((p) => p.left === "A" && p.right === "B")!;
  const ac = result.pairs.find((p) => p.left === "A" && p.right === "C")!;
  const bc = result.pairs.find((p) => p.left === "B" && p.right === "C")!;

  assert.equal(ab.connectionKind, "DIRECT");
  assert.equal(ab.hopCount, 1);
  assert.equal(ab.shortestPath?.steps[1]?.viaEdge?.relationshipType, "PERSON_VEHICLE");
  assert.equal(ab.shortestPath?.steps[1]?.viaEdge?.edgeKind, "DIRECT");
  assert.deepEqual(
    ab.sharedCases.map((c) => c.caseNumber),
    ["DI-TEST-003"]
  );
  assert.equal(ab.sharedCases[0].caseId, caseIds["DI-TEST-003"]);

  assert.equal(ac.connectionKind, "DIRECT");
  assert.equal(ac.hopCount, 1);
  assert.equal(ac.shortestPath?.steps[1]?.viaEdge?.relationshipType, "PERSON_PHONE");
  assert.deepEqual(
    ac.sharedCases.map((c) => c.caseNumber),
    ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003"]
  );
  assert.ok(ac.sharedCases.every((c) => c.caseId === caseIds[c.caseNumber]));

  assert.equal(bc.connectionKind, "INDIRECT");
  assert.equal(bc.hopCount, 2);
  assert.ok(bc.shortestPath);
  assert.ok(!bc.shortestPath.steps.some((step) => step.viaEdge?.relationshipType === ("PHONE_VEHICLE" as string)));
  assert.ok(bc.shortestPath.steps.every((step) => !step.viaEdge || step.viaEdge.edgeKind === "DIRECT"));
  assert.ok(!bc.shortestPath.steps.some((step) => String(step.viaEdge?.relationshipType ?? "").startsWith("SHARED_")));
  assert.deepEqual(
    bc.shortestPath.steps.map((step) => ({ type: step.node.type, id: String(step.node.id) })),
    [
      { type: "VEHICLE", id: String(vehicleId) },
      { type: "CASE", id: String(caseIds["DI-TEST-003"]) },
      { type: "PHONE", id: String(phoneId) },
    ]
  );
  assert.equal(bc.shortestPath.steps[1]?.viaEdge?.relationshipType, "CASE_VEHICLE");
  assert.equal(bc.shortestPath.steps[2]?.viaEdge?.relationshipType, "CASE_PHONE");
  assert.deepEqual(
    bc.sharedCases.map((c) => c.caseNumber),
    ["DI-TEST-003"]
  );
  assert.equal(ab.sharedEntities.length, 0);
  assert.equal(ac.sharedEntities.length, 0);
  assert.equal(bc.sharedEntities.length, 0);

  assert.ok(result.tripleIntersection);
  assert.deepEqual(
    result.tripleIntersection.cases.map((c) => c.caseNumber),
    ["DI-TEST-003"]
  );
  assert.equal(result.tripleIntersection.cases[0].caseId, caseIds["DI-TEST-003"]);
  assert.equal(result.tripleIntersection.entities.length, 0);
  assert.ok(!result.tripleIntersection.cases.some((c) => c.caseNumber === "DI-TEST-005"));

  const fingerprints = [];
  for (let i = 0; i < 4; i++) {
    const again = await service.compare(
      {
        slots: databaseSlots([
          { key: "A", type: "PERSON", id: personId },
          { key: "B", type: "VEHICLE", id: vehicleId },
          { key: "C", type: "PHONE", id: phoneId },
        ]),
      },
      { canViewFull: true }
    );
    fingerprints.push(
      JSON.stringify({
        pairs: again.pairs.map((pair) => ({
          left: pair.left,
          right: pair.right,
          connectionKind: pair.connectionKind,
          hopCount: pair.hopCount,
          sharedCases: pair.sharedCases.map((c) => c.caseId),
          sharedEntities: pair.sharedEntities.map((e) => `${e.entityType}:${e.entityId}`),
          path: pair.shortestPath?.steps.map((s) => `${s.node.type}:${s.node.id}`) ?? null,
        })),
        triple: again.tripleIntersection?.cases.map((c) => c.caseId) ?? null,
      })
    );
  }
  assert.equal(new Set(fingerprints).size, 1);
});

test("shared cases are returned even when they are not on the shortest path", async () => {
  const { db, personId, phoneId, caseIds } = await seedDemoTopology();
  const service = new DrugLinkCompareService(db);
  const result = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );
  const pair = result.pairs[0];
  assert.equal(pair.connectionKind, "DIRECT");
  assert.equal(pair.hopCount, 1);
  const pathCaseIds = new Set(
    pair.shortestPath?.steps.filter((s) => s.node.type === "CASE").map((s) => s.node.id) ?? []
  );
  assert.equal(pathCaseIds.size, 0, "direct PERSON_PHONE path does not include a case hop");
  assert.ok(pair.sharedCases.some((c) => c.caseId === caseIds["DI-TEST-001"]));
  assert.ok(pair.sharedCases.some((c) => c.caseId === caseIds["DI-TEST-002"]));
  assert.ok(pair.sharedCases.some((c) => c.caseId === caseIds["DI-TEST-003"]));
});

test("compare does not write cases, persons, or relationships", async () => {
  const { db, personId, vehicleId } = await seedDemoTopology();
  const beforeCases = (await db.drugCase.findMany({})).length;
  const beforePersons = (await db.drugPerson.findMany({})).length;
  const beforePhones = (await db.drugPhoneNumber.findMany({})).length;
  const service = new DrugLinkCompareService(db);
  await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "VEHICLE", id: vehicleId },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal((await db.drugCase.findMany({})).length, beforeCases);
  assert.equal((await db.drugPerson.findMany({})).length, beforePersons);
  assert.equal((await db.drugPhoneNumber.findMany({})).length, beforePhones);
});

test("only 1 database entity is a validation error, not a graph query", async () => {
  const { db, personId } = await seedDemoTopology();
  const service = new DrugLinkCompareService(db);
  await assert.rejects(
    () =>
      service.compare(
        { slots: databaseSlots([{ key: "A", type: "PERSON", id: personId }]) },
        { canViewFull: true }
      ),
    (error: unknown) => error instanceof DrugLinkCompareValidationError && error.code === "INSUFFICIENT_DATABASE_ENTITIES"
  );
});

test("manual slot is not analyzed and cannot make up a second database entity", async () => {
  const { db, personId } = await seedDemoTopology();
  const service = new DrugLinkCompareService(db);
  await assert.rejects(
    () =>
      service.compare(
        {
          slots: [
            { key: "A", kind: "DATABASE", entityType: "PERSON", entityId: personId },
            { key: "B", kind: "MANUAL", manualText: "รถกระบะสีดำ ทะเบียนไม่ทราบ" },
          ],
        },
        { canViewFull: true }
      ),
    (error: unknown) => error instanceof DrugLinkCompareValidationError && error.code === "INSUFFICIENT_DATABASE_ENTITIES"
  );
});

test("4 entities are rejected", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugLinkCompareService(db);
  await assert.rejects(
    () =>
      service.compare(
        {
          slots: [
            { key: "A", kind: "DATABASE", entityType: "PERSON", entityId: "1" },
            { key: "B", kind: "DATABASE", entityType: "PERSON", entityId: "2" },
            { key: "C", kind: "DATABASE", entityType: "PERSON", entityId: "3" },
            { key: "A", kind: "DATABASE", entityType: "PERSON", entityId: "4" },
          ],
        },
        { canViewFull: true }
      ),
    (error: unknown) => error instanceof DrugLinkCompareValidationError && error.code === "TOO_MANY_ENTITIES"
  );
});

test("duplicate A/B entity is rejected", async () => {
  const { db, personId } = await seedDemoTopology();
  const service = new DrugLinkCompareService(db);
  await assert.rejects(
    () =>
      service.compare(
        {
          slots: databaseSlots([
            { key: "A", type: "PERSON", id: personId },
            { key: "B", type: "PERSON", id: personId },
          ]),
        },
        { canViewFull: true }
      ),
    (error: unknown) => error instanceof DrugLinkCompareValidationError && error.code === "DUPLICATE_ENTITY"
  );
});

test("LOCATION is an unsupported compare endpoint", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugLinkCompareService(db);
  await assert.rejects(
    () =>
      service.compare(
        {
          slots: [
            { key: "A", kind: "DATABASE", entityType: "LOCATION", entityId: "loc-1" },
            { key: "B", kind: "DATABASE", entityType: "PERSON", entityId: "p-1" },
          ],
        },
        { canViewFull: true }
      ),
    (error: unknown) => error instanceof DrugLinkCompareValidationError && error.code === "UNSUPPORTED_TYPE"
  );
});

test("missing entity throws not-found, never a raw path miss", async () => {
  const { db, personId } = await seedDemoTopology();
  const service = new DrugLinkCompareService(db);
  await assert.rejects(
    () =>
      service.compare(
        {
          slots: databaseSlots([
            { key: "A", type: "PERSON", id: personId },
            { key: "B", type: "VEHICLE", id: "missing-vehicle" },
          ]),
        },
        { canViewFull: true }
      )
  );
});

test("disconnected pair is NONE_KNOWN with absence key", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "LC-DISC-1", persons: [personEntry("ไม่เชื่อม เอ")] }));
  await caseService.createCase(baseCase({ caseNumber: "LC-DISC-2", persons: [personEntry("ไม่เชื่อม บี")] }));
  const [a, b] = await db.drugPerson.findMany({});
  const service = new DrugLinkCompareService(db);
  const result = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: a.id },
        { key: "B", type: "PERSON", id: b.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.pairs[0].connectionKind, "NONE_KNOWN");
  assert.equal(result.pairs[0].hopCount, null);
  assert.equal(result.pairs[0].shortestPath, null);
  assert.equal(result.pairs[0].absenceExplanationKey, DRUG_LINK_COMPARE_NONE_KNOWN_KEY);
  assert.equal(result.tripleIntersection, null);
});

test("direct 1-hop path classifies as DIRECT", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "LC-DIRECT", persons: [personEntry("พบในคดี", { phone: "0811111111" })] })
  );
  const personId = (await db.drugPerson.findMany({}))[0].id;
  const phoneId = (await db.drugPhoneNumber.findMany({}))[0].id;
  const service = new DrugLinkCompareService(db);
  const result = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.pairs[0].connectionKind, "DIRECT");
  assert.equal(result.pairs[0].hopCount, 1);
});

test("2-hop person-person via shared case is INDIRECT and does not use SHARED_* hops", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-SHARED-CASE",
      persons: [personEntry("บุคคลเอ"), personEntry("บุคคลบี")],
    })
  );
  const [a, b] = await db.drugPerson.findMany({});
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: a.id },
        { key: "B", type: "PERSON", id: b.id },
      ]),
    },
    { canViewFull: true }
  );
  const pair = result.pairs[0];
  assert.equal(pair.connectionKind, "INDIRECT");
  assert.equal(pair.hopCount, 2);
  assert.ok(pair.shortestPath);
  for (const step of pair.shortestPath.steps) {
    assert.notEqual(step.viaEdge?.edgeKind, "INFERRED");
    assert.ok(!String(step.viaEdge?.relationshipType ?? "").startsWith("SHARED_"));
  }
});

test("3-hop shortest path classifies as INDIRECT", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "LC-3HOP-A", persons: [personEntry("ต้นทาง", { phone: "0822222222" })] })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-3HOP-B",
      persons: [personEntry("กลางทาง", { phone: "0822222222", vehicleReg: "LC-3HOP" })],
    })
  );
  const personA = (await db.drugPerson.findMany({})).find((p) => p.primaryFullName === "ต้นทาง")!;
  const vehicle = (await db.drugVehicle.findMany({}))[0];
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personA.id },
        { key: "B", type: "VEHICLE", id: vehicle.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.pairs[0].connectionKind, "INDIRECT");
  assert.equal(result.pairs[0].hopCount, 3);
  assert.ok(!result.pairs[0].shortestPath?.steps.some((s) => s.viaEdge?.relationshipType === ("PHONE_VEHICLE" as string)));
});

test("path deeper than 3 is NONE_KNOWN", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "LC-4HOP-A", persons: [personEntry("ต้นทางลึก", { phone: "0833333333" })] })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-4HOP-B",
      persons: [personEntry("กลางทางลึก", { phone: "0833333333", vehicleReg: "LC-4HOP" })],
    })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-4HOP-C",
      persons: [personEntry("ปลายทางลึก", { vehicleReg: "LC-4HOP" })],
    })
  );
  const persons = await db.drugPerson.findMany({});
  const a = persons.find((p) => p.primaryFullName === "ต้นทางลึก")!;
  const b = persons.find((p) => p.primaryFullName === "ปลายทางลึก")!;
  const graph = new DrugNetworkGraphService(db);
  const deep = await graph.findPaths(
    { fromType: "PERSON", fromId: a.id, toType: "PERSON", toId: b.id, maxDepth: 4 },
    { canViewFull: true }
  );
  assert.equal(deep.found, true);
  assert.ok((deep.paths[0]?.hopCount ?? 0) >= 4);

  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: a.id },
        { key: "B", type: "PERSON", id: b.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.pairs[0].connectionKind, "NONE_KNOWN");
  assert.equal(result.pairs[0].absenceExplanationKey, DRUG_LINK_COMPARE_NONE_KNOWN_KEY);
});

test("cycles do not hang and still return a DIRECT-only path", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-CYCLE",
      persons: [personEntry("วงเอ", { phone: "0844444444" }), personEntry("วงบี", { phone: "0844444444" })],
    })
  );
  const [a, b] = await db.drugPerson.findMany({});
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: a.id },
        { key: "B", type: "PERSON", id: b.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.ok(result.pairs[0].connectionKind === "DIRECT" || result.pairs[0].connectionKind === "INDIRECT");
  assert.ok(result.pairs[0].shortestPath);
  assert.ok(result.pairs[0].shortestPath.steps.every((s) => !s.viaEdge || s.viaEdge.edgeKind === "DIRECT"));
});

test("pairwise connectivity without a common case does not fabricate a triple intersection", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "LC-P1", persons: [personEntry("ทริปเอ"), personEntry("ทริปบี")] }));
  const persons = await db.drugPerson.findMany({});
  const a = persons.find((p) => p.primaryFullName === "ทริปเอ")!;
  const b = persons.find((p) => p.primaryFullName === "ทริปบี")!;
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-P2",
      persons: [personEntry("ทริปเอ", { existingPersonId: a.id }), personEntry("ทริปซี")],
    })
  );
  const c = (await db.drugPerson.findMany({})).find((p) => p.primaryFullName === "ทริปซี")!;
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-P3",
      persons: [personEntry("ทริปบี", { existingPersonId: b.id }), personEntry("ทริปซี", { existingPersonId: c.id })],
    })
  );

  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: a.id },
        { key: "B", type: "PERSON", id: b.id },
        { key: "C", type: "PERSON", id: c.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.pairs.length, 3);
  assert.ok(result.pairs.every((p) => p.connectionKind !== "NONE_KNOWN"));
  assert.ok(result.pairs.every((p) => p.sharedCases.length === 1));
  assert.equal(result.tripleIntersection, null);
});

test("two persons sharing a phone return that canonical phone as a shared entity", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-SHARE-PHONE-1",
      persons: [personEntry("ใช้เบอร์เอ", { phone: "0855555555" })],
    })
  );
  const personA = (await db.drugPerson.findMany({}))[0];
  const phoneId = (await db.drugPhoneNumber.findMany({}))[0].id;
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-SHARE-PHONE-2",
      persons: [personEntry("ใช้เบอร์บี", { phone: "0855555555" })],
    })
  );
  const personB = (await db.drugPerson.findMany({})).find((p) => p.primaryFullName === "ใช้เบอร์บี")!;
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personA.id },
        { key: "B", type: "PERSON", id: personB.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.ok(result.pairs[0].sharedEntities.some((e) => e.entityType === "PHONE" && e.entityId === phoneId));
  assert.doesNotMatch(JSON.stringify(result.pairs[0].sharedEntities), /เจ้าของ/);
});

test("masking is preserved on phone labels when canViewFull is false", async () => {
  const { db, personId, phoneId } = await seedDemoTopology();
  const phone = (await db.drugPhoneNumber.findMany({})).find((row) => row.id === phoneId)!;
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: false }
  );
  const slot = result.slots.find((s) => s.key === "B")!;
  assert.notEqual(slot.label, phone.normalizedNumber);
  assert.match(String(slot.label), /x/i);
  const pathPhone = result.pairs[0].shortestPath?.steps.find((s) => s.node.type === "PHONE");
  assert.ok(pathPhone);
  assert.notEqual(pathPhone.node.label, phone.normalizedNumber);
});

test("Person↔Case is DIRECT via PERSON_CASE and still returns identifiers on that case", async () => {
  const { db, personId, phoneId, vehicleId, caseIds } = await seedDemoTopology();
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "CASE", id: caseIds["DI-TEST-003"] },
      ]),
    },
    { canViewFull: true }
  );
  const pair = result.pairs[0];
  assert.equal(pair.connectionKind, "DIRECT");
  assert.equal(pair.shortestPath?.steps[1]?.viaEdge?.relationshipType, "PERSON_CASE");
  assert.deepEqual(
    pair.sharedCases.map((c) => c.caseNumber),
    ["DI-TEST-003"]
  );
  assert.ok(pair.sharedEntities.some((e) => e.entityType === "PHONE" && e.entityId === phoneId));
  assert.ok(pair.sharedEntities.some((e) => e.entityType === "VEHICLE" && e.entityId === vehicleId));
});

test("Case↔Case sharing a canonical phone is INDIRECT and does not invent a shared-case membership", async () => {
  const { db, phoneId, caseIds } = await seedDemoTopology();
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "CASE", id: caseIds["DI-TEST-001"] },
        { key: "B", type: "CASE", id: caseIds["DI-TEST-002"] },
      ]),
    },
    { canViewFull: true }
  );
  const pair = result.pairs[0];
  assert.equal(pair.connectionKind, "INDIRECT");
  assert.equal(pair.hopCount, 2);
  assert.ok(pair.sharedEntities.some((e) => e.entityType === "PHONE" && e.entityId === phoneId));
  assert.equal(pair.sharedCases.length, 0);
  assert.ok(!pair.shortestPath?.steps.some((s) => String(s.viaEdge?.relationshipType ?? "").startsWith("SHARED_")));
});

test("Vehicle↔Phone does not treat co-case identifiers as a fabricated PHONE_VEHICLE share", async () => {
  const { db, phoneId, vehicleId, caseIds } = await seedDemoTopology();
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "VEHICLE", id: vehicleId },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );
  const pair = result.pairs[0];
  assert.equal(pair.connectionKind, "INDIRECT");
  assert.equal(pair.sharedEntities.length, 0);
  assert.deepEqual(
    pair.sharedCases.map((c) => c.caseId),
    [caseIds["DI-TEST-003"]]
  );
});

test("SIM↔Device on the same case intersect by case membership, not by inferred identifier ownership", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "LC-SIM-DEV",
      seizedSims: [{ iccid: "8999030000000000001", imsi: "520031234567890", carrier: "AIS", associatedPhone: null, notes: null }],
      seizedDevices: [{ brand: null, model: null, serialNumber: null, imei1: "353918123456789", imei2: null, associatedPhone: null, notes: null }],
    })
  );
  const simId = (await db.drugSim.findMany({}))[0].id;
  const deviceId = (await db.drugDevice.findMany({}))[0].id;
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "SIM", id: simId },
        { key: "B", type: "DEVICE", id: deviceId },
      ]),
    },
    { canViewFull: true }
  );
  const pair = result.pairs[0];
  assert.equal(pair.connectionKind, "INDIRECT");
  assert.equal(pair.hopCount, 2);
  assert.equal(pair.sharedEntities.length, 0);
  assert.equal(pair.sharedCases[0]?.caseId, created.caseId);
  assert.ok(!pair.shortestPath?.steps.some((s) => s.viaEdge?.relationshipType === "PERSON_SIM"));
  assert.ok(!pair.shortestPath?.steps.some((s) => s.viaEdge?.relationshipType === "PERSON_DEVICE"));
});

test("case-only seized phone stays CASE_PHONE and is not attributed as Person ownership", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "LC-SEIZED-PHONE",
      persons: [personEntry("ผู้ต้องหาในคดี")],
      seizedDevices: [{ brand: null, model: null, serialNumber: null, imei1: null, imei2: null, associatedPhone: "0891112222", notes: null }],
    })
  );
  const personId = (await db.drugPerson.findMany({}))[0].id;
  const phone = (await db.drugPhoneNumber.findMany({}))[0];
  const links = await db.drugCasePhone.findMany({ where: { phoneNumberId: phone.id } });
  assert.ok(links.length >= 1);
  assert.ok(links.every((link) => link.personId === null));
  assert.equal((await db.drugPerson.findMany({})).length, 1);

  const service = new DrugLinkCompareService(db);
  const caseVsPhone = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "CASE", id: created.caseId },
        { key: "B", type: "PHONE", id: phone.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(caseVsPhone.pairs[0].connectionKind, "DIRECT");
  assert.equal(caseVsPhone.pairs[0].shortestPath?.steps[1]?.viaEdge?.relationshipType, "CASE_PHONE");
  assert.equal(caseVsPhone.pairs[0].sharedCases[0]?.caseId, created.caseId);
  assert.equal(
    caseVsPhone.pairs[0].sharedEntities.some((e) => e.entityId === String(phone.id)),
    false
  );

  const personVsPhone = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "PHONE", id: phone.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(personVsPhone.pairs[0].connectionKind, "INDIRECT");
  assert.equal(personVsPhone.pairs[0].hopCount, 2);
  assert.ok(!personVsPhone.pairs[0].shortestPath?.steps.some((s) => s.viaEdge?.relationshipType === "PERSON_PHONE"));
  assert.equal(personVsPhone.pairs[0].sharedCases[0]?.caseId, created.caseId);
  assert.equal(
    personVsPhone.pairs[0].sharedEntities.some((e) => e.entityId === String(phone.id)),
    false
  );

  const personVsCase = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "CASE", id: created.caseId },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(
    personVsCase.pairs[0].sharedEntities.some((e) => e.entityType === "PHONE"),
    false,
    "case-only phone must not become a person identifier"
  );
});

test("case-only SIM/DEVICE/VEHICLE participate through case junctions without a Person", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "LC-SEIZED-ALL",
      seizedSims: [{ iccid: "8999030000000000099", imsi: "520039999999999", carrier: "DTAC", associatedPhone: null, notes: null }],
      seizedDevices: [{ brand: null, model: null, serialNumber: null, imei1: "359999999999999", imei2: null, associatedPhone: null, notes: null }],
      seizedVehicles: [
        {
          registrationNumber: "LC-SEIZED",
          registrationProvince: "เชียงราย",
          vehicleType: null,
          brand: null,
          model: null,
          color: null,
          vin: null,
          notes: null,
        },
      ],
    })
  );
  assert.equal((await db.drugPerson.findMany({})).length, 0);
  const sim = (await db.drugSim.findMany({}))[0];
  const device = (await db.drugDevice.findMany({}))[0];
  const vehicle = (await db.drugVehicle.findMany({}))[0];
  const simLinks = await db.drugCaseSim.findMany({ where: { simId: sim.id } });
  const deviceLinks = await db.drugCaseDevice.findMany({ where: { deviceId: device.id } });
  const vehicleLinks = await db.drugCaseVehicle.findMany({ where: { vehicleId: vehicle.id } });
  assert.ok(simLinks.every((link) => link.personId === null));
  assert.ok(deviceLinks.every((link) => link.personId === null));
  assert.ok(vehicleLinks.every((link) => link.personId === null));

  const service = new DrugLinkCompareService(db);
  for (const [type, id, relationship] of [
    ["SIM", sim.id, "CASE_SIM"],
    ["DEVICE", device.id, "CASE_DEVICE"],
    ["VEHICLE", vehicle.id, "CASE_VEHICLE"],
  ] as const) {
    const result = await service.compare(
      {
        slots: databaseSlots([
          { key: "A", type: "CASE", id: created.caseId },
          { key: "B", type, id },
        ]),
      },
      { canViewFull: true }
    );
    assert.equal(result.pairs[0].connectionKind, "DIRECT");
    assert.equal(result.pairs[0].shortestPath?.steps[1]?.viaEdge?.relationshipType, relationship);
    assert.ok(!result.pairs[0].shortestPath?.steps.some((s) => String(s.viaEdge?.relationshipType ?? "").startsWith("PERSON_")));
    assert.equal(result.pairs[0].sharedCases[0]?.caseId, created.caseId);
  }
});

test("duplicate junction rows still yield one shared case", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(
    baseCase({ caseNumber: "LC-DUP-JUNC", persons: [personEntry("ซ้ำแถว", { phone: "0877777777" })] })
  );
  const personId = (await db.drugPerson.findMany({}))[0].id;
  const phoneId = (await db.drugPhoneNumber.findMany({}))[0].id;
  const existing = (await db.drugCasePhone.findMany({}))[0];
  await db.drugCasePhone.create({
    data: {
      caseId: existing.caseId,
      personId: existing.personId,
      phoneNumberId: existing.phoneNumberId,
      originalInput: "duplicate-row",
      status: "REPORTED",
      firstSeenAt: null,
      lastSeenAt: null,
      recordedBy: "mock:admin",
      notes: "should not duplicate shared cases",
    },
  });
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.pairs[0].sharedCases.length, 1);
  assert.equal(result.pairs[0].sharedCases[0].caseId, existing.caseId);
});

test("shared-case list is capped at 20 with stable ordering", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "LC-CAP-00", persons: [personEntry("คนแคป", { phone: "0866666666" })] }));
  const personId = (await db.drugPerson.findMany({}))[0].id;
  const phoneId = (await db.drugPhoneNumber.findMany({}))[0].id;
  for (let i = 1; i <= 21; i++) {
    await caseService.createCase(
      baseCase({
        caseNumber: `LC-CAP-${String(i).padStart(2, "0")}`,
        persons: [personEntry("คนแคป", { existingPersonId: personId, phone: "0866666666" })],
      })
    );
  }
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.pairs[0].sharedCases.length, 20);
  assert.equal(result.pairs[0].truncated, true);
  const numbers = result.pairs[0].sharedCases.map((c) => c.caseNumber);
  assert.deepEqual(
    numbers,
    [...numbers].sort((a, b) => a.localeCompare(b, "th"))
  );
});

test("three persons sharing one canonical phone produce a triple identifier, not a fake triple case", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "LC-T1", persons: [personEntry("ทริปโฟนเอ", { phone: "0888888888" })] }));
  const phoneId = (await db.drugPhoneNumber.findMany({}))[0].id;
  const a = (await db.drugPerson.findMany({}))[0];
  await caseService.createCase(baseCase({ caseNumber: "LC-T2", persons: [personEntry("ทริปโฟนบี", { phone: "0888888888" })] }));
  await caseService.createCase(baseCase({ caseNumber: "LC-T3", persons: [personEntry("ทริปโฟนซี", { phone: "0888888888" })] }));
  const persons = await db.drugPerson.findMany({});
  const b = persons.find((p) => p.primaryFullName === "ทริปโฟนบี")!;
  const c = persons.find((p) => p.primaryFullName === "ทริปโฟนซี")!;
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: a.id },
        { key: "B", type: "PERSON", id: b.id },
        { key: "C", type: "PERSON", id: c.id },
      ]),
    },
    { canViewFull: true }
  );
  assert.equal(result.tripleIntersection?.cases.length ?? 0, 0);
  assert.ok(result.tripleIntersection?.entities.some((e) => e.entityType === "PHONE" && e.entityId === phoneId));
});

test("merged person resolves to the survivor without writing, and survivor+merged is a duplicate", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "LC-MERGE-A", persons: [personEntry("ผู้รอด", { phone: "0810000001" })] }));
  await caseService.createCase(baseCase({ caseNumber: "LC-MERGE-B", persons: [personEntry("ผู้ถูกรวม")] }));
  const persons = await db.drugPerson.findMany({});
  const survivor = persons.find((p) => p.primaryFullName === "ผู้รอด")!;
  const merged = persons.find((p) => p.primaryFullName === "ผู้ถูกรวม")!;
  const phoneId = (await db.drugPhoneNumber.findMany({}))[0].id;
  await new DrugPersonMergeService(db).merge({
    survivorPersonId: survivor.id,
    mergedPersonId: merged.id,
    reason: "duplicate",
    actorId: "mock:admin",
    actorName: "Administrator",
  });
  const afterMerge = await db.drugPerson.findUnique({ where: { id: merged.id } });
  const beforePersons = (await db.drugPerson.findMany({})).map((p) => ({ id: p.id, status: p.status, mergedIntoPersonId: p.mergedIntoPersonId }));

  const service = new DrugLinkCompareService(db);
  const redirected = await service.compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: merged.id },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );
  const slotA = redirected.slots.find((s) => s.key === "A")!;
  assert.equal(slotA.entityId, survivor.id);
  assert.equal(redirected.pairs[0].connectionKind, "DIRECT");
  assert.equal(afterMerge?.status, "MERGED");
  assert.equal(afterMerge?.mergedIntoPersonId, survivor.id);

  await assert.rejects(
    () =>
      service.compare(
        {
          slots: databaseSlots([
            { key: "A", type: "PERSON", id: merged.id },
            { key: "B", type: "PERSON", id: survivor.id },
          ]),
        },
        { canViewFull: true }
      ),
    (error: unknown) => error instanceof DrugLinkCompareValidationError && error.code === "DUPLICATE_ENTITY"
  );

  const afterCompare = (await db.drugPerson.findMany({})).map((p) => ({ id: p.id, status: p.status, mergedIntoPersonId: p.mergedIntoPersonId }));
  assert.deepEqual(afterCompare, beforePersons);
});

test("SIM/IMEI labels stay masked on the compare DTO when canViewFull is false", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "LC-MASK-ID",
      seizedSims: [{ iccid: "8999030000000000777", imsi: "520037777777777", carrier: "AIS", associatedPhone: null, notes: null }],
      seizedDevices: [{ brand: null, model: null, serialNumber: null, imei1: "358888888888888", imei2: null, associatedPhone: null, notes: null }],
    })
  );
  const sim = (await db.drugSim.findMany({}))[0];
  const device = (await db.drugDevice.findMany({}))[0];
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "SIM", id: sim.id },
        { key: "B", type: "DEVICE", id: device.id },
        { key: "C", type: "CASE", id: created.caseId },
      ]),
    },
    { canViewFull: false }
  );
  const payload = JSON.stringify(result);
  assert.equal(payload.includes(sim.iccid ?? "missing-iccid"), false);
  assert.equal(payload.includes(sim.imsi ?? "missing-imsi"), false);
  assert.equal(payload.includes(device.imei1 ?? "missing-imei"), false);
  const simSlot = result.slots.find((s) => s.key === "A")!;
  const deviceSlot = result.slots.find((s) => s.key === "B")!;
  assert.match(String(simSlot.label), /x/i);
  assert.match(String(deviceSlot.label), /x/i);
});

test("DTO contains no notes, tasks, or Prisma internals", async () => {
  const { db, personId, phoneId } = await seedDemoTopology();
  const result = await new DrugLinkCompareService(db).compare(
    {
      slots: databaseSlots([
        { key: "A", type: "PERSON", id: personId },
        { key: "B", type: "PHONE", id: phoneId },
      ]),
    },
    { canViewFull: true }
  );
  const payload = JSON.stringify(result);
  assert.doesNotMatch(payload, /Prisma/);
  assert.doesNotMatch(payload, /"notes"/);
  assert.doesNotMatch(payload, /task/i);
  assert.doesNotMatch(payload, /analyst/i);
});
