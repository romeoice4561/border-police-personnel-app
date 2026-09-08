import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { requireDrugExport, resolveDrugExportAccess } from "@/lib/drug_intelligence/drug_export_auth";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import {
  DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION,
  DRUG_EXPORT_CASE_REPORT_SOFT_PER_SECTION,
  exportLimitsForType,
} from "@/lib/drug_intelligence/drug_export_limits";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { CASE_REPORT_SECTIONS } from "@/lib/drug_intelligence/drug_export_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const RAW_PHONE = "0812345678";
const RAW_NATIONAL_ID = "1103700123456";
const RAW_IMSI = "520031234567890";
const RAW_ICCID = "8966012345678901234";
const RAW_IMEI = "350000000000001";
const RAW_SERIAL = "SERIAL-ABC-9999";
const RAW_PLATE = "กข1234";
const RAW_VIN = "VIN123456789";
const RAW_LAT = "20.43";
const RAW_LNG = "99.88";
const FORBIDDEN_CLAIMS =
  /ร่วมขบวนการ|สมรู้ร่วมคิด|เป็นเครือข่ายเดียวกัน|โทรหากัน|ความเป็นเจ้าของ|เจ้าของรถ|caller|callee|\bCDR\b|conspiracy|owner|ownership/i;

function requestWithSession(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function person(name: string, extras?: Partial<DrugCasePersonInput>): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nickname: extras?.newPerson?.nickname ?? "แดง",
      nationality: extras?.newPerson?.nationality ?? "ไทย",
      sex: extras?.newPerson?.sex ?? "MALE",
      dateOfBirth: extras?.newPerson?.dateOfBirth ?? null,
      notes: extras?.newPerson?.notes ?? null,
      aliases: extras?.newPerson?.aliases ?? [{ fullName: "ชื่อเล่น" }],
      identifiers: extras?.newPerson?.identifiers ?? [{ type: "THAI_ID", value: RAW_NATIONAL_ID, notes: null }],
    },
    role: extras?.role ?? "ARRESTED_PERSON",
    linkedOfficerId: extras?.linkedOfficerId ?? null,
    notes: extras?.notes ?? null,
    phones: extras?.phones ?? [
      { rawInput: RAW_PHONE, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null },
    ],
    sims: extras?.sims ?? [
      { iccid: RAW_ICCID, imsi: RAW_IMSI, carrier: "AIS", firstSeenAt: null, lastSeenAt: null, notes: null },
    ],
    devices: extras?.devices ?? [
      {
        brand: "X",
        model: "Y",
        serialNumber: RAW_SERIAL,
        imei1: RAW_IMEI,
        imei2: null,
        firstSeenAt: null,
        lastSeenAt: null,
        notes: null,
      },
    ],
    vehicles: extras?.vehicles ?? [
      {
        registrationNumber: RAW_PLATE,
        registrationProvince: "เชียงราย",
        vehicleType: "PICKUP",
        brand: null,
        model: null,
        color: null,
        vin: RAW_VIN,
        firstSeenAt: null,
        lastSeenAt: null,
        notes: null,
      },
    ],
  };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "QA-001",
    title: "คดีทดสอบรายงานคดี",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "14:30",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    leadUnitText: "กก.ตชด.44",
    province: "เชียงราย",
    district: "แม่สาย",
    subdistrict: null,
    locationName: "ด่าน",
    latitude: 20.43,
    longitude: 99.88,
    narrative: "บันทึกการจับกุมทดสอบ",
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function seedRichCase(db: InMemoryDatabaseClient) {
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      title: '<script>alert(1)</script>',
      narrative: `<img src=x onerror=alert(1)>`,
      participatingUnits: [
        {
          headquartersId: null,
          regionId: null,
          battalionId: null,
          companyId: null,
          unitText: "สภ.ท่าแซะ",
          role: "PARTICIPATING",
          note: null,
        },
      ],
      officers: [
        {
          officerId: null,
          manualRank: "ร.ต.ต.",
          manualFullName: "ทดสอบ ผู้จับกุม",
          manualPosition: null,
          manualUnitText: "ป.ป.ส. ภาค 8",
          role: "ARRESTING_OFFICER",
          note: null,
        },
      ],
      persons: [person('<img onerror=alert(1)> สมชาย')],
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
  await db.drugIntelligenceAlert.create({
    data: {
      id: generateDrugId(),
      alertType: "REPEAT_PERSON",
      status: "NEW",
      severity: "HIGH",
      entityType: "CASE",
      entityId: created.caseId,
      title: "สมรู้ร่วมคิด",
      explanation: "เป็นเครือข่ายเดียวกัน และโทรหากัน",
      currentCaseId: created.caseId,
      priorCaseIds: [],
      relatedPersonIds: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrenceCount: 2,
      dedupeKey: `case-repeat-${created.caseId}`,
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      dismissReason: null,
      createdAt: new Date(),
    },
  });
  return created;
}

