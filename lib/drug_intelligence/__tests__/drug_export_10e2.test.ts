import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { requireDrugExport, resolveDrugExportAccess } from "@/lib/drug_intelligence/drug_export_auth";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import {
  DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION,
  DRUG_EXPORT_PERSON_REPORT_SOFT_PER_SECTION,
  exportLimitsForType,
} from "@/lib/drug_intelligence/drug_export_limits";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const RAW_PHONE = "0891234567";
const RAW_NATIONAL_ID = "1103700123456";
const RAW_IMSI = "520031234567890";
const RAW_ICCID = "8966012345678901234";
const RAW_IMEI = "350000000000001";
const RAW_PLATE = "กข1234";
const RAW_LAT = "20.43";
const RAW_LNG = "99.88";
const FORBIDDEN_CLAIMS =
  /ร่วมขบวนการ|สมรู้ร่วมคิด|เป็นเครือข่ายเดียวกัน|โทรหากัน|conspiracy|caller|callee|\bCDR\b/i;

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
      aliases: extras?.newPerson?.aliases ?? [{ fullName: "ไอ้แดง" }],
      identifiers: extras?.newPerson?.identifiers ?? [{ type: "THAI_ID", value: RAW_NATIONAL_ID, notes: null }],
      networkRoles: extras?.newPerson?.networkRoles ?? [
        { role: "COURIER", source: "TESTIMONY", verificationStatus: "UNVERIFIED", note: "ร่วมขบวนการ" },
      ],
    },
    role: extras?.role ?? "SUSPECT",
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
        serialNumber: "SN1",
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
        vin: "VIN123456789",
        firstSeenAt: null,
        lastSeenAt: null,
        notes: null,
      },
    ],
  };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "10E2-001",
    title: "คดีทดสอบรายงานบุคคล",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
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
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function seedPerson(db: InMemoryDatabaseClient) {
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      title: '<script>alert(1)</script>',
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
      persons: [person('<img onerror=alert(1)> สมชาย')],
    })
  );
  const persons = await db.drugPerson.findMany({});
  const focus = persons[0]!;
  await db.drugIntelligenceAlert.create({
    data: {
      id: generateDrugId(),
      alertType: "REPEAT_PERSON",
      status: "NEW",
      severity: "HIGH",
      entityType: "PERSON",
      entityId: focus.id,
      title: "สมรู้ร่วมคิด",
      explanation: "เป็นเครือข่ายเดียวกัน และโทรหากัน",
      currentCaseId: created.caseId,
      priorCaseIds: [],
      relatedPersonIds: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrenceCount: 2,
      dedupeKey: `person-repeat-${focus.id}`,
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      dismissReason: null,
      createdAt: new Date(),
    },
  });
  return { caseId: created.caseId, personId: focus.id, personName: focus.primaryFullName };
}

function personBody(personId: string, overrides: Record<string, unknown> = {}) {
  return {
    actorId: "mock:admin",
    intent: "DOWNLOAD",
    exportType: "PERSON_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/persons",
      person: { personId },
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
  return { response, json: (await response.json()) as { data?: { estimatedRecordCount?: number; implemented?: boolean }; error?: { code?: string; message?: string } } };
}

test("PERSON_DATA HTML_PRINT is implemented with per-section bounds", () => {
  const service = new DrugExportService(new InMemoryDatabaseClient());
  assert.equal(service.isImplemented("PERSON_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("PERSON_DATA", "CSV"), false);
  assert.equal(exportLimitsForType("PERSON_DATA").softLimit, DRUG_EXPORT_PERSON_REPORT_SOFT_PER_SECTION);
  assert.equal(exportLimitsForType("PERSON_DATA").hardLimit, DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION);
});

test("authorization requires both drug.read and drug.export", async () => {
  assert.equal(resolveDrugExportAccess(["drug.read"]).canExport, false);
  assert.equal(resolveDrugExportAccess(["drug.export"]).canExport, false);
  assert.equal(resolveDrugExportAccess(["drug.read", "drug.export"]).canExport, true);
  assert.equal(requireDrugExport(defaultPermissionsForRole("officer")), null);
  assert.equal(requireDrugExport(defaultPermissionsForRole("admin"))?.canExport, true);

  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const officer = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(personBody(personId, { actorId: "mock:1101700123456" })) })
  );
  assert.equal(officer.status, 403);
  const commander = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(personBody(personId, { actorId: "mock:bpp414" })) })
  );
  assert.equal(commander.status, 200);
});

