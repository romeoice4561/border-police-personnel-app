/**
 * DI-10E.6B — live Map API handler + V2 client contract tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugMapQuery } from "@/lib/drug_intelligence/drug_geo_api_handlers";
import { drugGeoQueryToSearchParams } from "@/lib/drug_intelligence/drug_geo_client";
import { DrugMapQueryService } from "@/lib/drug_intelligence/drug_map_query";
import { isDrugMapHardLimit, isDrugMapSoftLimit, isDrugMapTrueEmpty, mapListTotalPages } from "@/lib/drug_intelligence/drug_map_view";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "MAP-6B-001",
    title: "map v2",
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
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function seedBare(db: InMemoryDatabaseClient, id: string, caseNumber: string, lat: number | null, lng: number | null): Promise<void> {
  await db.drugCase.create({
    data: {
      id,
      caseNumber,
      title: caseNumber,
      status: "OPEN",
      arrestDate: new Date("2026-01-15"),
      province: "ชุมพร",
      latitude: lat,
      longitude: lng,
      createdBy: "qa",
      createdByName: "QA",
    },
  });
}

test("live route and handler do not use MAX_SAFE_INTEGER or getGeoResult", () => {
  const route = readFileSync(join(ROOT, "app/api/drug-intelligence/map/route.ts"), "utf8");
  assert.match(route, /handleDrugMapQuery/);
  assert.match(route, /mapQueryService/);
  assert.doesNotMatch(route, /handleDrugGeoResult/);
  assert.doesNotMatch(route, /geoIntelligenceService/);
  assert.doesNotMatch(route, /MAX_SAFE_INTEGER/);
  assert.doesNotMatch(route, /getGeoResult/);

  const handler = readFileSync(join(ROOT, "lib/drug_intelligence/drug_geo_api_handlers.ts"), "utf8");
  const liveFn = handler.slice(handler.indexOf("export async function handleDrugMapQuery"));
  assert.doesNotMatch(liveFn, /MAX_SAFE_INTEGER/);
  assert.doesNotMatch(liveFn, /getGeoResult/);
  assert.match(liveFn, /DrugMapQueryService/);
});

test("pagination helpers and empty/limit classification", () => {
  assert.equal(mapListTotalPages(0, 50), 1);
  assert.equal(mapListTotalPages(50, 50), 1);
  assert.equal(mapListTotalPages(51, 50), 2);
  assert.equal(isDrugMapTrueEmpty(0), true);
  assert.equal(isDrugMapTrueEmpty(1), false);
  assert.equal(isDrugMapSoftLimit(["MARKER_SOFT_LIMIT"]), true);
  assert.equal(isDrugMapHardLimit(["MARKER_LIMIT"]), true);
  assert.equal(isDrugMapHardLimit(["MARKER_SOFT_LIMIT"]), false);
});

test("client query string omits caseId and prefers dateFrom/dateTo", () => {
  const params = drugGeoQueryToSearchParams("mock:admin", {
    caseId: "should-not-appear",
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
    arrestDateFrom: "ignored",
    page: 2,
    pageSize: 50,
    personId: "p1",
  } as Parameters<typeof drugGeoQueryToSearchParams>[1] & { caseId: string });
  assert.equal(params.get("actorId"), "mock:admin");
  assert.equal(params.get("caseId"), null);
  assert.equal(params.get("dateFrom"), "2026-01-01");
  assert.equal(params.get("dateTo"), "2026-01-31");
  assert.equal(params.get("arrestDateFrom"), null);
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("personId"), "p1");
});

test("pagination maps to list page and does not send caseId as a filter", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const first = await cases.createCase(baseCase({ caseNumber: "KEEP-1", latitude: 10, longitude: 99 }));
  await cases.createCase(baseCase({ caseNumber: "KEEP-2", latitude: 11, longitude: 100 }));
  const service = new DrugMapQueryService(db);
  const req = requestWithSession("http://localhost/api/drug-intelligence/map");
  const res = await handleDrugMapQuery(
    service,
    new URLSearchParams({ actorId: "mock:admin", page: "1", pageSize: "1", caseId: first.caseId }),
    "mock:admin",
    req
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.summary.totalCases, 2);
  assert.equal(body.data.list.page, 1);
  assert.equal(body.data.list.pageSize, 1);
  assert.equal(body.data.list.items.length, 1);
  assert.equal(body.data.list.totalPages, 2);
});

test("hard-limit result is HTTP 200 with empty markers and remaining list", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 2001; i += 1) {
    await seedBare(db, `h-${i}`, `H-${String(i).padStart(4, "0")}`, 10, 99);
  }
  const service = new DrugMapQueryService(db);
  const req = requestWithSession("http://localhost/api/drug-intelligence/map");
  const res = await handleDrugMapQuery(service, new URLSearchParams({ actorId: "mock:admin" }), "mock:admin", req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.summary.withCoordinates, 2001);
  assert.equal(body.data.summary.markerCount, 0);
  assert.equal(body.data.markers.length, 0);
  assert.equal(body.data.summary.markerLimitReached, true);
  assert.deepEqual(body.data.warnings, ["MARKER_LIMIT"]);
  assert.equal(body.data.list.items.length, 50);
  assert.ok(body.data.list.totalPages >= 40);
});

test("soft-limit warning is preserved and markers are still returned", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 501; i += 1) {
    await seedBare(db, `s-${i}`, `S-${String(i).padStart(4, "0")}`, 10, 99);
  }
  const service = new DrugMapQueryService(db);
  const req = requestWithSession("http://localhost/api/drug-intelligence/map");
  const res = await handleDrugMapQuery(service, new URLSearchParams({ actorId: "mock:admin" }), "mock:admin", req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.data.warnings, ["MARKER_SOFT_LIMIT"]);
  assert.equal(body.data.markers.length, 501);
  assert.equal(body.data.summary.markerCount, 501);
});

test("service failure returns API error", async () => {
  const service = {
    load: async () => {
      throw new Error("boom");
    },
  } as unknown as DrugMapQueryService;
  const req = requestWithSession("http://localhost/api/drug-intelligence/map");
  const res = await handleDrugMapQuery(service, new URLSearchParams({ actorId: "mock:admin" }), "mock:admin", req);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, "INTERNAL_ERROR");
});

test("representative 100-marker + 50-list payload stays under 150 KB", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 100; i += 1) {
    await seedBare(db, `p-${i}`, `P-${String(i).padStart(3, "0")}`, 10 + i / 100, 99);
  }
  const result = await new DrugMapQueryService(db).load({ page: 1, pageSize: 50 });
  const json = JSON.stringify({
    ...result,
    list: { ...result.list, totalPages: mapListTotalPages(result.list.total, result.list.pageSize) },
  });
  const bytes = Buffer.byteLength(json);
  assert.ok(bytes < 150 * 1024, `payload ${bytes} bytes`);
});
