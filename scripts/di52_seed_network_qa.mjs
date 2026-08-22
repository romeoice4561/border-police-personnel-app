/**
 * DI-5.2 QA fixture seed script — Network Intelligence end-to-end dataset.
 *
 * TEST/QA ONLY. Every identifier is obviously synthetic (QA- prefixes,
 * 080-000-00XX phones, 9900000000000X IMEIs, 999999999000X Thai IDs).
 * Inserts through the real DrugCaseService (audit rows, canonical entity
 * reuse, phone/device normalization, provenance) for every case-linked
 * entity. Person F (the intentional duplicate-match fixture) is created
 * through DrugPersonRepository directly, NOT through DrugCaseService,
 * because createCase()'s pre-transaction duplicate-safety block would
 * legitimately reject it — that block is correct production behavior and
 * is not bypassed; F is simply created via the same lower-level repository
 * calls DI-2's own test suite already uses for constructing duplicate
 * pairs, and is deliberately left un-linked to any case (a standalone
 * person, exactly per the DI-5.2 spec).
 *
 * Idempotent-ish: re-running will create a SECOND set of QA-00X cases
 * (case numbers are not unique by schema design), so check row counts
 * before re-running, or run the cleanup script first.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database.js";
import { DrugCaseService } from "../lib/drug_intelligence/drug_case_service.js";
import { DrugPersonRepository } from "../lib/database/repositories/drug_person_repository.js";
import { generateDrugId } from "../lib/drug_intelligence/drug_id.js";

const db = createDatabaseClient();
const caseService = new DrugCaseService({ db });
const personRepo = new DrugPersonRepository(db);

const ACTOR_ID = "mock:admin";
const ACTOR_NAME = "Administrator";

// Organization hierarchy confirmed present in this dev DB (Section 6):
// Headquarters "BPP" (บช.ตชด.) -> Region "4" (ภาค 4, southern provinces) ->
// Battalion "44" (กก.ตชด.44) -> Company "414" (ตชด.414) — the same battalion
// already used as reportingUnitText throughout every prior DI test fixture
// in this codebase.
const ORG = { headquartersId: 1, regionId: 4, battalionId: 16, companyId: 57, reportingUnitText: "กก.ตชด.44" };

function baseCaseFields(overrides) {
  return {
    status: "OPEN",
    arrestTime: "10:00",
    headquartersId: ORG.headquartersId,
    regionId: ORG.regionId,
    battalionId: ORG.battalionId,
    companyId: ORG.companyId,
    reportingUnitText: ORG.reportingUnitText,
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    seizedItems: [],
    locations: [],
    actorId: ACTOR_ID,
    actorName: ACTOR_NAME,
    ...overrides,
  };
}

function newPerson(fullName, alias, thaiId) {
  return {
    newPerson: {
      primaryFullName: fullName,
      nationality: null,
      dateOfBirth: null,
      notes: `DI-5.2 QA fixture — ${alias}`,
      identifiers: [{ type: "THAI_ID", value: thaiId, notes: "DI-5.2 QA synthetic identifier" }],
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

function existingPerson(personId) {
  return { existingPersonId: personId, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] };
}

function phone(rawInput) {
  return { rawInput, firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: "DI-5.2 QA fixture" };
}
function sim(iccid, imsi) {
  return { iccid, imsi, carrier: "QA-CARRIER", firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: "DI-5.2 QA fixture" };
}
function device(brand, model, imei1) {
  return { brand, model, serialNumber: null, imei1, imei2: null, firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: "DI-5.2 QA fixture" };
}
function vehicle(registrationNumber, registrationProvince) {
  return { registrationNumber, registrationProvince, vehicleType: null, brand: null, model: null, color: null, vin: null, firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: "DI-5.2 QA fixture" };
}
function seized(drugCategory, measurementKind, amount) {
  const base = { drugCategory, otherDrugCategoryLabel: null, measurementKind, subtype: null, packageCount: null, notes: "DI-5.2 QA fixture" };
  if (measurementKind === "COUNT") {
    return { ...base, drugType: labelFor(drugCategory), quantity: amount, unit: "เม็ด", weightGrams: null };
  }
  return { ...base, drugType: labelFor(drugCategory), quantity: null, unit: null, weightGrams: amount };
}
function labelFor(drugCategory) {
  return { METHAMPHETAMINE_TABLET: "ยาบ้า", CRYSTAL_METHAMPHETAMINE: "ไอซ์", HEROIN: "เฮโรอีน" }[drugCategory];
}
function location(name, province) {
  return { name, addressText: null, province, district: null, subdistrict: null, latitude: null, longitude: null, role: "ARREST_LOCATION", notes: "DI-5.2 QA fixture" };
}

const results = {};

console.log("=== QA-001: A + B, shared phone 080-000-0001 ===");
{
  const r = await caseService.createCase(
    baseCaseFields({
      caseNumber: "QA-001",
      title: "ทดสอบเครือข่าย A-B",
      arrestDate: new Date("2026-08-01"),
      province: "ชุมพร",
      persons: [
        { ...newPerson("นาย ทดสอบ หนึ่ง", "แดง", "9999999990001"), phones: [phone("0800000001"), phone("0800000010")], sims: [sim("QA-SIM-0001", "QA-IMSI-0001")], devices: [device("Samsung", "QA-A", "990000000000001")], vehicles: [vehicle("QA-1001", "ชุมพร")] },
        { ...newPerson("นาย ทดสอบ สอง", "ดำ", "9999999990002"), phones: [phone("0800000002"), phone("0800000001")], sims: [sim("QA-SIM-0002", "QA-IMSI-0002")], devices: [device("iPhone", "QA-B", "990000000000002")], vehicles: [vehicle("QA-2002", "สุราษฎร์ธานี")] },
      ],
      seizedItems: [seized("METHAMPHETAMINE_TABLET", "COUNT", 120000), seized("CRYSTAL_METHAMPHETAMINE", "MASS", 2500)],
      locations: [location("จุดจับกุม QA-001", "ชุมพร")],
    })
  );
  results.caseQA001 = r.caseId;
  console.log("Case QA-001:", r.caseId);
}

// Resolve Person A and Person B's ids from QA-001 for reuse in later cases.
const qa001Persons = await db.drugCasePerson.findMany({ where: { caseId: results.caseQA001 } });
const personRowsQA001 = await Promise.all(qa001Persons.map((cp) => personRepo.findById(cp.personId)));
const personA = personRowsQA001.find((p) => p.primaryFullName === "นาย ทดสอบ หนึ่ง");
const personB = personRowsQA001.find((p) => p.primaryFullName === "นาย ทดสอบ สอง");
results.personA = personA.id;
results.personB = personB.id;
console.log("Person A:", personA.id);
console.log("Person B:", personB.id);

console.log("\n=== QA-002: B + C, shared IMEI 990000000000002 ===");
{
  const r = await caseService.createCase(
    baseCaseFields({
      caseNumber: "QA-002",
      title: "ทดสอบเครือข่าย B-C",
      arrestDate: new Date("2026-08-05"),
      province: "สุราษฎร์ธานี",
      persons: [
        existingPerson(personB.id),
        { ...newPerson("นาย ทดสอบ สาม", "เขียว", "9999999990003"), phones: [phone("0800000003")], sims: [sim("QA-SIM-0003", null)], devices: [device("Samsung", "QA-C", "990000000000002")], vehicles: [vehicle("QA-3003", "นครศรีธรรมราช")] },
      ],
      seizedItems: [seized("METHAMPHETAMINE_TABLET", "COUNT", 50000), seized("HEROIN", "MASS", 1200)],
      locations: [location("จุดจับกุม QA-002", "สุราษฎร์ธานี")],
    })
  );
  results.caseQA002 = r.caseId;
  console.log("Case QA-002:", r.caseId);
}

const qa002Persons = await db.drugCasePerson.findMany({ where: { caseId: results.caseQA002 } });
const personRowsQA002 = await Promise.all(qa002Persons.map((cp) => personRepo.findById(cp.personId)));
const personC = personRowsQA002.find((p) => p.primaryFullName === "นาย ทดสอบ สาม");
results.personC = personC.id;
console.log("Person C:", personC.id);

console.log("\n=== QA-003: A + D, shared vehicle QA-1001 ===");
{
  const r = await caseService.createCase(
    baseCaseFields({
      caseNumber: "QA-003",
      title: "ทดสอบเครือข่าย A-D",
      arrestDate: new Date("2026-08-10"),
      province: "ชุมพร",
      persons: [
        existingPerson(personA.id),
        { ...newPerson("นาย ทดสอบ สี่", "ขาว", "9999999990004"), phones: [phone("0800000004")], sims: [], devices: [device("Xiaomi", "QA-D", "990000000000004")], vehicles: [vehicle("QA-1001", "ชุมพร")] },
      ],
      seizedItems: [seized("METHAMPHETAMINE_TABLET", "COUNT", 300000)],
      locations: [location("จุดจับกุม QA-003", "ชุมพร")],
    })
  );
  results.caseQA003 = r.caseId;
  console.log("Case QA-003:", r.caseId);
}

const qa003Persons = await db.drugCasePerson.findMany({ where: { caseId: results.caseQA003 } });
const personRowsQA003 = await Promise.all(qa003Persons.map((cp) => personRepo.findById(cp.personId)));
const personD = personRowsQA003.find((p) => p.primaryFullName === "นาย ทดสอบ สี่");
results.personD = personD.id;
console.log("Person D:", personD.id);

console.log("\n=== QA-004: C only (repeat-case history test) ===");
{
  const r = await caseService.createCase(
    baseCaseFields({
      caseNumber: "QA-004",
      title: "ทดสอบประวัติ C ซ้ำหลายคดี",
      arrestDate: new Date("2026-08-14"),
      province: "นครศรีธรรมราช",
      persons: [existingPerson(personC.id)],
      seizedItems: [seized("CRYSTAL_METHAMPHETAMINE", "MASS", 4200)],
      locations: [location("จุดจับกุม QA-004", "นครศรีธรรมราช")],
    })
  );
  results.caseQA004 = r.caseId;
  console.log("Case QA-004:", r.caseId);
}

console.log("\n=== QA-005: E only — CONTROL, must never connect to A-D ===");
{
  const r = await caseService.createCase(
    baseCaseFields({
      caseNumber: "QA-005",
      title: "ทดสอบบุคคลไม่เกี่ยวข้อง",
      arrestDate: new Date("2026-08-18"),
      province: "ระนอง",
      persons: [
        { ...newPerson("นาย ทดสอบ ห้า", "น้ำเงิน", "9999999990005"), phones: [phone("0800000005")], sims: [sim("QA-SIM-0005", null)], devices: [device("OPPO", "QA-E", "990000000000005")], vehicles: [vehicle("QA-5005", "ระนอง")] },
      ],
      seizedItems: [seized("METHAMPHETAMINE_TABLET", "COUNT", 1000)],
      locations: [location("จุดจับกุม QA-005", "ระนอง")],
    })
  );
  results.caseQA005 = r.caseId;
  console.log("Case QA-005:", r.caseId);
}

const qa005Persons = await db.drugCasePerson.findMany({ where: { caseId: results.caseQA005 } });
const personRowsQA005 = await Promise.all(qa005Persons.map((cp) => personRepo.findById(cp.personId)));
const personE = personRowsQA005.find((p) => p.primaryFullName === "นาย ทดสอบ ห้า");
results.personE = personE.id;
console.log("Person E:", personE.id);

console.log("\n=== Person F: duplicate-match fixture (NOT linked to any case, NOT merged) ===");
{
  // Created via direct repository calls, matching DI-2's own established
  // test-fixture pattern (drug_person_matching_service.test.ts) — this does
  // NOT go through DrugCaseService.createCase(), so the case-submission
  // duplicate-safety block (which WOULD legitimately reject "newPerson" with
  // the same THAI_ID as Person A) is never in scope here. This does not
  // weaken that block: it still fires correctly for any real Create Case
  // submission, verified separately below.
  const personId = generateDrugId();
  await personRepo.create({ id: personId, primaryFullName: "นาย ทดสอบ หนึ่ง", nationality: null, dateOfBirth: null, notes: "DI-5.2 QA fixture — duplicate-match test person", createdBy: ACTOR_ID, createdByName: ACTOR_NAME });
  await personRepo.addAlias(personId, "แดงสำรอง", false, ACTOR_ID);
  await personRepo.addIdentifier(personId, "THAI_ID", "9999999990001", "DI-5.2 QA fixture — intentional duplicate of Person A's identifier", ACTOR_ID);
  results.personF = personId;
  console.log("Person F:", personId);
}

console.log("\n=== Verify duplicate detection: A vs F (must NOT auto-merge) ===");
{
  const { findDrugPersonDuplicateCandidates } = await import("../lib/drug_intelligence/drug_duplicate_check.js");
  const candidates = await findDrugPersonDuplicateCandidates(db, {
    identifiers: [{ type: "THAI_ID", value: "9999999990001", notes: null }],
    primaryFullName: "นาย ทดสอบ หนึ่ง",
    dateOfBirth: null,
  });
  console.log("Duplicate candidates for A's identity:", JSON.stringify(candidates.map((c) => ({ personId: c.personId, primaryFullName: c.primaryFullName, reasons: c.reasons })), null, 2));
  const foundF = candidates.some((c) => c.personId === results.personF);
  console.log("Person F correctly flagged as a duplicate candidate:", foundF);
}

console.log("\n=== Verify: real Create Case duplicate-safety block still fires (never bypassed) ===");
{
  try {
    await caseService.createCase(
      baseCaseFields({
        caseNumber: "QA-DUPLICATE-SAFETY-CHECK",
        title: "DI-5.2 safety verification — must be rejected",
        arrestDate: new Date("2026-08-19"),
        province: "ชุมพร",
        persons: [newPerson("นาย ทดสอบ หนึ่ง", "แดง (ซ้ำ)", "9999999990001")],
      })
    );
    console.log("!!! UNEXPECTED: duplicate-safety block did NOT fire — this would be a serious bug !!!");
  } catch (error) {
    console.log("Confirmed: DrugDuplicatePersonError correctly fired —", error.constructor.name, "-", error.message);
  }
}

console.log("\n=== Seeded entity ids summary ===");
console.log(JSON.stringify(results, null, 2));
