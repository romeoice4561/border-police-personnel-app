/**
 * DI-7.4 DrugPersonAdvancedSearchService — focused regression tests.
 *
 * Covers scenarios A–AG from the DI-7.4 spec:
 *   A   — name search (partial + exact)
 *   B   — nickname exact match
 *   C   — alias exact match
 *   D   — multiple aliases in result
 *   E   — alias partial match (Thai substring)
 *   F   — identifier search + masked value
 *   G   — phone search + masked value
 *   H   — sex filter
 *   I   — nationality filter (case-insensitive)
 *   J   — DOB-derived age filter
 *   K   — approximateAge fallback age filter
 *   L   — age range excludes out-of-range person
 *   M   — network group membership filter
 *   N   — historical network role filter (OR semantics)
 *   O   — network role source filter
 *   P   — verification status filter
 *   Q   — case-role filter (SUSPECT vs WITNESS)
 *   R   — minimum case count filter
 *   S   — province filter
 *   T   — battalion filter
 *   U   — company filter
 *   V   — multiple filters combined (intersection)
 *   W   — relevance ranking: EXACT before PARTIAL
 *   X   — pagination (25 persons, pageSize=10)
 *   Y   — sort CASE_COUNT_DESC
 *   Z   — sort LAST_SEEN_DESC
 *   AA  — sensitive value masking (identifier, phone, name)
 *   AB  — API handler authorization (drug.read vs officer)
 *   AC  — empty search returns all active persons
 *   AD  — no-result query
 *   AE  — Zod schema parsing (comma arrays, coerced numbers, defaults)
 *   AF  — search is read-only (no DrugPerson mutations)
 *   AG  — DI-2 duplicate matching state unchanged after search
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/di74_advanced_search_focused.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugPersonAdvancedSearchService } from "@/lib/drug_intelligence/drug_person_advanced_search_service";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import { drugPersonAdvancedSearchSchema } from "@/lib/drug_intelligence/drug_person_advanced_search_api_schemas";
import { handleDrugPersonAdvancedSearch } from "@/lib/drug_intelligence/drug_person_advanced_search_api_handlers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { maskIdentifierValue, maskPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";

// ── constants ─────────────────────────────────────────────────────────────────

const ACTOR_ID = "mock:admin";

function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

// ── shared test DB factory ────────────────────────────────────────────────────
//
// Persons seeded:
//   A  "นาย ทดสอบ หนึ่ง"   nick "แดง"      MALE   ไทย   DOB ~31y   2 SUSPECT cases
//   B  "นาย ทดสอบ สอง"    nick "เขียว"    FEMALE  ไทย   DOB ~25y   1 WITNESS case
//   C  "นาย ทองแท้ ใต้"    no nick         MALE   พม่า   DOB ~45y   aliases: ไอ้แดง, เสี่ยแดง
//   D  "นาง ทดสอบ สี่"    nick "น้ำเงิน"   FEMALE  ลาว   DOB ~30y   no cases
//   E  "นาย สมชาย วงศ์ดี"  no nick         MALE   ไทย   approxAge=40  THAI_ID "1234567890123"
//   F  "นาย วิระ ดีมาก"   no nick         MALE   ไทย   approxAge=35  phone "0812345678"
//
// Network roles for A: COURIER (DIRECT_ARREST, CONFIRMED) + RETAIL_DEALER (TESTIMONY, UNVERIFIED)
// Network roles for B: RETAIL_DEALER (TESTIMONY, UNVERIFIED)
// Network membership for A: group-1
// Cases: A → case A1 (ชุมพร, battalion=5, SUSPECT) + case A2 (กรุงเทพ, company=10, SUSPECT)
//        B → case B1 (กรุงเทพ, WITNESS)

type TestCtx = {
  db: InMemoryDatabaseClient;
  service: DrugPersonAdvancedSearchService;
  idA: string;
  idB: string;
  idC: string;
  idD: string;
  idE: string;
  idF: string;
  caseId_A1: string;
  caseId_A2: string;
  caseId_B1: string;
};

async function makeTestDb(): Promise<TestCtx> {
  const db = new InMemoryDatabaseClient();
  const service = new DrugPersonAdvancedSearchService(db);

  // ── Person A ────────────────────────────────────────────────────────────────
  const idA = generateDrugId();
  await db.drugPerson.create({
    data: {
      id: idA,
      primaryFullName: "นาย ทดสอบ หนึ่ง",
      nickname: "แดง",
      sex: "MALE",
      nationality: "ไทย",
      dateOfBirth: yearsAgo(31),
      approximateAge: null,
      status: "ACTIVE",
      notes: null,
    },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idA, fullName: "นาย ทดสอบ หนึ่ง", isPrimary: true },
  });

  // ── Person B ────────────────────────────────────────────────────────────────
  const idB = generateDrugId();
  await db.drugPerson.create({
    data: {
      id: idB,
      primaryFullName: "นาย ทดสอบ สอง",
      nickname: "เขียว",
      sex: "FEMALE",
      nationality: "ไทย",
      dateOfBirth: yearsAgo(25),
      approximateAge: null,
      status: "ACTIVE",
      notes: null,
    },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idB, fullName: "นาย ทดสอบ สอง", isPrimary: true },
  });

  // ── Person C — name has NO "แดง"; aliases have "ไอ้แดง" + "เสี่ยแดง" ────────
  const idC = generateDrugId();
  await db.drugPerson.create({
    data: {
      id: idC,
      primaryFullName: "นาย ทองแท้ ใต้",
      nickname: null,
      sex: "MALE",
      nationality: "พม่า",
      dateOfBirth: yearsAgo(45),
      approximateAge: null,
      status: "ACTIVE",
      notes: null,
    },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idC, fullName: "นาย ทองแท้ ใต้", isPrimary: true },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idC, fullName: "ไอ้แดง", isPrimary: false },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idC, fullName: "เสี่ยแดง", isPrimary: false },
  });

  // ── Person D ────────────────────────────────────────────────────────────────
  const idD = generateDrugId();
  await db.drugPerson.create({
    data: {
      id: idD,
      primaryFullName: "นาง ทดสอบ สี่",
      nickname: "น้ำเงิน",
      sex: "FEMALE",
      nationality: "ลาว",
      dateOfBirth: yearsAgo(30),
      approximateAge: null,
      status: "ACTIVE",
      notes: null,
    },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idD, fullName: "นาง ทดสอบ สี่", isPrimary: true },
  });

  // ── Person E — identifier ───────────────────────────────────────────────────
  const idE = generateDrugId();
  await db.drugPerson.create({
    data: {
      id: idE,
      primaryFullName: "นาย สมชาย วงศ์ดี",
      nickname: null,
      sex: "MALE",
      nationality: "ไทย",
      dateOfBirth: null,
      approximateAge: 40,
      status: "ACTIVE",
      notes: null,
    },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idE, fullName: "นาย สมชาย วงศ์ดี", isPrimary: true },
  });
  await db.drugPersonIdentifier.create({
    data: {
      id: generateDrugId(),
      personId: idE,
      type: "THAI_ID",
      value: "1234567890123",
      createdBy: ACTOR_ID,
    },
  });

  // ── Person F — phone link ───────────────────────────────────────────────────
  const idF = generateDrugId();
  await db.drugPerson.create({
    data: {
      id: idF,
      primaryFullName: "นาย วิระ ดีมาก",
      nickname: null,
      sex: "MALE",
      nationality: "ไทย",
      dateOfBirth: null,
      approximateAge: 35,
      status: "ACTIVE",
      notes: null,
    },
  });
  await db.drugPersonAlias.create({
    data: { id: generateDrugId(), personId: idF, fullName: "นาย วิระ ดีมาก", isPrimary: true },
  });
  const phoneId = generateDrugId();
  await db.drugPhoneNumber.create({
    data: { id: phoneId, normalizedNumber: "66812345678" },
  });
  const caseId_F = generateDrugId();
  await db.drugCase.create({
    data: {
      id: caseId_F,
      caseNumber: "F-001",
      title: "คดี เอฟ",
      status: "OPEN",
      createdBy: ACTOR_ID,
      createdByName: "Admin",
    },
  });
  await db.drugCasePhone.create({
    data: {
      id: generateDrugId(),
      personId: idF,
      caseId: caseId_F,
      phoneNumberId: phoneId,
      recordedBy: ACTOR_ID,
    },
  });

  // ── Network roles for A: COURIER (CONFIRMED) + RETAIL_DEALER (UNVERIFIED) ──
  await db.drugPersonNetworkRole.create({
    data: {
      id: generateDrugId(),
      personId: idA,
      role: "COURIER",
      source: "DIRECT_ARREST",
      verificationStatus: "CONFIRMED",
    },
  });
  await db.drugPersonNetworkRole.create({
    data: {
      id: generateDrugId(),
      personId: idA,
      role: "RETAIL_DEALER",
      source: "TESTIMONY",
      verificationStatus: "UNVERIFIED",
    },
  });

  // ── Network role for B: RETAIL_DEALER (TESTIMONY, UNVERIFIED) ─────────────
  await db.drugPersonNetworkRole.create({
    data: {
      id: generateDrugId(),
      personId: idB,
      role: "RETAIL_DEALER",
      source: "TESTIMONY",
      verificationStatus: "UNVERIFIED",
    },
  });

  // ── Network membership for A: group-1 ─────────────────────────────────────
  await db.drugPersonNetworkMembership.create({
    data: { id: generateDrugId(), personId: idA, networkGroupId: "group-1" },
  });

  // ── Cases ─────────────────────────────────────────────────────────────────
  const caseId_A1 = generateDrugId();
  await db.drugCase.create({
    data: {
      id: caseId_A1,
      caseNumber: "A-001",
      title: "คดี A1",
      status: "OPEN",
      province: "ชุมพร",
      battalionId: 5,
      companyId: null,
      createdBy: ACTOR_ID,
      createdByName: "Admin",
    },
  });
  await db.drugCasePerson.create({
    data: { id: generateDrugId(), caseId: caseId_A1, personId: idA, role: "SUSPECT", createdBy: ACTOR_ID },
  });

  const caseId_A2 = generateDrugId();
  await db.drugCase.create({
    data: {
      id: caseId_A2,
      caseNumber: "A-002",
      title: "คดี A2",
      status: "OPEN",
      province: "กรุงเทพ",
      battalionId: null,
      companyId: 10,
      createdBy: ACTOR_ID,
      createdByName: "Admin",
    },
  });
  await db.drugCasePerson.create({
    data: { id: generateDrugId(), caseId: caseId_A2, personId: idA, role: "SUSPECT", createdBy: ACTOR_ID },
  });

  const caseId_B1 = generateDrugId();
  await db.drugCase.create({
    data: {
      id: caseId_B1,
      caseNumber: "B-001",
      title: "คดี B1",
      status: "OPEN",
      province: "กรุงเทพ",
      battalionId: null,
      companyId: null,
      createdBy: ACTOR_ID,
      createdByName: "Admin",
    },
  });
  await db.drugCasePerson.create({
    data: { id: generateDrugId(), caseId: caseId_B1, personId: idB, role: "WITNESS", createdBy: ACTOR_ID },
  });

  return { db, service, idA, idB, idC, idD, idE, idF, caseId_A1, caseId_A2, caseId_B1 };
}

// ── A. Name search ────────────────────────────────────────────────────────────

describe("A. Name search", () => {
  test("A-1. partial 'ทดสอบ' matches A, B, D only (not C, E, F)", async () => {
    const { service, idA, idB, idC, idD, idE, idF } = await makeTestDb();
    const r = await service.search({ query: "ทดสอบ" }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA), "A must match");
    assert.ok(ids.includes(idB), "B must match");
    assert.ok(ids.includes(idD), "D must match");
    assert.ok(!ids.includes(idC), "C (ทองแท้) must NOT match");
    assert.ok(!ids.includes(idE), "E (สมชาย) must NOT match");
    assert.ok(!ids.includes(idF), "F (วิระ) must NOT match");
    assert.equal(r.items.length, 3);
  });

  test("A-2. exact full name 'นาย ทดสอบ หนึ่ง' returns only A with NAME EXACT", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ query: "นาย ทดสอบ หนึ่ง" }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idA);
    const nameField = r.items[0].matchedFields.find((f) => f.field === "NAME");
    assert.ok(nameField, "NAME must be in matchedFields");
    assert.equal(nameField!.matchType, "EXACT");
    assert.equal(nameField!.maskedValue, "นาย ทดสอบ หนึ่ง");
  });
});

// ── B. Nickname exact search ──────────────────────────────────────────────────

describe("B. Nickname exact search", () => {
  test("B. 'แดง' matches A by NICKNAME EXACT", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ query: "แดง" }, ACTOR_ID);
    const aResult = r.items.find((x) => x.id === idA);
    assert.ok(aResult, "Person A must be in results");
    const nickField = aResult!.matchedFields.find((f) => f.field === "NICKNAME");
    assert.ok(nickField, "NICKNAME must be in matchedFields");
    assert.equal(nickField!.matchType, "EXACT");
    assert.equal(nickField!.maskedValue, "แดง");
  });
});

// ── C. Alias exact search ─────────────────────────────────────────────────────

describe("C. Alias exact search", () => {
  test("C. 'ไอ้แดง' matches Person C by ALIAS EXACT", async () => {
    const { service, idC } = await makeTestDb();
    const r = await service.search({ query: "ไอ้แดง" }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idC);
    const aliasField = r.items[0].matchedFields.find((f) => f.field === "ALIAS");
    assert.ok(aliasField, "ALIAS must be in matchedFields");
    assert.equal(aliasField!.matchType, "EXACT");
    assert.equal(aliasField!.maskedValue, "ไอ้แดง");
  });
});

// ── D. Multiple aliases ───────────────────────────────────────────────────────

describe("D. Multiple aliases in result", () => {
  test("D. Person C aliases array includes 'ไอ้แดง' and 'เสี่ยแดง'", async () => {
    const { service, idC } = await makeTestDb();
    const r = await service.search({ query: "ไอ้แดง" }, ACTOR_ID);
    const cResult = r.items.find((x) => x.id === idC);
    assert.ok(cResult, "Person C must be found");
    assert.ok(cResult!.aliases.includes("ไอ้แดง"), "aliases must include 'ไอ้แดง'");
    assert.ok(cResult!.aliases.includes("เสี่ยแดง"), "aliases must include 'เสี่ยแดง'");
    assert.equal(cResult!.aliasCount, 2);
  });
});

// ── E. Thai partial alias ─────────────────────────────────────────────────────

describe("E. Thai partial alias match", () => {
  test("E. 'แดง' matches Person C because alias 'ไอ้แดง' contains 'แดง'", async () => {
    const { service, idC } = await makeTestDb();
    const r = await service.search({ query: "แดง" }, ACTOR_ID);
    const cResult = r.items.find((x) => x.id === idC);
    assert.ok(cResult, "Person C must appear (alias 'ไอ้แดง' contains 'แดง')");
    // At least one PARTIAL entry in matchedFields
    const partials = cResult!.matchedFields.filter((f) => f.matchType === "PARTIAL");
    assert.ok(partials.length > 0, "must have at least one PARTIAL match");
  });
});

// ── F. Identifier search ──────────────────────────────────────────────────────

describe("F. Identifier search", () => {
  test("F. '1234567890123' matches Person E; IDENTIFIER field present; maskedValue is masked", async () => {
    const { service, idE } = await makeTestDb();
    const r = await service.search({ query: "1234567890123" }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idE);
    const idField = r.items[0].matchedFields.find((f) => f.field === "IDENTIFIER");
    assert.ok(idField, "IDENTIFIER must be in matchedFields");
    assert.notEqual(idField!.maskedValue, "1234567890123", "raw value must not be exposed");
    assert.equal(idField!.maskedValue, maskIdentifierValue("1234567890123"));
  });
});

// ── G. Phone search ───────────────────────────────────────────────────────────

describe("G. Phone search", () => {
  test("G. '0812345678' matches Person F; PHONE field present; maskedValue is masked", async () => {
    const { service, idF } = await makeTestDb();
    const r = await service.search({ query: "0812345678" }, ACTOR_ID);
    const fResult = r.items.find((x) => x.id === idF);
    assert.ok(fResult, "Person F must be in results");
    const phoneField = fResult!.matchedFields.find((f) => f.field === "PHONE");
    assert.ok(phoneField, "PHONE must be in matchedFields");
    assert.notEqual(phoneField!.maskedValue, "0812345678", "raw phone must not be exposed");
    assert.notEqual(phoneField!.maskedValue, "66812345678", "normalized phone must not be exposed");
    assert.equal(phoneField!.maskedValue, maskPhoneNumber("66812345678"));
  });
});

// ── H. Sex filter ─────────────────────────────────────────────────────────────

describe("H. Sex filter", () => {
  test("H. sex='MALE' returns only A, C, E, F (not B, D)", async () => {
    const { service, idA, idB, idC, idD, idE, idF } = await makeTestDb();
    const r = await service.search({ sex: "MALE" }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA));
    assert.ok(ids.includes(idC));
    assert.ok(ids.includes(idE));
    assert.ok(ids.includes(idF));
    assert.ok(!ids.includes(idB), "B is FEMALE");
    assert.ok(!ids.includes(idD), "D is FEMALE");
    assert.equal(r.items.length, 4);
    r.items.forEach((p) => assert.equal(p.sex, "MALE"));
  });
});

// ── I. Nationality filter ─────────────────────────────────────────────────────

describe("I. Nationality filter", () => {
  test("I. nationality='ไทย' returns A, B, E, F (not C=พม่า, D=ลาว)", async () => {
    const { service, idA, idB, idC, idD, idE, idF } = await makeTestDb();
    const r = await service.search({ nationality: "ไทย" }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA));
    assert.ok(ids.includes(idB));
    assert.ok(ids.includes(idE));
    assert.ok(ids.includes(idF));
    assert.ok(!ids.includes(idC), "C is พม่า");
    assert.ok(!ids.includes(idD), "D is ลาว");
    assert.equal(r.items.length, 4);
  });
});

// ── J. DOB-derived age ────────────────────────────────────────────────────────

describe("J. DOB-derived age filter", () => {
  test("J. Person D (DOB 30y) included in ageMin=28 ageMax=32, not approximate", async () => {
    const { service, idB, idD } = await makeTestDb();
    const r = await service.search({ ageMin: 28, ageMax: 32 }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idD), "D (30y DOB) must be included");
    assert.ok(!ids.includes(idB), "B (25y) must be excluded");
    const dResult = r.items.find((x) => x.id === idD)!;
    assert.equal(dResult.isAgeApproximate, false, "DOB-derived age is not approximate");
    assert.ok(dResult.displayAge !== null);
    assert.ok(dResult.displayAge! >= 28 && dResult.displayAge! <= 32);
  });
});

// ── K. approximateAge fallback ────────────────────────────────────────────────

describe("K. approximateAge fallback", () => {
  test("K. no DOB, approximateAge=31 included in ageMin=28 ageMax=32, isAgeApproximate=true", async () => {
    const db2 = new InMemoryDatabaseClient();
    const idP = generateDrugId();
    await db2.drugPerson.create({
      data: {
        id: idP,
        primaryFullName: "นาย ประมาณ วัย",
        nickname: null,
        sex: null,
        nationality: null,
        dateOfBirth: null,
        approximateAge: 31,
        status: "ACTIVE",
        notes: null,
      },
    });
    const svc2 = new DrugPersonAdvancedSearchService(db2);
    const r = await svc2.search({ ageMin: 28, ageMax: 32 }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idP);
    assert.equal(r.items[0].isAgeApproximate, true);
    assert.equal(r.items[0].displayAge, 31);
  });
});

// ── L. Age range ──────────────────────────────────────────────────────────────

describe("L. Age range", () => {
  test("L. ageMin=30 ageMax=35 excludes Person B (age ~25)", async () => {
    const { service, idB } = await makeTestDb();
    const r = await service.search({ ageMin: 30, ageMax: 35 }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(!ids.includes(idB), "B (25y) must be excluded");
  });
});

// ── M. Network group filter ───────────────────────────────────────────────────

describe("M. Network group filter", () => {
  test("M. networkGroupIds=['group-1'] returns only Person A", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ networkGroupIds: ["group-1"] }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idA);
  });
});

// ── N. Historical network role filter ─────────────────────────────────────────

describe("N. Historical network role filter", () => {
  test("N. networkRoles=['COURIER'] finds A even though A also has RETAIL_DEALER", async () => {
    const { service, idA, idB, idC } = await makeTestDb();
    const r = await service.search({ networkRoles: ["COURIER"] }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA), "A has COURIER role");
    assert.ok(!ids.includes(idB), "B has no COURIER role");
    assert.ok(!ids.includes(idC), "C has no network roles");
    // A's role summary includes both roles
    const aResult = r.items.find((x) => x.id === idA)!;
    assert.ok(aResult.networkRoleSummary.includes("COURIER"));
    assert.ok(aResult.networkRoleSummary.includes("RETAIL_DEALER"));
  });
});

// ── O. Network role source filter ────────────────────────────────────────────

describe("O. Network role source filter", () => {
  test("O. networkRoleSources=['TESTIMONY'] returns A and B (both have TESTIMONY source)", async () => {
    const { service, idA, idB, idC } = await makeTestDb();
    const r = await service.search({ networkRoleSources: ["TESTIMONY"] }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA), "A has TESTIMONY source role");
    assert.ok(ids.includes(idB), "B has TESTIMONY source role");
    assert.ok(!ids.includes(idC), "C has no network roles");
  });
});

// ── P. Verification status filter ────────────────────────────────────────────

describe("P. Verification status filter", () => {
  test("P. verificationStatuses=['UNVERIFIED'] returns A and B", async () => {
    const { service, idA, idB, idC } = await makeTestDb();
    const r = await service.search({ verificationStatuses: ["UNVERIFIED"] }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA), "A has UNVERIFIED role (RETAIL_DEALER)");
    assert.ok(ids.includes(idB), "B has UNVERIFIED role");
    assert.ok(!ids.includes(idC), "C has no roles");
  });
});

// ── Q. Case-role filter ───────────────────────────────────────────────────────

describe("Q. Case-role filter", () => {
  test("Q. caseRoles=['SUSPECT'] returns only Person A (B is WITNESS)", async () => {
    const { service, idA, idB } = await makeTestDb();
    const r = await service.search({ caseRoles: ["SUSPECT"] }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA), "A is SUSPECT");
    assert.ok(!ids.includes(idB), "B is WITNESS only");
    assert.equal(r.items.length, 1);
  });
});

// ── R. Min case count filter ──────────────────────────────────────────────────

describe("R. Min case count filter", () => {
  test("R. minCaseCount=2 returns only Person A (2 cases), not B (1 case)", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ minCaseCount: 2 }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idA);
    assert.equal(r.items[0].caseCount, 2);
  });
});

// ── S. Province filter ────────────────────────────────────────────────────────

describe("S. Province filter", () => {
  test("S. province='ชุมพร' returns only Person A (has case A1 in Chumphon)", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ province: "ชุมพร" }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idA);
  });
});

// ── T. Battalion filter ───────────────────────────────────────────────────────

describe("T. Battalion filter", () => {
  test("T. battalionId=5 returns only Person A (case A1 has battalionId=5)", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ battalionId: 5 }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idA);
  });
});

// ── U. Company filter ─────────────────────────────────────────────────────────

describe("U. Company filter", () => {
  test("U. companyId=10 returns only Person A (case A2 has companyId=10)", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ companyId: 10 }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idA);
  });
});

// ── V. Multiple filters combined ──────────────────────────────────────────────

describe("V. Multiple filters combined", () => {
  test("V. sex=MALE + nationality=ไทย + minCaseCount=1 → only Person A", async () => {
    const { service, idA } = await makeTestDb();
    const r = await service.search({ sex: "MALE", nationality: "ไทย", minCaseCount: 1 }, ACTOR_ID);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].id, idA);
    assert.equal(r.items[0].sex, "MALE");
  });
});

// ── W. Relevance ranking ──────────────────────────────────────────────────────

describe("W. Relevance ranking: EXACT before PARTIAL", () => {
  test("W. query='แดง': A (NICKNAME EXACT) ranks before C (ALIAS PARTIAL)", async () => {
    const { service, idA, idC } = await makeTestDb();
    const r = await service.search({ query: "แดง", sort: "RELEVANCE" }, ACTOR_ID);
    const ids = r.items.map((x) => x.id);
    assert.ok(ids.includes(idA), "A must be in results");
    assert.ok(ids.includes(idC), "C must be in results (alias contains 'แดง')");
    const idxA = ids.indexOf(idA);
    const idxC = ids.indexOf(idC);
    assert.ok(idxA < idxC, `A (EXACT, idx=${idxA}) must rank before C (PARTIAL, idx=${idxC})`);
  });
});

// ── X. Pagination ─────────────────────────────────────────────────────────────

describe("X. Pagination", () => {
  test("X. 25 persons, pageSize=10: page1=10 items, page3=5 items, total=25", async () => {
    const db2 = new InMemoryDatabaseClient();
    for (let i = 1; i <= 25; i++) {
      const id = generateDrugId();
      await db2.drugPerson.create({
        data: {
          id,
          primaryFullName: `นาย คน ${String(i).padStart(2, "0")}`,
          status: "ACTIVE",
          sex: null,
          nationality: null,
          dateOfBirth: null,
          approximateAge: null,
          notes: null,
        },
      });
    }
    const svc2 = new DrugPersonAdvancedSearchService(db2);

    const page1 = await svc2.search({ page: 1, pageSize: 10 }, ACTOR_ID);
    assert.equal(page1.items.length, 10);
    assert.equal(page1.total, 25);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.page, 1);
    assert.equal(page1.pageSize, 10);

    const page3 = await svc2.search({ page: 3, pageSize: 10 }, ACTOR_ID);
    assert.equal(page3.items.length, 5);
    assert.equal(page3.total, 25);
    assert.equal(page3.totalPages, 3);
    assert.equal(page3.page, 3);
  });
});

// ── Y. Sort CASE_COUNT_DESC ───────────────────────────────────────────────────

describe("Y. Sort CASE_COUNT_DESC", () => {
  test("Y. sort='CASE_COUNT_DESC': A (2 cases) before B (1 case) before others (0 cases)", async () => {
    const { service, idA, idB } = await makeTestDb();
    const r = await service.search({ sort: "CASE_COUNT_DESC" }, ACTOR_ID);
    assert.equal(r.items[0].id, idA, "A (2 cases) must be first");
    assert.equal(r.items[0].caseCount, 2);
    const ids = r.items.map((x) => x.id);
    const idxA = ids.indexOf(idA);
    const idxB = ids.indexOf(idB);
    assert.ok(idxA < idxB, "A (2) must rank before B (1)");
  });
});

// ── Z. Sort LAST_SEEN_DESC ────────────────────────────────────────────────────

describe("Z. Sort LAST_SEEN_DESC", () => {
  test("Z. sort='LAST_SEEN_DESC': person with later updatedAt appears first", async () => {
    const db2 = new InMemoryDatabaseClient();
    const idOld = generateDrugId();
    const idNew = generateDrugId();
    await db2.drugPerson.create({
      data: {
        id: idOld,
        primaryFullName: "คนเก่า",
        status: "ACTIVE",
        updatedAt: new Date("2025-01-01T00:00:00Z"),
      },
    });
    await db2.drugPerson.create({
      data: {
        id: idNew,
        primaryFullName: "คนใหม่",
        status: "ACTIVE",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    const svc2 = new DrugPersonAdvancedSearchService(db2);
    const r = await svc2.search({ sort: "LAST_SEEN_DESC" }, ACTOR_ID);
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0].id, idNew, "newer updatedAt must be first");
    assert.equal(r.items[1].id, idOld);
  });
});

// ── AA. Sensitive match explanation masking ───────────────────────────────────

describe("AA. Sensitive masking", () => {
  test("AA-1. identifier match: maskedValue is masked, not raw", async () => {
    const { service } = await makeTestDb();
    const r = await service.search({ query: "1234567890123" }, ACTOR_ID);
    const idField = r.items[0].matchedFields.find((f) => f.field === "IDENTIFIER")!;
    assert.notEqual(idField.maskedValue, "1234567890123");
    assert.ok(idField.maskedValue.includes("x"), "should contain mask characters");
  });

  test("AA-2. phone match: maskedValue is masked, not raw", async () => {
    const { service, idF } = await makeTestDb();
    const r = await service.search({ query: "0812345678" }, ACTOR_ID);
    const fResult = r.items.find((x) => x.id === idF)!;
    const phoneField = fResult.matchedFields.find((f) => f.field === "PHONE")!;
    assert.notEqual(phoneField.maskedValue, "0812345678");
    assert.notEqual(phoneField.maskedValue, "66812345678");
    assert.ok(phoneField.maskedValue.includes("xxx"), "phone mask should contain 'xxx'");
  });

  test("AA-3. name match: maskedValue shows the name as-is (not sensitive)", async () => {
    const { service } = await makeTestDb();
    const r = await service.search({ query: "นาย ทดสอบ หนึ่ง" }, ACTOR_ID);
    const nameField = r.items[0].matchedFields.find((f) => f.field === "NAME")!;
    assert.equal(nameField.maskedValue, "นาย ทดสอบ หนึ่ง");
  });
});

// ── AB. Authorization ─────────────────────────────────────────────────────────

describe("AB. Authorization", () => {
  test("AB-1. admin with drug.read returns 200", async () => {
    const { db } = await makeTestDb();
    const params = new URLSearchParams({ actorId: ACTOR_ID });
    const req = new Request("http://localhost/api/drug-intelligence/persons/search?" + params.toString(), {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=mock:admin` },
    });
    const res = await handleDrugPersonAdvancedSearch(db, params, req);
    assert.equal(res.status, 200, "admin with drug.read should get 200");
  });

  test("AB-2. officer (no drug.read) returns 403", async () => {
    const { db } = await makeTestDb();
    // officer username is "1101700123456" → id is "mock:1101700123456"
    const officerId = "mock:1101700123456";
    const params = new URLSearchParams({ actorId: officerId });
    const req = new Request("http://localhost/api/drug-intelligence/persons/search?" + params.toString(), {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=mock:1101700123456` },
    });
    const res = await handleDrugPersonAdvancedSearch(db, params, req);
    assert.equal(res.status, 403, "officer without drug.read should get 403");
  });
});

// ── AC. Empty search ──────────────────────────────────────────────────────────

describe("AC. Empty search", () => {
  test("AC. no query/no filters returns all 6 active persons, does not throw", async () => {
    const { service } = await makeTestDb();
    const r = await service.search({}, ACTOR_ID);
    assert.equal(r.total, 6, "all 6 ACTIVE persons must be returned");
    assert.equal(r.items.length, 6);
    r.items.forEach((p) => assert.equal(p.status, "ACTIVE"));
  });
});

// ── AD. No-result ─────────────────────────────────────────────────────────────

describe("AD. No-result", () => {
  test("AD. unknown query returns empty result set", async () => {
    const { service } = await makeTestDb();
    // Use a query with NO digits so it cannot accidentally match a phone number substring.
    // "zzznomatchatall" has no digits → normalizedPhoneQuery="" → phone check skipped.
    const r = await service.search({ query: "zzznomatchatall" }, ACTOR_ID);
    assert.equal(r.items.length, 0);
    assert.equal(r.total, 0);
    assert.equal(r.totalPages, 1, "totalPages is Math.max(1, ceil(0/pageSize))=1");
  });
});

// ── AE. Zod schema parsing ────────────────────────────────────────────────────

describe("AE. Zod schema URL parsing", () => {
  test("AE-1. networkRoles comma-separated string → array", () => {
    const r = drugPersonAdvancedSearchSchema.safeParse({ actorId: "mock:admin", networkRoles: "COURIER,DEALER" });
    assert.ok(r.success, JSON.stringify(r.error?.issues));
    assert.deepEqual(r.data!.networkRoles, ["COURIER", "DEALER"]);
  });

  test("AE-2. ageMin='25' coerced to number 25", () => {
    const r = drugPersonAdvancedSearchSchema.safeParse({ actorId: "mock:admin", ageMin: "25" });
    assert.ok(r.success);
    assert.equal(r.data!.ageMin, 25);
    assert.equal(typeof r.data!.ageMin, "number");
  });

  test("AE-3. page defaults to 1, pageSize defaults to 20 when omitted", () => {
    const r = drugPersonAdvancedSearchSchema.safeParse({ actorId: "mock:admin" });
    assert.ok(r.success);
    assert.equal(r.data!.page, 1);
    assert.equal(r.data!.pageSize, 20);
  });

  test("AE-4. single networkRole value is also split correctly", () => {
    const r = drugPersonAdvancedSearchSchema.safeParse({ actorId: "mock:admin", networkRoles: "COURIER" });
    assert.ok(r.success);
    assert.deepEqual(r.data!.networkRoles, ["COURIER"]);
  });

  test("AE-5. caseRoles comma-separated → array", () => {
    const r = drugPersonAdvancedSearchSchema.safeParse({ actorId: "mock:admin", caseRoles: "SUSPECT,ACCUSED" });
    assert.ok(r.success);
    assert.deepEqual(r.data!.caseRoles, ["SUSPECT", "ACCUSED"]);
  });
});

// ── AF. No automatic merge side effects ───────────────────────────────────────

describe("AF. No merge side effects", () => {
  test("AF. running search does not create/modify/delete DrugPerson rows", async () => {
    const { db, service } = await makeTestDb();

    const before = await db.drugPerson.findMany({});
    const beforeIds = new Set(before.map((p) => String(p.id)));

    await service.search({ query: "ทดสอบ" }, ACTOR_ID);
    await service.search({}, ACTOR_ID);
    await service.search({ sex: "MALE", minCaseCount: 1 }, ACTOR_ID);

    const after = await db.drugPerson.findMany({});
    assert.equal(after.length, before.length, "row count must not change");
    after.forEach((p) => {
      assert.ok(beforeIds.has(String(p.id)), `unexpected new person id: ${String(p.id)}`);
    });
  });
});

// ── AG. DI-2 duplicate matching unchanged ─────────────────────────────────────

describe("AG. DI-2 duplicate matching unchanged after search", () => {
  test("AG. findPersonIdsWithPotentialDuplicates returns same result before and after search", async () => {
    // Two persons sharing the same THAI_ID → STRONG signal → HIGH confidence → both flagged
    const db2 = new InMemoryDatabaseClient();
    const idP1 = generateDrugId();
    const idP2 = generateDrugId();

    await db2.drugPerson.create({
      data: {
        id: idP1,
        primaryFullName: "คน ก",
        status: "ACTIVE",
        sex: null,
        nationality: null,
        dateOfBirth: null,
        approximateAge: null,
        notes: null,
      },
    });
    await db2.drugPersonAlias.create({
      data: { id: generateDrugId(), personId: idP1, fullName: "คน ก", isPrimary: true },
    });
    await db2.drugPersonIdentifier.create({
      data: {
        id: generateDrugId(),
        personId: idP1,
        type: "THAI_ID",
        value: "9999999999999",
        createdBy: ACTOR_ID,
      },
    });

    await db2.drugPerson.create({
      data: {
        id: idP2,
        primaryFullName: "คน ข",
        status: "ACTIVE",
        sex: null,
        nationality: null,
        dateOfBirth: null,
        approximateAge: null,
        notes: null,
      },
    });
    await db2.drugPersonAlias.create({
      data: { id: generateDrugId(), personId: idP2, fullName: "คน ข", isPrimary: true },
    });
    await db2.drugPersonIdentifier.create({
      data: {
        id: generateDrugId(),
        personId: idP2,
        type: "THAI_ID",
        value: "9999999999999",
        createdBy: ACTOR_ID,
      },
    });

    const matchingService = new DrugPersonMatchingService(db2);

    // Before search: verify both flagged
    const before = await matchingService.findPersonIdsWithPotentialDuplicates();
    assert.ok(before.has(idP1), "P1 must be flagged before search");
    assert.ok(before.has(idP2), "P2 must be flagged before search");

    // Run advanced search
    const svc2 = new DrugPersonAdvancedSearchService(db2);
    await svc2.search({}, ACTOR_ID);

    // After search: still flagged (search must be read-only)
    const after = await matchingService.findPersonIdsWithPotentialDuplicates();
    assert.ok(after.has(idP1), "P1 must still be flagged after search");
    assert.ok(after.has(idP2), "P2 must still be flagged after search");

    // No extra persons created
    const persons = await db2.drugPerson.findMany({});
    assert.equal(persons.length, 2, "search must not create extra person rows");

    // NEW: also verify potentialDuplicateCandidateId is populated in search results
    const results = await new DrugPersonAdvancedSearchService(db2).search({}, ACTOR_ID);
    const rP1 = results.items.find((x) => x.id === idP1);
    const rP2 = results.items.find((x) => x.id === idP2);
    assert.ok(rP1, "P1 must appear in search results");
    assert.ok(rP2, "P2 must appear in search results");
    assert.equal(rP1!.hasPotentialDuplicate, true, "P1 hasPotentialDuplicate must be true");
    assert.equal(rP1!.potentialDuplicateCandidateId, idP2, "P1 candidateId must point to P2");
    assert.equal(rP2!.hasPotentialDuplicate, true, "P2 hasPotentialDuplicate must be true");
    assert.equal(rP2!.potentialDuplicateCandidateId, idP1, "P2 candidateId must point to P1");
  });
});

// ── AH. Network group name resolution ─────────────────────────────────────────

describe("AH. Network group name resolution", () => {
  test("AH-1. networkGroups in result contains {id, name} not raw IDs", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugPersonAdvancedSearchService(db);
    const groupId = generateDrugId();
    const personId = generateDrugId();

    // Seed network group with a real name
    await db.drugNetworkGroup.create({ data: { id: groupId, name: "เครือข่าย QA ชุมพร", createdBy: ACTOR_ID } });

    await db.drugPerson.create({
      data: { id: personId, primaryFullName: "นาย ทดสอบ เอ", status: "ACTIVE", sex: null, nationality: null, dateOfBirth: null, approximateAge: null, notes: null },
    });
    await db.drugPersonAlias.create({ data: { id: generateDrugId(), personId, fullName: "นาย ทดสอบ เอ", isPrimary: true } });
    await db.drugPersonNetworkMembership.create({ data: { id: generateDrugId(), personId, networkGroupId: groupId } });

    const r = await service.search({}, ACTOR_ID);
    const person = r.items.find((x) => x.id === personId);
    assert.ok(person, "person must appear in results");
    assert.equal(person!.networkGroups.length, 1, "must have one group");
    assert.equal(person!.networkGroups[0].id, groupId, "group id must match");
    assert.equal(person!.networkGroups[0].name, "เครือข่าย QA ชุมพร", "group name must be resolved");
  });

  test("AH-2. unknown group ID falls back to ID string (not crash)", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugPersonAdvancedSearchService(db);
    const groupId = "orphan-group-id";
    const personId = generateDrugId();

    // Membership with no matching DrugNetworkGroup row
    await db.drugPerson.create({
      data: { id: personId, primaryFullName: "นาย ทดสอบ บี", status: "ACTIVE", sex: null, nationality: null, dateOfBirth: null, approximateAge: null, notes: null },
    });
    await db.drugPersonAlias.create({ data: { id: generateDrugId(), personId, fullName: "นาย ทดสอบ บี", isPrimary: true } });
    await db.drugPersonNetworkMembership.create({ data: { id: generateDrugId(), personId, networkGroupId: groupId } });

    const r = await service.search({}, ACTOR_ID);
    const person = r.items.find((x) => x.id === personId);
    assert.ok(person, "person must appear");
    assert.equal(person!.networkGroups[0].id, groupId, "id preserved");
    assert.equal(person!.networkGroups[0].name, groupId, "falls back to id when group row missing");
  });
});
