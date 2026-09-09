import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { drugExportContextV1InputSchema, resolveDrugExportContext } from "@/lib/drug_intelligence/drug_export_context";
import {
  buildInvestigationBoardExportContext,
  DIRTY_BOARD_REPORT_CONTRACT,
  investigationBoardExportType,
} from "@/lib/drug_intelligence/drug_export_network_context";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { edgeKindForRelationshipType } from "@/lib/drug_intelligence/drug_investigation_board_report";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

function requestWithSession(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function requestNoCookie(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function person(name: string, extras?: Partial<DrugCasePersonInput>): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: extras?.newPerson && "identifiers" in extras.newPerson ? extras.newPerson.identifiers ?? [] : [],
    },
    role: "SUSPECT",
    linkedOfficerId: null,
    notes: null,
    phones: extras?.phones ?? [],
    sims: extras?.sims ?? [],
    devices: extras?.devices ?? [],
    vehicles: extras?.vehicles ?? [],
  };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "10E-NET-001",
    title: "คดีทดสอบรายงานผัง",
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

async function seedGraph(db: InMemoryDatabaseClient) {
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "10E-SHARED",
      title: "คดี<script>alert(1)</script>",
      latitude: 20.43,
      longitude: 99.88,
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
      persons: [
        person('<img onerror=alert(1)> สมชาย', {
          newPerson: {
            primaryFullName: '<img onerror=alert(1)> สมชาย',
            nationality: null,
            dateOfBirth: null,
            notes: null,
            identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }],
          },
          phones: [{ rawInput: "0891234567", firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null }],
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
        }),
        person("สมหญิง ร่วมคดี", {
          phones: [{ rawInput: "0891234567", firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null }],
        }),
      ],
    })
  );
  const persons = await db.drugPerson.findMany({});
  const focus = persons.find((row) => row.primaryFullName.includes("สมชาย")) ?? persons[0];
  return { caseId: created.caseId, personId: focus.id };
}

function networkBody(personId: string, overrides: Record<string, unknown> = {}) {
  return {
    actorId: "mock:admin",
    intent: "DOWNLOAD",
    exportType: "NETWORK_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: buildInvestigationBoardExportContext({
      locale: "th",
      focusType: "PERSON",
      focusId: personId,
      focusLabel: '<script>alert("focus")</script>',
      depth: 2,
      nodeIds: [personId],
      annotationTypes: ["RECTANGLE", "TEXT", "IMAGE"],
      title: 'ผังปัจจุบัน & "quote"',
    }),
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

test("dirty board contract is current visible workspace", () => {
  assert.equal(DIRTY_BOARD_REPORT_CONTRACT, "CURRENT_VISIBLE_WORKSPACE");
  assert.equal(investigationBoardExportType(null), "NETWORK_DATA");
  assert.equal(investigationBoardExportType("board-1"), "BOARD_DATA");
  assert.equal(edgeKindForRelationshipType("PERSON_CASE"), "DIRECT");
  assert.equal(edgeKindForRelationshipType("SHARED_PHONE"), "INFERRED");
});

test("NETWORK_DATA and BOARD_DATA HTML_PRINT are implemented; reserved formats stay closed", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedGraph(db);
  const service = new DrugExportService(db);
  assert.equal(service.isImplemented("NETWORK_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("BOARD_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("NETWORK_DATA", "CSV"), false);
  assert.equal(service.isImplemented("BOARD_DATA", "JSON"), false);
  assert.equal(service.isImplemented("MAP_DATA", "HTML_PRINT"), true);
  assert.equal(service.isImplemented("MAP_DATA", "JSON"), false);

  const csv = await handleDrugExportCreate(
    service,
    requestWithSession({ body: JSON.stringify(networkBody(personId, { format: "CSV" })) })
  );
  assert.equal(csv.status, 400);
  const mapJson = await handleDrugExportCreate(
    service,
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "MAP_DATA",
        format: "JSON",
        context: { schemaVersion: 1, locale: "th", sourceRoute: "/drug-intelligence/map" },
      }),
    })
  );
  assert.equal(mapJson.status, 501);
  for (const format of ["PDF", "XLSX", "PNG", "SVG", "GeoJSON"]) {
    const blocked = await handleDrugExportCreate(
      service,
      requestWithSession({ body: JSON.stringify(networkBody(personId, { format })) })
    );
    assert.equal(blocked.status, 400, format);
  }
});

