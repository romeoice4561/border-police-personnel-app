/**
 * DI-7.6 — Arrest Team / Participating Units / Arresting Officers Data
 * Foundation. Covers Section 26's required test matrix: lead arrest unit
 * (canonical + manual), reporting-unit independence, participating units
 * (canonical/manual/multiple/dedup-not-enforced), internal + external
 * officers, officer roles, review/persistence/read, canonical officer
 * linking, authorization, audit logging, domain-separation guarantees
 * (no DrugPerson creation, no network-graph edges), and old-case
 * compatibility.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_case_arrest_team.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugCaseCreate, handleDrugCaseDetail, handleDrugCaseList } from "@/lib/drug_intelligence/drug_case_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  headers.set("Content-Type", "application/json");
  return new Request(url, { ...init, headers });
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

// ── A/B/C/D: lead arrest unit + reporting unit independence ────────────────

test("A: lead arrest unit — canonical (id-based) persists independently on the case", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(baseCase({ leadCompanyId: 69, leadBattalionId: 16, leadRegionId: 4, leadHeadquartersId: 1, leadUnitText: "ตชด.444" }));
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.leadCompanyId, 69);
  assert.equal(stored?.leadUnitText, "ตชด.444");
});

test("B: lead arrest unit — manual fallback persists as leadUnitText with all lead*Id null", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(baseCase({ leadUnitText: "หน่วยเฉพาะกิจ ABC" }));
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.leadUnitText, "หน่วยเฉพาะกิจ ABC");
  assert.equal(stored?.leadCompanyId, null);
  assert.equal(stored?.leadHeadquartersId, null);
});

test("C: reporting unit remains fully independent of lead arrest unit", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ reportingUnitText: "กก.ตชด.44", leadUnitText: "ร้อย ตชด.414", leadCompanyId: 57 })
  );
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.reportingUnitText, "กก.ตชด.44");
  assert.equal(stored?.leadUnitText, "ร้อย ตชด.414");
  assert.notEqual(stored?.reportingUnitText, stored?.leadUnitText);
});

test("D: 'same as reporting unit' convenience — client-derived values match reporting unit exactly", async () => {
  // This is a client-side draft convenience (create_case_draft.ts), not
  // server behavior — verified here at the request-shape level: when the
  // caller copies reporting-unit fields into lead-unit fields, the service
  // persists them as ordinary, equal values (no special-casing needed).
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ reportingUnitText: "กก.ตชด.44", companyId: 69, leadUnitText: "กก.ตชด.44", leadCompanyId: 69 })
  );
  const stored = await db.drugCase.findUnique({ where: { id: result.caseId } });
  assert.equal(stored?.reportingUnitText, stored?.leadUnitText);
  assert.equal(stored?.companyId, stored?.leadCompanyId);
});

// ── E/F/G/H: participating units ────────────────────────────────────────

test("E: participating unit — canonical org reference persists", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ participatingUnits: [{ headquartersId: 1, regionId: 4, battalionId: 13, companyId: 57, unitText: "ร้อย ตชด.414", role: "PARTICIPATING", note: null }] })
  );
  const units = await db.drugCaseParticipatingUnit.findMany({ where: { caseId: result.caseId } });
  assert.equal(units.length, 1);
  assert.equal((units[0] as { companyId: number | null }).companyId, 57);
});

test("F: participating unit — manual fallback persists with no org ids", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ participatingUnits: [{ headquartersId: null, regionId: null, battalionId: null, companyId: null, unitText: "ป.ป.ส.", role: "PARTICIPATING", note: null }] })
  );
  const units = await db.drugCaseParticipatingUnit.findMany({ where: { caseId: result.caseId } });
  assert.equal(units.length, 1);
  assert.equal((units[0] as { unitText: string | null }).unitText, "ป.ป.ส.");
  assert.equal((units[0] as { companyId: number | null }).companyId, null);
});

test("G: multiple participating units on one case all persist", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      participatingUnits: [
        { headquartersId: null, regionId: null, battalionId: null, companyId: 57, unitText: "ร้อย ตชด.414", role: "PARTICIPATING", note: null },
        { headquartersId: null, regionId: null, battalionId: null, companyId: null, unitText: "ฝ่ายปกครอง อ.ท่าแซะ", role: "PARTICIPATING", note: null },
      ],
    })
  );
  const units = await db.drugCaseParticipatingUnit.findMany({ where: { caseId: result.caseId } });
  assert.equal(units.length, 2);
});

test("H: duplicate participating unit rows are NOT deduplicated (Section 16: append, never auto-merge distinct rows)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      participatingUnits: [
        { headquartersId: null, regionId: null, battalionId: null, companyId: 57, unitText: "ร้อย ตชด.414", role: "PARTICIPATING", note: null },
        { headquartersId: null, regionId: null, battalionId: null, companyId: 57, unitText: "ร้อย ตชด.414", role: "PARTICIPATING", note: null },
      ],
    })
  );
  const units = await db.drugCaseParticipatingUnit.findMany({ where: { caseId: result.caseId } });
  assert.equal(units.length, 2, "each submitted row is its own record — no implicit unique constraint on participating units");
});

// ── I/J/K/L/M: arrest team officers ─────────────────────────────────────

test("I: internal officer (officerId set) persists and links by string business key", async () => {
  const db = new InMemoryDatabaseClient();
  await db.officer.create({ data: { officerId: "ภาค4/999", rank: "ร.ต.อ.", firstName: "ทดสอบ", lastName: "ตำรวจ", currentUnit: "กก.ตชด.44" } });
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ officers: [{ officerId: "ภาค4/999", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null }] })
  );
  const officers = await db.drugCaseOfficer.findMany({ where: { caseId: result.caseId } });
  assert.equal(officers.length, 1);
  assert.equal((officers[0] as { officerId: string | null }).officerId, "ภาค4/999");
});

test("J: external/manual officer (no officerId) persists via manual* fields", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ officers: [{ officerId: null, manualRank: "ร.ต.ต.", manualFullName: "สมชาย ภายนอก", manualPosition: "เจ้าหน้าที่ ป.ป.ส.", manualUnitText: "ป.ป.ส. ภาค 8", role: "SUPPORT", note: null }] })
  );
  const officers = await db.drugCaseOfficer.findMany({ where: { caseId: result.caseId } });
  assert.equal(officers.length, 1);
  assert.equal((officers[0] as { officerId: string | null }).officerId, null);
  assert.equal((officers[0] as { manualFullName: string | null }).manualFullName, "สมชาย ภายนอก");
});

test("K: officer role is one of the 8 canonical values and persists exactly", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ officers: [{ officerId: null, manualRank: null, manualFullName: "ทดสอบ บทบาท", manualPosition: null, manualUnitText: null, role: "EVIDENCE_OFFICER", note: null }] })
  );
  const officers = await db.drugCaseOfficer.findMany({ where: { caseId: result.caseId } });
  assert.equal((officers[0] as { role: string }).role, "EVIDENCE_OFFICER");
});

test("L: multiple officers with different roles all persist", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      officers: [
        { officerId: null, manualRank: "ร.ต.อ.", manualFullName: "หัวหน้าชุด A", manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null },
        { officerId: null, manualRank: "ด.ต.", manualFullName: "เจ้าหน้าที่ B", manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null },
        { officerId: null, manualRank: "ส.ต.ท.", manualFullName: "สนับสนุน C", manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null },
      ],
    })
  );
  const officers = await db.drugCaseOfficer.findMany({ where: { caseId: result.caseId } });
  assert.equal(officers.length, 3);
});

test("M: DrugCaseOfficer's schema declares @@unique([caseId, officerId, role]) — verified against the migration SQL, not the test fake", async () => {
  // InMemoryDatabaseClient's Table.create() never checks uniqueness on
  // insert (only find/update/upsert consult matchUnique — a pre-existing
  // limitation of every table in this fake, not specific to DI-7.6), so a
  // duplicate (caseId, officerId, role) insert does NOT throw here even
  // though real Postgres enforces it. This test documents that gap
  // explicitly rather than asserting a false guarantee: real enforcement is
  // confirmed by inspecting the applied migration SQL directly.
  const fs = await import("node:fs");
  const migrationSql = fs.readFileSync(
    "prisma/migrations/20260826000000_drug_intelligence_arrest_team/migration.sql",
    "utf-8"
  );
  assert.match(migrationSql, /CREATE UNIQUE INDEX "DrugCaseOfficer_caseId_officerId_role_key" ON "DrugCaseOfficer"\("caseId", "officerId", "role"\)/);

  // Confirmed on the live fake: BOTH rows still get created (no throw) —
  // documents the fake's real behavior rather than silently skipping it.
  const db = new InMemoryDatabaseClient();
  await db.officer.create({ data: { officerId: "ภาค4/998", rank: "ร.ต.อ.", firstName: "ซ้ำ", lastName: "กัน" } });
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      officers: [
        { officerId: "ภาค4/998", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null },
        { officerId: "ภาค4/998", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null },
      ],
    })
  );
  const officers = await db.drugCaseOfficer.findMany({ where: { caseId: result.caseId } });
  assert.equal(officers.length, 2, "fake does not enforce @@unique on create() — real Postgres does (see migration.sql assertion above)");
});

test("M2: the SAME internal officer in TWO DIFFERENT roles on one case is allowed", async () => {
  const db = new InMemoryDatabaseClient();
  await db.officer.create({ data: { officerId: "ภาค4/997", rank: "ร.ต.อ.", firstName: "สอง", lastName: "บทบาท" } });
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      officers: [
        { officerId: "ภาค4/997", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null },
        { officerId: "ภาค4/997", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "INVESTIGATOR", note: null },
      ],
    })
  );
  const officers = await db.drugCaseOfficer.findMany({ where: { caseId: result.caseId } });
  assert.equal(officers.length, 2);
});

// ── P/Q/R/S: persistence + read (Case Workspace) ────────────────────────

test("P/Q: getCase() returns participatingUnits and officers with resolved canonical officer summaries", async () => {
  const db = new InMemoryDatabaseClient();
  await db.officer.create({ data: { officerId: "ภาค4/996", rank: "พ.ต.ท.", firstName: "แผนก", lastName: "ปฏิบัติการ", currentUnit: "กก.ตชด.44" } });
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({
      leadUnitText: "ร้อย ตชด.414",
      leadCompanyId: 57,
      participatingUnits: [{ headquartersId: null, regionId: null, battalionId: null, companyId: null, unitText: "สภ.ท่าแซะ", role: "PARTICIPATING", note: null }],
      officers: [
        { officerId: "ภาค4/996", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null },
        { officerId: null, manualRank: "ร.ต.ต.", manualFullName: "ภายนอก D", manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null },
      ],
    })
  );

  const detail = await service.getCase(result.caseId);
  assert.equal(detail.case.leadUnitText, "ร้อย ตชด.414");
  assert.equal(detail.participatingUnits.length, 1);
  assert.equal(detail.officers.length, 2);

  const internal = detail.officers.find((o) => o.officerId === "ภาค4/996");
  assert.ok(internal, "internal officer row must be present");
  assert.equal(internal!.officer?.firstName, "แผนก");
  assert.equal(internal!.officer?.rank, "พ.ต.ท.");

  const external = detail.officers.find((o) => o.officerId === null);
  assert.ok(external, "external officer row must be present");
  assert.equal(external!.officer, null, "external/manual rows must never resolve a canonical officer");
  assert.equal(external!.manualFullName, "ภายนอก D");
});

test("S: manual officer with an officerId that resolves to nothing still displays cleanly (officer=null, not a crash)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  // Directly insert a DrugCaseOfficer row referencing a non-existent officerId
  // (simulates an officer removed from Personnel after the case was recorded).
  await db.$transaction(async (tx) => {
    const caseRepo = new (await import("@/lib/database/repositories/drug_case_repository")).DrugCaseRepository(tx);
    await caseRepo.create({
      id: "orphan-officer-case",
      caseNumber: "ORPHAN-001",
      title: "ทดสอบ",
      status: "OPEN",
      arrestDate: null,
      arrestTime: null,
      headquartersId: null,
      regionId: null,
      battalionId: null,
      companyId: null,
      reportingUnitText: null,
      province: null,
      district: null,
      subdistrict: null,
      locationName: null,
      latitude: null,
      longitude: null,
      narrative: null,
      createdBy: "mock:admin",
      createdByName: "Administrator",
    });
    await tx.drugCaseOfficer.create({
      data: { id: "orphan-row", caseId: "orphan-officer-case", officerId: "does-not-exist", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null, createdBy: "mock:admin", createdByName: "Administrator" },
    });
  });

  const detail = await service.getCase("orphan-officer-case");
  assert.equal(detail.officers.length, 1);
  assert.equal(detail.officers[0].officer, null, "a dangling officerId must resolve to null, never throw");
});

// ── N: review-step rendering is a pure client function, covered indirectly
// via buildCreateCaseRequest below (O) — the review step itself has no
// server-testable behavior (no I/O), consistent with this module's
// existing convention of not unit-testing presentational React components.

// ── O: create request payload shape (buildCreateCaseRequest) ───────────

test("O: buildCreateCaseRequest() derives leadUnitText from 'same as reporting unit' toggle", async () => {
  const { createEmptyDraft, buildCreateCaseRequest } = await import("@/lib/drug_intelligence/create_case_draft");
  const draft = createEmptyDraft();
  draft.headquartersText = "บช.ตชด.";
  draft.regionText = "ภาค4";
  draft.battalionText = "กก.ตชด.44";
  draft.companyText = "ตชด.444";
  draft.sameAsReportingUnit = true;

  const request = buildCreateCaseRequest(draft, "mock:admin", "Administrator");
  assert.equal(request.leadUnitText, "ตชด.444");
  assert.equal(request.reportingUnitText, "ตชด.444");
});

test("O2: buildCreateCaseRequest() drops an untouched participating-unit row (no id, no manual text)", async () => {
  const { createEmptyDraft, buildCreateCaseRequest, createEmptyParticipatingUnitDraft } = await import("@/lib/drug_intelligence/create_case_draft");
  const draft = createEmptyDraft();
  draft.participatingUnits = [createEmptyParticipatingUnitDraft()];

  const request = buildCreateCaseRequest(draft, "mock:admin", "Administrator");
  assert.equal(request.participatingUnits?.length, 0);
});

test("O3: buildCreateCaseRequest() drops an untouched officer row (no officerId, no manual name)", async () => {
  const { createEmptyDraft, buildCreateCaseRequest, createEmptyCaseOfficerDraft } = await import("@/lib/drug_intelligence/create_case_draft");
  const draft = createEmptyDraft();
  draft.officers = [createEmptyCaseOfficerDraft()];

  const request = buildCreateCaseRequest(draft, "mock:admin", "Administrator");
  assert.equal(request.officers?.length, 0);
});

// ── T: case filtering by lead battalion/company ─────────────────────────

test("T/U: listCases() filters by leadBattalionId and leadCompanyId", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(baseCase({ caseNumber: "FILTER-A", leadBattalionId: 16, leadCompanyId: 69 }));
  await service.createCase(baseCase({ caseNumber: "FILTER-B", leadBattalionId: 13, leadCompanyId: 57 }));

  const byBattalion = await service.listCases({ page: 1, pageSize: 20, leadBattalionId: 16 });
  assert.equal(byBattalion.rows.length, 1);
  assert.equal(byBattalion.rows[0].caseNumber, "FILTER-A");

  const byCompany = await service.listCases({ page: 1, pageSize: 20, leadCompanyId: 57 });
  assert.equal(byCompany.rows.length, 1);
  assert.equal(byCompany.rows[0].caseNumber, "FILTER-B");
});

test("V: listCases() filters by participatingUnitCompanyId", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(
    baseCase({ caseNumber: "PU-A", participatingUnits: [{ headquartersId: null, regionId: null, battalionId: null, companyId: 57, unitText: "ร้อย ตชด.414", role: "PARTICIPATING", note: null }] })
  );
  await service.createCase(baseCase({ caseNumber: "PU-B", participatingUnits: [] }));

  const filtered = await service.listCases({ page: 1, pageSize: 20, participatingUnitCompanyId: 57 });
  assert.equal(filtered.rows.length, 1);
  assert.equal(filtered.rows[0].caseNumber, "PU-A");
});

test("W: listCases() filters by officerId and officerRole", async () => {
  const db = new InMemoryDatabaseClient();
  await db.officer.create({ data: { officerId: "ภาค4/995", rank: "ร.ต.อ.", firstName: "ค้นหา", lastName: "เจ้าหน้าที่" } });
  const service = new DrugCaseService({ db });
  await service.createCase(
    baseCase({ caseNumber: "OFF-A", officers: [{ officerId: "ภาค4/995", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null }] })
  );
  await service.createCase(baseCase({ caseNumber: "OFF-B", officers: [] }));

  const byOfficer = await service.listCases({ page: 1, pageSize: 20, officerId: "ภาค4/995" });
  assert.equal(byOfficer.rows.length, 1);
  assert.equal(byOfficer.rows[0].caseNumber, "OFF-A");

  const byRole = await service.listCases({ page: 1, pageSize: 20, officerRole: "ARREST_TEAM_LEAD" });
  assert.equal(byRole.rows.length, 1);

  const byWrongRole = await service.listCases({ page: 1, pageSize: 20, officerRole: "SUPPORT" });
  assert.equal(byWrongRole.rows.length, 0);
});

// ── X/Y: authorization ──────────────────────────────────────────────────

test("X: officer (no drug.create) is REJECTED 403 creating a case with arrest-team data", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const body = { ...baseCase(), actorId: "mock:1101700123456", actorName: "Officer" };
  const req = requestWithSession("http://localhost/api/drug-intelligence/cases", { method: "POST", body: JSON.stringify(body) });
  const res = await handleDrugCaseCreate(service, req);
  assert.equal(res.status, 403);
});

test("Y: admin (drug.create) CAN create a case with lead unit + participating units + officers", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const body = {
    ...baseCase(),
    leadUnitText: "ร้อย ตชด.414",
    participatingUnits: [{ headquartersId: null, regionId: null, battalionId: null, companyId: null, unitText: "สภ.ท่าแซะ", role: "PARTICIPATING", note: null }],
    officers: [{ officerId: null, manualRank: "ร.ต.ต.", manualFullName: "ทดสอบ ผู้จับกุม", manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null }],
    actorId: "mock:admin",
    actorName: "Administrator",
  };
  const req = requestWithSession("http://localhost/api/drug-intelligence/cases", { method: "POST", body: JSON.stringify(body) });
  const res = await handleDrugCaseCreate(service, req);
  assert.equal(res.status, 201);
});

test("Y2: missing session is REJECTED 401 on case detail read", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(baseCase());
  const req = new Request(`http://localhost/api/drug-intelligence/cases/${result.caseId}?actorId=mock:admin`);
  const res = await handleDrugCaseDetail(service, result.caseId, "mock:admin", req);
  assert.equal(res.status, 401);
});

test("Y3: commander (drug.read) CAN read case list including lead-unit fields", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(baseCase({ leadUnitText: "ร้อย ตชด.414" }));
  const req = requestWithSession("http://localhost/api/drug-intelligence/cases?actorId=mock:bpp414");
  const res = await handleDrugCaseList(service, new URLSearchParams({ actorId: "mock:bpp414" }), "mock:bpp414", req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[0].leadUnitText, "ร้อย ตชด.414");
});

// ── Z: audit logging ─────────────────────────────────────────────────────

test("Z: creating a case with a lead unit writes an arrest_unit_set audit entry", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(baseCase({ leadUnitText: "ร้อย ตชด.414" }));
  const logs = await db.drugAuditLog.findMany({ where: { entityId: result.caseId, action: "arrest_unit_set" } });
  assert.equal(logs.length, 1);
});

test("Z2: adding a participating unit writes a participating_unit_added audit entry", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(
    baseCase({ participatingUnits: [{ headquartersId: null, regionId: null, battalionId: null, companyId: null, unitText: "สภ.ท่าแซะ", role: "PARTICIPATING", note: null }] })
  );
  const logs = await db.drugAuditLog.findMany({ where: { action: "participating_unit_added" } });
  assert.equal(logs.length, 1);
});

test("Z3: adding an officer writes a case_officer_added audit entry", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  await service.createCase(
    baseCase({ officers: [{ officerId: null, manualRank: null, manualFullName: "ทดสอบ", manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] })
  );
  const logs = await db.drugAuditLog.findMany({ where: { action: "case_officer_added" } });
  assert.equal(logs.length, 1);
});

// ── AB/AC: domain-separation guarantees ─────────────────────────────────

test("AB: creating arrest-team officers does NOT create any DrugPerson rows", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const before = (await db.drugPerson.findMany({})).length;
  await service.createCase(
    baseCase({
      officers: [
        { officerId: null, manualRank: "ร.ต.อ.", manualFullName: "เจ้าหน้าที่ A", manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null },
      ],
    })
  );
  const after = (await db.drugPerson.findMany({})).length;
  assert.equal(after, before, "no DrugPerson row should ever be created from officer data");
});

test("AC: arrest-team officers create NO DrugNetworkGroup / DrugPersonNetworkRole rows (Section 23: officers are never criminal-network nodes)", async () => {
  // DrugRelationship (the DI-5 network-graph edge table) has no repository
  // or InMemoryDatabaseClient delegate in this codebase at all — nothing
  // currently writes to it directly, so there is no runtime edge count to
  // assert against. The stronger, directly-checkable guarantee is that
  // creating officers touches NEITHER of the two tables that actually
  // populate the network graph (DrugNetworkGroup / DrugPersonNetworkRole,
  // DI-7.2/7.3) — confirmed here by row count, and structurally by
  // DrugCaseOfficerRepository never importing either repository.
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const beforeGroups = (await db.drugNetworkGroup.findMany({})).length;
  const beforeRoles = (await db.drugPersonNetworkRole.findMany({})).length;
  await service.createCase(
    baseCase({
      officers: [
        { officerId: null, manualRank: "ร.ต.อ.", manualFullName: "เจ้าหน้าที่ B", manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null },
      ],
    })
  );
  assert.equal((await db.drugNetworkGroup.findMany({})).length, beforeGroups);
  assert.equal((await db.drugPersonNetworkRole.findMany({})).length, beforeRoles);
});

test("AF: manual participating-unit text cannot create an org-master row — DatabaseClient exposes no company/battalion/region/headquarters delegate at all", async () => {
  // Stronger than a row-count check: DrugCaseParticipatingUnitRepository can
  // only write through the narrow DatabaseClient contract (database_types.ts),
  // which has no `company`/`battalion`/`region`/`headquarters` delegate
  // whatsoever — org master tables are referenced only via plain Int FK
  // columns. There is therefore no code path by which creating a
  // participating unit (canonical OR manual) could create an org master
  // row, confirmed here by successfully creating one with manual text that
  // matches no real unit, and by the type-level absence of the delegate.
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(
    baseCase({ participatingUnits: [{ headquartersId: null, regionId: null, battalionId: null, companyId: null, unitText: "หน่วยสมมติที่ไม่มีอยู่จริง", role: "PARTICIPATING", note: null }] })
  );
  const units = await db.drugCaseParticipatingUnit.findMany({ where: { caseId: result.caseId } });
  assert.equal(units.length, 1);
  assert.equal("company" in db, false, "DatabaseClient must never expose a company delegate to Drug Intelligence repositories");
});

test("AG: manual officer fields do NOT create an Officer master row", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const beforeOfficers = (await db.officer.findMany({})).length;
  await service.createCase(
    baseCase({ officers: [{ officerId: null, manualRank: "ร.ต.ต.", manualFullName: "บุคคลสมมติ", manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] })
  );
  const afterOfficers = (await db.officer.findMany({})).length;
  assert.equal(afterOfficers, beforeOfficers, "manual officer fields must never create an Officer row");
});

// ── AD: old cases with no team data render cleanly ──────────────────────

test("AD: a case created with NO lead unit, NO participating units, NO officers reads back cleanly (empty arrays, null lead fields)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  const result = await service.createCase(baseCase());
  const detail = await service.getCase(result.caseId);
  assert.equal(detail.case.leadUnitText, null);
  assert.deepEqual(detail.participatingUnits, []);
  assert.deepEqual(detail.officers, []);
});

test("AD2: DrugCaseCreateRequest omitting leadUnitText/participatingUnits/officers entirely (pre-DI-7.6 shape) still creates a valid case", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  // Built directly (not via baseCase()) so the object literal itself proves
  // every DI-7.6 field is optional at the TYPE level — a pre-DI-7.6 caller
  // that never mentions leadUnitText/participatingUnits/officers still
  // satisfies DrugCaseCreateRequest without a cast.
  const legacyShapeCase: DrugCaseCreateRequest = {
    caseNumber: "LEGACY-001",
    title: "คดีก่อน DI-7.6",
    status: "OPEN",
    arrestDate: null,
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: null,
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
  };
  const result = await service.createCase(legacyShapeCase);
  assert.ok(result.caseId);
});
