/**
 * DI-10E.6C — Map case-detail API handler tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugMapCaseDetail } from "@/lib/drug_intelligence/drug_geo_api_handlers";
import { DrugMapCaseDetailService } from "@/lib/drug_intelligence/drug_map_case_detail";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());

function requestWithSession(url: string): Request {
  return new Request(url, { headers: { cookie: `${SESSION_COOKIE_NAME}=test-session` } });
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "MAP-6C-API",
    title: "api",
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

test("detail route is Map-specific and does not reuse the workspace handler", () => {
  const route = readFileSync(join(ROOT, "app/api/drug-intelligence/map/cases/[caseId]/route.ts"), "utf8");
  assert.match(route, /handleDrugMapCaseDetail/);
  assert.match(route, /mapCaseDetailService/);
  assert.doesNotMatch(route, /handleDrugCaseDetail/);
  assert.doesNotMatch(route, /caseService/);
  assert.doesNotMatch(route, /getGeoResult/);
  const liveMap = readFileSync(join(ROOT, "app/api/drug-intelligence/map/route.ts"), "utf8");
  assert.doesNotMatch(liveMap, /handleDrugMapCaseDetail/);
  assert.doesNotMatch(liveMap, /persons/);
  assert.doesNotMatch(liveMap, /seizures/);
  const handler = readFileSync(join(ROOT, "lib/drug_intelligence/drug_geo_api_handlers.ts"), "utf8");
  assert.match(handler, /handleDrugMapCaseDetail/);
  assert.doesNotMatch(handler, /export_created/);
  assert.doesNotMatch(handler, /drug\.export/);
});

test("admin and commander with drug.read receive 200; officer is 403", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const service = new DrugMapCaseDetailService(db);

  const admin = await handleDrugMapCaseDetail(service, created.caseId, "mock:admin", requestWithSession("http://localhost/detail"));
  assert.equal(admin.status, 200);

  const commander = await handleDrugMapCaseDetail(service, created.caseId, "mock:bpp414", requestWithSession("http://localhost/detail"));
  assert.equal(commander.status, 200);

  const officer = await handleDrugMapCaseDetail(service, created.caseId, "mock:1101700123456", requestWithSession("http://localhost/detail"));
  assert.equal(officer.status, 403);
  const denied = await officer.json();
  assert.equal(denied.error.code, "FORBIDDEN");
  assert.doesNotMatch(JSON.stringify(denied), /MAP-6C-API/);
});

test("unknown case is 404 and service failure is 500", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugMapCaseDetailService(db);
  const missing = await handleDrugMapCaseDetail(service, "missing-case-id-0001", "mock:admin", requestWithSession("http://localhost/detail"));
  assert.equal(missing.status, 404);

  const failing = {
    load: async () => {
      throw new Error("boom");
    },
  } as unknown as DrugMapCaseDetailService;
  const failed = await handleDrugMapCaseDetail(failing, "any-case-id-0001", "mock:admin", requestWithSession("http://localhost/detail"));
  assert.equal(failed.status, 500);
});
