/**
 * Unit tests for DrugCaseService (Phase DI-1) over the in-memory fake
 * DatabaseClient. Covers Section 27's minimum checklist: create Case, add
 * multiple Persons, add multiple phones to the same Person, add multiple
 * devices/IMEIs, reuse an existing Phone/Device entity when the same
 * number/IMEI reappears, the same Person appearing in multiple Cases, and
 * duplicate-safety blocking (Section 14).
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_case_service.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugDuplicatePersonError, DrugPersonNotFoundError } from "@/lib/drug_intelligence/drug_case_types";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "ตชด.44-2569-001",
    title: "จับกุมยาเสพติดทดสอบ",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "14:30",
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
    narrative: "เหตุการณ์ทดสอบ",
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

test("createCase() writes a case with no persons/items (minimal submission)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const result = await service.createCase(baseCase());

  assert.ok(result.caseId);
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.caseNumber, "ตชด.44-2569-001");
  assert.equal(stored?.createdBy, "mock:admin");
});

test("createCase() adds multiple NEW persons with distinct roles", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const result = await service.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "สมชาย ทดสอบ", nationality: "ไทย", dateOfBirth: new Date("1990-01-01"), notes: null, identifiers: [] },
          role: "ARRESTED_PERSON",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
        {
          newPerson: { primaryFullName: "สมหญิง ทดสอบ", nationality: "ไทย", dateOfBirth: new Date("1992-05-05"), notes: null, identifiers: [] },
          role: "WITNESS",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const casePersons = await db.drugCasePerson.findMany({ where: { caseId: result.caseId } });
  assert.equal(casePersons.length, 2);
  const roles = casePersons.map((r) => r.role).sort();
  assert.deepEqual(roles, ["ARRESTED_PERSON", "WITNESS"]);

  const persons = await db.drugPerson.findMany({});
  assert.equal(persons.length, 2);
});

test("createCase() adds multiple phones to the SAME person, never a phone1/phone2 column", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const result = await service.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "มีหลายเบอร์ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [
            { rawInput: "081-234-5678", firstSeenAt: null, lastSeenAt: null, notes: null },
            { rawInput: "0899999999", firstSeenAt: null, lastSeenAt: null, notes: null },
            { rawInput: "+66856781234", firstSeenAt: null, lastSeenAt: null, notes: null },
          ],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const casePhones = await db.drugCasePhone.findMany({ where: { caseId: result.caseId } });
  assert.equal(casePhones.length, 3);

  const phoneEntities = await db.drugPhoneNumber.findMany({});
  assert.equal(phoneEntities.length, 3);
  const normalized = phoneEntities.map((p) => p.normalizedNumber).sort();
  assert.deepEqual(normalized, ["66812345678", "66856781234", "66899999999"]);
});

test("createCase() adds multiple devices/IMEIs to the same person", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const result = await service.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "มีหลายเครื่อง ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [
            { brand: "Samsung", model: "A50", serialNumber: null, imei1: "111111111111111", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null },
            { brand: "Apple", model: "iPhone 12", serialNumber: null, imei1: "222222222222222", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null },
          ],
          vehicles: [],
        },
      ],
    })
  );

  const caseDevices = await db.drugCaseDevice.findMany({ where: { caseId: result.caseId } });
  assert.equal(caseDevices.length, 2);
  const devices = await db.drugDevice.findMany({});
  assert.equal(devices.length, 2);
});

test("createCase() adds multiple SIMs to a person and reuses an existing SIM by ICCID", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  function personWithSim(name: string, iccid: string) {
    return {
      newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
      role: "SUSPECT" as const,
      linkedOfficerId: null,
      notes: null,
      phones: [],
      sims: [{ iccid, imsi: null, carrier: "AIS", firstSeenAt: null, lastSeenAt: null, notes: null }],
      devices: [],
      vehicles: [],
    };
  }

  const first = await service.createCase(baseCase({ caseNumber: "sim-case-1", persons: [personWithSim("เจ้าของซิม", "8966001234567890123")] }));
  await service.createCase(baseCase({ caseNumber: "sim-case-2", persons: [personWithSim("บุคคลอื่น", "8966001234567890123")] }));

  const sims = await db.drugSim.findMany({});
  assert.equal(sims.length, 1, "the same ICCID must resolve to ONE DrugSim row");

  const caseSims = await db.drugCaseSim.findMany({});
  assert.equal(caseSims.length, 2, "but each case still gets its own link row");

  const firstCaseSims = await db.drugCaseSim.findMany({ where: { caseId: first.caseId } });
  assert.equal(firstCaseSims.length, 1);
});

test("createCase() REUSES an existing DrugPhoneNumber when the same number reappears in a later case", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  function personWithPhone(name: string) {
    return {
      newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
      role: "SUSPECT" as const,
      linkedOfficerId: null,
      notes: null,
      phones: [{ rawInput: "0891112222", firstSeenAt: null, lastSeenAt: null, notes: null }],
      sims: [],
      devices: [],
      vehicles: [],
    };
  }

  await service.createCase(baseCase({ caseNumber: "case-1", persons: [personWithPhone("บุคคลที่หนึ่ง")] }));
  await service.createCase(baseCase({ caseNumber: "case-2", persons: [personWithPhone("บุคคลที่สอง")] }));

  const phoneEntities = await db.drugPhoneNumber.findMany({});
  assert.equal(phoneEntities.length, 1, "the same normalized number must resolve to ONE DrugPhoneNumber row, not two");

  const casePhones = await db.drugCasePhone.findMany({});
  assert.equal(casePhones.length, 2, "but each case still gets its OWN link row with its own provenance");
});

test("createCase() REUSES an existing DrugDevice when the same IMEI reappears with a DIFFERENT person", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  function personWithDevice(name: string) {
    return {
      newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
      role: "SUSPECT" as const,
      linkedOfficerId: null,
      notes: null,
      phones: [],
      sims: [],
      devices: [{ brand: null, model: null, serialNumber: null, imei1: "999888777666555", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
      vehicles: [],
    };
  }

  await service.createCase(baseCase({ caseNumber: "case-a", persons: [personWithDevice("เจ้าของเดิม")] }));
  await service.createCase(baseCase({ caseNumber: "case-b", persons: [personWithDevice("บุคคลใหม่")] }));

  const devices = await db.drugDevice.findMany({});
  assert.equal(devices.length, 1, "the same IMEI must resolve to ONE DrugDevice row even across different people/cases");

  const personDeviceLinks = await db.drugPersonDevice.findMany({});
  assert.equal(personDeviceLinks.length, 2, "but the device-person relationship is recorded separately each time — never overwriting who it was seen with before");
});

test("createCase() allows the SAME existing person to be added to a SECOND case via existingPersonId", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const first = await service.createCase(
    baseCase({
      caseNumber: "case-first",
      persons: [
        {
          newPerson: { primaryFullName: "ซ้ำสองคดี ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const firstCasePersons = await db.drugCasePerson.findMany({ where: { caseId: first.caseId } });
  const personId = firstCasePersons[0].personId;

  const second = await service.createCase(
    baseCase({
      caseNumber: "case-second",
      persons: [{ existingPersonId: personId, role: "ASSOCIATED_PERSON", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const persons = await db.drugPerson.findMany({});
  assert.equal(persons.length, 1, "linking an existing person must never create a duplicate DrugPerson row");

  const links = await db.drugCasePerson.findMany({ where: { personId } });
  assert.equal(links.length, 2, "the same person now has links to BOTH cases");
  assert.equal(new Set(links.map((l) => l.caseId)).size, 2);
  assert.notEqual(first.caseId, second.caseId);
});

test("createCase() BLOCKS creation when a new person's Thai ID matches an existing person (Section 14) — writes nothing", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  await service.createCase(
    baseCase({
      caseNumber: "case-original",
      persons: [
        {
          newPerson: {
            primaryFullName: "มีบัตรประชาชน ทดสอบ",
            nationality: null,
            dateOfBirth: null,
            notes: null,
            identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }],
          },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  await assert.rejects(
    () =>
      service.createCase(
        baseCase({
          caseNumber: "case-duplicate-attempt",
          persons: [
            {
              newPerson: {
                primaryFullName: "ชื่ออื่น ไม่เกี่ยวข้อง",
                nationality: null,
                dateOfBirth: null,
                notes: null,
                identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }],
              },
              role: "SUSPECT",
              linkedOfficerId: null,
              notes: null,
              phones: [],
              sims: [],
              devices: [],
              vehicles: [],
            },
          ],
        })
      ),
    DrugDuplicatePersonError
  );

  const cases = await db.drugCase.findMany({});
  assert.equal(cases.length, 1, "the duplicate-blocked submission must create NOTHING — not even the case itself");
  const persons = await db.drugPerson.findMany({});
  assert.equal(persons.length, 1, "no second DrugPerson row must be created");
});

test("createCase() writes a DrugAuditLog row for case_created and person_created (Section 21)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const result = await service.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "ตรวจสอบ Audit", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const auditRows = await db.drugAuditLog.findMany({});
  const actions = auditRows.map((r) => r.action);
  assert.ok(actions.includes("case_created"));
  assert.ok(actions.includes("person_created"));
  assert.ok(actions.includes("person_added_to_case"));
  for (const row of auditRows) {
    assert.equal(row.actorId, "mock:admin");
    assert.equal(row.actorName, "Administrator");
  }
  void result;
});

test("createCase() adds seized items and locations", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const result = await service.createCase(
    baseCase({
      seizedItems: [
        { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 5000, unit: "เม็ด", weightGrams: null, packageCount: 10, notes: null },
        { drugCategory: "CRYSTAL_METHAMPHETAMINE", otherDrugCategoryLabel: null, measurementKind: "MASS", drugType: "ไอซ์", subtype: null, quantity: null, unit: null, weightGrams: 250.5, packageCount: 1, notes: null },
      ],
      locations: [{ name: "จุดตรวจ", addressText: "ถนนพหลโยธิน", province: "เชียงราย", district: null, subdistrict: null, latitude: null, longitude: null, role: "ARREST_LOCATION", notes: null }],
    })
  );

  const items = await db.drugSeizedItem.findMany({ where: { caseId: result.caseId } });
  assert.equal(items.length, 2, "never flattened into drugType1/drugType2 columns — each item is its own row");

  const locations = await db.drugCaseLocation.findMany({ where: { caseId: result.caseId } });
  assert.equal(locations.length, 1);
  assert.equal(locations[0].role, "ARREST_LOCATION");
});

test("getCase() returns FULL resolved detail (person names, phone numbers, device IMEI, seized items, locations) — not just counts", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const result = await service.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "รายละเอียดเต็ม ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0812223333", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [{ brand: "Samsung", model: null, serialNumber: null, imei1: "123123123123123", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
      seizedItems: [{ drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 20000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null }],
      locations: [{ name: "จุดจับกุม", addressText: null, province: "เชียงราย", district: null, subdistrict: null, latitude: null, longitude: null, role: "ARREST_LOCATION", notes: null }],
    })
  );

  const detail = await service.getCase(result.caseId);

  assert.equal(detail.persons.length, 1);
  assert.equal(detail.persons[0].person?.primaryFullName, "รายละเอียดเต็ม ทดสอบ");

  assert.equal(detail.phones.length, 1);
  assert.equal(detail.phones[0].phoneNumber?.normalizedNumber, "66812223333");
  assert.equal(detail.phones[0].person?.primaryFullName, "รายละเอียดเต็ม ทดสอบ");

  assert.equal(detail.devices.length, 1);
  assert.equal(detail.devices[0].device?.imei1, "123123123123123");

  assert.equal(detail.seizedItems.length, 1);
  assert.equal(detail.seizedItems[0].drugType, "ยาบ้า");

  assert.equal(detail.locations.length, 1);
  assert.equal(detail.locations[0].location?.name, "จุดจับกุม");
  assert.equal(detail.locations[0].role, "ARREST_LOCATION");
});

test("checkPersonDuplicate() reports candidates WITHOUT creating anything (real-time pre-submit check)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  await service.createCase(
    baseCase({
      persons: [
        {
          newPerson: {
            primaryFullName: "เช็คซ้ำ ทดสอบ",
            nationality: null,
            dateOfBirth: null,
            notes: null,
            identifiers: [{ type: "THAI_ID", value: "1199900011122", notes: null }],
          },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );

  const candidates = await service.checkPersonDuplicate({
    identifiers: [{ type: "THAI_ID", value: "1199900011122" }],
    primaryFullName: "ชื่ออื่น",
    dateOfBirth: null,
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].primaryFullName, "เช็คซ้ำ ทดสอบ");

  const personCountAfterCheck = await db.drugPerson.count({});
  assert.equal(personCountAfterCheck, 1, "a duplicate CHECK must never create a person row");
});

test("checkPhoneExists() / checkDeviceExists() are existence-only and never block or create", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const notFoundPhone = await service.checkPhoneExists("0899998888");
  assert.equal(notFoundPhone, null);

  await service.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "มีเบอร์อยู่แล้ว", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0899998888", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [{ brand: null, model: null, serialNumber: null, imei1: "555555555555555", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
    })
  );

  const foundPhone = await service.checkPhoneExists("0899998888");
  assert.ok(foundPhone);
  assert.equal(foundPhone?.normalizedNumber, "66899998888");

  const foundDevice = await service.checkDeviceExists("555555555555555", null);
  assert.ok(foundDevice);

  const notFoundDevice = await service.checkDeviceExists("000000000000000", null);
  assert.equal(notFoundDevice, null);
});

test("listCases() query search matches case number/title, linked person name, and linked phone number", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  await service.createCase(
    baseCase({
      caseNumber: "SEARCH-001",
      title: "คดีค้นหาทดสอบ",
      persons: [
        {
          newPerson: { primaryFullName: "ค้นหาได้ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0877776666", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  await service.createCase(baseCase({ caseNumber: "OTHER-002", title: "คดีอื่น" }));

  const byCaseNumber = await service.listCases({ page: 1, pageSize: 20, query: "SEARCH-001" });
  assert.equal(byCaseNumber.total, 1);

  const byPersonName = await service.listCases({ page: 1, pageSize: 20, query: "ค้นหาได้" });
  assert.equal(byPersonName.total, 1);
  assert.equal(byPersonName.rows[0].caseNumber, "SEARCH-001");

  const byPhone = await service.listCases({ page: 1, pageSize: 20, query: "0877776666" });
  assert.equal(byPhone.total, 1);
  assert.equal(byPhone.rows[0].caseNumber, "SEARCH-001");

  const noMatch = await service.listCases({ page: 1, pageSize: 20, query: "ไม่มีอยู่จริง" });
  assert.equal(noMatch.total, 0);
});

test("listCases() enriches rows with seizedItemsSummary text (Section 12 format)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  await service.createCase(
    baseCase({
      caseNumber: "SUMMARY-001",
      seizedItems: [
        { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 20000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null },
        { drugCategory: "CRYSTAL_METHAMPHETAMINE", otherDrugCategoryLabel: null, measurementKind: "MASS", drugType: "ไอซ์", subtype: null, quantity: null, unit: null, weightGrams: 2400, packageCount: null, notes: null },
      ],
    })
  );

  const { rows } = await service.listCases({ page: 1, pageSize: 20, caseNumber: "SUMMARY-001" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seizedItemsSummary, "ยาบ้า 20,000 เม็ด • ไอซ์ 2.4 กก.");
});

test("getPersonDetail() returns aliases, identifiers, case count, and phones/devices/vehicles ACROSS all of a person's cases (Section 18)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const first = await service.createCase(
    baseCase({
      caseNumber: "drawer-case-1",
      persons: [
        {
          newPerson: {
            primaryFullName: "ลิ้นชัก ทดสอบ",
            nationality: "ไทย",
            dateOfBirth: null,
            notes: null,
            identifiers: [{ type: "THAI_ID", value: "1234567890123", notes: null }],
          },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0811112222", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [{ brand: "Samsung", model: null, serialNumber: null, imei1: "112233445566778", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
    })
  );

  const firstCasePersons = await db.drugCasePerson.findMany({ where: { caseId: first.caseId } });
  const personId = firstCasePersons[0].personId;

  // Same person appears in a SECOND case too — case count must reflect both.
  await service.createCase(
    baseCase({
      caseNumber: "drawer-case-2",
      persons: [{ existingPersonId: personId, role: "WITNESS", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const detail = await service.getPersonDetail(personId);

  assert.equal(detail.person.primaryFullName, "ลิ้นชัก ทดสอบ");
  assert.equal(detail.aliases.length, 1);
  assert.equal(detail.aliases[0].fullName, "ลิ้นชัก ทดสอบ");
  assert.equal(detail.identifiers.length, 1);
  assert.equal(detail.identifiers[0].value, "1234567890123");
  assert.equal(detail.caseCount, 2, "the person is linked to TWO cases");
  assert.equal(detail.phones.length, 1);
  assert.equal(detail.phones[0].phoneNumber?.normalizedNumber, "66811112222");
  assert.equal(detail.devices.length, 1);
  assert.equal(detail.devices[0].device?.imei1, "112233445566778");
});

test("getPersonDetail() throws DrugPersonNotFoundError for a nonexistent person", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await assert.rejects(() => service.getPersonDetail("does-not-exist"), DrugPersonNotFoundError);
});
