import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import {
  clampExportHistoryTake,
  DRUG_EXPORT_HISTORY_DEFAULT_TAKE,
  DRUG_EXPORT_HISTORY_MAX_TAKE,
  projectExportHistoryItem,
} from "@/lib/drug_intelligence/drug_export_history";
import { handleDrugExportHistory } from "@/lib/drug_intelligence/drug_export_history_api_handlers";
import { personsListFiltersToExportContext } from "@/lib/drug_intelligence/drug_export_persons_list_context";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(url, { ...init, headers });
}

function exportBody(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "mock:admin",
    intent: "DOWNLOAD",
    exportType: "OPERATIONAL_PERSONS",
    format: "CSV",
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/reports" },
    ...overrides,
  };
}

function person(name: string, extras?: Partial<DrugCasePersonInput["newPerson"]>): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: [],
      ...extras,
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

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "10E4-001",
    title: "คดีทดสอบศูนย์รายงาน",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
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

async function historyJson(db: InMemoryDatabaseClient, actorId: string, take?: number) {
  const params = new URLSearchParams({ actorId });
  if (take != null) params.set("take", String(take));
  const response = await handleDrugExportHistory(
    db,
    params,
    requestWithSession(`http://localhost/api/drug-intelligence/exports/history?${params}`)
  );
  const body = (await response.json()) as {
    data?: { items: Array<Record<string, unknown>> };
    error?: { code: string };
  };
  return { response, body };
}

test("clampExportHistoryTake stays between default and 50", () => {
  assert.equal(clampExportHistoryTake(undefined), DRUG_EXPORT_HISTORY_DEFAULT_TAKE);
  assert.equal(clampExportHistoryTake(0), DRUG_EXPORT_HISTORY_DEFAULT_TAKE);
  assert.equal(clampExportHistoryTake(-3), DRUG_EXPORT_HISTORY_DEFAULT_TAKE);
  assert.equal(clampExportHistoryTake(20), 20);
  assert.equal(clampExportHistoryTake(999), DRUG_EXPORT_HISTORY_MAX_TAKE);
});

test("history projection never copies searchQuery, HTML, or raw detail", () => {
  const item = projectExportHistoryItem({
    id: "row-1",
    createdAt: new Date("2026-09-08T03:15:00.000Z"),
    detail: JSON.stringify({
      exportType: "OPERATIONAL_PERSONS",
      format: "CSV",
      locale: "th",
      recordCount: 12,
      filename: "drug-persons-2026-09-08.csv",
      contextSummary: { searchQuery: "1101700123456", caseId: "abc" },
      html: "<html>secret</html>",
    }),
  });
  const serialized = JSON.stringify(item);
  assert.equal(item.reportKind, "persons_csv");
  assert.equal(item.formatKind, "csv");
  assert.equal(item.recordCount, 12);
  assert.equal(item.filename, "drug-persons-2026-09-08.csv");
  assert.doesNotMatch(serialized, /searchQuery|1101700123456|<html>|CASE_REPORT|PERSON_DATA|HTML_PRINT|OPERATIONAL_PERSONS/);
  assert.equal("detail" in item, false);
});

test("unsafe filenames are omitted from history", () => {
  const item = projectExportHistoryItem({
    id: 9,
    createdAt: new Date("2026-09-08T03:15:00.000Z"),
    detail: JSON.stringify({
      exportType: "CASE_REPORT",
      format: "HTML_PRINT",
      recordCount: 1,
      filename: "phone-0812345678.html",
    }),
  });
  assert.equal(item.filename, null);
  assert.equal(item.reportKind, "case");
  assert.equal(item.formatKind, "print");
});

test("MAP_DATA and OPERATIONAL_ALERTS remain unimplemented", () => {
  const service = new DrugExportService(new InMemoryDatabaseClient());
  assert.equal(service.isImplemented("MAP_DATA", "HTML_PRINT"), false);
  assert.equal(service.isImplemented("OPERATIONAL_ALERTS", "CSV"), false);
});

test("officer without drug.export cannot read history", async () => {
  const db = new InMemoryDatabaseClient();
  const { response } = await historyJson(db, "mock:1101700123456");
  assert.equal(response.status, 403);
});

test("commander can read own history and remains isolated from admin", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(baseCase({ persons: [person("นายทดสอบศูนย์")] }));
  await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession("http://localhost/api/drug-intelligence/exports", {
      method: "POST",
      body: JSON.stringify(exportBody({ actorId: "mock:bpp414" })),
    })
  );
  await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession("http://localhost/api/drug-intelligence/exports", {
      method: "POST",
      body: JSON.stringify(exportBody()),
    })
  );

  const commander = await historyJson(db, "mock:bpp414");
  const admin = await historyJson(db, "mock:admin");
  assert.equal(commander.response.status, 200);
  assert.equal(admin.response.status, 200);
  assert.equal(commander.body.data?.items.length, 1);
  assert.equal(admin.body.data?.items.length, 1);
  assert.equal(commander.body.data?.items[0]?.reportKind, "persons_csv");
  const adminText = JSON.stringify(admin.body);
  assert.doesNotMatch(adminText, /searchQuery|detail|HTML_PRINT|OPERATIONAL_PERSONS|<html>/);
});

