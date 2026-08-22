/**
 * Handler-level permission + audit tests for the DI-3 Global Search API
 * surface (Section 27 — drug.read is the floor for every search endpoint).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import { handleDrugSearchGrouped, handleDrugSearchByType } from "@/lib/drug_intelligence/drug_search_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "SEARCH-PERM-TEST",
    title: "คดีทดสอบสิทธิ์การค้นหา",
    status: "OPEN",
    arrestDate: null,
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: null,
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

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

test("search: officer (no drug.* permissions) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/search?actorId=mock:1101700123456&actorName=Officer&q=test");
  const response = await handleDrugSearchGrouped(search, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("search: commander (drug.read only) CAN search — search is read-only, never a higher bar", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/search?actorId=mock:bpp414&actorName=Commander&q=test");
  const response = await handleDrugSearchGrouped(search, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
});

test("search: missing session cookie is REJECTED with 401", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);

  const request = new Request("http://localhost/api/drug-intelligence/search?actorId=mock:admin&actorName=Administrator&q=test");
  const response = await handleDrugSearchGrouped(search, new URL(request.url).searchParams, request);
  assert.equal(response.status, 401);
});

test("search: a successful non-empty-query search writes exactly one search_performed audit row without the raw query text", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "AUDIT-1", persons: [{ newPerson: { primaryFullName: "ตรวจสอบบันทึก", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "1234567890123", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const search = new DrugIntelligenceSearchService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/search?actorId=mock:admin&actorName=Administrator&q=1234567890123");
  const response = await handleDrugSearchGrouped(search, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);

  const auditRows = await db.drugAuditLog.findMany({ where: { action: "search_performed" } });
  assert.equal(auditRows.length, 1);
  const detail = (auditRows[0] as { detail: string }).detail;
  assert.ok(!detail.includes("1234567890123"), "the raw sensitive query value must never appear in the audit detail");
  assert.ok(detail.includes("classification="));
  assert.ok(detail.includes("results="));
});

test("search: an empty query never writes an audit row", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/search?actorId=mock:admin&actorName=Administrator&q=");
  await handleDrugSearchGrouped(search, new URL(request.url).searchParams, request);

  const auditRows = await db.drugAuditLog.findMany({ where: { action: "search_performed" } });
  assert.equal(auditRows.length, 0);
});

test("search by-type: officer is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/search/by-type?actorId=mock:1101700123456&q=test&entityType=PERSON&page=1&pageSize=20");
  const response = await handleDrugSearchByType(search, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("search by-type: commander CAN paginate a single entity type", async () => {
  const db = new InMemoryDatabaseClient();
  const search = new DrugIntelligenceSearchService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/search/by-type?actorId=mock:bpp414&q=test&entityType=CASE&page=1&pageSize=20");
  const response = await handleDrugSearchByType(search, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
});

test("search: commander (drug.read only) receives masked sensitive values", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "MASK-PERM-1", persons: [{ newPerson: { primaryFullName: "มาสก์สิทธิ์", nationality: null, dateOfBirth: null, notes: null, identifiers: [{ type: "THAI_ID", value: "9998887776655", notes: null }] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] })
  );
  const search = new DrugIntelligenceSearchService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/search?actorId=mock:bpp414&actorName=Commander&q=9998887776655");
  const response = await handleDrugSearchGrouped(search, new URL(request.url).searchParams, request);
  const body = (await response.json()) as { data: { groups: Array<{ entityType: string; results: Array<{ matchedValueMasked: string }> }> } };
  const personGroup = body.data.groups.find((g) => g.entityType === "PERSON");
  assert.ok(personGroup);
  assert.notEqual(personGroup!.results[0].matchedValueMasked, "9998887776655");
});
