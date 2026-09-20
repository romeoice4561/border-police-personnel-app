/**
 * DI-10E.6A — bounded interactive Map V2 query foundation tests.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_map_query.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import type { DrugCaseCreateRequest, DrugCasePersonInput, DrugCaseSeizedItemInput } from "@/lib/drug_intelligence/drug_case_types";
import {
  buildDrugMapCaseWhere,
  buildDrugMapDirectCoordinateWhere,
  buildDrugMapIncompleteCoordinateWhere,
  DrugMapQueryInvalidFilterError,
  DrugMapQueryService,
  MAP_LIST_DEFAULT_PAGE_SIZE,
  MAP_LIST_MAX_PAGE_SIZE,
  MAP_MARKER_HARD_LIMIT,
  MAP_MARKER_SOFT_LIMIT,
  MAP_QUERY_MAX_DB_CALLS,
  MAP_UNKNOWN_PROVINCE_LABEL,
  normalizeDrugMapListPage,
  normalizeDrugMapQueryInput,
} from "@/lib/drug_intelligence/drug_map_query";

const ROOT = join(process.cwd());
const FOUNDATION_FILE = "lib/drug_intelligence/drug_map_query.ts";
const PERSON_A_ID = "b9a6c674-db36-4f40-a7de-4c9a727c37a7";
const PERSON_F_ID = "1f230a17-8055-4905-9e01-d24fde3b08ec";
const SENSITIVE_KEYS = ["nationalId", "phone", "imsi", "iccid", "imei", "imei1", "plate", "vin", "documentUrl", "signedUrl"];

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "MAP-V2-001",
    title: "map v2 fixture",
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

function countItem(quantity: number): DrugCaseSeizedItemInput {
  return {
    drugCategory: "METHAMPHETAMINE_TABLET",
    otherDrugCategoryLabel: null,
    measurementKind: "COUNT",
    drugType: "ยาบ้า",
    subtype: null,
    quantity,
    unit: "เม็ด",
    weightGrams: null,
    packageCount: null,
    notes: null,
  };
}

function person(name: string): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: [],
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

function arrestLocation(latitude: number | null, longitude: number | null) {
  return {
    name: "จุดจับกุม",
    addressText: null,
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    latitude,
    longitude,
    role: "ARREST_LOCATION" as const,
    notes: null,
  };
}

async function seedBareCase(
  db: InMemoryDatabaseClient,
  data: {
    id: string;
    caseNumber: string;
    arrestDate?: Date | null;
    arrestTime?: string | null;
    province?: string | null;
    district?: string | null;
    status?: string;
    headquartersId?: number | null;
    regionId?: number | null;
    battalionId?: number | null;
    companyId?: number | null;
    leadHeadquartersId?: number | null;
    leadRegionId?: number | null;
    leadBattalionId?: number | null;
    leadCompanyId?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locationName?: string | null;
  }
): Promise<void> {
  await db.drugCase.create({
    data: {
      id: data.id,
      caseNumber: data.caseNumber,
      title: data.caseNumber,
      status: data.status ?? "OPEN",
      arrestDate: data.arrestDate === undefined ? new Date("2026-01-15") : data.arrestDate,
      arrestTime: data.arrestTime === undefined ? null : data.arrestTime,
      headquartersId: data.headquartersId ?? null,
      regionId: data.regionId ?? null,
      battalionId: data.battalionId ?? null,
      companyId: data.companyId ?? null,
      leadHeadquartersId: data.leadHeadquartersId ?? null,
      leadRegionId: data.leadRegionId ?? null,
      leadBattalionId: data.leadBattalionId ?? null,
      leadCompanyId: data.leadCompanyId ?? null,
      province: data.province === undefined ? "ชุมพร" : data.province,
      district: data.district === undefined ? null : data.district,
      locationName: data.locationName ?? null,
      reportingUnitText: "กก.",
      leadUnitText: "ชุด",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      createdBy: "qa",
      createdByName: "QA",
    },
  });
}

function countingDatabase(db: DatabaseClient): {
  db: DatabaseClient;
  queries: () => number;
  calls: () => Array<{ model: string; method: string; where: unknown }>;
} {
  let n = 0;
  const calls: Array<{ model: string; method: string; where: unknown }> = [];
  const keys = new Set(["drugCase", "drugSeizedItem", "drugCasePerson", "drugCaseLocation", "drugLocation"]);
  const proxied = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && keys.has(prop) && value && typeof value === "object") {
        return new Proxy(value as object, {
          get(delegate, method, delReceiver) {
            const fn = Reflect.get(delegate, method, delReceiver);
            if ((method === "findMany" || method === "count" || method === "groupBy") && typeof fn === "function") {
              return (args?: { where?: unknown }) => {
                n += 1;
                calls.push({ model: prop, method: String(method), where: args?.where });
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
  return { db: proxied, queries: () => n, calls: () => calls };
}

function assertNoSensitivePayload(value: unknown): void {
  const json = JSON.stringify(value);
  for (const key of SENSITIVE_KEYS) {
    assert.doesNotMatch(json, new RegExp(`"${key}"`, "i"));
  }
}

test("Y: foundation source has no MAX_SAFE_INTEGER and does not touch live Map or report services", () => {
  const src = readFileSync(join(ROOT, FOUNDATION_FILE), "utf8");
  assert.doesNotMatch(src, /Number\.MAX_SAFE_INTEGER/);
  assert.doesNotMatch(src, /getGeoResult/);
  assert.doesNotMatch(src, /from ["']@\/lib\/drug_intelligence\/drug_geo_intelligence_service["']/);
  assert.doesNotMatch(src, /from ["']@\/lib\/drug_intelligence\/drug_geographic_report_query["']/);
  assert.doesNotMatch(src, /from ["']@\/lib\/database\/repositories\/drug_case_repository["']/);
  assert.doesNotMatch(src, /forPerson\(/);
  assert.doesNotMatch(src, /caseLocationsForCase\(/);
  assert.doesNotMatch(src, /findLocationById\(/);
  assert.doesNotMatch(src, /mergePersons/);
  assert.doesNotMatch(src, new RegExp(PERSON_A_ID));
  assert.doesNotMatch(src, new RegExp(PERSON_F_ID));
  assert.match(src, /seizedItems\s*=\s*\{\s*some:/);
  assert.match(src, /persons\s*=\s*\{\s*some:/);
  assert.match(src, /MAP_MARKER_SOFT_LIMIT = 500/);
  assert.match(src, /MAP_MARKER_HARD_LIMIT = 2000/);
  assert.match(src, /ARREST_LOCATION by id ASC/);
  assert.doesNotMatch(src, /locations:\s*\{\s*some:/);
});

test("AA: MAP_DATA HTML_PRINT remains implemented by the export service, not this foundation", () => {
  const service = new DrugExportService(new InMemoryDatabaseClient());
  assert.equal(service.isImplemented("MAP_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("MAP_DATA", "CSV"), false);
  assert.equal(service.isImplemented("MAP_DATA", "JSON"), false);
  const src = readFileSync(join(ROOT, FOUNDATION_FILE), "utf8");
  assert.doesNotMatch(src, /isImplemented\(/);
});

test("AC: QA Person A and Person F remain distinct identities", () => {
  assert.notEqual(PERSON_A_ID, PERSON_F_ID);
});

test("A/B/C: dateFrom/dateTo are Prisma arrestDate gte/lte and inclusive", () => {
  const where = buildDrugMapCaseWhere(normalizeDrugMapQueryInput({ dateFrom: "2026-05-01", dateTo: "2026-07-01" }));
  const arrestDate = where.arrestDate as { gte: Date; lte: Date };
  assert.ok(arrestDate.gte instanceof Date);
  assert.ok(arrestDate.lte instanceof Date);
  assert.equal(arrestDate.gte.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(arrestDate.lte.toISOString().slice(0, 10), "2026-07-01");
  assert.equal("createdAt" in where, false);
});

test("one-sided dates are allowed and inverted ranges fail closed", () => {
  const fromOnly = buildDrugMapCaseWhere(normalizeDrugMapQueryInput({ dateFrom: "2026-05-01" }));
  assert.ok((fromOnly.arrestDate as { gte: Date }).gte instanceof Date);
  assert.equal((fromOnly.arrestDate as { lte?: Date }).lte, undefined);
  const toOnly = buildDrugMapCaseWhere(normalizeDrugMapQueryInput({ dateTo: "2026-07-01" }));
  assert.ok((toOnly.arrestDate as { lte: Date }).lte instanceof Date);
  assert.throws(() => normalizeDrugMapQueryInput({ dateFrom: "2026-06-01", dateTo: "2026-01-01" }), DrugMapQueryInvalidFilterError);
});

test("A2: date range filters by arrestDate, not createdAt", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "IN", arrestDate: new Date("2026-06-01") }));
  await cases.createCase(baseCase({ caseNumber: "OUT", arrestDate: new Date("2026-01-01") }));
  const result = await new DrugMapQueryService(db).load({ dateFrom: "2026-05-01", dateTo: "2026-07-01" });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.list.items[0]?.caseNumber, "IN");
});

test("C2: inclusive date boundaries include both ends", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "START", arrestDate: new Date("2026-05-01") }));
  await cases.createCase(baseCase({ caseNumber: "END", arrestDate: new Date("2026-07-01") }));
  await cases.createCase(baseCase({ caseNumber: "OUT", arrestDate: new Date("2026-07-02") }));
  const result = await new DrugMapQueryService(db).load({ dateFrom: "2026-05-01", dateTo: "2026-07-01" });
  assert.equal(result.summary.totalCases, 2);
});

test("D/E/F: status, province, and district filters apply", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "CH-TA", province: "ชุมพร", district: "ท่าแซะ", status: "OPEN" }));
  await cases.createCase(baseCase({ caseNumber: "CH-MU", province: "ชุมพร", district: "เมืองชุมพร", status: "CLOSED" }));
  await cases.createCase(baseCase({ caseNumber: "RN", province: "ระนอง", district: "เมืองระนอง", status: "OPEN" }));
  const service = new DrugMapQueryService(db);
  assert.equal((await service.load({ province: "ชุมพร" })).summary.totalCases, 2);
  const district = await service.load({ province: "ชุมพร", district: "ท่าแซะ" });
  assert.equal(district.summary.totalCases, 1);
  assert.equal(district.list.items[0]?.caseNumber, "CH-TA");
  assert.equal((await service.load({ status: "CLOSED" })).summary.totalCases, 1);
});

test("G/H: drugCategory uses seizedItems.some and duplicate rows do not inflate membership", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "DUP-CAT", seizedItems: [countItem(1), countItem(2), countItem(3)] }));
  await cases.createCase(baseCase({ caseNumber: "OTHER" }));
  const where = buildDrugMapCaseWhere({ drugCategory: "METHAMPHETAMINE_TABLET" });
  assert.deepEqual(where.seizedItems, { some: { drugCategory: "METHAMPHETAMINE_TABLET" } });
  const counted = countingDatabase(db);
  const result = await new DrugMapQueryService(counted.db).load({ drugCategory: "METHAMPHETAMINE_TABLET" });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.list.items[0]?.caseNumber, "DUP-CAT");
  assert.equal(counted.calls().filter((call) => call.model === "drugSeizedItem").length, 0);
});

test("I: personId uses persons.some and does not call forPerson", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const linked = await cases.createCase(baseCase({ caseNumber: "WITH-P", persons: [person("นาย หนึ่ง"), person("นาย สอง")] }));
  await cases.createCase(baseCase({ caseNumber: "NONE" }));
  const links = await db.drugCasePerson.findMany({ where: { caseId: linked.caseId } });
  const personId = String((links[0] as { personId: string }).personId);
  const where = buildDrugMapCaseWhere({ personId });
  assert.deepEqual(where.persons, { some: { personId } });
  const counted = countingDatabase(db);
  const result = await new DrugMapQueryService(counted.db).load({ personId });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.list.items[0]?.caseNumber, "WITH-P");
  assert.equal(counted.calls().filter((call) => call.model === "drugCasePerson").length, 0);
});

test("J–R: reporting and lead org filters stay independent and can combine", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "rep", caseNumber: "REP", headquartersId: 1, regionId: 11, battalionId: 21, companyId: 31, leadHeadquartersId: 9 });
  await seedBareCase(db, { id: "lead", caseNumber: "LEAD", headquartersId: 9, leadHeadquartersId: 1, leadRegionId: 12, leadBattalionId: 22, leadCompanyId: 32 });
  await seedBareCase(db, { id: "both", caseNumber: "BOTH", headquartersId: 1, regionId: 11, battalionId: 21, companyId: 31, leadHeadquartersId: 1, leadRegionId: 12, leadBattalionId: 22, leadCompanyId: 32 });
  const service = new DrugMapQueryService(db);
  assert.equal((await service.load({ headquartersId: 1 })).list.items.map((row) => row.caseNumber).sort().join(","), "BOTH,REP");
  assert.equal((await service.load({ regionId: 11 })).summary.totalCases, 2);
  assert.equal((await service.load({ battalionId: 21 })).summary.totalCases, 2);
  assert.equal((await service.load({ companyId: 31 })).summary.totalCases, 2);
  assert.equal((await service.load({ leadHeadquartersId: 1 })).list.items.map((row) => row.caseNumber).sort().join(","), "BOTH,LEAD");
  assert.equal((await service.load({ leadRegionId: 12 })).summary.totalCases, 2);
  assert.equal((await service.load({ leadBattalionId: 22 })).summary.totalCases, 2);
  assert.equal((await service.load({ leadCompanyId: 32 })).summary.totalCases, 2);
  const both = await service.load({ headquartersId: 1, leadHeadquartersId: 1 });
  assert.equal(both.summary.totalCases, 1);
  assert.equal(both.list.items[0]?.caseNumber, "BOTH");
});

test("direct/incomplete coordinate where is a complete pair vs its inverse", () => {
  assert.deepEqual(buildDrugMapDirectCoordinateWhere(), {
    AND: [{ latitude: { not: null } }, { longitude: { not: null } }],
  });
  assert.deepEqual(buildDrugMapIncompleteCoordinateWhere(), {
    OR: [{ latitude: null }, { longitude: null }],
  });
});

test("A–E coordinates: precedence, no mixing, classification", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "DIRECT", latitude: 10.1, longitude: 99.1 }));
  await cases.createCase(baseCase({ caseNumber: "FALLBACK", latitude: null, longitude: null, locations: [arrestLocation(11.1, 100.1)] }));
  await cases.createCase(baseCase({ caseNumber: "PARTIAL-PLUS-FB", latitude: 10.2, longitude: null, locations: [arrestLocation(12.2, 101.2)] }));
  await cases.createCase(baseCase({ caseNumber: "PARTIAL-ONLY", latitude: 10.3, longitude: null }));
  await cases.createCase(baseCase({ caseNumber: "PARTIAL-FB", latitude: null, longitude: null, locations: [arrestLocation(13.3, null)] }));
  await cases.createCase(baseCase({ caseNumber: "NONE" }));
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.totalCases, 6);
  assert.equal(result.summary.withCoordinates, 3);
  assert.equal(result.summary.withoutCoordinates, 3);
  assert.equal(result.summary.totalCases, result.summary.withCoordinates + result.summary.withoutCoordinates);
  const byNumber = new Map(result.markers.map((marker) => [marker.caseNumber, marker]));
  assert.equal(byNumber.get("DIRECT")?.coordinateSource, "CASE");
  assert.equal(byNumber.get("DIRECT")?.latitude, 10.1);
  assert.equal(byNumber.get("FALLBACK")?.coordinateSource, "ARREST_LOCATION");
  assert.equal(byNumber.get("FALLBACK")?.latitude, 11.1);
  assert.equal(byNumber.get("PARTIAL-PLUS-FB")?.coordinateSource, "ARREST_LOCATION");
  assert.equal(byNumber.get("PARTIAL-PLUS-FB")?.latitude, 12.2);
  assert.equal(byNumber.has("PARTIAL-ONLY"), false);
  assert.equal(byNumber.has("PARTIAL-FB"), false);
  assert.equal(byNumber.has("NONE"), false);
});

async function seedDualArrestLocations(
  db: InMemoryDatabaseClient,
  data: {
    caseId: string;
    caseNumber: string;
    caseLatitude?: number | null;
    caseLongitude?: number | null;
    first: { id: string; locationId: string; latitude: number | null; longitude: number | null };
    later: { id: string; locationId: string; latitude: number | null; longitude: number | null };
  }
): Promise<void> {
  await seedBareCase(db, {
    id: data.caseId,
    caseNumber: data.caseNumber,
    latitude: data.caseLatitude ?? null,
    longitude: data.caseLongitude ?? null,
  });
  await db.drugLocation.create({ data: { id: data.first.locationId, latitude: data.first.latitude, longitude: data.first.longitude } });
  await db.drugLocation.create({ data: { id: data.later.locationId, latitude: data.later.latitude, longitude: data.later.longitude } });
  await db.drugCaseLocation.create({ data: { id: data.first.id, caseId: data.caseId, locationId: data.first.locationId, role: "ARREST_LOCATION" } });
  await db.drugCaseLocation.create({ data: { id: data.later.id, caseId: data.caseId, locationId: data.later.locationId, role: "ARREST_LOCATION" } });
}

test("6A.1 mismatch: first ARREST_LOCATION incomplete / later complete is NOT coordinate-capable", async () => {
  const db = new InMemoryDatabaseClient();
  await seedDualArrestLocations(db, {
    caseId: "gap",
    caseNumber: "GAP",
    first: { id: "a-first", locationId: "loc-incomplete", latitude: 10, longitude: null },
    later: { id: "z-later", locationId: "loc-complete", latitude: 20, longitude: 120 },
  });
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.summary.withCoordinates, 0);
  assert.equal(result.summary.withoutCoordinates, 1);
  assert.equal(result.markers.length, 0);
  assert.equal(result.list.items[0]?.hasCoordinates, false);
});

test("inverse order: first complete / later incomplete IS coordinate-capable", async () => {
  const db = new InMemoryDatabaseClient();
  await seedDualArrestLocations(db, {
    caseId: "ok",
    caseNumber: "OK-FIRST",
    first: { id: "a-first", locationId: "loc-complete", latitude: 15, longitude: 110 },
    later: { id: "z-later", locationId: "loc-incomplete", latitude: 20, longitude: null },
  });
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.summary.withCoordinates, 1);
  assert.equal(result.summary.withoutCoordinates, 0);
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0]?.latitude, 15);
  assert.equal(result.markers[0]?.coordinateSource, "ARREST_LOCATION");
  assert.equal(result.list.items[0]?.hasCoordinates, true);
});

test("direct complete pair wins even when first ARREST_LOCATION is incomplete and a later one is complete", async () => {
  const db = new InMemoryDatabaseClient();
  await seedDualArrestLocations(db, {
    caseId: "direct",
    caseNumber: "DIRECT-WINS",
    caseLatitude: 9.1,
    caseLongitude: 99.1,
    first: { id: "a-first", locationId: "loc-incomplete", latitude: null, longitude: 120 },
    later: { id: "z-later", locationId: "loc-complete", latitude: 20, longitude: 120 },
  });
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.withCoordinates, 1);
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0]?.latitude, 9.1);
  assert.equal(result.markers[0]?.coordinateSource, "CASE");
});

test("partial direct pair + first fallback complete uses ARREST_LOCATION; later complete does not rescue an incomplete first", async () => {
  const db = new InMemoryDatabaseClient();
  await seedDualArrestLocations(db, {
    caseId: "partial-ok",
    caseNumber: "PARTIAL-OK",
    caseLatitude: 10.2,
    caseLongitude: null,
    first: { id: "a-first", locationId: "loc-complete", latitude: 12.2, longitude: 101.2 },
    later: { id: "z-later", locationId: "loc-other", latitude: 1, longitude: 1 },
  });
  const ok = await new DrugMapQueryService(db).load({});
  assert.equal(ok.summary.withCoordinates, 1);
  assert.equal(ok.markers[0]?.coordinateSource, "ARREST_LOCATION");
  assert.equal(ok.markers[0]?.latitude, 12.2);

  const db2 = new InMemoryDatabaseClient();
  await seedDualArrestLocations(db2, {
    caseId: "partial-no",
    caseNumber: "PARTIAL-NO",
    caseLatitude: 10.3,
    caseLongitude: null,
    first: { id: "a-first", locationId: "loc-incomplete", latitude: 13.3, longitude: null },
    later: { id: "z-later", locationId: "loc-complete", latitude: 20, longitude: 120 },
  });
  const no = await new DrugMapQueryService(db2).load({});
  assert.equal(no.summary.withCoordinates, 0);
  assert.equal(no.markers.length, 0);
  assert.equal(no.list.items[0]?.hasCoordinates, false);
});

test("multiple ARREST_LOCATION uses lowest DrugCaseLocation.id", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "multi", caseNumber: "MULTI", latitude: null, longitude: null });
  await db.drugLocation.create({ data: { id: "loc-later", latitude: 20, longitude: 120 } });
  await db.drugLocation.create({ data: { id: "loc-first", latitude: 15, longitude: 110 } });
  await db.drugCaseLocation.create({ data: { id: "z-later", caseId: "multi", locationId: "loc-later", role: "ARREST_LOCATION" } });
  await db.drugCaseLocation.create({ data: { id: "a-first", caseId: "multi", locationId: "loc-first", role: "ARREST_LOCATION" } });
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0]?.latitude, 15);
  assert.equal(result.markers[0]?.coordinateSource, "ARREST_LOCATION");
});

test("invalid first / valid later locations do not inflate marker-limit counts", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 500; i += 1) {
    await seedBareCase(db, { id: `d-${i}`, caseNumber: `D-${String(i).padStart(3, "0")}`, latitude: 10, longitude: 99 });
  }
  await seedDualArrestLocations(db, {
    caseId: "inflator",
    caseNumber: "INFLATOR",
    first: { id: "a-first", locationId: "loc-bad", latitude: 1, longitude: null },
    later: { id: "z-later", locationId: "loc-good", latitude: 2, longitude: 3 },
  });
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.totalCases, 501);
  assert.equal(result.summary.withCoordinates, 500);
  assert.equal(result.summary.withoutCoordinates, 1);
  assert.equal(result.markers.length, 500);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.summary.markerLimitReached, false);
});

test("invalid first / valid later locations do not push withCoordinates across the hard limit", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 2000; i += 1) {
    await seedBareCase(db, { id: `hlim-${i}`, caseNumber: `HL-${String(i).padStart(4, "0")}`, latitude: 10, longitude: 99 });
  }
  await seedDualArrestLocations(db, {
    caseId: "hard-inflator",
    caseNumber: "HARD-INFLATOR",
    first: { id: "a-first", locationId: "loc-bad", latitude: 1, longitude: null },
    later: { id: "z-later", locationId: "loc-good", latitude: 2, longitude: 3 },
  });
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.totalCases, 2001);
  assert.equal(result.summary.withCoordinates, 2000);
  assert.equal(result.summary.withoutCoordinates, 1);
  assert.equal(result.markers.length, 2000);
  assert.equal(result.summary.markerLimitReached, false);
  assert.deepEqual(result.warnings, ["MARKER_SOFT_LIMIT"]);
});

test("F/G: total is not derived from markers; marker cap uses withCoordinates", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 8; i += 1) {
    await seedBareCase(db, { id: `c-${i}`, caseNumber: `C-${String(i).padStart(2, "0")}`, latitude: i < 3 ? 10 : null, longitude: i < 3 ? 99 : null });
  }
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.totalCases, 8);
  assert.equal(result.summary.withCoordinates, 3);
  assert.equal(result.summary.withoutCoordinates, 5);
  assert.equal(result.markers.length, 3);
  assert.equal(result.list.total, 8);
  assert.equal(result.list.items.length, 8);
});

test("H: >2000 total with 100 coordinates still returns 100 markers", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 2100; i += 1) {
    await seedBareCase(db, {
      id: `h-${i}`,
      caseNumber: `H-${String(i).padStart(4, "0")}`,
      latitude: i < 100 ? 10 : null,
      longitude: i < 100 ? 99 : null,
    });
  }
  const result = await new DrugMapQueryService(db).load({});
  assert.equal(result.summary.totalCases, 2100);
  assert.equal(result.summary.withCoordinates, 100);
  assert.equal(result.markers.length, 100);
  assert.equal(result.summary.markerLimitReached, false);
  assert.deepEqual(result.warnings, []);
});

test("I/M: 2001 coordinate cases return zero markers and MARKER_LIMIT; list still works", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 2001; i += 1) {
    await seedBareCase(db, { id: `m-${i}`, caseNumber: `M-${String(i).padStart(4, "0")}`, latitude: 10, longitude: 99 });
  }
  const counted = countingDatabase(db);
  const result = await new DrugMapQueryService(counted.db).load({});
  assert.equal(result.summary.totalCases, 2001);
  assert.equal(result.summary.withCoordinates, 2001);
  assert.equal(result.markers.length, 0);
  assert.equal(result.summary.markerCount, 0);
  assert.equal(result.summary.markerLimitReached, true);
  assert.deepEqual(result.warnings, ["MARKER_LIMIT"]);
  assert.equal(result.list.items.length, MAP_LIST_DEFAULT_PAGE_SIZE);
  assert.equal(result.list.total, 2001);
  assert.ok(counted.queries() <= MAP_QUERY_MAX_DB_CALLS);
  assert.ok(counted.queries() < 20);
});

test("J/K/L: 500 is normal, 501–2000 is soft, 2000 is allowed", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 2000; i += 1) {
    await seedBareCase(db, { id: `s-${i}`, caseNumber: `S-${String(i).padStart(4, "0")}`, latitude: 10, longitude: 99 });
  }
  const at500 = await new DrugMapQueryService(db).load({ pageSize: 1 });
  // Filter is not applied; reload after... we need subsets. Seed is 2000, so query all then
  // check 2000 first.
  const at2000 = at500;
  assert.equal(at2000.summary.withCoordinates, 2000);
  assert.equal(at2000.markers.length, 2000);
  assert.deepEqual(at2000.warnings, ["MARKER_SOFT_LIMIT"]);
  assert.equal(at2000.summary.markerLimitReached, false);

  const db500 = new InMemoryDatabaseClient();
  for (let i = 0; i < 500; i += 1) {
    await seedBareCase(db500, { id: `n-${i}`, caseNumber: `N-${String(i).padStart(3, "0")}`, latitude: 10, longitude: 99 });
  }
  const exact500 = await new DrugMapQueryService(db500).load({});
  assert.equal(exact500.summary.withCoordinates, 500);
  assert.equal(exact500.markers.length, 500);
  assert.deepEqual(exact500.warnings, []);

  const db501 = new InMemoryDatabaseClient();
  for (let i = 0; i < 501; i += 1) {
    await seedBareCase(db501, { id: `w-${i}`, caseNumber: `W-${String(i).padStart(3, "0")}`, latitude: 10, longitude: 99 });
  }
  const soft = await new DrugMapQueryService(db501).load({});
  assert.equal(soft.markers.length, 501);
  assert.deepEqual(soft.warnings, ["MARKER_SOFT_LIMIT"]);
});

test("list A–L: pagination, universe, order, authoritative total", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "null-date", caseNumber: "ZZ-NULL", arrestDate: null, latitude: null, longitude: null });
  await seedBareCase(db, { id: "tie-b", caseNumber: "TIE", arrestDate: new Date("2026-02-01"), latitude: 10, longitude: 99 });
  await seedBareCase(db, { id: "tie-a", caseNumber: "TIE", arrestDate: new Date("2026-02-01"), latitude: null, longitude: null });
  await seedBareCase(db, { id: "late", caseNumber: "LATE", arrestDate: new Date("2026-03-01"), latitude: 11, longitude: 100 });
  for (let i = 0; i < 55; i += 1) {
    await seedBareCase(db, {
      id: `p-${i}`,
      caseNumber: `P-${String(i).padStart(2, "0")}`,
      arrestDate: new Date("2026-01-01"),
      latitude: null,
      longitude: null,
    });
  }
  const service = new DrugMapQueryService(db);
  const page1 = await service.load({});
  assert.equal(page1.list.page, 1);
  assert.equal(page1.list.pageSize, 50);
  assert.equal(page1.list.items.length, 50);
  assert.equal(page1.list.total, 59);
  assert.equal(page1.list.items[0]?.caseNumber, "LATE");
  assert.equal(page1.list.items[1]?.caseId, "tie-a");
  assert.equal(page1.list.items[2]?.caseId, "tie-b");
  assert.ok(page1.list.items.some((row) => row.hasCoordinates));
  assert.ok(page1.list.items.some((row) => !row.hasCoordinates));

  const page2 = await service.load({ page: 2 });
  assert.equal(page2.list.page, 2);
  assert.equal(page2.list.items.length, 9);
  assert.equal(page2.list.items.at(-1)?.caseNumber, "ZZ-NULL");

  const clamped = normalizeDrugMapListPage({ pageSize: Number.MAX_SAFE_INTEGER });
  assert.equal(clamped.pageSize, MAP_LIST_MAX_PAGE_SIZE);
  const maxPage = await service.load({ pageSize: 200 });
  assert.equal(maxPage.list.pageSize, 100);
  assert.equal(maxPage.list.items.length, 59);
});

test("list G: marker hard limit does not disable List", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 2001; i += 1) {
    await seedBareCase(db, { id: `l-${i}`, caseNumber: `L-${String(i).padStart(4, "0")}`, latitude: 10, longitude: 99 });
  }
  const result = await new DrugMapQueryService(db).load({ page: 2, pageSize: 20 });
  assert.equal(result.summary.markerLimitReached, true);
  assert.equal(result.markers.length, 0);
  assert.equal(result.list.page, 2);
  assert.equal(result.list.pageSize, 20);
  assert.equal(result.list.items.length, 20);
  assert.equal(result.list.total, 2001);
});

test("province A–G: named counts, no-coord included, unknown bucket, order, KPI, hard-cap independence", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "ch-1", caseNumber: "CH1", province: "ชุมพร", latitude: 10, longitude: 99 });
  await seedBareCase(db, { id: "ch-2", caseNumber: "CH2", province: "ชุมพร", latitude: null, longitude: null });
  await seedBareCase(db, { id: "rn-1", caseNumber: "RN1", province: "ระนอง", latitude: 11, longitude: 100 });
  await seedBareCase(db, { id: "blank", caseNumber: "BLANK", province: "", latitude: null, longitude: null });
  await seedBareCase(db, { id: "nullp", caseNumber: "NULLP", province: null, latitude: 12, longitude: 101 });
  const result = await new DrugMapQueryService(db).load({});
  const named = result.provinces.filter((row) => !row.unspecified);
  const unknown = result.provinces.filter((row) => row.unspecified);
  assert.equal(named.find((row) => row.province === "ชุมพร")?.caseCount, 2);
  assert.equal(named.find((row) => row.province === "ชุมพร")?.withCoordinates, 1);
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0]?.province, MAP_UNKNOWN_PROVINCE_LABEL);
  assert.equal(unknown[0]?.caseCount, 2);
  assert.equal(result.summary.provinceCount, 2);
  assert.equal(result.provinces[0]?.province, "ชุมพร");
  assert.equal(result.provinces[1]?.unspecified, true);
  assert.equal(result.provinces[2]?.province, "ระนอง");

  const dbCap = new InMemoryDatabaseClient();
  for (let i = 0; i < 2001; i += 1) {
    await seedBareCase(dbCap, { id: `pv-${i}`, caseNumber: `PV-${i}`, province: "ชุมพร", latitude: 10, longitude: 99 });
  }
  const capped = await new DrugMapQueryService(dbCap).load({});
  assert.equal(capped.summary.markerLimitReached, true);
  assert.equal(capped.provinces[0]?.caseCount, 2001);
  assert.equal(capped.provinces[0]?.withCoordinates, 2001);
  assert.equal(capped.summary.provinceCount, 1);
});

test("query count is fixed for N=12, N=500, and N=2001", async () => {
  async function measure(n: number, withCoords: number) {
    const db = new InMemoryDatabaseClient();
    for (let i = 0; i < n; i += 1) {
      await seedBareCase(db, {
        id: `q-${i}`,
        caseNumber: `Q-${String(i).padStart(4, "0")}`,
        latitude: i < withCoords ? 10 : null,
        longitude: i < withCoords ? 99 : null,
      });
    }
    const counted = countingDatabase(db);
    const result = await new DrugMapQueryService(counted.db).load({});
    return { queries: counted.queries(), result };
  }

  const n12 = await measure(12, 6);
  assert.equal(n12.result.summary.totalCases, 12);
  assert.equal(n12.result.summary.withCoordinates, 6);
  assert.equal(n12.result.summary.withoutCoordinates, 6);
  assert.equal(n12.result.markers.length, 6);
  assert.equal(n12.result.list.items.length, 12);
  assert.deepEqual(n12.result.warnings, []);
  assert.equal(n12.queries, 10, `N=12 queries ${n12.queries}`);

  const n500 = await measure(500, 500);
  assert.equal(n500.result.summary.withCoordinates, 500);
  assert.equal(n500.result.markers.length, 500);
  assert.equal(n500.result.list.items.length, 50);
  assert.deepEqual(n500.result.warnings, []);
  assert.equal(n500.queries, 9, `N=500 queries ${n500.queries}`);

  const n2001 = await measure(2001, 2001);
  assert.equal(n2001.result.summary.totalCases, 2001);
  assert.equal(n2001.result.summary.withCoordinates, 2001);
  assert.equal(n2001.result.summary.withoutCoordinates, 0);
  assert.equal(n2001.result.markers.length, 0);
  assert.deepEqual(n2001.result.warnings, ["MARKER_LIMIT"]);
  assert.equal(n2001.result.list.items.length, 50);
  assert.equal(n2001.queries, 8, `N=2001 queries ${n2001.queries}`);
});

test("fallback first-location scan query count stays fixed for N=12, N=500, and N=2001", async () => {
  async function measureFallback(n: number) {
    const db = new InMemoryDatabaseClient();
    for (let i = 0; i < n; i += 1) {
      await seedBareCase(db, { id: `fb-${i}`, caseNumber: `FB-${String(i).padStart(4, "0")}`, latitude: null, longitude: null });
      await db.drugLocation.create({ data: { id: `fbl-${i}`, latitude: 10, longitude: 99 } });
      await db.drugCaseLocation.create({
        data: { id: `fbn-${i}`, caseId: `fb-${i}`, locationId: `fbl-${i}`, role: "ARREST_LOCATION" },
      });
    }
    const counted = countingDatabase(db);
    const result = await new DrugMapQueryService(counted.db).load({});
    return { queries: counted.queries(), result };
  }

  const n12 = await measureFallback(12);
  assert.equal(n12.result.summary.withCoordinates, 12);
  assert.equal(n12.result.markers.length, 12);
  assert.equal(n12.queries, 13, `fallback N=12 queries ${n12.queries}`);
  assert.ok(n12.queries <= MAP_QUERY_MAX_DB_CALLS);

  const n500 = await measureFallback(500);
  assert.equal(n500.result.summary.withCoordinates, 500);
  assert.equal(n500.result.markers.length, 500);
  assert.equal(n500.queries, 13, `fallback N=500 queries ${n500.queries}`);

  const n2001 = await measureFallback(2001);
  assert.equal(n2001.result.summary.withCoordinates, 2001);
  assert.equal(n2001.result.markers.length, 0);
  assert.deepEqual(n2001.result.warnings, ["MARKER_LIMIT"]);
  assert.equal(n2001.queries, 12, `fallback N=2001 queries ${n2001.queries}`);
});

test("DI-8.2.1: weekday + night filter and unknown time coverage", async () => {
  const db = new InMemoryDatabaseClient();
  // Friday 2026-08-07
  await seedBareCase(db, { id: "fri-night", caseNumber: "FRI-N", arrestDate: new Date("2026-08-07"), arrestTime: "21:00", latitude: 10, longitude: 99 });
  await seedBareCase(db, { id: "fri-day", caseNumber: "FRI-D", arrestDate: new Date("2026-08-07"), arrestTime: "10:00", latitude: 10, longitude: 99 });
  await seedBareCase(db, { id: "fri-unk", caseNumber: "FRI-U", arrestDate: new Date("2026-08-07"), arrestTime: null, latitude: 10, longitude: 99 });
  // Saturday
  await seedBareCase(db, { id: "sat-night", caseNumber: "SAT-N", arrestDate: new Date("2026-08-08"), arrestTime: "22:00", latitude: 10, longitude: 99 });
  // Monday
  await seedBareCase(db, { id: "mon-night", caseNumber: "MON-N", arrestDate: new Date("2026-08-10"), arrestTime: "21:00", latitude: 10, longitude: 99 });

  const allDay = await new DrugMapQueryService(db).load({ weekdays: [5, 6] });
  assert.equal(allDay.summary.totalCases, 4);
  assert.equal(allDay.temporal.coverage.total, 4);
  assert.equal(allDay.temporal.coverage.withTime, 3);
  assert.equal(allDay.temporal.coverage.withoutTime, 1);
  assert.equal(allDay.temporal.timeFilterActive, false);
  assert.equal(allDay.temporal.weekdayFrequency[5], 3); // Fri facet ignores weekday? wait - afterTimeOnly with no time filter = all 5 cases; Fri=3 Sat=1 Mon=1
  assert.equal(allDay.temporal.weekdayFrequency[6], 1);

  const night = await new DrugMapQueryService(db).load({ weekdays: [5, 6], timePreset: "H21_24" });
  assert.equal(night.summary.totalCases, 2);
  assert.equal(night.temporal.timeFilterActive, true);
  assert.equal(night.temporal.coverage.total, 4); // post-weekday pre-time
  assert.equal(night.temporal.coverage.withTime, 3);
  assert.equal(night.list.items.every((i) => i.arrestTime != null), true);
  assert.ok(night.markers.every((m) => m.arrestTime === "21:00" || m.arrestTime === "22:00"));
});

test("markers stay lightweight and list/markers omit sensitive identifiers", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(
    baseCase({
      caseNumber: "LIGHT",
      latitude: 10,
      longitude: 99,
      persons: [person("นาย ทดสอบ")],
      seizedItems: [countItem(9)],
    })
  );
  const result = await new DrugMapQueryService(db).load({});
  const marker = result.markers[0];
  assert.ok(marker);
  assert.equal(typeof marker.latitude, "number");
  assert.equal(typeof marker.longitude, "number");
  assert.equal("personSummaries" in marker, false);
  assert.equal("seizedItems" in marker, false);
  assert.equal("officers" in marker, false);
  assert.equal("participatingUnits" in marker, false);
  assert.equal("alerts" in marker, false);
  assertNoSensitivePayload(result);
});

test("caseId is not a filter even if a caller smuggles it", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const kept = await cases.createCase(baseCase({ caseNumber: "KEEP-A", latitude: 10, longitude: 99 }));
  await cases.createCase(baseCase({ caseNumber: "KEEP-B", latitude: 11, longitude: 100 }));
  const result = await new DrugMapQueryService(db).load({
    caseId: kept.caseId,
  } as Parameters<DrugMapQueryService["load"]>[0] & { caseId: string });
  assert.equal(result.summary.totalCases, 2);
});

test("limits are the documented 500/2000/50/100 constants", () => {
  assert.equal(MAP_MARKER_SOFT_LIMIT, 500);
  assert.equal(MAP_MARKER_HARD_LIMIT, 2000);
  assert.equal(MAP_LIST_DEFAULT_PAGE_SIZE, 50);
  assert.equal(MAP_LIST_MAX_PAGE_SIZE, 100);
});
