/**
 * DI-10E.6C — Map case-detail service tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCaseNotFoundError, type DrugCaseCreateRequest, type DrugCasePersonInput, type DrugCaseSeizedItemInput } from "@/lib/drug_intelligence/drug_case_types";
import {
  DrugMapCaseDetailInvalidIdError,
  DrugMapCaseDetailService,
  MAP_DETAIL_MAX_DB_CALLS,
  MAP_DETAIL_PERSON_CAP,
  MAP_DETAIL_SEIZURE_GROUP_CAP,
  MAP_DETAIL_UNIT_CAP,
} from "@/lib/drug_intelligence/drug_map_case_detail";

const ROOT = join(process.cwd());
const SENSITIVE = ["nationalId", "phone", "imsi", "iccid", "imei", "imei1", "plate", "vin", "documentUrl", "signedUrl", "telegram"];

function countingDatabase(db: DatabaseClient): { db: DatabaseClient; queries: () => number } {
  let n = 0;
  const keys = new Set(["drugCase", "drugCasePerson", "drugPerson", "drugSeizedItem", "drugCaseParticipatingUnit", "drugCaseOfficer"]);
  const proxied = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && keys.has(prop) && value && typeof value === "object") {
        return new Proxy(value as object, {
          get(delegate, method, delReceiver) {
            const fn = Reflect.get(delegate, method, delReceiver);
            if ((method === "findMany" || method === "count" || method === "findUnique") && typeof fn === "function") {
              return (args?: unknown) => {
                n += 1;
                return fn.apply(delegate, [args]);
              };
            }
            return fn;
          },
        });
      }
      return value;
    },
  });
  return { db: proxied, queries: () => n };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "MAP-6C-001",
    title: "map detail",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    leadUnitText: "ชุดจับกุม",
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    locationName: "จุดตรวจ",
    latitude: 10,
    longitude: 99,
    narrative: "บันทึกภายในห้ามออก popup",
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

function person(name: string, role = "SUSPECT"): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: "person-note",
      identifiers: [],
    },
    role,
    linkedOfficerId: null,
    notes: "link-note",
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

function countItem(quantity: number, unit = "เม็ด"): DrugCaseSeizedItemInput {
  return {
    drugCategory: "METHAMPHETAMINE_TABLET",
    otherDrugCategoryLabel: null,
    measurementKind: "COUNT",
    drugType: "ยาบ้า",
    subtype: null,
    quantity,
    unit,
    weightGrams: null,
    packageCount: null,
    notes: "seizure-note",
  };
}

function massItem(grams: number): DrugCaseSeizedItemInput {
  return {
    drugCategory: "CRYSTAL_METHAMPHETAMINE",
    otherDrugCategoryLabel: null,
    measurementKind: "MASS",
    drugType: "ไอซ์",
    subtype: null,
    quantity: null,
    unit: null,
    weightGrams: grams,
    packageCount: null,
    notes: null,
  };
}

test("source does not call getCase or the live Map aggregate loader", () => {
  const src = readFileSync(join(ROOT, "lib/drug_intelligence/drug_map_case_detail.ts"), "utf8");
  assert.doesNotMatch(src, /DrugCaseService/);
  assert.doesNotMatch(src, /\.getCase\(/);
  assert.doesNotMatch(src, /getGeoResult/);
  assert.doesNotMatch(src, /DrugMapQueryService/);
  assert.doesNotMatch(src, /Number\.MAX_SAFE_INTEGER/);
});

test("unknown case is not found and invalid id is rejected", async () => {
  const service = new DrugMapCaseDetailService(new InMemoryDatabaseClient());
  await assert.rejects(() => service.load("missing-case-id-0001"), DrugCaseNotFoundError);
  await assert.rejects(() => service.load("../etc/passwd"), DrugMapCaseDetailInvalidIdError);
});

test("detail projects persons, grouped seizures, units, and officer count without sensitive fields", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      persons: [person("วิไล ทดสอบพยาน", "WITNESS"), person("สมชาย ทดสอบผู้ต้องสงสัย", "SUSPECT")],
      seizedItems: [countItem(1000), countItem(500), massItem(2500)],
      participatingUnits: [{ headquartersId: null, regionId: null, battalionId: null, companyId: null, unitText: "สภ.ท่าแซะ", role: "PARTICIPATING", note: null }],
      officers: [
        { officerId: null, manualRank: null, manualFullName: "ทดสอบ หนึ่ง", manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null },
        { officerId: null, manualRank: null, manualFullName: "ทดสอบ สอง", manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null },
      ],
    })
  );
  const links = (await db.drugCasePerson.findMany({ where: { caseId: created.caseId } })) as Array<{ personId: string }>;
  assert.equal(links.length, 2, "fixture should create two case-person links");
  if (links[0]) {
    await db.drugPersonIdentifier.create({
      data: { id: "id-secret", personId: links[0].personId, type: "THAI_ID", value: "1101700123456", createdBy: "qa" },
    });
  }
  const result = await new DrugMapCaseDetailService(db).load(created.caseId);
  assert.equal(result.case.caseNumber, "MAP-6C-001");
  assert.equal(result.persons.items.length, 2);
  assert.equal(result.persons.items[0]?.displayName, "สมชาย ทดสอบผู้ต้องสงสัย");
  assert.equal(result.persons.items[0]?.role, "SUSPECT");
  assert.equal(result.persons.items[1]?.role, "WITNESS");
  assert.equal(result.seizures.items.length, 2);
  const countGroup = result.seizures.items.find((row) => row.measurementKind === "COUNT");
  const massGroup = result.seizures.items.find((row) => row.measurementKind === "MASS");
  assert.equal(countGroup?.quantity, 1500);
  assert.equal(countGroup?.displayUnit, "เม็ด");
  assert.equal(massGroup?.quantity, 2.5);
  assert.equal(massGroup?.displayUnit, "กก.");
  assert.equal(result.participatingUnits.items[0]?.unitName, "สภ.ท่าแซะ");
  assert.equal(result.officers.count, 2);
  const json = JSON.stringify(result);
  for (const key of SENSITIVE) assert.doesNotMatch(json, new RegExp(`"${key}"`, "i"));
  assert.doesNotMatch(json, /1101700123456/);
  assert.doesNotMatch(json, /บันทึกภายใน/);
  assert.doesNotMatch(json, /seizure-note/);
  const detailBytes = Buffer.byteLength(json);
  assert.ok(detailBytes < 15 * 1024, `detail payload ${detailBytes} bytes`);
});

test("empty relation sections stay empty and capped relations disclose truncation", async () => {
  const db = new InMemoryDatabaseClient();
  const empty = await new DrugCaseService({ db }).createCase(baseCase({ caseNumber: "MAP-6C-EMPTY" }));
  const emptyResult = await new DrugMapCaseDetailService(db).load(empty.caseId);
  assert.equal(emptyResult.persons.items.length, 0);
  assert.equal(emptyResult.seizures.items.length, 0);
  assert.equal(emptyResult.participatingUnits.items.length, 0);
  assert.equal(emptyResult.officers.count, 0);

  async function loadCase(suffix: string, overrides: Partial<DrugCaseCreateRequest>) {
    const created = await new DrugCaseService({ db }).createCase(baseCase({ caseNumber: `MAP-6C-${suffix}`, ...overrides }));
    return new DrugMapCaseDetailService(db).load(created.caseId);
  }

  const personExact = await loadCase("P20", {
    persons: Array.from({ length: MAP_DETAIL_PERSON_CAP }, (_, i) => person(`บุคคล ${String(i).padStart(2, "0")}`)),
  });
  assert.equal(personExact.persons.displayedCount, MAP_DETAIL_PERSON_CAP);
  assert.equal(personExact.persons.truncated, false);
  assert.equal(personExact.persons.totalCount, MAP_DETAIL_PERSON_CAP);

  const personOver = await loadCase("P21", {
    persons: Array.from({ length: MAP_DETAIL_PERSON_CAP + 1 }, (_, i) => person(`บุคคลเกิน ${String(i).padStart(2, "0")}`)),
  });
  assert.equal(personOver.persons.displayedCount, MAP_DETAIL_PERSON_CAP);
  assert.equal(personOver.persons.truncated, true);
  assert.equal(personOver.persons.totalCount, null);
  assert.equal(personOver.persons.items[0]?.displayName, "บุคคลเกิน 00");

  const seizureExact = await loadCase("S20", {
    seizedItems: Array.from({ length: MAP_DETAIL_SEIZURE_GROUP_CAP }, (_, i) => countItem(i + 1, `หน่วยนับ ${i}`)),
  });
  assert.equal(seizureExact.seizures.displayedCount, MAP_DETAIL_SEIZURE_GROUP_CAP);
  assert.equal(seizureExact.seizures.truncated, false);

  const seizureOver = await loadCase("S21", {
    seizedItems: Array.from({ length: MAP_DETAIL_SEIZURE_GROUP_CAP + 1 }, (_, i) => countItem(i + 1, `หน่วยเกิน ${i}`)),
  });
  assert.equal(seizureOver.seizures.displayedCount, MAP_DETAIL_SEIZURE_GROUP_CAP);
  assert.equal(seizureOver.seizures.truncated, true);
  assert.equal(seizureOver.seizures.totalCount, MAP_DETAIL_SEIZURE_GROUP_CAP + 1);

  const unitExact = await loadCase("U20", {
    participatingUnits: Array.from({ length: MAP_DETAIL_UNIT_CAP }, (_, i) => ({
      headquartersId: null,
      regionId: null,
      battalionId: null,
      companyId: null,
      unitText: `หน่วยร่วม ${String(i).padStart(2, "0")}`,
      role: "PARTICIPATING",
      note: null,
    })),
  });
  assert.equal(unitExact.participatingUnits.displayedCount, MAP_DETAIL_UNIT_CAP);
  assert.equal(unitExact.participatingUnits.truncated, false);
  assert.equal(unitExact.participatingUnits.items[0]?.unitName, "หน่วยร่วม 00");

  const unitOver = await loadCase("U21", {
    participatingUnits: Array.from({ length: MAP_DETAIL_UNIT_CAP + 1 }, (_, i) => ({
      headquartersId: null,
      regionId: null,
      battalionId: null,
      companyId: null,
      unitText: `หน่วยเกิน ${String(i).padStart(2, "0")}`,
      role: "PARTICIPATING",
      note: null,
    })),
  });
  assert.equal(unitOver.participatingUnits.displayedCount, MAP_DETAIL_UNIT_CAP);
  assert.equal(unitOver.participatingUnits.truncated, true);
  assert.equal(unitOver.participatingUnits.totalCount, null);
});

test("query count stays fixed for 1 vs 20 relation rows", async () => {
  async function measure(personCount: number, seizureCount: number, unitCount: number, officerCount: number) {
    const db = new InMemoryDatabaseClient();
    const created = await new DrugCaseService({ db }).createCase(
      baseCase({
        caseNumber: `MAP-6C-Q${personCount}`,
        persons: Array.from({ length: personCount }, (_, i) => person(`P${i}`)),
        seizedItems: Array.from({ length: seizureCount }, () => countItem(10)),
        participatingUnits: Array.from({ length: unitCount }, (_, i) => ({
          headquartersId: null,
          regionId: null,
          battalionId: null,
          companyId: null,
          unitText: `หน่วย ${i}`,
          role: "PARTICIPATING",
          note: null,
        })),
        officers: Array.from({ length: officerCount }, (_, i) => ({
          officerId: null,
          manualRank: null,
          manualFullName: `เจ้าหน้าที่ ${i}`,
          manualPosition: null,
          manualUnitText: null,
          role: "SUPPORT",
          note: null,
        })),
      })
    );
    const counted = countingDatabase(db);
    await new DrugMapCaseDetailService(counted.db).load(created.caseId);
    return counted.queries();
  }

  const one = await measure(1, 1, 1, 1);
  const twenty = await measure(20, 20, 20, 20);
  assert.equal(one, twenty);
  assert.ok(one <= MAP_DETAIL_MAX_DB_CALLS, `queries ${one}`);
  assert.ok(one <= 6, `preferred <=6, got ${one}`);
});