test("lookup distinguishes valid person, missing person, and invalid request", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const missing = await exportJson(db, personBody("missing-person-id", { intent: "PREVIEW" }));
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error?.code, "NOT_FOUND");
  const invalid = await exportJson(db, {
    actorId: "mock:admin",
    intent: "PREVIEW",
    exportType: "PERSON_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/persons" },
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json.error?.code, "INVALID_CONTEXT");
  const csv = await exportJson(db, personBody(personId, { format: "CSV", intent: "DOWNLOAD" }));
  assert.equal(csv.response.status, 400);
  assert.equal(csv.json.error?.code, "INVALID_FORMAT");
});

test("person report includes aliases, cases, phones, SIMs, devices, vehicles, and analytic signals", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const { response, html } = await exportHtml(db, personBody(personId));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition") ?? "", /drug-person-/);
  assert.match(html, /รายงานข้อมูลบุคคล/);
  assert.match(html, /PERSON INTELLIGENCE REPORT/);
  assert.match(html, /Border Patrol Police Personnel Intelligence System/);
  assert.match(html, /ไอ้แดง/);
  assert.match(html, /10E2-001/);
  assert.match(html, /กก\.ตชด\.44/);
  assert.match(html, /เชียงราย/);
  assert.match(html, /AIS/);
  assert.match(html, /REPEAT_PERSON/);
  assert.match(html, /ANALYTIC SIGNAL|สัญญาณวิเคราะห์/);
  assert.match(html, /badge-analytic/);
  assert.match(html, /badge-fact/);
  assert.match(html, /ข้อเท็จจริงจากฐานข้อมูล/);
  assert.match(html, /วิธีการและข้อจำกัดการตีความ/);
  assert.match(html, /class="kpi"/);
});

test("masked person report never exposes raw identifiers, coordinates, or private URLs", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const { html } = await exportHtml(db, personBody(personId));
  assert.doesNotMatch(html, new RegExp(RAW_PHONE));
  assert.doesNotMatch(html, new RegExp(RAW_NATIONAL_ID));
  assert.doesNotMatch(html, new RegExp(RAW_IMSI));
  assert.doesNotMatch(html, new RegExp(RAW_ICCID));
  assert.doesNotMatch(html, new RegExp(RAW_IMEI));
  assert.doesNotMatch(html, new RegExp(RAW_PLATE));
  assert.doesNotMatch(html, new RegExp(RAW_LAT));
  assert.doesNotMatch(html, new RegExp(RAW_LNG));
  assert.doesNotMatch(html, /signedUrl|https:\/\/storage|blob:/i);
  assert.match(html, /xxxxxxxxx3456/);
});

test("person report does not make unsupported guilt, network, or call claims", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const { html } = await exportHtml(db, personBody(personId));
  assert.doesNotMatch(html, FORBIDDEN_CLAIMS);
  assert.match(html, /ไม่ได้แปลว่ามีความผิด/);
});

test("user-controlled person text is HTML-escaped", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const { html } = await exportHtml(db, personBody(personId));
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img onerror/);
  assert.match(html, /&lt;img onerror/);
});

test("preview does not write export_created; download audits safe metadata only", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const preview = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(personBody(personId, { intent: "PREVIEW" })) })
  );
  assert.equal(preview.status, 200);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);

  const { response, html } = await exportHtml(db, personBody(personId));
  assert.equal(response.status, 200);
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 1);
  const detail = String(audits[0]?.detail ?? "");
  assert.match(detail, /PERSON_DATA/);
  assert.match(detail, /HTML_PRINT/);
  assert.match(detail, new RegExp(personId));
  assert.doesNotMatch(detail, new RegExp(RAW_PHONE));
  assert.doesNotMatch(detail, new RegExp(RAW_NATIONAL_ID));
  assert.doesNotMatch(detail, new RegExp(RAW_IMSI));
  assert.doesNotMatch(detail, new RegExp(RAW_IMEI));
  assert.doesNotMatch(detail, /signedUrl|https:\/\/storage/i);
  assert.equal(detail.includes("<!DOCTYPE html>"), false);
  assert.equal(detail.includes(html.slice(0, 120)), false);
});

