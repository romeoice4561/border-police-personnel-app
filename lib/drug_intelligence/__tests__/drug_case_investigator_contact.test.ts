/**
 * Investigator contact — case-level administrative name/phone.
 *
 * Proves persistence, PATCH RBAC, intelligence-phone isolation, and that
 * DrugCaseOfficer INVESTIGATOR remains an independent arrest-team role.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import {
  handleDrugCaseCreate,
  handleDrugCaseDetail,
  handleDrugCaseInvestigatorContactUpdate,
  handleDrugCaseList,
} from "@/lib/drug_intelligence/drug_case_api_handlers";
import { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import { DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import { normalizeInvestigatorContactName, normalizeInvestigatorContactPhone } from "@/lib/drug_intelligence/investigator_contact";
import { createEmptyDraft, createEmptyCaseOfficerDraft, buildCreateCaseRequest } from "@/lib/drug_intelligence/create_case_draft";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("Content-Type", "application/json");
  return new Request(url, { ...init, headers });
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "INV-2569-001",
    title: "คดีทดสอบพนักงานสอบสวน",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "14:30",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "ร้อย ตชด.414",
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

test("F: Thai mobile formatting uses display XXX-XXX-XXXX and does not guess non-standard text", () => {
  assert.equal(normalizeInvestigatorContactPhone("0812345678"), "081-234-5678");
  assert.equal(normalizeInvestigatorContactPhone("081-234-5678"), "081-234-5678");
  assert.equal(normalizeInvestigatorContactPhone("  081 234 5678  "), "081-234-5678");
  assert.equal(normalizeInvestigatorContactPhone("021234567"), "021234567");
  assert.equal(normalizeInvestigatorContactPhone("081-234-5678 ต่อ 12"), "081-234-5678 ต่อ 12");
  assert.equal(normalizeInvestigatorContactPhone("  "), null);
  assert.equal(normalizeInvestigatorContactName("  ร.ต.อ.สมชาย ใจดี  "), "ร.ต.อ.สมชาย ใจดี");
  assert.equal(normalizeInvestigatorContactName("   "), null);
});

test("A: Create with name + phone persists both on DrugCase", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ investigatorName: "ร.ต.อ.สมชาย ใจดี", investigatorPhone: "0812345678" })
  );
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.investigatorName, "ร.ต.อ.สมชาย ใจดี");
  assert.equal(stored?.investigatorPhone, "081-234-5678");
});

test("B/C/D/E: name-only, phone-only, both optional, and whitespace become null", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });

  const nameOnly = await service.createCase(baseCase({ caseNumber: "INV-B", investigatorName: "ร.ต.อ.สมชาย ใจดี" }));
  const nameRow = await db.drugCase.findUnique({ where: { id: nameOnly.caseId } });
  assert.equal(nameRow?.investigatorName, "ร.ต.อ.สมชาย ใจดี");
  assert.equal(nameRow?.investigatorPhone, null);

  const phoneOnly = await service.createCase(baseCase({ caseNumber: "INV-C", investigatorPhone: "0812345678" }));
  const phoneRow = await db.drugCase.findUnique({ where: { id: phoneOnly.caseId } });
  assert.equal(phoneRow?.investigatorName, null);
  assert.equal(phoneRow?.investigatorPhone, "081-234-5678");

  const empty = await service.createCase(baseCase({ caseNumber: "INV-D" }));
  const emptyRow = await db.drugCase.findUnique({ where: { id: empty.caseId } });
  assert.equal(emptyRow?.investigatorName, null);
  assert.equal(emptyRow?.investigatorPhone, null);

  const ws = await service.createCase(baseCase({ caseNumber: "INV-E", investigatorName: "   ", investigatorPhone: "  \t  " }));
  const wsRow = await db.drugCase.findUnique({ where: { id: ws.caseId } });
  assert.equal(wsRow?.investigatorName, null);
  assert.equal(wsRow?.investigatorPhone, null);
});

test("H/I/J: create does not create DrugPhoneNumber, DrugCasePhone, or DrugCaseOfficer INVESTIGATOR", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(baseCase({ investigatorName: "ร.ต.อ.สมชาย ใจดี", investigatorPhone: "0812345678" }));
  assert.equal((await db.drugPhoneNumber.findMany({})).length, 0);
  assert.equal((await db.drugCasePhone.findMany({})).length, 0);
  assert.equal((await db.drugCaseOfficer.findMany({})).length, 0);
});

test("W: DrugCaseOfficer INVESTIGATOR remains independent of case contact fields", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      caseNumber: "INV-W",
      officers: [
        {
          officerId: null,
          manualRank: "ร.ต.อ.",
          manualFullName: "วิชัย ทีมจับ",
          manualPosition: null,
          manualUnitText: null,
          role: "INVESTIGATOR",
          note: null,
        },
      ],
    })
  );
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.investigatorName, null);
  assert.equal(stored?.investigatorPhone, null);
  const officers = await db.drugCaseOfficer.findMany({ where: { caseId: result.caseId } });
  assert.equal(officers.length, 1);
  assert.equal((officers[0] as { role: string }).role, "INVESTIGATOR");
  assert.equal((officers[0] as { manualFullName: string }).manualFullName, "วิชัย ทีมจับ");
});

test("P: getCase returns investigator contact for Case Detail", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const created = await service.createCase(
    baseCase({ investigatorName: "ร.ต.อ.สมชาย ใจดี", investigatorPhone: "0812345678" })
  );
  const detail = await service.getCase(created.caseId);
  assert.equal(detail.case.investigatorName, "ร.ต.อ.สมชาย ใจดี");
  assert.equal(detail.case.investigatorPhone, "081-234-5678");
});

test("K/L: PATCH with drug.edit succeeds; drug.read-only is denied", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const created = await service.createCase(baseCase({ caseNumber: "INV-PATCH" }));

  const allowed = requestWithSession(`http://localhost/api/drug-intelligence/cases/${created.caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorId: "mock:admin",
      actorName: "Administrator",
      investigatorName: "ร.ต.อ.สมชาย ใจดี",
      investigatorPhone: "0812345678",
    }),
  });
  const allowedRes = await handleDrugCaseInvestigatorContactUpdate(service, created.caseId, allowed);
  assert.equal(allowedRes.status, 200);
  const allowedBody = (await allowedRes.json()) as { data: { investigatorName: string | null; investigatorPhone: string | null } };
  assert.equal(allowedBody.data.investigatorName, "ร.ต.อ.สมชาย ใจดี");
  assert.equal(allowedBody.data.investigatorPhone, "081-234-5678");

  const denied = requestWithSession(`http://localhost/api/drug-intelligence/cases/${created.caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorId: "mock:bpp414",
      actorName: "Commander BPP414",
      investigatorName: "should not write",
      investigatorPhone: "0899999999",
    }),
  });
  const deniedRes = await handleDrugCaseInvestigatorContactUpdate(service, created.caseId, denied);
  assert.equal(deniedRes.status, 403);
  const afterDenied = await db.drugCase.findUnique({ where: { id: created.caseId } });
  assert.equal(afterDenied?.investigatorName, "ร.ต.อ.สมชาย ใจดี");
});

test("M/N: PATCH only changes investigator contact and rejects arbitrary DrugCase fields", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const created = await service.createCase(baseCase({ caseNumber: "INV-STRICT", title: "ต้นฉบับ", investigatorName: "เดิม" }));

  const abused = requestWithSession(`http://localhost/api/drug-intelligence/cases/${created.caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorId: "mock:admin",
      actorName: "Administrator",
      investigatorName: "ใหม่",
      investigatorPhone: null,
      title: "HACKED",
      status: "CLOSED",
      narrative: "should not land",
    }),
  });
  const abusedRes = await handleDrugCaseInvestigatorContactUpdate(service, created.caseId, abused);
  assert.equal(abusedRes.status, 400);

  const ok = requestWithSession(`http://localhost/api/drug-intelligence/cases/${created.caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorId: "mock:admin",
      actorName: "Administrator",
      investigatorName: "ใหม่",
      investigatorPhone: null,
    }),
  });
  const okRes = await handleDrugCaseInvestigatorContactUpdate(service, created.caseId, ok);
  assert.equal(okRes.status, 200);
  const stored = await db.drugCase.findUnique({ where: { id: created.caseId } });
  assert.equal(stored?.investigatorName, "ใหม่");
  assert.equal(stored?.investigatorPhone, null);
  assert.equal(stored?.title, "ต้นฉบับ");
  assert.equal(stored?.status, "OPEN");
  assert.equal(stored?.caseNumber, "INV-STRICT");
});

test("O: PATCH phone does not create DrugPhoneNumber or DrugCasePhone", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const created = await service.createCase(baseCase({ caseNumber: "INV-O" }));
  await service.updateInvestigatorContact(created.caseId, {
    investigatorName: null,
    investigatorPhone: "0812345678",
    actorId: "mock:admin",
    actorName: "Administrator",
  });
  assert.equal((await db.drugPhoneNumber.findMany({})).length, 0);
  assert.equal((await db.drugCasePhone.findMany({})).length, 0);
});

test("S: case list search and global search do not match investigator contact", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(
    baseCase({
      caseNumber: "INV-SEARCH",
      title: "คดีไม่เกี่ยวกับเบอร์นี้",
      investigatorName: "ร.ต.อ.สมชาย ใจดี",
      investigatorPhone: "0812345678",
    })
  );

  const byPhone = await service.listCases({ page: 1, pageSize: 20, query: "0812345678" });
  assert.equal(byPhone.total, 0);
  const byName = await service.listCases({ page: 1, pageSize: 20, query: "ร.ต.อ.สมชาย ใจดี" });
  assert.equal(byName.total, 0);

  const search = new DrugIntelligenceSearchService(db);
  const groupedPhone = await search.searchGrouped({ query: "0812345678" }, { canViewFull: true });
  assert.equal(groupedPhone.totalCount, 0);
  const groupedName = await search.searchGrouped({ query: "ร.ต.อ.สมชาย ใจดี" }, { canViewFull: true });
  assert.equal(groupedName.totalCount, 0);
});

test("T: network graph does not ingest investigator phone as a PHONE node", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const created = await service.createCase(
    baseCase({ caseNumber: "INV-NET", investigatorName: "ร.ต.อ.สมชาย ใจดี", investigatorPhone: "0812345678" })
  );
  const graph = new DrugNetworkGraphService(db);
  const neighborhood = await graph.getNeighborhood({ entityType: "CASE", entityId: created.caseId, depth: 1 }, { canViewFull: true });
  assert.equal(neighborhood.nodes.some((node) => node.type === "PHONE"), false);
  assert.equal((await db.drugPhoneNumber.findMany({})).length, 0);
});

test("list API omits investigatorPhone while detail keeps it", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(baseCase({ caseNumber: "INV-LIST", investigatorPhone: "0812345678", investigatorName: "ร.ต.อ.สมชาย ใจดี" }));
  const listed = await service.listCases({ page: 1, pageSize: 20 });
  assert.equal(listed.rows.length, 1);
  assert.equal("investigatorPhone" in listed.rows[0], false);
  const req = requestWithSession("http://localhost/api/drug-intelligence/cases?actorId=mock:admin&page=1&pageSize=20");
  const res = await handleDrugCaseList(service, new URL(req.url).searchParams, "mock:admin", req);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: Array<Record<string, unknown>> };
  assert.equal("investigatorPhone" in body.data[0], false);
});

test("draft/request wiring sends normalized contact and never copies arrest-team officers", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.investigatorName = "  ร.ต.อ.สมชาย ใจดี  ";
  draft.investigatorPhone = "0812345678";
  const officer = createEmptyCaseOfficerDraft();
  officer.manualFullName = "วิชัย ทีมจับ";
  officer.role = "INVESTIGATOR";
  draft.officers.push(officer);
  const req = buildCreateCaseRequest(draft, "mock:admin", "Administrator");
  assert.equal(req.investigatorName, "ร.ต.อ.สมชาย ใจดี");
  assert.equal(req.investigatorPhone, "081-234-5678");
  assert.equal(req.officers[0]?.manualFullName, "วิชัย ทีมจับ");
  assert.notEqual(req.investigatorName, req.officers[0]?.manualFullName);
});

test("Q/R: Case Detail source has display + edit action gated by drug.edit", () => {
  const card = read("components/drug_intelligence/drug_case_investigator_contact_card.tsx");
  assert.match(card, /if \(!hasContact && !canEdit\) return null/);
  assert.match(card, /can\("drug\.edit"\)/);
  assert.match(card, /investigator-contact-edit/);
  assert.match(card, /tel:/);
  assert.doesNotMatch(card, /\/drug-intelligence\/phones\//);
  const detail = read("app/drug-intelligence/cases/[id]/page.tsx");
  assert.match(detail, /DrugCaseInvestigatorContactCard/);
  const unitsIdx = detail.indexOf("DrugCaseUnitsAndTeamCard");
  const contactIdx = detail.indexOf("DrugCaseInvestigatorContactCard");
  assert.ok(contactIdx > 0 && contactIdx < unitsIdx);
});

test("U/V: Map, Timeline, Telegram, export/report do not newly expose investigator contact", () => {
  const files = [
    "lib/drug_intelligence/drug_map_case_detail.ts",
    "lib/drug_intelligence/drug_timeline_service.ts",
    "lib/drug_intelligence/drug_case_report.ts",
    "lib/drug_intelligence/drug_export_service.ts",
    "lib/personnel_search_telegram/drug_search_formatter.ts",
    "lib/personnel_search_telegram/drug_search_command.ts",
    "lib/drug_intelligence/drug_network_graph_service.ts",
    "lib/drug_intelligence/drug_intelligence_alert_service.ts",
  ];
  for (const file of files) {
    const src = read(file);
    assert.equal(src.includes("investigatorPhone"), false, file);
    assert.equal(src.includes("investigatorName"), false, file);
  }
});

test("P create API round-trip via handler", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const createReq = requestWithSession("http://localhost/api/drug-intelligence/cases", {
    method: "POST",
    body: JSON.stringify({
      ...baseCase({ investigatorName: "ร.ต.อ.สมชาย ใจดี", investigatorPhone: "0812345678" }),
    }),
  });
  const created = await handleDrugCaseCreate(service, createReq);
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { data: { caseId: string } };
  const detailReq = requestWithSession(`http://localhost/api/drug-intelligence/cases/${createdBody.data.caseId}?actorId=mock:admin`);
  const detail = await handleDrugCaseDetail(service, createdBody.data.caseId, "mock:admin", detailReq);
  assert.equal(detail.status, 200);
  const detailBody = (await detail.json()) as { data: { case: { investigatorName: string | null; investigatorPhone: string | null } } };
  assert.equal(detailBody.data.case.investigatorName, "ร.ต.อ.สมชาย ใจดี");
  assert.equal(detailBody.data.case.investigatorPhone, "081-234-5678");
});

test("Z: Persons A/F and QA fixture identifiers are not referenced by this feature", () => {
  const files = [
    "lib/drug_intelligence/investigator_contact.ts",
    "components/drug_intelligence/drug_case_investigator_contact_card.tsx",
    "prisma/migrations/20260916000000_drug_case_investigator_contact/migration.sql",
  ];
  for (const file of files) {
    const src = read(file);
    assert.doesNotMatch(src, /Person A|Person F|QA-001|QA-003/);
  }
  const migration = read("prisma/migrations/20260916000000_drug_case_investigator_contact/migration.sql");
  assert.match(migration, /ADD COLUMN "investigatorName" TEXT/);
  assert.match(migration, /ADD COLUMN "investigatorPhone" TEXT/);
  assert.doesNotMatch(migration, /DROP |RENAME /i);
});
