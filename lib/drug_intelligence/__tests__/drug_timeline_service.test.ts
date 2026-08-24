/**
 * Tests for DrugTimelineService (Phase DI-7, Section 18/21). Mirrors the
 * exact QA dataset shape used by DI-6's own alert-service tests: Person A
 * across two cases, Person C across two cases, shared phone A/B, shared
 * device B/C, shared vehicle A/D, Person E fully isolated.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugTimelineService } from "@/lib/drug_intelligence/drug_timeline_service";
import { DrugIntelligenceAlertService } from "@/lib/drug_intelligence/drug_intelligence_alert_service";
import { DrugTimelineFocusNotFoundError } from "@/lib/drug_intelligence/drug_timeline_types";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "TL-TEST-001",
    title: "คดีทดสอบไทม์ไลน์",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "ชุมพร",
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

function newPerson(name: string, identifierValue?: string): DrugCasePersonInput {
  return {
    newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: identifierValue ? [{ type: "THAI_ID", value: identifierValue, notes: null }] : [] },
    role: "SUSPECT",
    linkedOfficerId: null,
    notes: null,
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

function existingPerson(personId: string): DrugCasePersonInput {
  return { existingPersonId: personId, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] };
}

function withPhone(p: DrugCasePersonInput, rawInput: string): DrugCasePersonInput {
  return { ...p, phones: [{ rawInput, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-10"), notes: null }] };
}

function withDevice(p: DrugCasePersonInput, imei1: string): DrugCasePersonInput {
  return { ...p, devices: [{ brand: null, model: null, serialNumber: null, imei1, imei2: null, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-10"), notes: null }] };
}

function withVehicle(p: DrugCasePersonInput, registrationNumber: string): DrugCasePersonInput {
  return { ...p, vehicles: [{ registrationNumber, registrationProvince: "ชุมพร", vehicleType: null, brand: null, model: null, color: null, vin: null, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-10"), notes: null }] };
}

async function findPersonByName(db: InMemoryDatabaseClient, name: string) {
  const persons = await db.drugPerson.findMany({ where: { primaryFullName: name } });
  return persons[0];
}

async function seedQaShapedDataset(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });

  // QA-001: A + B, shared phone.
  await caseService.createCase(
    baseCase({ caseNumber: "QA-001", arrestDate: new Date("2026-08-01"), province: "ชุมพร", persons: [withPhone(newPerson("นาย เอ"), "0800000001"), withPhone(newPerson("นาย บี"), "0800000001")] })
  );
  const personA = await findPersonByName(db, "นาย เอ");
  const personB = await findPersonByName(db, "นาย บี");

  // QA-002: B + C, shared device.
  await caseService.createCase(
    baseCase({ caseNumber: "QA-002", arrestDate: new Date("2026-08-05"), province: "สุราษฎร์ธานี", persons: [existingPerson(personB.id), withDevice(newPerson("นาย ซี"), "990000000000002")] })
  );
  const personC = await findPersonByName(db, "นาย ซี");

  // QA-003: A + D, shared vehicle.
  await caseService.createCase(
    baseCase({ caseNumber: "QA-003", arrestDate: new Date("2026-08-10"), province: "ชุมพร", persons: [existingPerson(personA.id), withVehicle(newPerson("นาย ดี"), "QA-1001")] })
  );
  const personD = await findPersonByName(db, "นาย ดี");

  // QA-004: C only (repeat-case history).
  await caseService.createCase(baseCase({ caseNumber: "QA-004", arrestDate: new Date("2026-08-14"), province: "นครศรีธรรมราช", persons: [existingPerson(personC.id)] }));

  // QA-005: E only — isolated negative control.
  await caseService.createCase(baseCase({ caseNumber: "QA-005", arrestDate: new Date("2026-08-18"), province: "ระนอง", persons: [withPhone(newPerson("นาย อี"), "0800000005")] }));
  const personE = await findPersonByName(db, "นาย อี");

  return { personA, personB, personC, personD, personE };
}

// ---------------------------------------------------------------------
// Chronological ordering + pagination end to end

test("getTimeline returns all 5 QA events, oldest-first by default query direction", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.equal(result.totalCount, 5);
  assert.deepEqual(
    allEvents.map((e) => e.caseNumber),
    ["QA-001", "QA-002", "QA-003", "QA-004", "QA-005"]
  );
});

test("getTimeline reverse direction returns newest-first", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ sort: "NEWEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(
    allEvents.map((e) => e.caseNumber),
    ["QA-005", "QA-004", "QA-003", "QA-002", "QA-001"]
  );
});

// ---------------------------------------------------------------------
// Person history (Section 6, 21) — A, B, C, E

test("Person A's timeline shows exactly QA-001 and QA-003", async () => {
  const db = new InMemoryDatabaseClient();
  const { personA } = await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ personId: personA.id, sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(
    allEvents.map((e) => e.caseNumber).sort(),
    ["QA-001", "QA-003"]
  );
});

test("Person B's timeline shows exactly QA-001 and QA-002", async () => {
  const db = new InMemoryDatabaseClient();
  const { personB } = await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ personId: personB.id, sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(
    allEvents.map((e) => e.caseNumber).sort(),
    ["QA-001", "QA-002"]
  );
});

test("Person C's timeline shows exactly QA-002 and QA-004", async () => {
  const db = new InMemoryDatabaseClient();
  const { personC } = await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ personId: personC.id, sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(
    allEvents.map((e) => e.caseNumber).sort(),
    ["QA-002", "QA-004"]
  );
});

test("Person E (negative control) shows ONLY QA-005 — no false cross-case history", async () => {
  const db = new InMemoryDatabaseClient();
  const { personE } = await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ personId: personE.id, sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(allEvents.map((e) => e.caseNumber), ["QA-005"]);
});

test("an unknown personId throws DrugTimelineFocusNotFoundError, never a silent empty result", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  await assert.rejects(() => timelineService.getTimeline({ personId: "nonexistent-id", sort: "OLDEST_FIRST", page: 1, pageSize: 50 }), DrugTimelineFocusNotFoundError);
});

// ---------------------------------------------------------------------
// Entity history (Section 7) — phone/device/vehicle

test("phone history: the shared A/B phone's timeline shows exactly QA-001 (the only case it appears in)", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const phones = await db.drugPhoneNumber.findMany({ where: { normalizedNumber: "66800000001" } });
  const result = await timelineService.getTimeline({ phoneNumberId: phones[0].id, sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(allEvents.map((e) => e.caseNumber), ["QA-001"]);
});

test("device history: the shared B/C device's timeline shows exactly QA-002", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const devices = await db.drugDevice.findMany({ where: { imei1: "990000000000002" } });
  const result = await timelineService.getTimeline({ deviceId: devices[0].id, sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(allEvents.map((e) => e.caseNumber), ["QA-002"]);
});

test("vehicle history: the shared A/D vehicle's timeline shows exactly QA-003", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const vehicles = await db.drugVehicle.findMany({ where: { registrationNumber: "QA-1001" } });
  const result = await timelineService.getTimeline({ vehicleId: vehicles[0].id, sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(allEvents.map((e) => e.caseNumber), ["QA-003"]);
});

// ---------------------------------------------------------------------
// Missing-coordinate handling (Section 8) — QA dataset has no lat/long anywhere.

test("every QA event has hasCoordinates=false (no fabricated coordinates) since the fixture never sets latitude/longitude", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.ok(allEvents.every((e) => e.hasCoordinates === false));
  assert.ok(allEvents.every((e) => e.latitude === null && e.longitude === null));
});

// ---------------------------------------------------------------------
// Filter combinations (Section 4, 18)

test("province filter narrows to only events in that province", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ province: "ชุมพร", sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(
    allEvents.map((e) => e.caseNumber).sort(),
    ["QA-001", "QA-003"]
  );
});

test("date range filter narrows to only events within the range", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ dateFrom: new Date("2026-08-04"), dateTo: new Date("2026-08-12"), sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  assert.deepEqual(
    allEvents.map((e) => e.caseNumber).sort(),
    ["QA-002", "QA-003"]
  );
});

test("province + focus person filters combine correctly (AND semantics)", async () => {
  const db = new InMemoryDatabaseClient();
  const { personA } = await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  // Person A appears in QA-001 (ชุมพร) and QA-003 (ชุมพร) — both match; a mismatched province should exclude everything.
  const matching = await timelineService.getTimeline({ personId: personA.id, province: "ชุมพร", sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const nonMatching = await timelineService.getTimeline({ personId: personA.id, province: "ระนอง", sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  assert.equal(matching.totalCount, 2);
  assert.equal(nonMatching.totalCount, 0);
});

// ---------------------------------------------------------------------
// KPI end to end (Section 3, 21)

test("KPI reflects the full unfiltered QA dataset correctly", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const result = await timelineService.getTimeline({ sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  assert.equal(result.kpi.eventCount, 5);
  assert.equal(result.kpi.provinceCount, 4); // ชุมพร, สุราษฎร์ธานี, นครศรีธรรมราช, ระนอง
  assert.equal(result.kpi.areasWithRepeatEvents, 1); // ชุมพร has QA-001 + QA-003
});

// ---------------------------------------------------------------------
// Alert integration (Section 12) — hasUnreviewedAlert reflects DI-6 alerts, never a duplicate computation.

test("hasUnreviewedAlert is true for a case with a NEW DI-6 alert, false otherwise", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const alertService = new DrugIntelligenceAlertService(db);
  const timelineService = new DrugTimelineService(db);

  const cases = await db.drugCase.findMany({});
  const qa001 = cases.find((c) => c.caseNumber === "QA-001")!;
  await alertService.generateAlertsForCase(qa001.id, "mock:admin", "Administrator");

  const result = await timelineService.getTimeline({ sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const allEvents = result.groups.flatMap((g) => g.events);
  const qa001Event = allEvents.find((e) => e.caseNumber === "QA-001")!;
  const qa005Event = allEvents.find((e) => e.caseNumber === "QA-005")!;
  assert.equal(qa001Event.hasUnreviewedAlert, true, "QA-001 has a same-case shared-phone NEW_NETWORK_CONNECTION alert (A+B share a phone)");
  assert.equal(qa005Event.hasUnreviewedAlert, false, "QA-005 (Person E, isolated) has no alerts");
});

// ---------------------------------------------------------------------
// Geographic aggregate (Section 9)

test("geographic aggregate reflects only provinces actually present in the QA data", async () => {
  const db = new InMemoryDatabaseClient();
  await seedQaShapedDataset(db);
  const timelineService = new DrugTimelineService(db);

  const rows = await timelineService.getGeographicAggregate({ sort: "OLDEST_FIRST", page: 1, pageSize: 50 });
  const chumphon = rows.find((r) => r.province === "ชุมพร")!;
  assert.equal(chumphon.caseCount, 2);
});