test("generating the person report is read-only besides export audit", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, caseId } = await seedPerson(db);
  const before = {
    person: await db.drugPerson.findUnique({ where: { id: personId } }),
    cases: await db.drugCase.count(),
    phones: await db.drugPhoneNumber.count(),
    sims: await db.drugSim.count(),
    devices: await db.drugDevice.count(),
    vehicles: await db.drugVehicle.count(),
    aliases: await db.drugPersonAlias.count(),
    identifiers: await db.drugPersonIdentifier.count(),
    alerts: await db.drugIntelligenceAlert.count(),
    roles: await db.drugPersonNetworkRole.count(),
    caseRow: await db.drugCase.findUnique({ where: { id: caseId } }),
  };
  const { response } = await exportHtml(db, personBody(personId));
  assert.equal(response.status, 200);
  const afterPerson = await db.drugPerson.findUnique({ where: { id: personId } });
  const afterCase = await db.drugCase.findUnique({ where: { id: caseId } });
  assert.equal(afterPerson?.updatedAt.toISOString(), before.person?.updatedAt.toISOString());
  assert.equal(afterPerson?.primaryFullName, before.person?.primaryFullName);
  assert.equal(afterCase?.updatedAt.toISOString(), before.caseRow?.updatedAt.toISOString());
  assert.equal(await db.drugCase.count(), before.cases);
  assert.equal(await db.drugPhoneNumber.count(), before.phones);
  assert.equal(await db.drugSim.count(), before.sims);
  assert.equal(await db.drugDevice.count(), before.devices);
  assert.equal(await db.drugVehicle.count(), before.vehicles);
  assert.equal(await db.drugPersonAlias.count(), before.aliases);
  assert.equal(await db.drugPersonIdentifier.count(), before.identifiers);
  assert.equal(await db.drugIntelligenceAlert.count(), before.alerts);
  assert.equal(await db.drugPersonNetworkRole.count(), before.roles);
});

test("large alias sets stay bounded and disclose truncation", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const repo = new DrugPersonRepository(db);
  for (let i = 0; i < 51; i += 1) {
    await repo.addAlias(personId, `นามแฝง-${String(i).padStart(2, "0")}`, false, "mock:admin");
  }
  const { html } = await exportHtml(db, personBody(personId));
  assert.match(html, /แสดง 50 จาก 5[0-9] รายการ/);
  assert.match(html, /นามแฝง-00/);
  assert.doesNotMatch(html, /นามแฝง-50/);
});

test("hard per-section bound returns TOO_MANY_ROWS", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPerson(db);
  const repo = new DrugPersonRepository(db);
  for (let i = 0; i < DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION + 1; i += 1) {
    await repo.addAlias(personId, `เกินขีด-${i}`, false, "mock:admin");
  }
  const result = await exportJson(db, personBody(personId));
  assert.equal(result.response.status, 400);
  assert.equal(result.json.error?.code, "TOO_MANY_ROWS");
});

test("identity-only person is still reportable", async () => {
  const db = new InMemoryDatabaseClient();
  const personId = generateDrugId();
  await new DrugPersonRepository(db).create({
    id: personId,
    primaryFullName: "นาย ไม่มีคดี",
    nationality: null,
    dateOfBirth: null,
    notes: null,
    createdBy: "mock:admin",
    createdByName: "Administrator",
  });
  const { response, html } = await exportHtml(db, personBody(personId));
  assert.equal(response.status, 200);
  assert.match(html, /นาย ไม่มีคดี/);
  assert.match(html, /รายงานข้อมูลบุคคล/);
  assert.match(html, /PERSON INTELLIGENCE REPORT/);
  assert.match(html, /วิธีการและข้อจำกัดการตีความ/);
  assert.doesNotMatch(html, /class="kpi"/);
});

test("PERSON_DATA drawers reuse shared HTML print helper", () => {
  const drawerSrc = readFileSync(join(process.cwd(), "components/drug_intelligence/drug_person_report_drawer.tsx"), "utf8");
  const pageSrc = readFileSync(join(process.cwd(), "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  assert.match(pageSrc, /can\("drug.export"\)/);
  assert.match(pageSrc, /data-testid="person-report-btn"/);
  assert.match(pageSrc, /di\.export\.personReportAction/);
  assert.match(drawerSrc, /openHtmlPrintReport/);
  assert.match(drawerSrc, /htmlPrintFailureMessage/);
  assert.match(drawerSrc, /di\.export\.printReport/);
  assert.match(drawerSrc, /di\.export\.close/);
  assert.match(drawerSrc, /di\.export\.personMaskingNotice/);
  assert.match(drawerSrc, /di\.export\.personScope/);
  assert.doesNotMatch(drawerSrc, /noopener,noreferrer/);
  assert.doesNotMatch(drawerSrc, /window\.print\(\)/);
  assert.doesNotMatch(drawerSrc, /t\("di\.export\.downloadFailed"\)/);
});