function caseBody(caseId: string, overrides: Record<string, unknown> = {}) {
  return {
    actorId: "mock:admin",
    intent: "DOWNLOAD",
    exportType: "CASE_REPORT",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/cases",
      case: { caseId },
    },
    ...overrides,
  };
}

async function exportHtml(db: InMemoryDatabaseClient, body: Record<string, unknown>) {
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(body) })
  );
  const html = response.status === 200 ? new TextDecoder().decode(await response.arrayBuffer()) : "";
  return { response, html };
}

async function exportJson(db: InMemoryDatabaseClient, body: Record<string, unknown>) {
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(body) })
  );
  return {
    response,
    json: (await response.json()) as {
      data?: { estimatedRecordCount?: number; implemented?: boolean; columns?: Array<{ key: string; label: string }> };
      error?: { code?: string; message?: string };
    },
  };
}

async function addSeizedRows(db: InMemoryDatabaseClient, caseId: string, count: number) {
  const repo = new DrugEntityRepository(db);
  for (let i = 0; i < count; i += 1) {
    await repo.addSeizedItem({
      caseId,
      drugCategory: "METHAMPHETAMINE_TABLET",
      otherDrugCategoryLabel: null,
      measurementKind: "COUNT",
      drugType: "ยาบ้า",
      subtype: null,
      quantity: i + 1,
      unit: `รายการ-${String(i).padStart(3, "0")}`,
      weightGrams: null,
      packageCount: 1,
      notes: null,
      createdBy: "mock:admin",
    });
  }
}

test("CASE_REPORT HTML_PRINT is the only implemented case-report pair", () => {
  const service = new DrugExportService(new InMemoryDatabaseClient());
  assert.equal(service.isImplemented("CASE_REPORT", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("CASE_REPORT", "CSV"), false);
  assert.equal(exportLimitsForType("CASE_REPORT").softLimit, DRUG_EXPORT_CASE_REPORT_SOFT_PER_SECTION);
  assert.equal(exportLimitsForType("CASE_REPORT").hardLimit, DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION);
  assert.equal(DRUG_EXPORT_CASE_REPORT_SOFT_PER_SECTION, 50);
  assert.equal(DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION, 200);
});

test("authorization requires both drug.read and drug.export; officer is denied", async () => {
  assert.equal(resolveDrugExportAccess(["drug.read"]).canExport, false);
  assert.equal(resolveDrugExportAccess(["drug.export"]).canExport, false);
  assert.equal(resolveDrugExportAccess(["drug.read", "drug.export"]).canExport, true);
  assert.equal(requireDrugExport(defaultPermissionsForRole("officer")), null);
  assert.equal(requireDrugExport(defaultPermissionsForRole("admin"))?.canExport, true);

  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const officer = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(caseBody(caseId, { actorId: "mock:1101700123456" })) })
  );
  assert.equal(officer.status, 403);
});

test("lookup distinguishes missing context, unknown case, and wrong format", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const missing = await exportJson(db, {
    actorId: "mock:admin",
    intent: "PREVIEW",
    exportType: "CASE_REPORT",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/cases" },
  });
  assert.equal(missing.response.status, 400);
  assert.equal(missing.json.error?.code, "INVALID_CONTEXT");

  const unknown = await exportJson(db, caseBody("missing-case-id", { intent: "PREVIEW" }));
  assert.equal(unknown.response.status, 404);
  assert.equal(unknown.json.error?.code, "NOT_FOUND");

  const csv = await exportJson(db, caseBody(caseId, { format: "CSV", intent: "DOWNLOAD" }));
  assert.equal(csv.response.status, 400);
  assert.equal(csv.json.error?.code, "INVALID_FORMAT");
});

