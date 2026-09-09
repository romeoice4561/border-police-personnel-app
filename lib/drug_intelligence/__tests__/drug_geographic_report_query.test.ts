/**
 * DI-10E.5B — bounded geographic report query foundation tests.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_geographic_report_query.test.ts
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
  buildGeographicReportCaseWhere,
  DrugGeographicReportQueryService,
  GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT,
  GEOGRAPHIC_REPORT_MATCHING_SOFT_LIMIT,
  GeographicReportInvalidFilterError,
  GeographicReportTooManyRowsError,
  normalizeGeographicReportFilter,
} from "@/lib/drug_intelligence/drug_geographic_report_query";
import { resolveExportPeriod } from "@/lib/drug_intelligence/drug_export_period";

const ROOT = join(process.cwd());
const FOUNDATION_FILE = "lib/drug_intelligence/drug_geographic_report_query.ts";
const PERSON_A_ID = "b9a6c674-db36-4f40-a7de-4c9a727c37a7";
const PERSON_F_ID = "1f230a17-8055-4905-9e01-d24fde3b08ec";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "GEO-R-001",
    title: "geographic report fixture",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
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
    notes: null,
  };
}

function massItem(weightGrams: number): DrugCaseSeizedItemInput {
  return {
    drugCategory: "CRYSTAL_METHAMPHETAMINE",
    otherDrugCategoryLabel: null,
    measurementKind: "MASS",
    drugType: "ไอซ์",
    subtype: null,
    quantity: null,
    unit: "กรัม",
    weightGrams,
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

async function seedBareCase(
  db: InMemoryDatabaseClient,
  data: {
    id: string;
    caseNumber: string;
    arrestDate?: Date | null;
    province?: string | null;
    district?: string | null;
    status?: string;
    headquartersId?: number | null;
    leadHeadquartersId?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<void> {
  await db.drugCase.create({
    data: {
      id: data.id,
      caseNumber: data.caseNumber,
      title: data.caseNumber,
      status: data.status ?? "OPEN",
      arrestDate: data.arrestDate === undefined ? new Date("2026-01-15") : data.arrestDate,
      headquartersId: data.headquartersId ?? null,
      leadHeadquartersId: data.leadHeadquartersId ?? null,
      province: data.province === undefined ? "ชุมพร" : data.province,
      district: data.district === undefined ? null : data.district,
      locationName: null,
      reportingUnitText: "กก.",
      leadUnitText: null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      createdBy: "qa",
      createdByName: "QA",
    },
  });
}

function countingDatabase(db: DatabaseClient): { db: DatabaseClient; queries: () => number; calls: () => Array<{ model: string; method: string; where: unknown }> } {
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
            if ((method === "findMany" || method === "count") && typeof fn === "function") {
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

test("Y: foundation source has no MAX_SAFE_INTEGER and does not call getGeoResult", () => {
  const src = readFileSync(join(ROOT, FOUNDATION_FILE), "utf8");
  assert.doesNotMatch(src, /Number\.MAX_SAFE_INTEGER/);
  assert.doesNotMatch(src, /getGeoResult/);
  assert.doesNotMatch(src, /DrugGeoIntelligenceService/);
  assert.doesNotMatch(src, /DrugCaseRepository/);
  assert.doesNotMatch(src, /forPerson\(/);
  assert.doesNotMatch(src, /resolveCaseIdAllowlist/);
  assert.doesNotMatch(src, /mergePersons/);
  assert.doesNotMatch(src, new RegExp(PERSON_A_ID));
  assert.doesNotMatch(src, new RegExp(PERSON_F_ID));
  assert.match(src, /seizedItems\s*=\s*\{\s*some:/);
  assert.match(src, /persons\s*=\s*\{\s*some:/);
});

test("AA: MAP_DATA HTML_PRINT is activated by the export service, not this foundation", () => {
  const service = new DrugExportService(new InMemoryDatabaseClient());
  assert.equal(service.isImplemented("MAP_DATA", "HTML_PRINT"), true);
  const src = readFileSync(join(ROOT, FOUNDATION_FILE), "utf8");
  assert.doesNotMatch(src, /isImplemented\(/);
});

test("AC: QA Person A and Person F remain distinct identities", () => {
  assert.notEqual(PERSON_A_ID, PERSON_F_ID);
});

test("B: explicit date range is pushed into Prisma where (arrestDate gte/lte)", () => {
  const filter = normalizeGeographicReportFilter({ dateFrom: "2026-05-01", dateTo: "2026-07-01" });
  const period = resolveExportPeriod(filter);
  const where = buildGeographicReportCaseWhere(filter, period);
  const arrestDate = where.arrestDate as { gte: Date; lte: Date };
  assert.ok(arrestDate.gte instanceof Date);
  assert.ok(arrestDate.lte instanceof Date);
  assert.equal(arrestDate.gte.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(arrestDate.lte.toISOString().slice(0, 10), "2026-07-01");
  assert.equal(where.id, undefined);
});

test("C/D: FY expands to Oct–Sep and explicit dates take precedence over FY", () => {
  const fy = resolveExportPeriod({ fiscalYearBe: 2569 });
  assert.equal(fy.source, "FISCAL_YEAR");
  assert.equal(fy.dateFrom, "2025-10-01");
  assert.equal(fy.dateTo, "2026-09-30");

  const both = resolveExportPeriod({ fiscalYearBe: 2569, dateFrom: "2026-01-01", dateTo: "2026-01-31" });
  assert.equal(both.source, "EXPLICIT_DATES");
  assert.equal(both.dateFrom, "2026-01-01");
  assert.equal(both.dateTo, "2026-01-31");
  assert.equal(both.appliedFiscalYearBe, undefined);
});

test("invalid period and inverted range fail closed", () => {
  assert.throws(() => normalizeGeographicReportFilter({ dateFrom: "2026-01-01" }), GeographicReportInvalidFilterError);
  assert.throws(() => normalizeGeographicReportFilter({ dateFrom: "2026-06-01", dateTo: "2026-01-01" }), GeographicReportInvalidFilterError);
});

test("L: caseId is not a query filter", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const a = await cases.createCase(baseCase({ caseNumber: "KEEP-A", latitude: 10, longitude: 99 }));
  await cases.createCase(baseCase({ caseNumber: "KEEP-B", latitude: 11, longitude: 100 }));
  const result = await new DrugGeographicReportQueryService(db).load({
    caseId: a.caseId,
  } as Parameters<DrugGeographicReportQueryService["load"]>[0] & { caseId: string });
  assert.equal(result.summary.totalCases, 2);
});

test("A: empty filters return all matching cases with no date bound", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "E1" }));
  await cases.createCase(baseCase({ caseNumber: "E2", arrestDate: new Date("2020-01-01") }));
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.summary.totalCases, 2);
  assert.equal(result.effectivePeriod.source, "NONE");
  assert.equal("arrestDate" in buildGeographicReportCaseWhere(result.filters, result.effectivePeriod), false);
});

test("B2: explicit date range filters by arrestDate, not createdAt", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "IN", arrestDate: new Date("2026-06-01") }));
  await cases.createCase(baseCase({ caseNumber: "OUT", arrestDate: new Date("2026-01-01") }));
  const result = await new DrugGeographicReportQueryService(db).load({ dateFrom: "2026-05-01", dateTo: "2026-07-01" });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.cases[0]?.caseNumber, "IN");
});

test("C2: FY 2569 includes 1 Oct 2025 and excludes 30 Sep 2025", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "FY-IN", arrestDate: new Date("2025-10-01") }));
  await cases.createCase(baseCase({ caseNumber: "FY-OUT", arrestDate: new Date("2025-09-30") }));
  const result = await new DrugGeographicReportQueryService(db).load({ fiscalYearBe: 2569 });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.cases[0]?.caseNumber, "FY-IN");
});

test("D2: explicit dates override FY at query time", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "JAN", arrestDate: new Date("2026-01-15") }));
  await cases.createCase(baseCase({ caseNumber: "JUN", arrestDate: new Date("2026-06-15") }));
  const result = await new DrugGeographicReportQueryService(db).load({
    fiscalYearBe: 2569,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-30",
  });
  assert.equal(result.effectivePeriod.source, "EXPLICIT_DATES");
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.cases[0]?.caseNumber, "JUN");
});

test("E/F: reporting org and lead org remain distinct filters", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "r1", caseNumber: "REP", headquartersId: 1, leadHeadquartersId: 2 });
  await seedBareCase(db, { id: "l1", caseNumber: "LEAD", headquartersId: 2, leadHeadquartersId: 1 });
  const service = new DrugGeographicReportQueryService(db);
  const reporting = await service.load({ headquartersId: 1 });
  const lead = await service.load({ leadHeadquartersId: 1 });
  assert.equal(reporting.summary.totalCases, 1);
  assert.equal(reporting.cases[0]?.caseNumber, "REP");
  assert.equal(lead.summary.totalCases, 1);
  assert.equal(lead.cases[0]?.caseNumber, "LEAD");
  assert.notEqual(reporting.cases[0]?.caseId, lead.cases[0]?.caseId);
});

test("G/H/I: province, district, and status filters apply", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "CH-TA", province: "ชุมพร", district: "ท่าแซะ", status: "OPEN" }));
  await cases.createCase(baseCase({ caseNumber: "CH-MU", province: "ชุมพร", district: "เมืองชุมพร", status: "CLOSED" }));
  await cases.createCase(baseCase({ caseNumber: "RN", province: "ระนอง", district: "เมืองระนอง", status: "OPEN" }));
  const service = new DrugGeographicReportQueryService(db);
  const province = await service.load({ province: "ชุมพร" });
  assert.equal(province.summary.totalCases, 2);
  const district = await service.load({ province: "ชุมพร", district: "ท่าแซะ" });
  assert.equal(district.summary.totalCases, 1);
  assert.equal(district.cases[0]?.caseNumber, "CH-TA");
  const status = await service.load({ status: "CLOSED" });
  assert.equal(status.summary.totalCases, 1);
  assert.equal(status.cases[0]?.caseNumber, "CH-MU");
});

test("J: drugCategory is DrugCase seizedItems.some, not an unbounded seized-item fetch", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "METH", seizedItems: [countItem(10), massItem(500)] }));
  await cases.createCase(baseCase({ caseNumber: "ICE-ONLY", seizedItems: [massItem(100)] }));
  const where = buildGeographicReportCaseWhere({ drugCategory: "METHAMPHETAMINE_TABLET" }, resolveExportPeriod({}));
  assert.deepEqual(where.seizedItems, { some: { drugCategory: "METHAMPHETAMINE_TABLET" } });
  assert.equal(where.id, undefined);
  const counted = countingDatabase(db);
  const meth = await new DrugGeographicReportQueryService(counted.db).load({ drugCategory: "METHAMPHETAMINE_TABLET" });
  assert.equal(meth.summary.totalCases, 1);
  assert.equal(meth.cases[0]?.caseNumber, "METH");
  const categoryScans = counted.calls().filter((call) => call.model === "drugSeizedItem" && call.method === "findMany");
  assert.ok(categoryScans.every((call) => call.where && typeof call.where === "object" && "caseId" in (call.where as object)));
  const ice = await new DrugGeographicReportQueryService(db).load({ drugCategory: "CRYSTAL_METHAMPHETAMINE" });
  assert.equal(ice.summary.totalCases, 2);
});

test("K: personId is a DrugCase persons.some filter, not a relation allowlist fetch", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const linked = await cases.createCase(baseCase({ caseNumber: "WITH-PERSON", persons: [person("นาย ทดสอบ หนึ่ง")] }));
  await cases.createCase(baseCase({ caseNumber: "NO-PERSON" }));
  const links = await db.drugCasePerson.findMany({ where: { caseId: linked.caseId } });
  assert.equal(links.length, 1);
  const personId = String((links[0] as { personId: string }).personId);
  const where = buildGeographicReportCaseWhere({ personId }, resolveExportPeriod({}));
  assert.deepEqual(where.persons, { some: { personId } });
  assert.equal(where.id, undefined);
  const counted = countingDatabase(db);
  const result = await new DrugGeographicReportQueryService(counted.db).load({ personId });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.cases[0]?.caseNumber, "WITH-PERSON");
  assert.equal(counted.calls().filter((call) => call.model === "drugCasePerson").length, 0);
});

test("M/N/O: coordinate presence uses complete pairs only; no lat/lng mixing", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "CASE-PAIR", latitude: 10.4, longitude: 99.1 }));
  await cases.createCase(
    baseCase({
      caseNumber: "ARREST-PAIR",
      latitude: null,
      longitude: null,
      locations: [
        {
          name: "จุดจับกุม",
          addressText: null,
          province: "ชุมพร",
          district: "ท่าแซะ",
          subdistrict: null,
          latitude: 11.1,
          longitude: 100.2,
          role: "ARREST_LOCATION",
          notes: null,
        },
      ],
    })
  );
  await cases.createCase(
    baseCase({
      caseNumber: "PARTIAL-MIX",
      latitude: 10.4,
      longitude: null,
      locations: [
        {
          name: "ที่พัก",
          addressText: null,
          province: "ชุมพร",
          district: "ท่าแซะ",
          subdistrict: null,
          latitude: null,
          longitude: 100.2,
          role: "ARREST_LOCATION",
          notes: null,
        },
      ],
    })
  );
  await cases.createCase(
    baseCase({
      caseNumber: "RESIDENCE-ONLY",
      locations: [
        {
          name: "บ้าน",
          addressText: null,
          province: "ชุมพร",
          district: "ท่าแซะ",
          subdistrict: null,
          latitude: 12,
          longitude: 101,
          role: "RESIDENCE",
          notes: null,
        },
      ],
    })
  );
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.summary.totalCases, 4);
  assert.equal(result.summary.casesWithCoordinates, 2);
  assert.equal(result.summary.casesWithoutCoordinates, 2);
  const withCoords = new Set(result.cases.filter((row) => row.hasCoordinates).map((row) => row.caseNumber));
  assert.deepEqual(withCoords, new Set(["CASE-PAIR", "ARREST-PAIR"]));
  const serialized = JSON.stringify(result.cases);
  assert.doesNotMatch(serialized, /latitude/);
  assert.doesNotMatch(serialized, /longitude/);
});

test("P: no-coordinate cases remain in totals, rankings, trend, and seizures", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(
    baseCase({
      caseNumber: "NO-COORD",
      province: "ระนอง",
      district: null,
      arrestDate: new Date("2026-03-01"),
      seizedItems: [countItem(3)],
    })
  );
  await cases.createCase(baseCase({ caseNumber: "COORD", province: "ชุมพร", latitude: 10, longitude: 99, arrestDate: new Date("2026-03-02") }));
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.summary.totalCases, 2);
  assert.equal(result.summary.casesWithoutCoordinates, 1);
  assert.equal(result.noCoordinateCases.length, 1);
  assert.equal(result.noCoordinateCases[0]?.caseNumber, "NO-COORD");
  assert.ok(result.provinceRanking.some((row) => row.value === "ระนอง" && row.caseCount === 1));
  assert.ok(result.monthlyTrend.some((row) => row.monthKey === "2026-03" && row.caseCount === 2));
  assert.equal(result.seizureGroups.length, 1);
});

test("Q: province ranking is recorded counts, unspecified last, stable", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "p1", caseNumber: "A1", province: "ชุมพร" });
  await seedBareCase(db, { id: "p2", caseNumber: "A2", province: "ชุมพร" });
  await seedBareCase(db, { id: "p3", caseNumber: "B1", province: "ระนอง" });
  await seedBareCase(db, { id: "p4", caseNumber: "U1", province: null });
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.provinceRanking[0]?.value, "ชุมพร");
  assert.equal(result.provinceRanking[0]?.caseCount, 2);
  assert.equal(result.summary.distinctProvinceCount, 2);
  assert.equal(result.provinceRanking.at(-1)?.unspecified, true);
});

test("R: district ranking keeps as-recorded spelling and an unspecified bucket", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "d1", caseNumber: "D1", district: "ท่าแซะ" });
  await seedBareCase(db, { id: "d2", caseNumber: "D2", district: "ท่า แซะ" });
  await seedBareCase(db, { id: "d3", caseNumber: "D3", district: null });
  const result = await new DrugGeographicReportQueryService(db).load({});
  const named = result.districtRanking.filter((row) => !row.unspecified);
  assert.equal(named.length, 2);
  assert.ok(named.some((row) => row.value === "ท่าแซะ"));
  assert.ok(named.some((row) => row.value === "ท่า แซะ"));
  assert.ok(result.districtRanking.some((row) => row.unspecified && row.caseCount === 1));
});

test("S: monthly trend uses arrestDate and clamps to 36 months", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 37; i += 1) {
    const year = 2020 + Math.floor(i / 12);
    const month = (i % 12) + 1;
    await seedBareCase(db, {
      id: `t${i}`,
      caseNumber: `T-${i}`,
      arrestDate: new Date(Date.UTC(year, month - 1, 15)),
    });
  }
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.summary.totalCases, 37);
  assert.equal(result.monthlyTrend.length, 36);
  assert.equal(result.truncation.monthlyTrend, true);
  assert.ok(result.warnings.includes("TREND_CLAMPED"));
  assert.equal(result.monthlyTrend[0]?.monthKey, "2020-02");
  assert.equal(result.monthlyTrend.at(-1)?.monthKey, "2023-01");
});

test("T: COUNT and MASS stay separate; no combined total", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "SEIZ", seizedItems: [countItem(10, "เม็ด"), massItem(1500)] }));
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.seizureGroups.length, 2);
  const count = result.seizureGroups.find((g) => g.measurementKind === "COUNT");
  const mass = result.seizureGroups.find((g) => g.measurementKind === "MASS");
  assert.equal(count?.totalCount, 10);
  assert.equal(count?.totalWeightGrams, null);
  assert.equal(mass?.totalWeightGrams, 1500);
  assert.equal(mass?.totalCount, null);
});

test("U: matching count above hard limit fails closed before detail load", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT + 1; i += 1) {
    await seedBareCase(db, { id: `h${i}`, caseNumber: `H-${i}` });
  }
  let findManyCases = 0;
  const original = db.drugCase.findMany.bind(db.drugCase);
  db.drugCase.findMany = (async (args?: Parameters<typeof original>[0]) => {
    findManyCases += 1;
    return original(args);
  }) as typeof db.drugCase.findMany;
  await assert.rejects(
    () => new DrugGeographicReportQueryService(db).load({}),
    (error: unknown) => error instanceof GeographicReportTooManyRowsError && error.code === "TOO_MANY_ROWS"
  );
  assert.equal(findManyCases, 0);
});

test("V: matching count above soft limit still returns with SOFT_LIMIT warning", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < GEOGRAPHIC_REPORT_MATCHING_SOFT_LIMIT + 1; i += 1) {
    await seedBareCase(db, { id: `s${i}`, caseNumber: `S-${i}` });
  }
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.summary.totalCases, GEOGRAPHIC_REPORT_MATCHING_SOFT_LIMIT + 1);
  assert.ok(result.warnings.includes("SOFT_LIMIT"));
});

test("W/X: case list and no-coordinate list are bounded and omit raw coordinates", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "c1", caseNumber: "C1", latitude: 10, longitude: 99 });
  await seedBareCase(db, { id: "c2", caseNumber: "C2", latitude: null, longitude: null });
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.equal(result.cases.length, 2);
  assert.equal(result.noCoordinateCases.length, 1);
  assert.equal(result.limits.caseListSoft, 100);
  assert.equal(result.limits.caseListHard, 1000);
  assert.equal(result.limits.noCoordinateListSoft, 50);
  assert.equal(result.limits.noCoordinateListHard, 500);
  for (const row of [...result.cases, ...result.noCoordinateCases]) {
    assert.equal("latitude" in row, false);
    assert.equal("longitude" in row, false);
  }
});

test("Z: query count stays fixed, not O(cases)", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  for (let i = 0; i < 12; i += 1) {
    await cases.createCase(
      baseCase({
        caseNumber: `N1-${i}`,
        latitude: i % 2 === 0 ? 10 : null,
        longitude: i % 2 === 0 ? 99 : null,
        seizedItems: [countItem(i + 1)],
        locations:
          i % 3 === 0
            ? [
                {
                  name: "จุดจับกุม",
                  addressText: null,
                  province: "ชุมพร",
                  district: "ท่าแซะ",
                  subdistrict: null,
                  latitude: 11,
                  longitude: 100,
                  role: "ARREST_LOCATION",
                  notes: null,
                },
              ]
            : [],
      })
    );
  }
  const counted = countingDatabase(db);
  const result = await new DrugGeographicReportQueryService(counted.db).load({ drugCategory: "METHAMPHETAMINE_TABLET" });
  assert.equal(result.summary.totalCases, 12);
  const n = counted.queries();
  assert.ok(n < 12, `expected bounded query count, got ${n}`);
  assert.equal(counted.calls().filter((call) => call.model === "drugSeizedItem" && call.where && typeof call.where === "object" && "drugCategory" in (call.where as object) && !("caseId" in (call.where as object))).length, 0);
});

test("C: duplicate seized items for one case do not inflate case membership", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(baseCase({ caseNumber: "DUP-SEIZ", seizedItems: [countItem(1), countItem(2), countItem(3)] }));
  await cases.createCase(baseCase({ caseNumber: "OTHER", seizedItems: [massItem(10)] }));
  const result = await new DrugGeographicReportQueryService(db).load({ drugCategory: "METHAMPHETAMINE_TABLET" });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.cases[0]?.caseNumber, "DUP-SEIZ");
});

test("F: category + person intersection stays complete and exact", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const both = await cases.createCase(baseCase({ caseNumber: "BOTH", persons: [person("นาย ร่วม ประเภท")], seizedItems: [countItem(4)] }));
  await cases.createCase(baseCase({ caseNumber: "CAT-ONLY", seizedItems: [countItem(8)] }));
  const links = await db.drugCasePerson.findMany({ where: { caseId: both.caseId } });
  const personId = String((links[0] as { personId: string }).personId);
  await cases.createCase(baseCase({ caseNumber: "PERSON-ICE", persons: [{ ...person("นาย ร่วม ประเภท"), existingPersonId: personId, newPerson: undefined }], seizedItems: [massItem(20)] }));
  const result = await new DrugGeographicReportQueryService(db).load({
    drugCategory: "METHAMPHETAMINE_TABLET",
    personId,
  });
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.cases[0]?.caseNumber, "BOTH");
});

test("D: category hard-limit count stays authoritative and does not scan seized rows first", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT + 1; i += 1) {
    await seedBareCase(db, { id: `hc${i}`, caseNumber: `HC-${i}` });
    await db.drugSeizedItem.create({
      data: {
        id: `sz-${i}-a`,
        caseId: `hc${i}`,
        drugCategory: "METHAMPHETAMINE_TABLET",
        measurementKind: "COUNT",
        drugType: "ยาบ้า",
        quantity: 1,
        unit: "เม็ด",
        createdBy: "qa",
      },
    });
    await db.drugSeizedItem.create({
      data: {
        id: `sz-${i}-b`,
        caseId: `hc${i}`,
        drugCategory: "METHAMPHETAMINE_TABLET",
        measurementKind: "COUNT",
        drugType: "ยาบ้า",
        quantity: 2,
        unit: "เม็ด",
        createdBy: "qa",
      },
    });
  }
  const counted = countingDatabase(db);
  await assert.rejects(
    () => new DrugGeographicReportQueryService(counted.db).load({ drugCategory: "METHAMPHETAMINE_TABLET" }),
    (error: unknown) => error instanceof GeographicReportTooManyRowsError && error.code === "TOO_MANY_ROWS"
  );
  assert.equal(counted.calls().filter((call) => call.model === "drugSeizedItem").length, 0);
  assert.equal(counted.calls().filter((call) => call.model === "drugCase" && call.method === "findMany").length, 0);
  assert.ok(counted.calls().some((call) => call.model === "drugCase" && call.method === "count"));
});

test("G/H: matching-case and no-coordinate lists are deterministic", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "late", caseNumber: "Z-LATE", arrestDate: new Date("2026-06-01"), latitude: null, longitude: null });
  await seedBareCase(db, { id: "early", caseNumber: "A-EARLY", arrestDate: new Date("2026-01-01"), latitude: 10, longitude: 99 });
  await seedBareCase(db, { id: "same-b", caseNumber: "M-B", arrestDate: new Date("2026-03-01"), latitude: null, longitude: null });
  await seedBareCase(db, { id: "same-a", caseNumber: "M-A", arrestDate: new Date("2026-03-01"), latitude: null, longitude: null });
  await seedBareCase(db, { id: "nodate", caseNumber: "NULL-DATE", arrestDate: null, latitude: null, longitude: null });
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.deepEqual(
    result.cases.map((row) => row.caseNumber),
    ["Z-LATE", "M-A", "M-B", "A-EARLY", "NULL-DATE"]
  );
  assert.deepEqual(
    result.noCoordinateCases.map((row) => row.caseNumber),
    ["Z-LATE", "M-A", "M-B", "NULL-DATE"]
  );
});

test("I/J-rank: province and district ranking stay deterministic", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "r1", caseNumber: "R1", province: "ระนอง", district: "เมืองระนอง" });
  await seedBareCase(db, { id: "c1", caseNumber: "C1", province: "ชุมพร", district: "เมืองชุมพร" });
  await seedBareCase(db, { id: "c2", caseNumber: "C2", province: "ชุมพร", district: "ท่าแซะ" });
  await seedBareCase(db, { id: "u1", caseNumber: "U1", province: null, district: null });
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.deepEqual(
    result.provinceRanking.map((row) => ({ value: row.value, count: row.caseCount, unspecified: row.unspecified })),
    [
      { value: "ชุมพร", count: 2, unspecified: false },
      { value: "ระนอง", count: 1, unspecified: false },
      { value: null, count: 1, unspecified: true },
    ]
  );
  const namedDistricts = result.districtRanking.filter((row) => !row.unspecified).map((row) => row.value as string);
  assert.deepEqual(
    namedDistricts,
    [...namedDistricts].sort((a, b) => a.localeCompare(b, "th"))
  );
  assert.equal(result.districtRanking.at(-1)?.unspecified, true);
});

test("L: seizure groups have deterministic category / measurement order", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  await cases.createCase(
    baseCase({
      caseNumber: "ORD",
      seizedItems: [massItem(100), countItem(5, "ขวด"), countItem(2, "เม็ด")],
    })
  );
  const result = await new DrugGeographicReportQueryService(db).load({});
  assert.deepEqual(
    result.seizureGroups.map((g) => `${g.drugCategory}:${g.measurementKind}:${g.displayUnit ?? ""}`),
    ["CRYSTAL_METHAMPHETAMINE:MASS:", "METHAMPHETAMINE_TABLET:COUNT:ขวด", "METHAMPHETAMINE_TABLET:COUNT:เม็ด"]
  );
});

test("empty match is a valid empty result, not an error", async () => {
  const db = new InMemoryDatabaseClient();
  await seedBareCase(db, { id: "only", caseNumber: "ONLY", province: "ชุมพร" });
  const result = await new DrugGeographicReportQueryService(db).load({ province: "แม่ฮ่องสอน" });
  assert.equal(result.summary.totalCases, 0);
  assert.deepEqual(result.cases, []);
});