test("admin history is current actor only even when other export_created rows exist", async () => {
  const db = new InMemoryDatabaseClient();
  const audit = new DrugAuditLogRepository(db);
  await audit.record({
    entityType: "DrugExport",
    entityId: "other-1",
    action: DRUG_EXPORT_AUDIT_ACTION,
    actorId: "mock:bpp414",
    actorName: "Commander",
    detail: JSON.stringify({ exportType: "COMMANDER_REPORT", format: "HTML_PRINT", recordCount: 3, filename: "drug-commander-report.html" }),
  });
  await audit.record({
    entityType: "DrugExport",
    entityId: "admin-1",
    action: DRUG_EXPORT_AUDIT_ACTION,
    actorId: "mock:admin",
    actorName: "Administrator",
    detail: JSON.stringify({ exportType: "OPERATIONAL_CASES", format: "CSV", recordCount: 8, filename: "drug-cases.csv" }),
  });
  const { response, body } = await historyJson(db, "mock:admin");
  assert.equal(response.status, 200);
  assert.equal(body.data?.items.length, 1);
  assert.equal(body.data?.items[0]?.reportKind, "cases_csv");
});

test("history is newest first and take is clamped to 50", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < 55; i += 1) {
    await db.drugAuditLog.create({
      data: {
        entityType: "DrugExport",
        entityId: `exp-${i}`,
        action: DRUG_EXPORT_AUDIT_ACTION,
        actorId: "mock:admin",
        actorName: "Administrator",
        detail: JSON.stringify({
          exportType: "OPERATIONAL_CASES",
          format: "CSV",
          recordCount: i,
          filename: `drug-cases-${i}.csv`,
        }),
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      },
    });
  }
  const { body } = await historyJson(db, "mock:admin", 999);
  assert.equal(body.data?.items.length, 50);
  const counts = body.data?.items.map((item) => item.recordCount) ?? [];
  assert.equal(counts[0], 54);
  assert.ok((counts[0] as number) > (counts[1] as number));
});

test("persons CSV PREVIEW does not write export_created; GENERATE writes one", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(baseCase({ persons: [person("นายส่งออกบุคคล")] }));
  const preview = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession("http://localhost/api/drug-intelligence/exports", {
      method: "POST",
      body: JSON.stringify(exportBody({ intent: "PREVIEW" })),
    })
  );
  assert.equal(preview.status, 200);
  const previewBody = (await preview.json()) as { data: { estimatedRecordCount: number; implemented: boolean } };
  assert.equal(previewBody.data.implemented, true);
  assert.ok(previewBody.data.estimatedRecordCount >= 1);
  const afterPreview = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(afterPreview.length, 0);

  const generated = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession("http://localhost/api/drug-intelligence/exports", {
      method: "POST",
      body: JSON.stringify(exportBody()),
    })
  );
  assert.equal(generated.status, 200);
  const text = new TextDecoder().decode(await generated.arrayBuffer());
  assert.match(text, /displayName|นายส่งออกบุคคล/);
  assert.doesNotMatch(text, /nationalId|phone|imei/);
  const afterGenerate = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(afterGenerate.length, 1);
});

test("persons CSV context is searchQuery or all active persons only", () => {
  const all = personsListFiltersToExportContext({}, "th");
  assert.equal(all.searchQuery, undefined);
  assert.equal(all.sourceRoute, "/drug-intelligence/reports");
  const filtered = personsListFiltersToExportContext({ searchQuery: " แดง " }, "th");
  assert.equal(filtered.searchQuery, "แดง");
  assert.equal(filtered.geo, undefined);
  assert.equal(filtered.organization, undefined);
});

test("MAP_DATA and OPERATIONAL_ALERTS generate remain 501", async () => {
  const db = new InMemoryDatabaseClient();
  const map = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession("http://localhost/api/drug-intelligence/exports", {
      method: "POST",
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "MAP_DATA",
        format: "HTML_PRINT",
        context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/map" },
      }),
    })
  );
  const alerts = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession("http://localhost/api/drug-intelligence/exports", {
      method: "POST",
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "OPERATIONAL_ALERTS",
        format: "CSV",
        context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/alerts" },
      }),
    })
  );
  assert.equal(map.status, 501);
  assert.equal(alerts.status, 501);
});

test("Center history opening does not write audit by itself", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugPersonRepository(db).create({
    id: "person-center-1",
    primaryFullName: "นายไม่ถูกรวม",
    nationality: null,
    dateOfBirth: null,
    notes: null,
    createdBy: "mock:admin",
    createdByName: "Administrator",
  });
  await historyJson(db, "mock:admin");
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 0);
});