test("commander stays MASKED; admin FULL keeps the existing case-report contract", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const commander = await exportHtml(db, caseBody(caseId, { actorId: "mock:bpp414" }));
  assert.equal(commander.response.status, 200);
  assert.doesNotMatch(commander.html, new RegExp(RAW_NATIONAL_ID));
  assert.doesNotMatch(commander.html, new RegExp(RAW_PHONE));
  assert.doesNotMatch(commander.html, new RegExp(RAW_LAT));

  const forbiddenFull = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(caseBody(caseId, { actorId: "mock:bpp414", masking: "FULL" })) })
  );
  assert.equal(forbiddenFull.status, 403);

  const adminFull = await exportHtml(db, caseBody(caseId, { masking: "FULL", context: {
    schemaVersion: 1,
    locale: "en",
    sourceRoute: "/drug-intelligence/cases",
    case: { caseId },
  } }));
  assert.equal(adminFull.response.status, 200);
  assert.match(adminFull.html, new RegExp(RAW_NATIONAL_ID));
  assert.match(adminFull.html, new RegExp(RAW_LAT));
  assert.match(adminFull.html, /CASE INTELLIGENCE REPORT/);
});

test("CASE_REPORT HTML includes masthead, FACT units/officers, ANALYTIC signals, and stored case role", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const { response, html } = await exportHtml(db, caseBody(caseId));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition") ?? "", /drug-case-|QA-001/);
  assert.match(html, /รายงานข้อมูลคดี/);
  assert.match(html, /CASE INTELLIGENCE REPORT/);
  assert.match(html, /Border Patrol Police Personnel Intelligence System/);
  assert.match(html, /ข่าวกรองยาเสพติด/);
  assert.match(html, /QA-001/);
  assert.match(html, /กก\.ตชด\.44/);
  assert.match(html, /ผู้ถูกจับกุม/);
  assert.match(html, /ชื่อเล่น/);
  assert.match(html, /สภ\.ท่าแซะ/);
  assert.match(html, /ทดสอบ ผู้จับกุม/);
  assert.match(html, /ป\.ป\.ส\. ภาค 8/);
  assert.match(html, /REPEAT_PERSON/);
  assert.match(html, /ANALYTIC SIGNAL|สัญญาณวิเคราะห์/);
  assert.match(html, /badge-analytic/);
  assert.match(html, /badge-fact/);
  assert.match(html, /ข้อเท็จจริงจากฐานข้อมูล/);
  assert.match(html, /วิธีการและข้อจำกัดการตีความ/);
  assert.match(html, /class="kpi"/);
  assert.match(html, /COUNT/);
  assert.match(html, /MASS/);
  assert.match(html, /ไม่ได้โดยลำพังพิสูจน์ความผิด/);
  assert.match(html, /ไม่ได้หมายความว่าเป็นที่พักอาศัย/);
});

test("masked CASE_REPORT never exposes raw identifiers, serial, plate, VIN, or coordinates", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const { html } = await exportHtml(db, caseBody(caseId));
  assert.doesNotMatch(html, new RegExp(RAW_PHONE));
  assert.doesNotMatch(html, new RegExp(RAW_NATIONAL_ID));
  assert.doesNotMatch(html, new RegExp(RAW_IMSI));
  assert.doesNotMatch(html, new RegExp(RAW_ICCID));
  assert.doesNotMatch(html, new RegExp(RAW_IMEI));
  assert.doesNotMatch(html, new RegExp(RAW_SERIAL));
  assert.doesNotMatch(html, new RegExp(RAW_PLATE));
  assert.doesNotMatch(html, new RegExp(RAW_VIN));
  assert.doesNotMatch(html, new RegExp(RAW_LAT));
  assert.doesNotMatch(html, new RegExp(RAW_LNG));
  assert.doesNotMatch(html, /signedUrl|https:\/\/storage|blob:/i);
  assert.match(html, /xxxxxxxxx3456/);
  assert.doesNotMatch(html, />ละติจูด<|>Longitude<|>Latitude</i);
});

test("CASE_REPORT does not invent guilt, ownership, or CDR language", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const { html } = await exportHtml(db, caseBody(caseId));
  assert.doesNotMatch(html, FORBIDDEN_CLAIMS);
  assert.match(html, /รายงานนี้ไม่ใช่คะแนนความเสี่ยงหรือคะแนนภัยคุกคาม/);
});

test("user-controlled case text is HTML-escaped", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const { html } = await exportHtml(db, caseBody(caseId));
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img onerror/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img onerror/);
});

test("COUNT and MASS remain separate dimensions", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const { html } = await exportHtml(db, caseBody(caseId));
  assert.match(html, /COUNT/);
  assert.match(html, /MASS/);
  assert.doesNotMatch(html, /total drugs|ยารวม|รวมยาเสพติด/i);
});

