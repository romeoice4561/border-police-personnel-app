import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function requestWithSession(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function baseContext() {
  return {
    schemaVersion: 1,
    locale: "th",
    sourceRoute: "/drug-intelligence/cases",
    period: { fiscalYearBe: 2569 },
  };
}

function exportBody(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "mock:admin",
    intent: "DOWNLOAD",
    exportType: "OPERATIONAL_CASES",
    format: "CSV",
    context: baseContext(),
    ...overrides,
  };
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

async function seedCase(db: InMemoryDatabaseClient) {
  await new DrugCaseService({ db }).createCase(baseCase());
}

test("officer without drug.export is forbidden", async () => {
  const db = new InMemoryDatabaseClient();
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ actorId: "mock:1101700123456" })) })
  );
  assert.equal(response.status, 403);
});

test("commander can generate masked operational cases CSV", async () => {
  const db = new InMemoryDatabaseClient();
  await seedCase(db);
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ actorId: "mock:bpp414" })) })
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type") ?? "", /text\/csv/);
  assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
  assert.match(response.headers.get("Content-Disposition") ?? "", /filename\*=UTF-8''/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder("utf-8").decode(bytes);
  assert.match(csv, /ตชด\.44-2569-001/);
  assert.doesNotMatch(csv, /0812345678|1103700123456/);
});

test("admin FULL request is allowed; commander FULL is forbidden", async () => {
  const db = new InMemoryDatabaseClient();
  await seedCase(db);
  const commander = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ actorId: "mock:bpp414", masking: "FULL" })) })
  );
  assert.equal(commander.status, 403);
  const admin = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ masking: "FULL" })) })
  );
  assert.equal(admin.status, 200);
});

test("malicious columns and malformed context are 400", async () => {
  const db = new InMemoryDatabaseClient();
  const columns = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify(exportBody({ preset: "CUSTOM", columns: ["phone", "imei"] })),
    })
  );
  assert.equal(columns.status, 400);
  const context = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify(exportBody({ context: { schemaVersion: 1, locale: "th", sourceRoute: "/login" } })),
    })
  );
  assert.equal(context.status, 400);
});

test("invalid type/format and unimplemented reports do not download empty files", async () => {
  const db = new InMemoryDatabaseClient();
  const badType = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ exportType: "NOT_A_TYPE" })) })
  );
  assert.equal(badType.status, 400);
  const unimplemented = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ exportType: "BOARD_DATA", format: "JSON" })) })
  );
  assert.equal(unimplemented.status, 501);
  const wrongFormat = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ format: "JSON" })) })
  );
  assert.equal(wrongFormat.status, 400);
});

test("preview returns contract without raw rows and without audit", async () => {
  const db = new InMemoryDatabaseClient();
  await seedCase(db);
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ intent: "PREVIEW" })) })
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { estimatedRecordCount: number; columns: Array<{ key: string }> } };
  assert.equal(body.data.estimatedRecordCount, 1);
  assert.ok(body.data.columns.some((c) => c.key === "caseNumber"));
  assert.equal((body.data as { rows?: unknown }).rows, undefined);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);
});

test("successful download writes a safe export_created audit", async () => {
  const db = new InMemoryDatabaseClient();
  await seedCase(db);
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody()) })
  );
  assert.equal(response.status, 200);
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 1);
  const detail = audits[0]?.detail ?? "";
  assert.match(detail, /OPERATIONAL_CASES/);
  assert.match(detail, /recordCount/);
  assert.doesNotMatch(detail, /0812345678|IMSI|IMEI|signedUrl|annotationText|eyJhbGciOi/);
});

test("row hard max rejects without writing export_created", async () => {
  const db = new InMemoryDatabaseClient();
  const original = DrugCaseRepository.prototype.list;
  DrugCaseRepository.prototype.list = async () => ({ rows: [], total: 5001 });
  try {
    const response = await handleDrugExportCreate(
      new DrugExportService(db),
      requestWithSession({ body: JSON.stringify(exportBody()) })
    );
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "TOO_MANY_ROWS");
    assert.equal(await db.drugAuditLog.count(), 0);
  } finally {
    DrugCaseRepository.prototype.list = original;
  }
});

test("failed unimplemented generate does not write export_created", async () => {
  const db = new InMemoryDatabaseClient();
  await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(exportBody({ exportType: "MAP_DATA", format: "JSON" })) })
  );
  assert.equal(await db.drugAuditLog.count(), 0);
});
