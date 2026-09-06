import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import {
  buildDrugCommanderReportV1,
  renderDrugCommanderReportHtml,
} from "@/lib/drug_intelligence/drug_commander_report";
import { resolveCommanderFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { commanderUrlStateToExportContext, exportContextToCommanderFilter } from "@/lib/drug_intelligence/drug_export_commander_context";
import { resolveDrugExportContext } from "@/lib/drug_intelligence/drug_export_context";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

function requestWithSession(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

function newSuspect(name: string): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: [],
    },
    role: "ARRESTED_PERSON",
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
    caseNumber: "CMD-10D-001",
    title: "คดีทดสอบรายงานผู้บังคับบัญชา",
    status: "OPEN",
    arrestDate: new Date("2026-08-15"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    leadHeadquartersId: null,
    leadRegionId: null,
    leadBattalionId: null,
    leadCompanyId: null,
    leadUnitText: null,
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
    participatingUnits: [],
    officers: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

function commanderBody(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "mock:admin",
    intent: "DOWNLOAD",
    exportType: "COMMANDER_REPORT",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/command",
      period: { fiscalYearBe: 2569 },
    },
    ...overrides,
  };
}

async function seedParityFixture(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({
    caseNumber: "10D-JUL",
    arrestDate: new Date("2026-07-10"),
    province: "ชุมพร",
    battalionId: 16,
    latitude: 10.5,
    longitude: 99.1,
    persons: [newSuspect("ผู้ถูกจับ ก.ค.")],
    seizedItems: [
      { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 100, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
    ],
  }));
  await caseService.createCase(baseCase({
    caseNumber: "10D-AUG-1",
    arrestDate: new Date("2026-08-10"),
    province: "ชุมพร",
    battalionId: 16,
    latitude: 10.5,
    longitude: 99.1,
    persons: [newSuspect("ผู้ถูกจับ ส.ค.")],
    seizedItems: [
      { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 300, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
      { drugCategory: "CRYSTAL_METHAMPHETAMINE", measurementKind: "MASS", drugType: "ไอซ์", quantity: null, unit: null, weightGrams: 500, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
    ],
  }));
  await caseService.createCase(baseCase({
    caseNumber: "10D-AUG-2<script>alert(1)</script>",
    title: "<img onerror=alert(1)>",
    arrestDate: new Date("2026-08-12"),
    province: "ระนอง & ทดสอบ",
    battalionId: null,
    latitude: null,
    longitude: null,
    seizedItems: [
      { drugCategory: "OTHER", measurementKind: "COUNT", drugType: "อื่น", quantity: 1, unit: "ชิ้น", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: "ไม่ทราบ", subtype: null },
    ],
  }));
  await db.drugIntelligenceAlert.create({
    data: {
      id: "alert-10d-1",
      alertType: "REPEAT_PERSON",
      status: "NEW",
      severity: "HIGH",
      entityType: "PERSON",
      entityId: "person-secret",
      title: "ไม่ควรโผล่ในรายงาน 0812345678",
      explanation: "test",
      currentCaseId: null,
      priorCaseIds: [],
      relatedPersonIds: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrenceCount: 3,
      dedupeKey: "test-10d-1",
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      dismissReason: null,
      createdAt: new Date(),
    },
  });
  await db.drugIntelligenceAlert.create({
    data: {
      id: "alert-10d-2",
      alertType: "HIGH_CONFIDENCE_DUPLICATE",
      status: "NEW",
      severity: "HIGH",
      entityType: "PERSON",
      entityId: "person-dup",
      title: "duplicate 1103700123456",
      explanation: "test",
      currentCaseId: null,
      priorCaseIds: [],
      relatedPersonIds: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrenceCount: 2,
      dedupeKey: "test-10d-2",
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      dismissReason: null,
      createdAt: new Date(),
    },
  });
}

test("adapter preserves FY, explicit dates, org, and province through resolveCommanderFilter", () => {
  const fy = commanderUrlStateToExportContext({ fy: "2569", province: "ชุมพร", battalionId: "16" }, "th");
  const fyFilter = exportContextToCommanderFilter(fy);
  const fyDirect = resolveCommanderFilter(params({ fy: "2569", province: "ชุมพร", battalionId: "16" }));
  assert.equal(fyFilter.fiscalYearBe, fyDirect.fiscalYearBe);
  assert.equal(fyFilter.province, fyDirect.province);
  assert.equal(fyFilter.reportingBattalionId, fyDirect.reportingBattalionId);
  assert.equal(fyFilter.arrestDateFrom.toISOString(), fyDirect.arrestDateFrom.toISOString());

  const custom = commanderUrlStateToExportContext({ from: "2026-08-01", to: "2026-08-31", hqId: "1", fy: "2569" }, "en");
  const customFilter = exportContextToCommanderFilter(custom);
  const customDirect = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31", hqId: "1" }));
  assert.equal(customFilter.fiscalYearBe, undefined);
  assert.equal(customFilter.reportingHeadquartersId, customDirect.reportingHeadquartersId);
  assert.equal(customFilter.arrestDateFrom.toISOString(), customDirect.arrestDateFrom.toISOString());
  assert.equal(customFilter.arrestDateTo.toISOString(), customDirect.arrestDateTo.toISOString());
});

test("report values match Commander dashboard services for the same scope", async () => {
  const db = new InMemoryDatabaseClient();
  await seedParityFixture(db);
  const context = resolveDrugExportContext(
    {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/command",
      period: { dateFrom: "2026-08-01", dateTo: "2026-08-31" },
    },
    "mock:admin",
    new Date("2026-09-06T03:00:00.000Z")
  );
  const filter = exportContextToCommanderFilter(context);
  const service = new DrugCommanderDashboardService(db);
  const [overview, seizures, trend, areas, units, decision, report] = await Promise.all([
    service.getOverview(filter),
    service.getSeizures(filter),
    service.getTrend(filter),
    service.getAreas(filter),
    service.getUnits(filter),
    service.getDecision(filter),
    buildDrugCommanderReportV1(db, { context, generatedBy: "Administrator" }),
  ]);

  assert.equal(report.kpis.find((k) => k.id === "cases")?.current, overview.caseCount);
  assert.equal(report.kpis.find((k) => k.id === "arrested")?.current, overview.arrestedPersonCount);
  assert.equal(report.kpis.find((k) => k.id === "alerts")?.current, overview.newAlertsCount);
  assert.equal(report.kpis.find((k) => k.id === "duplicates")?.current, overview.pendingDuplicatesCount);
  assert.equal(report.kpis.find((k) => k.id === "cases")?.previous, decision.previousCaseCount);
  assert.equal(report.dataReadiness.casesMissingArrested, overview.casesWithoutArrestedRoleCount);
  assert.equal(report.dataReadiness.casesMissingReportingUnit, decision.readiness.casesMissingReportingUnit);
  assert.equal(report.dataReadiness.casesMissingCoordinates, decision.readiness.casesMissingCoordinates);
  assert.equal(report.dataReadiness.casesWithIncompleteSeizureCategory, decision.readiness.casesWithIncompleteSeizureCategory);
  assert.equal(report.units.unassignedCaseCount, units.unassignedCaseCount);
  assert.deepEqual(report.areas.map((row) => row.caseCount), areas.rows.map((row) => row.caseCount));
  assert.deepEqual(report.trend.map((row) => row.caseCount), trend.buckets.map((row) => row.caseCount));
  const meth = report.seizures.find((row) => row.drugCategory === "METHAMPHETAMINE_TABLET" && row.measurementKind === "COUNT");
  const ice = report.seizures.find((row) => row.drugCategory === "CRYSTAL_METHAMPHETAMINE" && row.measurementKind === "MASS");
  const serviceMeth = seizures.items.find((row) => row.drugCategory === "METHAMPHETAMINE_TABLET" && row.measurementKind === "COUNT");
  const serviceIce = seizures.items.find((row) => row.drugCategory === "CRYSTAL_METHAMPHETAMINE" && row.measurementKind === "MASS");
  assert.equal(meth?.value, serviceMeth?.totalQuantity);
  assert.equal(ice?.value, serviceIce?.totalWeightKg);
  assert.equal(report.scope.periodSource, "EXPLICIT_DATES");
  assert.equal(report.scope.fiscalYearBe, null);
  assert.equal(report.comparisonScope.kind, "previous-window");
  assert.ok(report.units.unassignedCaseCount > 0);
  assert.ok(report.attentionItems.some((item) => item.id === "missing-unit"));
});

test("HTML is escaped, has no PII, and uses deterministic empty-safe comparison text", async () => {
  const db = new InMemoryDatabaseClient();
  await seedParityFixture(db);
  const context = resolveDrugExportContext(
    {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/command",
      period: { dateFrom: "2026-08-01", dateTo: "2026-08-31" },
      geo: { province: "<script>alert(1)</script>" },
    },
    "mock:admin",
    new Date("2026-09-06T03:00:00.000Z")
  );
  const report = await buildDrugCommanderReportV1(db, { context, generatedBy: "Admin <script>" });
  const html = renderDrugCommanderReportHtml(report);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /0812345678|1103700123456|person-secret/);
  assert.doesNotMatch(html, /Infinity|NaN|undefined|null/);
  assert.doesNotMatch(html, /risk score|พื้นที่อันตราย|เครือข่ายสำคัญ|AI conclusion/i);
  assert.match(html, /ไม่ใช่คะแนนความเสี่ยง|ไม่ใช่ข้อสรุปจากปัญญาประดิษฐ์/);
  assert.match(html, /COUNT/);
  assert.match(html, /MASS/);
  assert.doesNotMatch(html, /total drugs|ยารวม/i);
  assert.match(html, /ไม่มีข้อมูล|ชุมพร|ระนอง/);
  assert.equal(report.maskingMode, "MASKED");
});

test("empty scope stays readable and zero comparison never yields Infinity", async () => {
  const db = new InMemoryDatabaseClient();
  const context = resolveDrugExportContext(
    {
      schemaVersion: 1,
      locale: "en",
      sourceRoute: "/drug-intelligence/command",
      period: { dateFrom: "2020-01-01", dateTo: "2020-01-31" },
    },
    "mock:admin",
    new Date("2026-09-06T03:00:00.000Z")
  );
  const report = await buildDrugCommanderReportV1(db, { context, generatedBy: "Administrator" });
  const html = renderDrugCommanderReportHtml(report);
  assert.equal(report.kpis.find((k) => k.id === "cases")?.current, 0);
  assert.equal(report.kpis.find((k) => k.id === "cases")?.percentChange, null);
  assert.equal(report.seizures.length, 0);
  assert.equal(report.areas.length, 0);
  assert.equal(report.units.rows.length, 0);
  assert.match(html, /No data/);
  assert.doesNotMatch(html, /Infinity|NaN/);
  assert.match(html, /Drug situation report for commanders/);
});

test("commander can generate the aggregate report; officer cannot; preview has no audit", async () => {
  const db = new InMemoryDatabaseClient();
  await seedParityFixture(db);
  const officer = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(commanderBody({ actorId: "mock:1101700123456" })) })
  );
  assert.equal(officer.status, 403);
  const preview = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify(commanderBody({
        actorId: "mock:bpp414",
        intent: "PREVIEW",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/command",
          period: { dateFrom: "2026-08-01", dateTo: "2026-08-31" },
        },
      })),
    })
  );
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { data: { implemented: boolean; estimatedRecordCount: number } };
  assert.equal(previewJson.data.implemented, true);
  assert.equal(previewJson.data.estimatedRecordCount, 2);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);

  const commander = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify(commanderBody({
        actorId: "mock:bpp414",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/command",
          period: { dateFrom: "2026-08-01", dateTo: "2026-08-31" },
          actorId: "mock:injected",
          generatedAt: "1999-01-01T00:00:00.000Z",
        },
      })),
    })
  );
  assert.equal(commander.status, 200);
  assert.match(commander.headers.get("Content-Type") ?? "", /text\/html/);
  assert.match(commander.headers.get("Cache-Control") ?? "", /no-store/);
  assert.match(commander.headers.get("Content-Disposition") ?? "", /commander-report-20260906|commander-report-/);
  const html = new TextDecoder().decode(await commander.arrayBuffer());
  assert.doesNotMatch(html, /mock:injected|1999-01-01/);
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 1);
  assert.match(String(audits[0]?.detail), /COMMANDER_REPORT/);
  assert.doesNotMatch(String(audits[0]?.detail), /0812345678|1103700123456|<html/);
});

test("unsupported commander format and failed generate do not write export_created", async () => {
  const db = new InMemoryDatabaseClient();
  const csv = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(commanderBody({ format: "CSV" })) })
  );
  assert.equal(csv.status, 400);
  const map = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(commanderBody({ exportType: "MAP_DATA", format: "JSON" })) })
  );
  assert.equal(map.status, 501);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);
});

test("FY filename includes fy token; explicit dates omit it", async () => {
  const db = new InMemoryDatabaseClient();
  const fy = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(commanderBody()) })
  );
  assert.equal(fy.status, 200);
  assert.match(fy.headers.get("Content-Disposition") ?? "", /fy2569/);
  const custom = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify(commanderBody({
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/command",
          period: { fiscalYearBe: 2569, dateFrom: "2026-08-01", dateTo: "2026-08-31" },
        },
      })),
    })
  );
  assert.equal(custom.status, 200);
  assert.doesNotMatch(custom.headers.get("Content-Disposition") ?? "", /fy2569/);
});
