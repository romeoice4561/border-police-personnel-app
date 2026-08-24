/**
 * Handler-level permission + functional tests for the DI-7 Timeline API
 * surface (Section 18/22). Every route here is drug.read-gated — no
 * write endpoints exist (Section 12: Timeline is a consumer of DI-6
 * intelligence, never a second alert-generation engine).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugTimelineService } from "@/lib/drug_intelligence/drug_timeline_service";
import { handleDrugTimelineList, handleDrugTimelineGeographic, handleDrugTimelineCorrelations } from "@/lib/drug_intelligence/drug_timeline_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "TL-API-TEST",
    title: "คดีทดสอบ API ไทม์ไลน์",
    status: "OPEN",
    arrestDate: new Date("2026-08-01"),
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: "ชุมพร",
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

function requestWithSession(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

async function seedOneCase(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });
  const r = await caseService.createCase(
    baseCase({
      caseNumber: "TL-API-1",
      persons: [{ newPerson: { primaryFullName: "บุคคล เอพีไอ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );
  return { caseId: r.caseId };
}

// ---------------------------------------------------------------------
// Authorization (Section 18, 22)

test("timeline list: officer (no drug.* permissions) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline?actorId=mock:1101700123456");
  const response = await handleDrugTimelineList(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("timeline list: commander (drug.read) CAN view the timeline", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOneCase(db);
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline?actorId=mock:bpp414");
  const response = await handleDrugTimelineList(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
});

test("timeline list: missing session cookie is REJECTED with 401", async () => {
  const db = new InMemoryDatabaseClient();
  const timelineService = new DrugTimelineService(db);
  const request = new Request("http://localhost/api/drug-intelligence/timeline?actorId=mock:admin");
  const response = await handleDrugTimelineList(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 401);
});

test("geographic aggregate: officer is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline/geographic?actorId=mock:1101700123456");
  const response = await handleDrugTimelineGeographic(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("correlations: officer is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline/correlations?actorId=mock:1101700123456");
  const response = await handleDrugTimelineCorrelations(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

// ---------------------------------------------------------------------
// Functional / URL-state parsing (Section 4, 18)

test("timeline list: returns events + KPI for an authorized request", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOneCase(db);
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline?actorId=mock:admin");
  const response = await handleDrugTimelineList(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { groups: Array<{ events: unknown[] }>; totalCount: number; kpi: { eventCount: number } } };
  assert.equal(body.data.totalCount, 1);
  assert.equal(body.data.kpi.eventCount, 1);
});

test("timeline list: an unknown focus personId returns 404, not a silent empty result", async () => {
  const db = new InMemoryDatabaseClient();
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline?actorId=mock:admin&personId=nonexistent-id");
  const response = await handleDrugTimelineList(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 404);
});

test("timeline list: an invalid sort value is REJECTED with 400", async () => {
  const db = new InMemoryDatabaseClient();
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline?actorId=mock:admin&sort=SIDEWAYS");
  const response = await handleDrugTimelineList(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 400);
});

test("timeline list: groupMode=LOCATION regroups the SAME page without re-querying case data — group labels reflect province", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOneCase(db);
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline?actorId=mock:admin&groupMode=LOCATION");
  const response = await handleDrugTimelineList(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { groups: Array<{ groupLabel: string }> } };
  assert.equal(body.data.groups[0].groupLabel, "ชุมพร");
});

test("geographic aggregate: returns province rows for an authorized request", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOneCase(db);
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline/geographic?actorId=mock:admin");
  const response = await handleDrugTimelineGeographic(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { rows: Array<{ province: string; caseCount: number }> } };
  assert.equal(body.data.rows[0].province, "ชุมพร");
  assert.equal(body.data.rows[0].caseCount, 1);
});

test("correlations: returns an empty array (never throws) when no correlation signal exists", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOneCase(db);
  const timelineService = new DrugTimelineService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/timeline/correlations?actorId=mock:admin");
  const response = await handleDrugTimelineCorrelations(timelineService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { correlations: unknown[] } };
  assert.deepEqual(body.data.correlations, []);
});
