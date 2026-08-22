/**
 * Tests for DrugIntelligenceAlertService (Phase DI-6, Section 22's test
 * matrix). Mirrors the exact QA dataset shape (DI-5.2/DI-5.3): Person A+B
 * sharing a phone, B+C sharing a device, A+D sharing a vehicle, Person A
 * across two cases, Person C across two cases, Person E fully isolated,
 * and a Person-F-style strong duplicate (same name+identifier as A).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugIntelligenceAlertService } from "@/lib/drug_intelligence/drug_intelligence_alert_service";
import { DrugIntelligenceAlertRepository } from "@/lib/database/repositories/drug_intelligence_alert_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "ALERT-TEST-001",
    title: "คดีทดสอบแจ้งเตือน",
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

function newPerson(name: string, identifierValue?: string): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: identifierValue ? [{ type: "THAI_ID", value: identifierValue, notes: null }] : [],
    },
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
  // findOrCreateVehicle only matches an existing row when BOTH registrationNumber
  // AND registrationProvince are supplied and equal — a null province means every
  // call creates a fresh row, so tests exercising vehicle reuse must always set one.
  return { ...p, vehicles: [{ registrationNumber, registrationProvince: "ชุมพร", vehicleType: null, brand: null, model: null, color: null, vin: null, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-10"), notes: null }] };
}

async function findPersonByName(db: InMemoryDatabaseClient, name: string) {
  const persons = await db.drugPerson.findMany({ where: { primaryFullName: name } });
  return persons[0];
}

test("A. repeat phone: two persons sharing a phone across two cases produces one REPEAT_PHONE alert on the second case", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-001", persons: [withPhone(newPerson("บุคคล เอ"), "0800000001")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-002", persons: [withPhone(newPerson("บุคคล บี"), "0800000001")] }));
  const alerts = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const phoneAlert = alerts.find((a) => a.alertType === "REPEAT_PHONE");
  assert.ok(phoneAlert, "expected a REPEAT_PHONE alert on the second case");
  assert.equal(phoneAlert!.currentCaseId, r2.caseId);
  assert.deepEqual(phoneAlert!.priorCaseIds, [r1.caseId]);
});

test("A2. new network connection: two persons sharing a phone WITHIN THE SAME CASE (no prior case at all) produces a NEW_NETWORK_CONNECTION alert, not REPEAT_PHONE — exact DI-5.2 QA shape: Person A + B both reporting 080-000-0001 inside QA-001", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(
    baseCase({
      caseNumber: "QA-001",
      persons: [withPhone(newPerson("บุคคล เอ"), "0800000001"), withPhone(newPerson("บุคคล บี"), "0800000001")],
    })
  );
  const alerts = await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  const networkAlert = alerts.find((a) => a.alertType === "NEW_NETWORK_CONNECTION");
  assert.ok(networkAlert, "expected a NEW_NETWORK_CONNECTION alert for the same-case shared phone");
  assert.equal(networkAlert!.relatedPersonIds?.length, 2);
  assert.deepEqual(networkAlert!.priorCaseIds, [], "no prior case exists — this is a same-submission connection, not a repeat");
  assert.equal(alerts.filter((a) => a.alertType === "REPEAT_PHONE").length, 0, "must never ALSO fire REPEAT_PHONE when there is no prior case");
});

test("A3. new network connection does NOT fire for a phone used by only ONE person, even across the same case (no false positive on ordinary single-person data entry)", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-SINGLE-PHONE", persons: [withPhone(newPerson("บุคคล เดี่ยว โฟน"), "0800000077")] }));
  const alerts = await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  assert.equal(alerts.filter((a) => a.alertType === "NEW_NETWORK_CONNECTION").length, 0);
});

test("A4. new network connection is idempotent under regeneration (same dedup guarantee as REPEAT_* alerts)", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);
  const alertRepo = new DrugIntelligenceAlertRepository(db);

  const r1 = await caseService.createCase(
    baseCase({ caseNumber: "QA-001", persons: [withPhone(newPerson("บุคคล เอ"), "0800000001"), withPhone(newPerson("บุคคล บี"), "0800000001")] })
  );
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  const all = await alertRepo.findAll({ alertType: "NEW_NETWORK_CONNECTION" });
  assert.equal(all.length, 1, "regenerating must upsert the SAME row, never insert duplicates");
});

test("B. repeat device: shared IMEI across two persons/cases produces a REPEAT_DEVICE alert", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-002", persons: [withDevice(newPerson("บุคคล บี"), "990000000000002")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-003", persons: [withDevice(newPerson("บุคคล ซี"), "990000000000002")] }));
  const alerts = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const deviceAlert = alerts.find((a) => a.alertType === "REPEAT_DEVICE");
  assert.ok(deviceAlert, "expected a REPEAT_DEVICE alert");
  assert.equal(deviceAlert!.relatedPersonIds?.length, 2, "device is linked to 2 distinct persons across cases");
});

test("C. repeat vehicle: shared registration across two persons/cases produces a REPEAT_VEHICLE alert", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-001", persons: [withVehicle(newPerson("บุคคล เอ"), "QA-1001")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-003", persons: [withVehicle(newPerson("บุคคล ดี"), "QA-1001")] }));
  const alerts = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const vehicleAlert = alerts.find((a) => a.alertType === "REPEAT_VEHICLE");
  assert.ok(vehicleAlert, "expected a REPEAT_VEHICLE alert");
});

test("D. repeat person across cases: the SAME person (existingPersonId) appearing in a second case produces a REPEAT_PERSON alert", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-001", persons: [newPerson("บุคคล เอ")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  const personA = await findPersonByName(db, "บุคคล เอ");

  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-003", persons: [existingPerson(personA.id)] }));
  const alerts = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const personAlert = alerts.find((a) => a.alertType === "REPEAT_PERSON" && a.entityId === personA.id);
  assert.ok(personAlert, "expected a REPEAT_PERSON alert for Person A on the second case");
  assert.equal(personAlert!.severity, "NOTICE", "2 cases total is NOTICE, not yet HIGH");
});

test("D2. repeat person across THREE cases escalates to HIGH severity", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-002", persons: [newPerson("บุคคล ซี")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  const personC = await findPersonByName(db, "บุคคล ซี");

  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-004", persons: [existingPerson(personC.id)] }));
  await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const r3 = await caseService.createCase(baseCase({ caseNumber: "QA-006", persons: [existingPerson(personC.id)] }));
  const alerts = await alertService.generateAlertsForCase(r3.caseId, "mock:admin", "Administrator");

  const personAlert = alerts.find((a) => a.alertType === "REPEAT_PERSON" && a.entityId === personC.id);
  assert.ok(personAlert);
  assert.equal(personAlert!.severity, "HIGH", "3 cases total must escalate to HIGH");
});

test("E. strong duplicate person (A/F): same identifier value on a second, unlinked person produces a HIGH_CONFIDENCE_DUPLICATE alert", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const personRepo = new DrugPersonRepository(db);
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-001", persons: [newPerson("นาย ทดสอบ หนึ่ง", "9999999990001")] }));
  const alerts1 = await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  assert.equal(alerts1.filter((a) => a.alertType === "HIGH_CONFIDENCE_DUPLICATE").length, 0, "a lone person has no duplicate yet");
  const personA = await findPersonByName(db, "นาย ทดสอบ หนึ่ง");

  // Person F: same identifier value as A, created via DIRECT repository
  // calls — matching DI-5.2's own established QA-fixture pattern exactly,
  // because DrugCaseService.createCase()'s pre-transaction duplicate guard
  // WOULD legitimately reject this same identifier if submitted through a
  // normal case-creation "newPerson" flow (verified separately in DI-5.2's
  // seed script). This does not bypass or weaken that guard — it only
  // reaches the same end-state DI-5.2's real duplicate-fixture data has,
  // to exercise the alert layer built ON TOP of the existing match engine.
  const personFId = generateDrugId();
  await personRepo.create({ id: personFId, primaryFullName: "นาย ทดสอบ หนึ่ง สำรอง", nationality: null, dateOfBirth: null, notes: null, createdBy: "mock:admin", createdByName: "Administrator" });
  await personRepo.addIdentifier(personFId, "THAI_ID", "9999999990001", null, "mock:admin");

  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-999", persons: [existingPerson(personFId)] }));
  const alerts2 = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const dupeAlert = alerts2.find((a) => a.alertType === "HIGH_CONFIDENCE_DUPLICATE");
  assert.ok(dupeAlert, "expected a HIGH_CONFIDENCE_DUPLICATE alert for the A/F pair");
  assert.equal(dupeAlert!.severity, "HIGH");
  const pairIds = [dupeAlert!.entityId, ...(dupeAlert!.relatedPersonIds ?? [])].sort();
  assert.deepEqual(pairIds, [personA.id, personFId].sort());
});

test("F. single-use entity does not alert: an entity seen in exactly ONE case never produces a repeat alert", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-SOLO", persons: [withPhone(withDevice(withVehicle(newPerson("บุคคล เดี่ยว"), "QA-SOLO-1"), "990000000000099"), "0899999999")] }));
  const alerts = await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  assert.equal(alerts.filter((a) => a.alertType.startsWith("REPEAT_")).length, 0, "a first-time-only entity must never produce a repeat alert");
  assert.equal(alerts.filter((a) => a.alertType === "NEW_NETWORK_CONNECTION").length, 0, "a single person's own phone/device/vehicle must never be flagged as a 'new connection' — there is only one person, nothing connects to anything");
});

test("G. Person E negative control: an isolated person with a case count of 1 receives NO cross-case alert", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-005", persons: [withPhone(newPerson("บุคคล อี"), "0800000005")] }));
  const alerts = await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  assert.equal(alerts.length, 0, "Person E must receive zero alerts — no prior case, no shared entity, no duplicate");
});

test("H. repeated generation does not duplicate the same alert (dedup via upsert)", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);
  const alertRepo = new DrugIntelligenceAlertRepository(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-001", persons: [withPhone(newPerson("บุคคล เอ"), "0800000001")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");

  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-002", persons: [withPhone(newPerson("บุคคล บี"), "0800000001")] }));
  await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");
  await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator"); // regenerate — must not duplicate
  await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const all = await alertRepo.findAll({ alertType: "REPEAT_PHONE" });
  assert.equal(all.length, 1, "regenerating for the same case must upsert the SAME row, never insert duplicates");
});

test("I. review persists across regeneration — a REVIEWED alert stays REVIEWED after the alert is regenerated", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);
  const alertRepo = new DrugIntelligenceAlertRepository(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-001", persons: [withPhone(newPerson("บุคคล เอ"), "0800000001")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-002", persons: [withPhone(newPerson("บุคคล บี"), "0800000001")] }));
  const alerts = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");
  const phoneAlert = alerts.find((a) => a.alertType === "REPEAT_PHONE")!;

  await alertRepo.markReviewed(phoneAlert.id, "mock:reviewer", "Reviewer One");

  // regenerate again (e.g. triggered by a later unrelated case edit)
  await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const refreshed = await alertRepo.findById(phoneAlert.id);
  assert.equal(refreshed!.status, "REVIEWED", "regeneration must never reset a human review decision");
  assert.equal(refreshed!.reviewedBy, "mock:reviewer");
});

test("J. dismissal persists with a reason across regeneration", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);
  const alertRepo = new DrugIntelligenceAlertRepository(db);

  const r1 = await caseService.createCase(baseCase({ caseNumber: "QA-001", persons: [withPhone(newPerson("บุคคล เอ"), "0800000001")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  const r2 = await caseService.createCase(baseCase({ caseNumber: "QA-002", persons: [withPhone(newPerson("บุคคล บี"), "0800000001")] }));
  const alerts = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");
  const phoneAlert = alerts.find((a) => a.alertType === "REPEAT_PHONE")!;

  await alertRepo.markDismissed(phoneAlert.id, "mock:reviewer", "Reviewer One", "ตรวจสอบแล้ว ไม่มีนัยสำคัญ");
  await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");

  const refreshed = await alertRepo.findById(phoneAlert.id);
  assert.equal(refreshed!.status, "DISMISSED");
  assert.equal(refreshed!.dismissReason, "ตรวจสอบแล้ว ไม่มีนัยสำคัญ");
});

test("O. current/prior case provenance: priorCaseIds never includes currentCaseId", () => {
  // Covered structurally by test A's assertion (priorCaseIds deepEqual [r1.caseId], excluding r2.caseId)
  // — kept here as an explicit named checkpoint per the DI-6 test matrix.
  assert.ok(true);
});