test("unsaved workspace report hydrates facts, preserves semantics, and does not create a board", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedGraph(db);
  const boardsBefore = await db.drugInvestigationBoard.count();
  const preview = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(networkBody(personId, { intent: "PREVIEW" })) })
  );
  assert.equal(preview.status, 200);
  const previewJson = (await preview.json()) as { data: { implemented: boolean; estimatedRecordCount: number } };
  assert.equal(previewJson.data.implemented, true);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);

  const generated = await new DrugExportService(db).generate({
    actorName: "Administrator",
    exportType: "NETWORK_DATA",
    format: "HTML_PRINT",
    context: resolveDrugExportContext(networkBody(personId).context as never, "mock:admin", new Date("2026-09-06T03:00:00.000Z")),
    maskingMode: "MASKED",
  });
  assert.ok(generated.recordCount >= 1);
  assert.match(generated.body, /จำนวนจุดข้อมูล|Node count/);
  assert.match(generated.filename, /drug-investigation-board-/);

  const { response, html } = await exportHtml(db, networkBody(personId));
  assert.equal(response.status, 200);
  assert.match(html, /รายงานผังการสืบสวน/);
  assert.match(html, /รายงานจากผังปัจจุบัน/);
  assert.doesNotMatch(html, /รายงานจากบอร์ดที่บันทึกแล้ว/);
  assert.match(html, /FACT \/ DIRECT|ข้อเท็จจริงจากฐานข้อมูล/);
  assert.match(html, /INFERRED|ความเชื่อมโยงที่ระบบอนุมาน/);
  assert.match(html, /ANALYST ANNOTATION|หมายเหตุ\/องค์ประกอบของผู้วิเคราะห์/);
  assert.match(html, /ไม่ใช่คะแนนความเสี่ยง|ไม่ใช่ข้อสรุปจากปัญญาประดิษฐ์/);
  assert.doesNotMatch(html, /ร่วมขบวนการ|โทรหากัน|เจ้าของ|ผู้สมรู้ร่วมคิด/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;|&lt;img|สมชาย/);
  assert.doesNotMatch(html, /0891234567|1103700123456|520031234567890|350000000000001|กข1234|20\.43|99\.88/);
  assert.doesNotMatch(html, /signedUrl|blob:|https:\/\/storage/);
  assert.doesNotMatch(html, /อาจเป็นผู้ประสาน/);
  assert.doesNotMatch(html, /mock:admin/);
  assert.equal(await db.drugInvestigationBoard.count(), boardsBefore);
  const audits = await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } });
  assert.equal(audits.length, 2);
  for (const row of audits) {
    assert.match(String(row.detail), /NETWORK_DATA|HTML_PRINT/);
    assert.doesNotMatch(String(row.detail), /0891234567|1103700123456|อาจเป็นผู้ประสาน|annotationText|signedUrl/);
  }
});