test("sparse CASE_REPORT omits empty relationship sections", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "QA-003",
      title: "คดีว่าง",
      arrestDate: null,
      arrestTime: null,
      persons: [],
      seizedItems: [],
      locations: [],
      participatingUnits: [],
      officers: [],
    })
  );
  const { response, html } = await exportHtml(db, caseBody(caseId));
  assert.equal(response.status, 200);
  assert.match(html, /รายงานข้อมูลคดี/);
  assert.match(html, /CASE INTELLIGENCE REPORT/);
  assert.match(html, /QA-003/);
  assert.match(html, /วิธีการและข้อจำกัดการตีความ/);
  assert.doesNotMatch(html, /class="kpi"/);
  assert.doesNotMatch(html, /ไม่มีข้อมูล/);
  assert.doesNotMatch(html, /หน่วยร่วมปฏิบัติ/);
  assert.doesNotMatch(html, /ชุดจับกุม/);
  assert.doesNotMatch(html, /สัญญาณที่มีในระบบ/);
});

test("51 rows truncate to 50 with disclosure; 201 rows fail closed", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await new DrugCaseService({ db }).createCase(baseCase({ seizedItems: [] }));
  await addSeizedRows(db, caseId, 51);
  const truncated = await exportHtml(db, caseBody(caseId));
  assert.equal(truncated.response.status, 200);
  assert.match(truncated.html, /แสดง 50 จาก 51 รายการ/);
  assert.match(truncated.html, /รายการ-000/);
  assert.doesNotMatch(truncated.html, /รายการ-050/);

  const over = new InMemoryDatabaseClient();
  const overCase = await new DrugCaseService({ db: over }).createCase(baseCase({ caseNumber: "QA-OVER", seizedItems: [] }));
  await addSeizedRows(over, overCase.caseId, DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION + 1);
  const result = await exportJson(over, caseBody(overCase.caseId));
  assert.equal(result.response.status, 400);
  assert.equal(result.json.error?.code, "TOO_MANY_ROWS");
});

test("preview does not write export_created and returns a meaningful record count", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const preview = await exportJson(db, caseBody(caseId, { intent: "PREVIEW" }));
  assert.equal(preview.response.status, 200);
  assert.equal(preview.json.data?.implemented, true);
  assert.ok((preview.json.data?.estimatedRecordCount ?? 0) > 1);
  const keys = (preview.json.data?.columns ?? []).map((col) => col.key);
  for (const key of CASE_REPORT_SECTIONS) {
    assert.ok(keys.includes(key), `missing section ${key}`);
  }
  assert.equal(keys.includes("caseNumber"), false);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);
});

test("generate writes exactly one safe export_created audit", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const { response, html } = await exportHtml(db, caseBody(caseId));
  assert.equal(response.status, 200);
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 1);
  const detail = String(audits[0]?.detail ?? "");
  assert.match(detail, /CASE_REPORT/);
  assert.match(detail, /HTML_PRINT/);
  assert.match(detail, new RegExp(caseId));
  assert.doesNotMatch(detail, new RegExp(RAW_PHONE));
  assert.doesNotMatch(detail, new RegExp(RAW_NATIONAL_ID));
  assert.doesNotMatch(detail, new RegExp(RAW_IMSI));
  assert.doesNotMatch(detail, new RegExp(RAW_ICCID));
  assert.doesNotMatch(detail, new RegExp(RAW_IMEI));
  assert.doesNotMatch(detail, new RegExp(RAW_SERIAL));
  assert.doesNotMatch(detail, new RegExp(RAW_PLATE));
  assert.doesNotMatch(detail, new RegExp(RAW_LAT));
  assert.doesNotMatch(detail, /signedUrl|https:\/\/storage/i);
  assert.equal(detail.includes("<!DOCTYPE html>"), false);
  assert.equal(detail.includes(html.slice(0, 120)), false);
});

