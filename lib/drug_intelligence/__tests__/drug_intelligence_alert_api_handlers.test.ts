/**
 * Handler-level permission + functional tests for the DI-6 Intelligence
 * Alert API surface (Section 18 — drug.read is the floor for viewing;
 * drug.edit is required to review/dismiss/reopen; drug.create is required
 * to trigger generation, matching case creation's own gate).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugIntelligenceAlertService } from "@/lib/drug_intelligence/drug_intelligence_alert_service";
import {
  handleDrugAlertList,
  handleDrugAlertsForEntity,
  handleDrugAlertsForCase,
  handleDrugAlertGenerate,
  handleDrugAlertReview,
  handleDrugAlertDismiss,
  handleDrugAlertReopen,
} from "@/lib/drug_intelligence/drug_intelligence_alert_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "ALERT-API-TEST",
    title: "คดีทดสอบ API แจ้งเตือน",
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

function requestWithSession(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

function personWithPhone(name: string, rawInput: string) {
  return {
    newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
    role: "SUSPECT" as const,
    linkedOfficerId: null,
    notes: null,
    phones: [{ rawInput, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-10"), notes: null }],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

async function seedTwoAlertingCases(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);
  const r1 = await caseService.createCase(baseCase({ caseNumber: "ALERT-API-1", persons: [personWithPhone("บุคคล เอพีไอ เอ", "0899000001")] }));
  await alertService.generateAlertsForCase(r1.caseId, "mock:admin", "Administrator");
  const r2 = await caseService.createCase(baseCase({ caseNumber: "ALERT-API-2", persons: [personWithPhone("บุคคล เอพีไอ บี", "0899000001")] }));
  const alerts = await alertService.generateAlertsForCase(r2.caseId, "mock:admin", "Administrator");
  const alert = alerts.find((a) => a.alertType === "REPEAT_PHONE")!;
  return { caseId1: r1.caseId, caseId2: r2.caseId, alertId: alert.id };
}

test("list: officer (no drug.* permissions) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const alertService = new DrugIntelligenceAlertService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/alerts?actorId=mock:1101700123456");
  const response = await handleDrugAlertList(alertService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("list: commander (drug.read only) CAN view the alert list", async () => {
  const db = new InMemoryDatabaseClient();
  const alertService = new DrugIntelligenceAlertService(db);
  const request = requestWithSession("http://localhost/api/drug-intelligence/alerts?actorId=mock:bpp414");
  const response = await handleDrugAlertList(alertService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
});

test("list: missing session cookie is REJECTED with 401", async () => {
  const db = new InMemoryDatabaseClient();
  const alertService = new DrugIntelligenceAlertService(db);
  const request = new Request("http://localhost/api/drug-intelligence/alerts?actorId=mock:admin");
  const response = await handleDrugAlertList(alertService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 401);
});

test("list: returns alerts + KPI that agree with the returned list", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId2 } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts?actorId=mock:admin&currentCaseId=${caseId2}`);
  const response = await handleDrugAlertList(alertService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { alerts: unknown[]; totalCount: number; kpi: { repeatPhoneOrSim: number } } };
  assert.equal(body.data.alerts.length, 1);
  assert.equal(body.data.totalCount, 1);
  assert.equal(body.data.kpi.repeatPhoneOrSim, 1);
});

test("entity: commander can view alerts for one entity", async () => {
  const db = new InMemoryDatabaseClient();
  await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);
  const phone = (await db.drugPhoneNumber.findMany({}))[0];

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/entity?actorId=mock:bpp414&entityType=PHONE&entityId=${phone.id}`);
  const response = await handleDrugAlertsForEntity(alertService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { alerts: unknown[] } };
  assert.equal(body.data.alerts.length, 1);
});

test("case: alert summary scoped to one case", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId2 } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/case?actorId=mock:admin&caseId=${caseId2}`);
  const response = await handleDrugAlertsForCase(alertService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { alerts: unknown[] } };
  assert.equal(body.data.alerts.length, 1);
});

test("generate: commander (drug.read only, no drug.create) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);
  const r1 = await caseService.createCase(baseCase({ caseNumber: "GEN-1" }));

  const request = requestWithSession("http://localhost/api/drug-intelligence/alerts/generate", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander", caseId: r1.caseId }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertGenerate(alertService, request);
  assert.equal(response.status, 403);
});

test("generate: admin (drug.create) can trigger generation", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const alertService = new DrugIntelligenceAlertService(db);
  const r1 = await caseService.createCase(baseCase({ caseNumber: "GEN-2", persons: [personWithPhone("บุคคล เจน", "0899000099")] }));

  const request = requestWithSession("http://localhost/api/drug-intelligence/alerts/generate", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", caseId: r1.caseId }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertGenerate(alertService, request);
  assert.equal(response.status, 200);
});

test("review: commander (drug.read only, no drug.edit) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const { alertId } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/${alertId}/review`, {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander" }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertReview(alertService, alertId, request);
  assert.equal(response.status, 403);
});

test("review: admin (drug.edit) can review an alert, and the status persists", async () => {
  const db = new InMemoryDatabaseClient();
  const { alertId } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/${alertId}/review`, {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator" }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertReview(alertService, alertId, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { alert: { status: string } } };
  assert.equal(body.data.alert.status, "REVIEWED");
});

test("review: unknown alert id returns 404, never a raw DB error", async () => {
  const db = new InMemoryDatabaseClient();
  const alertService = new DrugIntelligenceAlertService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/alerts/nonexistent/review", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator" }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertReview(alertService, "nonexistent", request);
  assert.equal(response.status, 404);
});

test("dismiss: requires a non-empty reason (validation, not a DB error)", async () => {
  const db = new InMemoryDatabaseClient();
  const { alertId } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/${alertId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", reason: "" }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertDismiss(alertService, alertId, request);
  assert.equal(response.status, 400);
});

test("dismiss: admin (drug.edit) can dismiss with a reason, and it persists", async () => {
  const db = new InMemoryDatabaseClient();
  const { alertId } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/${alertId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", reason: "ตรวจสอบแล้ว" }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertDismiss(alertService, alertId, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { alert: { status: string; dismissReason: string } } };
  assert.equal(body.data.alert.status, "DISMISSED");
  assert.equal(body.data.alert.dismissReason, "ตรวจสอบแล้ว");
});

test("reopen: commander (no drug.edit) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const { alertId } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);
  await alertService.dismissAlert(alertId, "mock:admin", "Administrator", "test");

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/${alertId}/reopen`, {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander" }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertReopen(alertService, alertId, request);
  assert.equal(response.status, 403);
});

test("reopen: admin can reopen a dismissed alert back to NEW", async () => {
  const db = new InMemoryDatabaseClient();
  const { alertId } = await seedTwoAlertingCases(db);
  const alertService = new DrugIntelligenceAlertService(db);
  await alertService.dismissAlert(alertId, "mock:admin", "Administrator", "test");

  const request = requestWithSession(`http://localhost/api/drug-intelligence/alerts/${alertId}/reopen`, {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator" }),
    headers: { "content-type": "application/json" },
  });
  const response = await handleDrugAlertReopen(alertService, alertId, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { alert: { status: string } } };
  assert.equal(body.data.alert.status, "NEW");
});