test("saved board owner can export; non-owner and officer cannot; board stays read-only", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedGraph(db);
  const boards = new DrugInvestigationBoardService(db);
  const snapshot = sampleWorkspaceSnapshot();
  snapshot.graphContext = { ...snapshot.graphContext, focusType: "PERSON", focusId: personId, depth: 2 };
  snapshot.annotations[2]!.text = "อาจเป็นผู้ประสาน";
  const created = await boards.createBoard(
    { actorId: "mock:admin", actorName: "Administrator" },
    { title: 'บอร์ดลับ <script>alert(1)</script>', state: serializeInvestigationBoardState(snapshot) }
  );
  const before = {
    version: created.version,
    updatedAt: created.updatedAt.toISOString(),
    lastOpenedAt: created.lastOpenedAt?.toISOString() ?? null,
    cases: await db.drugCase.count(),
    persons: await db.drugPerson.count(),
    phones: await db.drugCasePhone.count(),
    boards: await db.drugInvestigationBoard.count(),
  };

  const owner = await exportHtml(db, {
    actorId: "mock:admin",
    exportType: "BOARD_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: buildInvestigationBoardExportContext({
      locale: "th",
      boardId: created.id,
      dirty: false,
      title: "client-should-not-win",
      focusType: "PERSON",
      focusId: personId,
      depth: 2,
      nodeIds: [personId],
      annotationTypes: [],
    }),
  });
  assert.equal(owner.response.status, 200);
  assert.match(owner.html, /รายงานจากบอร์ดที่บันทึกแล้ว/);
  assert.match(owner.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(owner.html, /อาจเป็นผู้ประสาน/);
  assert.doesNotMatch(owner.html, /client-should-not-win/);
  assert.match(owner.html, /RECTANGLE|สี่เหลี่ยม|IMAGE|รูปภาพ/);

  const commanderOther = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:bpp414",
        exportType: "BOARD_DATA",
        format: "HTML_PRINT",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/network",
          board: { boardId: created.id },
          network: { focusType: "PERSON", focusId: personId, depth: 2 },
          workspace: { nodeIds: [personId], annotationTypes: [] },
        },
      }),
    })
  );
  assert.equal(commanderOther.status, 403);
  const forbiddenBody = await commanderOther.text();
  assert.doesNotMatch(forbiddenBody, /อาจเป็นผู้ประสาน|บอร์ดลับ|<script>|nodeLayout/);

  const officer = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:1101700123456",
        exportType: "BOARD_DATA",
        format: "HTML_PRINT",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/network",
          board: { boardId: created.id },
          network: { focusType: "PERSON", focusId: personId },
          workspace: { nodeIds: [personId], annotationTypes: [] },
        },
      }),
    })
  );
  assert.equal(officer.status, 403);

  const unauthenticated = await handleDrugExportCreate(
    new DrugExportService(db),
    requestNoCookie({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "BOARD_DATA",
        format: "HTML_PRINT",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/network",
          board: { boardId: created.id },
          network: { focusType: "PERSON", focusId: personId },
          workspace: { nodeIds: [personId], annotationTypes: [] },
        },
      }),
    })
  );
  assert.equal(unauthenticated.status, 401);

  const reloaded = await db.drugInvestigationBoard.findUnique({ where: { id: created.id } });
  assert.equal(reloaded?.version, before.version);
  assert.equal(reloaded?.updatedAt.toISOString(), before.updatedAt);
  assert.equal(reloaded?.lastOpenedAt?.toISOString() ?? null, before.lastOpenedAt);
  const reloadedState = reloaded?.state as { annotations?: Array<{ text?: string }>; graphContext?: { focusId?: string } };
  assert.equal(reloadedState.annotations?.some((ann) => ann.text === "อาจเป็นผู้ประสาน"), true);
  assert.equal(reloadedState.graphContext?.focusId, personId);
  assert.equal(await db.drugCase.count(), before.cases);
  assert.equal(await db.drugPerson.count(), before.persons);
  assert.equal(await db.drugCasePhone.count(), before.phones);
  assert.equal(await db.drugInvestigationBoard.count(), before.boards);
});

