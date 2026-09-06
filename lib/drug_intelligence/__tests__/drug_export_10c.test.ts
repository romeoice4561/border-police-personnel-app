import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function requestWithSession(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function caseInput(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
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
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function exportJson(db: InMemoryDatabaseClient, body: Record<string, unknown>) {
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(body) })
  );
  return { response, json: (await response.json()) as { data?: { estimatedRecordCount?: number }; error?: { code?: string } } };
}

test("FY-only export includes start/end and excludes the days outside", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(caseInput({ caseNumber: "BEFORE", arrestDate: new Date("2025-09-30") }));
  await service.createCase(caseInput({ caseNumber: "START", arrestDate: new Date("2025-10-01") }));
  await service.createCase(caseInput({ caseNumber: "END", arrestDate: new Date("2026-09-30") }));
  await service.createCase(caseInput({ caseNumber: "AFTER", arrestDate: new Date("2026-10-01") }));
  const preview = await exportJson(db, {
    actorId: "mock:admin",
    intent: "PREVIEW",
    exportType: "OPERATIONAL_CASES",
    format: "CSV",
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/cases", period: { fiscalYearBe: 2569 } },
  });
  assert.equal(preview.response.status, 200);
  assert.equal(preview.json.data?.estimatedRecordCount, 2);
  const download = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "OPERATIONAL_CASES",
        format: "CSV",
        context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/cases", period: { fiscalYearBe: 2569 } },
      }),
    })
  );
  assert.equal(download.status, 200);
  const text = new TextDecoder().decode(await download.arrayBuffer());
  assert.match(text, /START/);
  assert.match(text, /END/);
  assert.doesNotMatch(text, /BEFORE/);
  assert.doesNotMatch(text, /AFTER/);
  assert.match(download.headers.get("content-disposition") ?? "", /fy2569/);
});

test("explicit dates override FY in preview and filename", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(caseInput({ caseNumber: "JAN", arrestDate: new Date("2026-01-15") }));
  await service.createCase(caseInput({ caseNumber: "JUN", arrestDate: new Date("2026-06-15") }));
  const preview = await exportJson(db, {
    actorId: "mock:admin",
    intent: "PREVIEW",
    exportType: "OPERATIONAL_CASES",
    format: "CSV",
    context: {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/cases",
      period: { fiscalYearBe: 2569, dateFrom: "2026-01-01", dateTo: "2026-01-31" },
    },
  });
  assert.equal(preview.json.data?.estimatedRecordCount, 1);
  const download = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "OPERATIONAL_CASES",
        format: "CSV",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/cases",
          period: { fiscalYearBe: 2569, dateFrom: "2026-01-01", dateTo: "2026-01-31" },
        },
      }),
    })
  );
  const text = new TextDecoder().decode(await download.arrayBuffer());
  assert.match(text, /JAN/);
  assert.doesNotMatch(text, /JUN/);
  assert.doesNotMatch(download.headers.get("content-disposition") ?? "", /fy2569/);
});

test("OPERATIONAL_PERSONS CSV is bounded and omits identifier columns", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(
    caseInput({
      persons: [
        {
          newPerson: {
            primaryFullName: "นายทดสอบ",
            nationality: null,
            dateOfBirth: null,
            notes: null,
            identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }],
          },
          role: "ARRESTED_PERSON",
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
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "OPERATIONAL_PERSONS",
        format: "CSV",
        context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/persons" },
      }),
    })
  );
  assert.equal(response.status, 200);
  const text = new TextDecoder().decode(await response.arrayBuffer());
  assert.match(text, /displayName/);
  assert.match(text, /นายทดสอบ/);
  assert.doesNotMatch(text, /1103700123456/);
  assert.doesNotMatch(text, /nationalId|phone|imei/);
});

