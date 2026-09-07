import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { DRUG_EXPORT_AUDIT_ACTION } from "@/lib/drug_intelligence/drug_export_audit";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import { buildInvestigationBoardExportContext } from "@/lib/drug_intelligence/drug_export_network_context";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = process.cwd();
const pageSrc = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
const boardDrawerSrc = readFileSync(
  join(ROOT, "components/drug_intelligence/drug_investigation_board_report_drawer.tsx"),
  "utf8"
);
const commanderDrawerSrc = readFileSync(
  join(ROOT, "components/drug_intelligence/drug_commander_report_drawer.tsx"),
  "utf8"
);
const caseDrawerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_case_report_drawer.tsx"), "utf8");

function requestWithSession(init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/drug-intelligence/exports", { method: "POST", ...init, headers });
}

function person(name: string): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }],
    },
    role: "SUSPECT",
    linkedOfficerId: null,
    notes: null,
    phones: [{ rawInput: "0891234567", firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null }],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

async function seedOwnedBoard(db: InMemoryDatabaseClient) {
  const createdCase = await new DrugCaseService({ db }).createCase({
    caseNumber: "10E1A-001",
    title: "คดีทดสอบ hotfix",
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
    latitude: 20.43,
    longitude: 99.88,
    narrative: null,
    persons: [person("นาย ทดสอบ หนึ่ง")],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
  } satisfies DrugCaseCreateRequest);
  const persons = await db.drugPerson.findMany({});
  const personId = persons[0]!.id;
  const snapshot = sampleWorkspaceSnapshot();
  snapshot.graphContext = { ...snapshot.graphContext, focusType: "PERSON", focusId: personId, depth: 2 };
  snapshot.annotations[2]!.text = "อาจเป็นผู้ประสาน";
  const board = await new DrugInvestigationBoardService(db).createBoard(
    { actorId: "mock:admin", actorName: "Administrator" },
    { title: "ทดสอบรูป DI-9.5D", state: serializeInvestigationBoardState(snapshot) }
  );
  return { caseId: createdCase.caseId, personId, board };
}

async function exportHtml(db: InMemoryDatabaseClient, body: Record<string, unknown>) {
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({ body: JSON.stringify(body) })
  );
  return { response, html: await response.text() };
}

test("HTML_PRINT drawers use the shared open helper and never treat noopener-null as download failure", () => {
  for (const src of [boardDrawerSrc, commanderDrawerSrc, caseDrawerSrc]) {
    assert.match(src, /openHtmlPrintReport/);
    assert.match(src, /htmlPrintFailureMessage/);
    assert.doesNotMatch(src, /noopener,noreferrer/);
    assert.doesNotMatch(src, /err instanceof ApiClientError \? err\.message : t\("di\.export\.downloadFailed"\)/);
  }
});

test("existing Print Board remains a separate window.print action", () => {
  assert.match(pageSrc, /data-testid="print-board-btn"/);
  assert.match(pageSrc, /window\.print\(\)/);
  assert.match(pageSrc, /data-testid="investigation-board-report-btn"/);
  assert.doesNotMatch(boardDrawerSrc, /window\.print\(\)/);
  assert.doesNotMatch(boardDrawerSrc, /data-testid="print-board-btn"/);
});

test("saved-board HTML_PRINT still audits once, stays read-only, and masks identifiers", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, board } = await seedOwnedBoard(db);
  const before = {
    version: board.version,
    updatedAt: board.updatedAt.toISOString(),
    lastOpenedAt: board.lastOpenedAt?.toISOString() ?? null,
    title: board.title,
  };

  const preview = await handleDrugExportCreate(
    new DrugExportService(db),
    requestWithSession({
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "BOARD_DATA",
        format: "HTML_PRINT",
        intent: "PREVIEW",
        masking: "MASKED",
        context: buildInvestigationBoardExportContext({
          locale: "th",
          boardId: board.id,
          dirty: false,
          title: board.title,
          focusType: "PERSON",
          focusId: personId,
          depth: 2,
          nodeIds: [personId],
          annotationTypes: [],
        }),
      }),
    })
  );
  assert.equal(preview.status, 200);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 0);

  const { response, html } = await exportHtml(db, {
    actorId: "mock:admin",
    exportType: "BOARD_DATA",
    format: "HTML_PRINT",
    masking: "MASKED",
    context: buildInvestigationBoardExportContext({
      locale: "th",
      boardId: board.id,
      dirty: false,
      title: board.title,
      focusType: "PERSON",
      focusId: personId,
      focusLabel: "นาย ทดสอบ หนึ่ง",
      depth: 2,
      nodeIds: [personId],
      annotationTypes: [],
    }),
  });
  assert.equal(response.status, 200);
  assert.match(html, /รายงานจากบอร์ดที่บันทึกแล้ว/);
  assert.match(html, /ทดสอบรูป DI-9\.5D/);
  assert.doesNotMatch(html, /0891234567|1103700123456|20\.43|99\.88/);
  assert.doesNotMatch(html, /อาจเป็นผู้ประสาน|signedUrl|blob:|https:\/\/storage/);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: DRUG_EXPORT_AUDIT_ACTION } })).length, 1);

  const reloaded = await db.drugInvestigationBoard.findUnique({ where: { id: board.id } });
  assert.equal(reloaded?.version, before.version);
  assert.equal(reloaded?.title, before.title);
  assert.equal(reloaded?.updatedAt.toISOString(), before.updatedAt);
  assert.equal(reloaded?.lastOpenedAt?.toISOString() ?? null, before.lastOpenedAt);
});
