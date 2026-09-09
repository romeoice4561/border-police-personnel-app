/**
 * DI-10E.5C — Geographic Intelligence Report (MAP_DATA + HTML_PRINT).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import { projectExportHistoryItem } from "@/lib/drug_intelligence/drug_export_history";
import {
  drugGeoFilterStateToExportContext,
  exportContextToGeographicReportFilter,
} from "@/lib/drug_intelligence/drug_export_geo_context";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { createEmptyDrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";
import { GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT } from "@/lib/drug_intelligence/drug_geographic_report_query";
import type { DrugCaseCreateRequest, DrugCaseSeizedItemInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = process.cwd();
const PERSON_A_ID = "b9a6c674-db36-4f40-a7de-4c9a727c37a7";
const PERSON_F_ID = "1f230a17-8055-4905-9e01-d24fde3b08ec";
const REPORT_FILES = [
  "lib/drug_intelligence/drug_geographic_report.ts",
  "lib/drug_intelligence/drug_export_geo_context.ts",
  "lib/drug_intelligence/drug_export_service.ts",
  "components/drug_intelligence/drug_geo_report_drawer.tsx",
];

function requestWithSession(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function mapBody(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "mock:admin",
    intent: "DOWNLOAD",
    exportType: "MAP_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/map",
      period: { dateFrom: "2026-01-01", dateTo: "2026-12-31" },
    },
    ...overrides,
  };
}

function seized(kind: "COUNT" | "MASS"): DrugCaseSeizedItemInput {
  if (kind === "COUNT") {
    return {
      drugCategory: "METHAMPHETAMINE_TABLET",
      otherDrugCategoryLabel: null,
      measurementKind: "COUNT",
      drugType: "ยาบ้า",
      subtype: null,
      quantity: 10,
      unit: "เม็ด",
      weightGrams: null,
      packageCount: null,
      notes: null,
    };
  }
  return {
    drugCategory: "CRYSTAL_METHAMPHETAMINE",
    otherDrugCategoryLabel: null,
    measurementKind: "MASS",
    drugType: "ไอซ์",
    subtype: null,
    quantity: null,
    unit: "กรัม",
    weightGrams: 25,
    packageCount: null,
    notes: null,
  };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "GEO-10E5C-001",
    title: "คดีทดสอบรายงานพื้นที่",
    status: "OPEN",
    arrestDate: new Date("2026-03-15"),
    arrestTime: null,
    headquartersId: 1,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    leadUnitText: "ชุดจับกุม",
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    locationName: "จุดตรวจ",
    latitude: 10.4,
    longitude: 99.1,
    narrative: null,
    persons: [],
    seizedItems: [seized("COUNT")],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function seedBareCase(db: InMemoryDatabaseClient, id: string, caseNumber: string): Promise<void> {
  await db.drugCase.create({
    data: {
      id,
      caseNumber,
      title: caseNumber,
      status: "OPEN",
      arrestDate: new Date("2026-01-15"),
      headquartersId: null,
      leadHeadquartersId: null,
      province: "ชุมพร",
      district: null,
      locationName: null,
      reportingUnitText: "กก.",
      leadUnitText: null,
      latitude: null,
      longitude: null,
      createdBy: "qa",
      createdByName: "QA",
    },
  });
}

test("A/B/C: MAP_DATA HTML_PRINT is implemented; CSV and JSON stay closed", () => {
  const service = new DrugExportService(new InMemoryDatabaseClient());
  assert.equal(service.isImplemented("MAP_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("MAP_DATA", "CSV"), false);
  assert.equal(service.isImplemented("MAP_DATA", "JSON"), false);
  assert.equal(service.isImplemented("OPERATIONAL_ALERTS", "CSV"), false);
});

test("D/E/F: report modules use the bounded foundation and avoid getGeoResult / MAX_SAFE_INTEGER", () => {
  for (const file of REPORT_FILES) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(src, /getGeoResult/, file);
    assert.doesNotMatch(src, /Number\.MAX_SAFE_INTEGER/, file);
    assert.doesNotMatch(src, /DrugGeoIntelligenceService/, file);
  }
  const reportSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_geographic_report.ts"), "utf8");
  assert.match(reportSrc, /DrugGeographicReportQueryService|GeographicReportQueryResult/);
  const serviceSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_export_service.ts"), "utf8");
  assert.match(serviceSrc, /DrugGeographicReportQueryService/);
});

test("G/H/I/K: Map filters map to export context without mixing reporting and lead org", () => {
  const state = {
    ...createEmptyDrugGeoFilterState(),
    dateFrom: "2026-01-01",
    dateTo: "2026-06-30",
    province: "ชุมพร",
    district: "ท่าแซะ",
    status: "OPEN",
    drugCategory: "METHAMPHETAMINE_TABLET",
    headquartersId: 1,
    regionId: 2,
    leadHeadquartersId: 9,
    leadCompanyId: 90,
    personId: "person-1",
    caseId: "case-should-not-export",
  };
  const context = drugGeoFilterStateToExportContext(state, "th");
  assert.equal(context.period?.dateFrom, "2026-01-01");
  assert.equal(context.period?.dateTo, "2026-06-30");
  assert.equal(context.organization?.hqId, 1);
  assert.equal(context.organization?.regionId, 2);
  assert.equal(context.leadOrganization?.hqId, 9);
  assert.equal(context.leadOrganization?.companyId, 90);
  assert.equal(context.organization?.companyId, undefined);
  assert.equal(context.geo?.province, "ชุมพร");
  assert.equal(context.geo?.district, "ท่าแซะ");
  assert.equal(context.geo?.status, "OPEN");
  assert.equal(context.geo?.drugCategory, "METHAMPHETAMINE_TABLET");
  assert.equal(context.person?.personId, "person-1");
  assert.equal(context.case, undefined);
  assert.equal(context.map, undefined);
  const filter = exportContextToGeographicReportFilter(context);
  assert.equal(filter.headquartersId, 1);
  assert.equal(filter.leadHeadquartersId, 9);
  assert.equal(filter.personId, "person-1");
});

test("J: FY is passed through when present in export period, not invented from Map URL", () => {
  const context = drugGeoFilterStateToExportContext(createEmptyDrugGeoFilterState(), "th");
  assert.equal(context.period, undefined);
  const fyFilter = exportContextToGeographicReportFilter({
    schemaVersion: 1,
    locale: "th",
    sourceRoute: "/drug-intelligence/map",
    period: { fiscalYearBe: 2569 },
  });
  assert.equal(fyFilter.fiscalYearBe, 2569);
  assert.equal(fyFilter.dateFrom, undefined);
});

test("L-R/S/T/U/X/Y: GENERATE builds HTML from foundation, omits coordinates, and writes one audit", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "GEO-A",
      latitude: 10.4,
      longitude: 99.1,
      seizedItems: [seized("COUNT"), seized("MASS")],
    })
  );
  await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "GEO-B",
      latitude: null,
      longitude: null,
      district: null,
      province: "ระนอง",
      seizedItems: [seized("MASS")],
    })
  );

  const preview = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(mapBody({ intent: "PREVIEW" })) })
  );
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as {
    data: { implemented: boolean; estimatedRecordCount: number; geographicSummary: { totalCases: number; printedCaseCount: number } };
  };
  assert.equal(previewJson.data.implemented, true);
  assert.equal(previewJson.data.estimatedRecordCount, 2);
  assert.equal(previewJson.data.geographicSummary.totalCases, 2);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);

  const generated = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(mapBody()) })
  );
  assert.equal(generated.status, 200);
  const html = await generated.text();
  const filename = generated.headers.get("content-disposition") ?? "";
  assert.match(filename, /drug-geographic-report-\d{8}\.html/);
  assert.match(html, /รายงานข่าวกรองเชิงพื้นที่ยาเสพติด/);
  assert.match(html, /GEOGRAPHIC INTELLIGENCE REPORT/);
  assert.match(html, /จำนวนคดีทั้งหมด/);
  assert.match(html, /ข้อมูลมีพิกัด/);
  assert.match(html, /ข้อมูลไม่มีพิกัด/);
  assert.match(html, /จำนวนคดีที่บันทึกตามจังหวัดภายใต้ตัวกรองนี้/);
  assert.match(html, /จำนวนคดีที่บันทึกตามอำเภอ/);
  assert.match(html, /ไม่ระบุอำเภอ|ท่าแซะ/);
  assert.match(html, /ยาบ้า|ไอซ์/);
  assert.match(html, /จำนวนนับ|น้ำหนัก/);
  assert.match(html, /GEO-A/);
  assert.match(html, /GEO-B/);
  assert.match(html, /คดีที่ไม่มีพิกัดยังถูกรวมในการคำนวณสรุปตามพื้นที่/);
  assert.match(html, /FACT \/ DIRECT/);
  assert.match(html, /ANALYTIC SUMMARY/);
  assert.match(html, /QUERY CONDITION/);
  assert.match(html, /รายงานนี้ไม่ใช่ risk score หรือ threat score/);
  assert.match(html, /ไม่ได้หมายถึงพื้นที่เสี่ยงหรือเส้นทางลำเลียง/);
  assert.doesNotMatch(html, /10\.4|99\.1|latitude|longitude|data-lat|data-lng/);
  assert.doesNotMatch(html, /hotspot|จุดเสี่ยง|พื้นที่อาชญากรรม|ศูนย์กลางยาเสพติด/);
  assert.doesNotMatch(html, /ยอดยาเสพติดรวม/);
  assert.doesNotMatch(html, /leaflet|openstreetmap|osm/i);
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 1);
});

test("S/T: FULL mode still omits raw coordinates", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(baseCase({ caseNumber: "GEO-FULL", latitude: 12.3, longitude: 101.2 }));
  const generated = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(mapBody({ masking: "FULL" })) })
  );
  assert.equal(generated.status, 200);
  const html = await generated.text();
  assert.doesNotMatch(html, /12\.3|101\.2|latitude|longitude/);
  assert.match(html, /แสดงข้อมูลเต็ม|ปกปิดข้อมูลอ่อนไหว/);
});

test("V/W: PREVIEW writes no audit; GENERATE writes exactly one", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(baseCase());
  await handleDrugExportCreate(new DrugExportService(db), requestWithSession({ body: JSON.stringify(mapBody({ intent: "PREVIEW" })) }));
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);
  await handleDrugExportCreate(new DrugExportService(db), requestWithSession({ body: JSON.stringify(mapBody()) }));
  await handleDrugExportCreate(new DrugExportService(db), requestWithSession({ body: JSON.stringify(mapBody()) }));
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 2);
});

test("X: recordCount is matching case count", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(baseCase({ caseNumber: "C1" }));
  await new DrugCaseService({ db }).createCase(baseCase({ caseNumber: "C2" }));
  const result = await new DrugExportService(db).generate({
    actorName: "Administrator",
    exportType: "MAP_DATA",
    format: "HTML_PRINT",
    maskingMode: "MASKED",
    context: {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/map",
      actorId: "mock:admin",
      generatedAt: "2026-09-08T10:00:00.000Z",
    },
  });
  assert.equal(result.recordCount, 2);
  assert.match(result.filename, /^drug-geographic-report-\d{8}\.html$/);
});

test("Z: history projects MAP_DATA to the geographic report kind", () => {
  const item = projectExportHistoryItem({
    id: "h1",
    createdAt: new Date("2026-09-08T03:15:00.000Z"),
    detail: JSON.stringify({
      exportType: "MAP_DATA",
      format: "HTML_PRINT",
      recordCount: 4,
      filename: "drug-geographic-report-20260908.html",
    }),
  });
  assert.equal(item.reportKind, "map");
  assert.equal(item.formatKind, "print");
  assert.equal(item.recordCount, 4);
});

test("AA/AF: Center launches Map and keeps alerts coming soon", () => {
  const centerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_reporting_center.tsx"), "utf8");
  const mapSrc = readFileSync(join(ROOT, "app/drug-intelligence/map/page.tsx"), "utf8");
  assert.match(centerSrc, /data-testid="report-card-map"/);
  assert.match(centerSrc, /\/drug-intelligence\/map/);
  assert.match(centerSrc, /withReturnTo/);
  assert.doesNotMatch(centerSrc, /data-testid="coming-soon-map"/);
  assert.match(centerSrc, /data-testid="coming-soon-alerts"/);
  assert.doesNotMatch(centerSrc, /MAP_DATA|OPERATIONAL_ALERTS|getGeoResult|Number\.MAX_SAFE_INTEGER/);
  assert.match(mapSrc, /data-testid="map-geographic-report-action"/);
  assert.match(mapSrc, /can\("drug.export"\)/);
  assert.match(mapSrc, /DrugGeoReportDrawer/);
});

test("AB/AE: Map drawer uses the shared print helper", () => {
  const drawerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_geo_report_drawer.tsx"), "utf8");
  assert.match(drawerSrc, /openHtmlPrintReport/);
  assert.match(drawerSrc, /htmlPrintFailureMessage/);
  assert.doesNotMatch(drawerSrc, /noopener,noreferrer/);
  assert.doesNotMatch(drawerSrc, /t\("di\.export\.downloadFailed"\)/);
});

test("AC: officer without drug.export is denied", async () => {
  const db = new InMemoryDatabaseClient();
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(mapBody({ actorId: "mock:1101700123456" })) })
  );
  assert.equal(response.status, 403);
});

test("AD: commander can generate MASKED geographic HTML", async () => {
  const db = new InMemoryDatabaseClient();
  await new DrugCaseService({ db }).createCase(baseCase({ actorId: "mock:bpp414", actorName: "Commander" }));
  const generated = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(mapBody({ actorId: "mock:bpp414", masking: "MASKED" })) })
  );
  assert.equal(generated.status, 200);
  const html = await generated.text();
  assert.match(html, /ปกปิดข้อมูลอ่อนไหว/);
  assert.doesNotMatch(html, /10\.4|99\.1/);
});

test("AF: OPERATIONAL_ALERTS remains unimplemented", async () => {
  const alerts = await handleDrugExportCreate(
    new DrugExportService(new InMemoryDatabaseClient()),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "OPERATIONAL_ALERTS",
        format: "CSV",
        context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/alerts" },
      }),
    })
  );
  assert.equal(alerts.status, 501);
});

test("hard-limit generate does not write HTML or audit", async () => {
  const db = new InMemoryDatabaseClient();
  for (let i = 0; i < GEOGRAPHIC_REPORT_MATCHING_HARD_LIMIT + 1; i += 1) {
    await seedBareCase(db, `lim-${i}`, `LIM-${i}`);
  }
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "MAP_DATA",
        format: "HTML_PRINT",
        context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/map" },
      }),
    })
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: { code?: string; message?: string } };
  assert.equal(body.error?.code, "TOO_MANY_ROWS");
  assert.match(body.error?.message ?? "", /ขีดจำกัดของรายงาน/);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);
});

test("zero-match GENERATE still creates a valid empty HTML report", async () => {
  const db = new InMemoryDatabaseClient();
  const generated = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(mapBody()) })
  );
  assert.equal(generated.status, 200);
  const html = await generated.text();
  assert.match(html, /รายงานข่าวกรองเชิงพื้นที่ยาเสพติด/);
  assert.match(html, /วิธีการและข้อจำกัดการตีความ/);
  assert.doesNotMatch(html, /leaflet|latitude/);
});

test("AH: QA Person A and Person F remain distinct and are not merged by this module", () => {
  assert.notEqual(PERSON_A_ID, PERSON_F_ID);
  for (const file of [
    "lib/drug_intelligence/drug_geographic_report.ts",
    "lib/drug_intelligence/drug_export_geo_context.ts",
    "lib/drug_intelligence/drug_export_service.ts",
  ]) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(src, /mergePersons|DrugPersonMerge/);
    assert.doesNotMatch(src, new RegExp(PERSON_A_ID));
    assert.doesNotMatch(src, new RegExp(PERSON_F_ID));
  }
});