test("admin cannot export another actor's private board", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedGraph(db);
  const boards = new DrugInvestigationBoardService(db);
  const snapshot = sampleWorkspaceSnapshot();
  snapshot.graphContext = { ...snapshot.graphContext, focusType: "PERSON", focusId: personId, depth: 2 };
  const created = await boards.createBoard(
    { actorId: "mock:bpp414", actorName: "Commander BPP414" },
    { title: "บอร์ดผู้บังคับบัญชา", state: serializeInvestigationBoardState(snapshot) }
  );
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "BOARD_DATA",
        format: "HTML_PRINT",
        context: {
          schemaVersion: 1,
          locale: "th",
          sourceRoute: "/drug-intelligence/network",
          board: { boardId: created.id },
          network: { focusType: "PERSON", focusId: personId, depth: 2 },
          workspace: { nodeIds: [personId], annotationTypes: [] },
        },
      }),
    })
  );
  assert.equal(response.status, 403);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);
});

test("dirty saved board reports the current workspace and still requires ownership", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedGraph(db);
  const boards = new DrugInvestigationBoardService(db);
  const snapshot = sampleWorkspaceSnapshot();
  snapshot.graphContext = { ...snapshot.graphContext, focusType: "PERSON", focusId: personId, depth: 2 };
  const created = await boards.createBoard(
    { actorId: "mock:admin", actorName: "Administrator" },
    { title: "บอร์ดต้นฉบับ", state: serializeInvestigationBoardState(snapshot) }
  );
  const { response, html } = await exportHtml(db, {
    actorId: "mock:admin",
    exportType: "BOARD_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: buildInvestigationBoardExportContext({
      locale: "th",
      boardId: created.id,
      dirty: true,
      title: "ชื่อที่ยังไม่บันทึก",
      focusType: "PERSON",
      focusId: personId,
      depth: 2,
      nodeIds: [personId],
      annotationTypes: ["ARROW", "LINE"],
    }),
  });
  assert.equal(response.status, 200);
  assert.match(html, /รายงานจากผังปัจจุบัน/);
  assert.match(html, /มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก/);
  assert.doesNotMatch(html, /รายงานจากบอร์ดที่บันทึกแล้ว/);
  const after = await db.drugInvestigationBoard.findUnique({ where: { id: created.id } });
  assert.equal(after?.version, 1);
  assert.equal(after?.title, "บอร์ดต้นฉบับ");
});

test("workspace bounds fail closed and inferred edges stay inferred", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, caseId } = await seedGraph(db);
  assert.equal(
    drugExportContextV1InputSchema.safeParse({
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/network",
      workspace: { nodeIds: Array.from({ length: 151 }, (_, i) => `n${i}`), annotationTypes: [] },
    }).success,
    false
  );
  assert.equal(
    drugExportContextV1InputSchema.safeParse({
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/network",
      workspace: { title: "ก".repeat(121), nodeIds: [personId], annotationTypes: [] },
    }).success,
    false
  );
  assert.equal(
    drugExportContextV1InputSchema.safeParse({
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/network",
      workspace: {
        nodeIds: [personId],
        annotationTypes: Array.from({ length: 201 }, () => "TEXT" as const),
      },
    }).success,
    false
  );
  const ok150 = drugExportContextV1InputSchema.safeParse({
    schemaVersion: 1,
    locale: "th",
    sourceRoute: "/drug-intelligence/network",
    network: { focusType: "PERSON", focusId: personId, maxNodes: 150 },
    workspace: { nodeIds: Array.from({ length: 150 }, (_, i) => (i === 0 ? personId : `pad-${i}`)), annotationTypes: [] },
  });
  assert.equal(ok150.success, true);

  const { html } = await exportHtml(db, {
    actorId: "mock:admin",
    exportType: "NETWORK_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: {
      schemaVersion: 1,
      locale: "th",
      sourceRoute: "/drug-intelligence/network",
      network: { focusType: "CASE", focusId: caseId, depth: 2 },
      workspace: { nodeIds: [], annotationTypes: ["RECTANGLE"] },
    },
  });
  assert.match(html, /INFERRED|ความเชื่อมโยงที่ระบบอนุมาน/);
  assert.match(html, /FACT \/ DIRECT|ข้อเท็จจริงจากฐานข้อมูล/);
  assert.doesNotMatch(html, /ร่วมขบวนการ/);
});