test("generating the case report is read-only besides export audit", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seedRichCase(db);
  const persons = await db.drugPerson.findMany({});
  const personId = persons[0]!.id;
  const before = {
    person: await db.drugPerson.findUnique({ where: { id: personId } }),
    caseRow: await db.drugCase.findUnique({ where: { id: caseId } }),
    cases: await db.drugCase.count(),
    people: await db.drugCasePerson.count(),
    phones: await db.drugPhoneNumber.count(),
    sims: await db.drugSim.count(),
    devices: await db.drugDevice.count(),
    vehicles: await db.drugVehicle.count(),
    seizures: await db.drugSeizedItem.count(),
    locations: await db.drugLocation.count(),
    units: await db.drugCaseParticipatingUnit.count(),
    officers: await db.drugCaseOfficer.count(),
    alerts: await db.drugIntelligenceAlert.count(),
    aliases: await db.drugPersonAlias.count(),
    identifiers: await db.drugPersonIdentifier.count(),
  };
  const { response } = await exportHtml(db, caseBody(caseId));
  assert.equal(response.status, 200);
  const afterPerson = await db.drugPerson.findUnique({ where: { id: personId } });
  const afterCase = await db.drugCase.findUnique({ where: { id: caseId } });
  assert.equal(afterPerson?.updatedAt.toISOString(), before.person?.updatedAt.toISOString());
  assert.equal(afterCase?.updatedAt.toISOString(), before.caseRow?.updatedAt.toISOString());
  assert.equal(await db.drugCase.count(), before.cases);
  assert.equal(await db.drugCasePerson.count(), before.people);
  assert.equal(await db.drugPhoneNumber.count(), before.phones);
  assert.equal(await db.drugSim.count(), before.sims);
  assert.equal(await db.drugDevice.count(), before.devices);
  assert.equal(await db.drugVehicle.count(), before.vehicles);
  assert.equal(await db.drugSeizedItem.count(), before.seizures);
  assert.equal(await db.drugLocation.count(), before.locations);
  assert.equal(await db.drugCaseParticipatingUnit.count(), before.units);
  assert.equal(await db.drugCaseOfficer.count(), before.officers);
  assert.equal(await db.drugIntelligenceAlert.count(), before.alerts);
  assert.equal(await db.drugPersonAlias.count(), before.aliases);
  assert.equal(await db.drugPersonIdentifier.count(), before.identifiers);
});

test("CASE_REPORT drawer and page reuse shared HTML print helper", () => {
  const drawerSrc = readFileSync(join(process.cwd(), "components/drug_intelligence/drug_case_report_drawer.tsx"), "utf8");
  const pageSrc = readFileSync(join(process.cwd(), "app/drug-intelligence/cases/[id]/page.tsx"), "utf8");
  const builderSrc = readFileSync(join(process.cwd(), "lib/drug_intelligence/drug_case_report.ts"), "utf8");
  assert.match(pageSrc, /can\("drug.export"\)/);
  assert.match(pageSrc, /data-testid="case-report-btn"/);
  assert.match(drawerSrc, /openHtmlPrintReport/);
  assert.match(drawerSrc, /htmlPrintFailureMessage/);
  assert.match(drawerSrc, /di\.export\.printReport/);
  assert.match(drawerSrc, /di\.export\.close/);
  assert.match(drawerSrc, /di\.export\.caseMaskingNotice/);
  assert.match(drawerSrc, /di\.export\.caseScope/);
  assert.match(drawerSrc, /data-testid="case-report-print-btn"/);
  assert.match(drawerSrc, /data-testid="case-report-close-btn"/);
  assert.doesNotMatch(drawerSrc, /noopener,noreferrer/);
  assert.doesNotMatch(drawerSrc, /window\.print\(\)/);
  assert.doesNotMatch(drawerSrc, /t\("di\.export\.downloadFailed"\)/);
  assert.doesNotMatch(builderSrc, /getCase\(/);
  assert.doesNotMatch(builderSrc, /DrugCaseService/);
});

test("Person, Commander, and Investigation Board report pairs stay unchanged", () => {
  const service = new DrugExportService(new InMemoryDatabaseClient());
  assert.equal(service.isImplemented("PERSON_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("COMMANDER_REPORT", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("BOARD_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("PERSON_DATA", "CSV"), false);
  const personSrc = readFileSync(join(process.cwd(), "lib/drug_intelligence/drug_person_report.ts"), "utf8");
  const commanderSrc = readFileSync(join(process.cwd(), "lib/drug_intelligence/drug_commander_report.ts"), "utf8");
  const boardSrc = readFileSync(join(process.cwd(), "lib/drug_intelligence/drug_investigation_board_report.ts"), "utf8");
  assert.match(personSrc, /buildDrugPersonReportV1/);
  assert.match(commanderSrc, /buildDrugCommanderReportV1/);
  assert.match(boardSrc, /buildDrugInvestigationBoardReportV1/);
  assert.doesNotMatch(personSrc + commanderSrc + boardSrc, /CASE_DATA/);
});
