/**
 * DI-8 — geo read model tests: coordinate precedence, marker/no-coordinate
 * separation, province/district/date/drug-category/person filtering,
 * seizure unit safety, and domain-separation guarantees.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_geo_intelligence.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugGeoIntelligenceService } from "@/lib/drug_intelligence/drug_geo_intelligence_service";
import { handleDrugGeoResult } from "@/lib/drug_intelligence/drug_geo_api_handlers";
import { resolveDrugGeoCoordinate, composeDrugGeoResult } from "@/lib/drug_intelligence/drug_geo_marker";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

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

// ── coordinate precedence (pure function) ───────────────────────────────

test("AC: case coordinates take precedence over arrest-location coordinates when both are present", () => {
  const result = resolveDrugGeoCoordinate({ caseLatitude: 10, caseLongitude: 99, arrestLocationLatitude: 20, arrestLocationLongitude: 199 });
  assert.deepEqual(result, { latitude: 10, longitude: 99, source: "CASE" });
});

test("AC2: falls back to arrest-location coordinates when the case itself has none", () => {
  const result = resolveDrugGeoCoordinate({ caseLatitude: null, caseLongitude: null, arrestLocationLatitude: 20, arrestLocationLongitude: 199 });
  assert.deepEqual(result, { latitude: 20, longitude: 199, source: "ARREST_LOCATION" });
});

test("AC3: no marker when neither source has a complete pair", () => {
  assert.equal(resolveDrugGeoCoordinate({ caseLatitude: null, caseLongitude: null, arrestLocationLatitude: null, arrestLocationLongitude: null }), null);
});

test("AB: a lone case latitude (no case longitude) never combines with the arrest-location's longitude — falls through to arrest-location's OWN pair", () => {
  const result = resolveDrugGeoCoordinate({ caseLatitude: 10, caseLongitude: null, arrestLocationLatitude: 20, arrestLocationLongitude: 199 });
  assert.deepEqual(result, { latitude: 20, longitude: 199, source: "ARREST_LOCATION" }, "must never produce {latitude:10, longitude:199} — mixing sources");
});

test("AB2: a lone case latitude with an incomplete arrest-location pair too produces no marker at all", () => {
  const result = resolveDrugGeoCoordinate({ caseLatitude: 10, caseLongitude: null, arrestLocationLatitude: 20, arrestLocationLongitude: null });
  assert.equal(result, null);
});

// ── A/B/C: zero/one/multiple markers ────────────────────────────────────

test("A: zero markers when no case in the result set has coordinates", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-A" }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.markers.length, 0);
  assert.equal(result.noCoordinateCases.length, 1);
  assert.equal(result.summary.markerCount, 0);
  assert.equal(result.summary.noCoordinateCount, 1);
});

test("B: one marker when exactly one case has a complete coordinate pair", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-B", latitude: 10.4934, longitude: 99.18 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-B2" }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-B");
  assert.equal(result.noCoordinateCases.length, 1);
});

test("C: multiple markers when multiple cases have coordinates", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-C1", latitude: 10.4934, longitude: 99.18 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-C2", latitude: 11.0, longitude: 100.0 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-C3", latitude: 12.0, longitude: 101.0 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.markers.length, 3);
  assert.equal(result.summary.totalCases, 3);
});

// ── E/F: province/district filtering ─────────────────────────────────

test("E: province filter — only markers matching the selected province remain", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-E1", province: "ชุมพร", latitude: 10.4934, longitude: 99.18 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-E2", province: "ระนอง", latitude: 9.9, longitude: 98.6 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, province: "ชุมพร" });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-E1");
  assert.equal(result.summary.totalCases, 1, "the total-case count must match the same filter, not just the marker count");
});

test("F: district filter narrows within a province", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-F1", province: "ชุมพร", district: "ท่าแซะ", latitude: 10.4934, longitude: 99.18 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-F2", province: "ชุมพร", district: "เมืองชุมพร", latitude: 10.5, longitude: 99.2 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, province: "ชุมพร", district: "ท่าแซะ" });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-F1");
});

// ── G/H: date / fiscal-year filtering ────────────────────────────────

test("G: date range filter narrows markers by arrestDate", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-G1", arrestDate: new Date("2026-01-01"), latitude: 10, longitude: 99 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-G2", arrestDate: new Date("2026-06-01"), latitude: 11, longitude: 100 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, arrestDateFrom: new Date("2026-05-01"), arrestDateTo: new Date("2026-07-01") });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-G2");
});

test("H: fiscal-year boundary (Oct 1) is honored when the caller derives dateFrom/dateTo from the fiscal-year helper", async () => {
  const { computeFiscalYearSummary } = await import("@/lib/intelligence/shared/fiscal_year");
  const fy = computeFiscalYearSummary(new Date("2026-11-01"));
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-H1", arrestDate: new Date("2026-09-30"), latitude: 10, longitude: 99 })); // previous FY
  await caseService.createCase(baseCase({ caseNumber: "GEO-H2", arrestDate: new Date("2026-10-01"), latitude: 11, longitude: 100 })); // this FY

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, arrestDateFrom: fy.start, arrestDateTo: fy.end });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-H2");
});

// ── I/J: lead unit / reporting unit filtering ────────────────────────

test("I: lead arrest unit filter (leadCompanyId) narrows markers", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-I1", leadCompanyId: 69, latitude: 10, longitude: 99 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-I2", leadCompanyId: 57, latitude: 11, longitude: 100 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, leadCompanyId: 69 });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-I1");
});

test("J: reporting unit filter (companyId) narrows markers", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-J1", companyId: 69, latitude: 10, longitude: 99 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-J2", companyId: 57, latitude: 11, longitude: 100 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, companyId: 69 });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-J1");
});

// ── K/L: drug-category / case-status filtering ───────────────────────

test("K: drug-category filter — a case with at least one matching seized item appears", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "GEO-K1",
      latitude: 10,
      longitude: 99,
      seizedItems: [{ drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 5000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null }],
    })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "GEO-K2",
      latitude: 11,
      longitude: 100,
      seizedItems: [{ drugCategory: "CRYSTAL_METHAMPHETAMINE", otherDrugCategoryLabel: null, measurementKind: "MASS", drugType: "ไอซ์", subtype: null, quantity: null, unit: null, weightGrams: 500, packageCount: null, notes: null }],
    })
  );

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, drugCategory: "METHAMPHETAMINE_TABLET" });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-K1");
});

test("L: case-status filter narrows markers", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-L1", status: "OPEN", latitude: 10, longitude: 99 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-L2", status: "CLOSED", latitude: 11, longitude: 100 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, status: "CLOSED" });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-L2");
});

// ── M: person deep-link ──────────────────────────────────────────────

test("M: person deep-link filter shows only cases that person is linked to", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "GEO-M1",
      latitude: 10,
      longitude: 99,
      persons: [{ newPerson: { primaryFullName: "สมชาย ทดสอบ", nationality: "ไทย", dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );
  await caseService.createCase(baseCase({ caseNumber: "GEO-M2", latitude: 11, longitude: 100 }));

  const persons = await db.drugPerson.findMany({ where: { primaryFullName: "สมชาย ทดสอบ" } });
  const personId = (persons[0] as { id: string }).id;

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20, personId });
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].caseNumber, "GEO-M1");
  assert.deepEqual(result.markers[0].personSummaries.map((p) => p.primaryFullName), ["สมชาย ทดสอบ"]);
});

// ── S/T: no-coordinate handling + marker vs total-case count ─────────

test("S/T: markerCount and totalCases are DISTINCT — no-coordinate cases are never silently hidden nor counted as markers", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-ST1", latitude: 10, longitude: 99 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-ST2" }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-ST3" }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.summary.totalCases, 3);
  assert.equal(result.summary.markerCount, 1);
  assert.equal(result.summary.noCoordinateCount, 2);
  assert.equal(result.noCoordinateCases.length, 2);
  assert.ok(result.noCoordinateCases.some((c) => c.caseNumber === "GEO-ST2"));
  assert.ok(result.noCoordinateCases.some((c) => c.caseNumber === "GEO-ST3"));
});

// ── AD: seizure unit safety in the geo result ────────────────────────

test("AD: seizure groups in a marker never combine COUNT and MASS for the same category", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "GEO-AD1",
      latitude: 10,
      longitude: 99,
      seizedItems: [
        { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 120000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null },
        { drugCategory: "CRYSTAL_METHAMPHETAMINE", otherDrugCategoryLabel: null, measurementKind: "MASS", drugType: "ไอซ์", subtype: null, quantity: null, unit: null, weightGrams: 2500, packageCount: null, notes: null },
      ],
    })
  );

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20 });
  const groups = result.markers[0].seizedItems;
  assert.equal(groups.length, 2, "two separate groups — never merged into one number");
  const yaba = groups.find((g) => g.drugCategory === "METHAMPHETAMINE_TABLET");
  const ice = groups.find((g) => g.drugCategory === "CRYSTAL_METHAMPHETAMINE");
  assert.equal(yaba?.totalCount, 120000);
  assert.equal(ice?.totalWeightKilograms, 2.5);
  assert.equal(yaba?.displayTh, "ยาบ้า 120,000 เม็ด");
  assert.equal(ice?.displayTh, "ไอซ์ 2.5 กก.");
  assert.ok(!yaba?.displayTh.includes("รายการ"));
});

// ── AE: raw enum labels absent ────────────────────────────────────────

test("AE: statusLabelTh is Thai text, not the raw DrugCaseStatus enum", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-AE1", status: "UNDER_INVESTIGATION", latitude: 10, longitude: 99 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const result = await geoService.getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.markers[0].statusLabelTh, "อยู่ระหว่างสอบสวน");
  assert.notEqual(result.markers[0].statusLabelTh, "UNDER_INVESTIGATION");
});

// ── domain separation: no DrugPerson creation, no network edges ──────

test("O: computing a geo result creates zero new DrugPerson rows", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-O1", latitude: 10, longitude: 99 }));

  const before = (await db.drugPerson.findMany({})).length;
  const geoService = new DrugGeoIntelligenceService({ db });
  await geoService.getGeoResult({ page: 1, pageSize: 20 });
  const after = (await db.drugPerson.findMany({})).length;
  assert.equal(after, before);
});

test("P: computing a geo result creates zero DrugNetworkGroup/DrugPersonNetworkRole rows", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-P1", latitude: 10, longitude: 99 }));

  const beforeGroups = (await db.drugNetworkGroup.findMany({})).length;
  const beforeRoles = (await db.drugPersonNetworkRole.findMany({})).length;
  const geoService = new DrugGeoIntelligenceService({ db });
  await geoService.getGeoResult({ page: 1, pageSize: 20 });
  assert.equal((await db.drugNetworkGroup.findMany({})).length, beforeGroups);
  assert.equal((await db.drugPersonNetworkRole.findMany({})).length, beforeRoles);
});

// ── composeDrugGeoResult (pure) — province breakdown ─────────────────

test("province breakdown groups by province, sorted by case count descending", () => {
  const result = composeDrugGeoResult([
    { caseId: "1", caseNumber: "P1", title: "t", status: "OPEN", arrestDate: null, caseLatitude: 10, caseLongitude: 99, arrestLocationLatitude: null, arrestLocationLongitude: null, province: "ชุมพร", district: null, subdistrict: null, locationName: null, reportingUnitText: null, leadUnitText: null, persons: [], seizedItems: [], participatingUnitCount: 0, officerCount: 0, hasUnreviewedAlert: false },
    { caseId: "2", caseNumber: "P2", title: "t", status: "OPEN", arrestDate: null, caseLatitude: 11, caseLongitude: 100, arrestLocationLatitude: null, arrestLocationLongitude: null, province: "ชุมพร", district: null, subdistrict: null, locationName: null, reportingUnitText: null, leadUnitText: null, persons: [], seizedItems: [], participatingUnitCount: 0, officerCount: 0, hasUnreviewedAlert: false },
    { caseId: "3", caseNumber: "P3", title: "t", status: "OPEN", arrestDate: null, caseLatitude: 12, caseLongitude: 101, arrestLocationLatitude: null, arrestLocationLongitude: null, province: "ระนอง", district: null, subdistrict: null, locationName: null, reportingUnitText: null, leadUnitText: null, persons: [], seizedItems: [], participatingUnitCount: 0, officerCount: 0, hasUnreviewedAlert: false },
  ]);
  assert.equal(result.provinceBreakdown.length, 2);
  assert.equal(result.provinceBreakdown[0].province, "ชุมพร");
  assert.equal(result.provinceBreakdown[0].caseCount, 2);
  assert.equal(result.provinceBreakdown[1].province, "ระนอง");
});

// ── Q/permission API handler ──────────────────────────────────────────

test("X: officer (no drug.read) is REJECTED 403 on GET /api/drug-intelligence/map", async () => {
  const db = new InMemoryDatabaseClient();
  const geoService = new DrugGeoIntelligenceService({ db });
  const req = requestWithSession("http://localhost/api/drug-intelligence/map?actorId=mock:1101700123456");
  const res = await handleDrugGeoResult(geoService, new URLSearchParams({ actorId: "mock:1101700123456" }), "mock:1101700123456", req);
  assert.equal(res.status, 403);
});

test("X2: commander (drug.read) CAN read the map result", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-X2", latitude: 10, longitude: 99 }));
  const geoService = new DrugGeoIntelligenceService({ db });
  const req = requestWithSession("http://localhost/api/drug-intelligence/map?actorId=mock:bpp414");
  const res = await handleDrugGeoResult(geoService, new URLSearchParams({ actorId: "mock:bpp414" }), "mock:bpp414", req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.markers.length, 1);
});

test("X3: admin CAN read the map result", async () => {
  const db = new InMemoryDatabaseClient();
  const geoService = new DrugGeoIntelligenceService({ db });
  const req = requestWithSession("http://localhost/api/drug-intelligence/map?actorId=mock:admin");
  const res = await handleDrugGeoResult(geoService, new URLSearchParams({ actorId: "mock:admin" }), "mock:admin", req);
  assert.equal(res.status, 200);
});

test("X4: missing session is REJECTED 401", async () => {
  const db = new InMemoryDatabaseClient();
  const geoService = new DrugGeoIntelligenceService({ db });
  const req = new Request("http://localhost/api/drug-intelligence/map?actorId=mock:admin");
  const res = await handleDrugGeoResult(geoService, new URLSearchParams({ actorId: "mock:admin" }), "mock:admin", req);
  assert.equal(res.status, 401);
});

test("X5: province filter is honored end-to-end through the API handler — ชุมพร returns only ชุมพร markers", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "GEO-X5-1", province: "ชุมพร", latitude: 10.4934, longitude: 99.18 }));
  await caseService.createCase(baseCase({ caseNumber: "GEO-X5-2", province: "ระนอง", latitude: 9.9, longitude: 98.6 }));

  const geoService = new DrugGeoIntelligenceService({ db });
  const req = requestWithSession("http://localhost/api/drug-intelligence/map?actorId=mock:admin&province=ชุมพร");
  const res = await handleDrugGeoResult(geoService, new URLSearchParams({ actorId: "mock:admin", province: "ชุมพร" }), "mock:admin", req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.markers.length, 1);
  assert.equal(body.data.markers[0].province, "ชุมพร");
  assert.equal(body.data.summary.totalCases, 1, "result count/list must match the same filter");
});