test("CASE_REPORT HTML escapes injection and masks commander identifiers", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await new DrugCaseService({ db }).createCase(
    caseInput({
      title: `<script>alert(1)</script>`,
      narrative: `<img src=x onerror=alert(1)>`,
      persons: [
        {
          newPerson: {
            primaryFullName: "นายเอ",
            nationality: null,
            dateOfBirth: null,
            notes: null,
            aliases: [{ fullName: "ชื่อเล่น" }],
            identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }],
          },
          role: "ARRESTED_PERSON",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0812345678", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [{ iccid: "8966012345678901234", imsi: "520031234567890", carrier: "AIS", firstSeenAt: null, lastSeenAt: null, notes: null }],
          devices: [
            {
              brand: "X",
              model: "Y",
              serialNumber: "SN1",
              imei1: "350000000000001",
              imei2: null,
              firstSeenAt: null,
              lastSeenAt: null,
              notes: null,
            },
          ],
          vehicles: [
            {
              registrationNumber: "กข1234",
              registrationProvince: "เชียงราย",
              vehicleType: "PICKUP",
              brand: null,
              model: null,
              color: null,
              vin: "VIN123456789",
              firstSeenAt: null,
              lastSeenAt: null,
              notes: null,
            },
          ],
        },
      ],
      seizedItems: [
        {
          drugCategory: "METHAMPHETAMINE_TABLET",
          otherDrugCategoryLabel: null,
          measurementKind: "COUNT",
          drugType: "ยาบ้า",
          subtype: null,
          quantity: 1000,
          unit: "เม็ด",
          weightGrams: null,
          packageCount: 1,
          notes: null,
        },
        {
          drugCategory: "CRYSTAL_METHAMPHETAMINE",
          otherDrugCategoryLabel: null,
          measurementKind: "MASS",
          drugType: "ไอซ์",
          subtype: null,
          quantity: null,
          unit: null,
          weightGrams: 250,
          packageCount: 1,
          notes: null,
        },
      ],
      locations: [
        {
          name: "ด่าน",
          addressText: null,
          province: "เชียงราย",
          district: "แม่สาย",
          subdistrict: null,
          latitude: 20.43,
          longitude: 99.88,
          role: "ARREST_LOCATION",
          notes: null,
        },
      ],
    })
  );
  const commander = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:bpp414",
        exportType: "CASE_REPORT",
        format: "HTML_PRINT",
        masking: "MASKED",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/cases",
          case: { caseId },
        },
      }),
    })
  );
  assert.equal(commander.status, 200);
  const html = new TextDecoder().decode(await commander.arrayBuffer());
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /1103700123456/);
  assert.match(html, /xxxxxxxxx3456/);
  assert.doesNotMatch(html, /20\.43/);
  assert.match(html, /COUNT/);
  assert.match(html, /MASS/);
  assert.match(html, /ชื่อเล่น/);
  const forbiddenFull = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:bpp414",
        exportType: "CASE_REPORT",
        format: "HTML_PRINT",
        masking: "FULL",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/cases",
          case: { caseId },
        },
      }),
    })
  );
  assert.equal(forbiddenFull.status, 403);
  const adminFull = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "CASE_REPORT",
        format: "HTML_PRINT",
        masking: "FULL",
        context: {
          schemaVersion: 1,
          locale: "en",
          sourceRoute: "/drug-intelligence/cases",
          case: { caseId },
        },
      }),
    })
  );
  assert.equal(adminFull.status, 200);
  const fullHtml = new TextDecoder().decode(await adminFull.arrayBuffer());
  assert.match(fullHtml, /1103700123456/);
  assert.match(fullHtml, /20\.43/);
  assert.match(fullHtml, /Drug case report/);
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 2);
  for (const row of audits) {
    assert.doesNotMatch(String(row.detail), /1103700123456|0812345678|350000000000001/);
  }
});

test("missing and unknown case ids are rejected; alerts stay unimplemented", async () => {
  const db = new InMemoryDatabaseClient();
  const missing = await exportJson(db, {
    actorId: "mock:admin",
    exportType: "CASE_REPORT",
    format: "HTML_PRINT",
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/cases" },
  });
  assert.equal(missing.response.status, 400);
  const unknown = await exportJson(db, {
    actorId: "mock:admin",
    exportType: "CASE_REPORT",
    format: "HTML_PRINT",
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/cases", case: { caseId: "missing-case" } },
  });
  assert.equal(unknown.response.status, 404);
  const alerts = await exportJson(db, {
    actorId: "mock:admin",
    exportType: "OPERATIONAL_ALERTS",
    format: "CSV",
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/alerts" },
  });
  assert.equal(alerts.response.status, 501);
  const customPersons = await exportJson(db, {
    actorId: "mock:admin",
    exportType: "OPERATIONAL_PERSONS",
    format: "CSV",
    preset: "CUSTOM",
    columns: ["displayName", "phone", "nationalId"],
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/persons" },
  });
  assert.equal(customPersons.response.status, 400);
});
