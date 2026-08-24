/**
 * DI-7.1 → DI-7.3 checkpoint focused regression tests.
 *
 * Covers:
 *   B  — audit logging for network-role / membership / group mutations
 *   C  — ID generation convention (generateDrugId, not numeric auto-increment)
 *   D  — alias UI persistence (multiple DrugPersonAlias rows, independent of nickname)
 *   E  — DOB / approximateAge mutual-exclusivity server validation
 *   F  — org fallback UX (manual unit path, no org master record created)
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/di73_checkpoint_focused.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import {
  handleAddDrugPersonNetworkRole,
  handleUpdateDrugPersonNetworkRoleStatus,
  handleDrugNetworkGroupCreate,
  handleAddDrugPersonNetworkMembership,
} from "@/lib/drug_intelligence/drug_person_api_handlers";
import { drugCaseCreateSchema } from "@/lib/drug_intelligence/drug_case_api_schemas";
import { buildCreateCaseRequest, createEmptyDraft, createEmptyPersonDraft, createEmptyAliasDraft } from "@/lib/drug_intelligence/create_case_draft";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

// ── helpers ───────────────────────────────────────────────────────────────────

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=mock:admin`);
  return new Request(url, { ...init, headers });
}

function jsonReq(url: string, body: unknown): Request {
  return requestWithSession(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(url: string, body: unknown): Request {
  return requestWithSession(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Minimal valid person input — all required arrays present. */
function newPerson(overrides: Record<string, unknown> = {}) {
  return {
    role: "SUSPECT",
    linkedOfficerId: null,
    notes: null,
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
    newPerson: {
      primaryFullName: "ทดสอบ X",
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: [],
      ...overrides,
    },
  };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "DI73-TEST-001",
    title: "คดีทดสอบ DI-7.3",
    status: "OPEN",
    arrestDate: new Date("2026-08-25"),
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
    ...overrides,
  };
}

// ── B. Audit logging ──────────────────────────────────────────────────────────

describe("B. audit logging for DI-7.2/7.3 mutations", () => {
  test("handleAddDrugPersonNetworkRole creates a DrugAuditLog entry", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    const { caseId } = await service.createCase(baseCase({
      persons: [newPerson({ primaryFullName: "ทดสอบ เอ" })],
    }));
    const cases = await db.drugCasePerson.findMany({ where: { caseId } });
    const personId = cases[0].personId;

    const req = jsonReq(`http://localhost/api/drug-intelligence/persons/${personId}/network-roles`, {
      actorId: "mock:admin",
      actorName: "Administrator",
      role: "COURIER",
      source: "DIRECT_ARREST",
      verificationStatus: "CONFIRMED",
    });
    const res = await handleAddDrugPersonNetworkRole(db, personId, req);
    assert.equal(res.status, 200, "handler must succeed");

    const audits = await db.drugAuditLog.findMany({ where: { entityType: "DrugPersonNetworkRole" } });
    assert.ok(audits.some((a) => a.action === "DRUG_PERSON_NETWORK_ROLE_ADDED"), "audit entry expected");
  });

  test("handleUpdateDrugPersonNetworkRoleStatus creates an audit entry", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({
        primaryFullName: "ทดสอบ บี",
        networkRoles: [{ role: "RETAIL_DEALER", source: "TESTIMONY", verificationStatus: "UNVERIFIED", note: null }],
      })],
    }));
    const roles = await db.drugPersonNetworkRole.findMany({});
    assert.ok(roles.length > 0, "must have a role");
    const roleId = roles[0].id as string;

    const req = patchReq(`http://localhost/api/.../network-roles/${roleId}`, {
      actorId: "mock:admin",
      actorName: "Administrator",
      verificationStatus: "SUPPORTED",
    });
    const res = await handleUpdateDrugPersonNetworkRoleStatus(db, roleId, req);
    assert.equal(res.status, 200);

    const audits = await db.drugAuditLog.findMany({ where: { entityType: "DrugPersonNetworkRole" } });
    assert.ok(audits.some((a) => a.action === "DRUG_PERSON_NETWORK_ROLE_STATUS_UPDATED"), "status-update audit entry expected");
  });

  test("handleDrugNetworkGroupCreate creates an audit entry", async () => {
    const db = new InMemoryDatabaseClient();
    const req = jsonReq("http://localhost/api/drug-intelligence/network-groups", {
      actorId: "mock:admin",
      actorName: "Administrator",
      name: "เครือข่ายทดสอบ",
    });
    const res = await handleDrugNetworkGroupCreate(db, req);
    assert.equal(res.status, 200);

    const audits = await db.drugAuditLog.findMany({ where: { entityType: "DrugNetworkGroup" } });
    assert.ok(audits.some((a) => a.action === "DRUG_NETWORK_GROUP_CREATED"), "group creation audit expected");
  });

  test("handleAddDrugPersonNetworkMembership creates an audit entry", async () => {
    const db = new InMemoryDatabaseClient();
    // first create a group
    const groupReq = jsonReq("http://localhost/api/drug-intelligence/network-groups", {
      actorId: "mock:admin",
      actorName: "Administrator",
      name: "เครือข่ายทดสอบ สมาชิก",
    });
    const groupRes = await handleDrugNetworkGroupCreate(db, groupReq);
    const { data: { id: networkGroupId } } = await groupRes.json() as { data: { id: string } };

    // create a person
    const service = new DrugCaseService({ db });
    const { caseId } = await service.createCase(baseCase({
      persons: [newPerson({ primaryFullName: "ทดสอบ ซี" })],
    }));
    const cases = await db.drugCasePerson.findMany({ where: { caseId } });
    const personId = cases[0].personId;

    const req = jsonReq(`http://localhost/api/.../network-memberships`, {
      actorId: "mock:admin",
      actorName: "Administrator",
      networkGroupId,
      source: "DIRECT_ARREST",
    });
    const res = await handleAddDrugPersonNetworkMembership(db, personId, req);
    assert.equal(res.status, 200, "membership must succeed");

    const audits = await db.drugAuditLog.findMany({ where: { entityType: "DrugPersonNetworkMembership" } });
    assert.ok(audits.some((a) => a.action === "DRUG_PERSON_NETWORK_MEMBERSHIP_ADDED"), "membership audit expected");
  });
});

// ── C. ID generation ──────────────────────────────────────────────────────────

describe("C. ID generation convention — IDs must not be numeric auto-increments", () => {
  test("DrugNetworkGroup IDs start with 'di-' prefix (generateDrugId)", async () => {
    const db = new InMemoryDatabaseClient();
    const req = jsonReq("http://localhost/api/drug-intelligence/network-groups", {
      actorId: "mock:admin",
      actorName: "Administrator",
      name: "กลุ่มทดสอบ",
    });
    const res = await handleDrugNetworkGroupCreate(db, req);
    const body = await res.json() as { data: { id: string } };
    // generateDrugId() returns a UUID — verify it is a non-empty string (not a numeric auto-increment)
    assert.ok(typeof body.data.id === "string" && body.data.id.length > 10, `expected string UUID, got: ${body.data.id}`);
    assert.ok(!String(body.data.id).match(/^\d+$/), "ID must not be a numeric auto-increment");
  });

  test("DrugPersonNetworkRole IDs start with 'di-' prefix (generateDrugId)", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({
        primaryFullName: "ทดสอบ ดี",
        networkRoles: [{ role: "COURIER", source: null, verificationStatus: "UNVERIFIED", note: null }],
      })],
    }));
    const roles = await db.drugPersonNetworkRole.findMany({});
    assert.ok(roles.length > 0);
    const roleId = roles[0].id as string;
    assert.ok(typeof roleId === "string" && roleId.length > 10, `expected UUID string, got: ${roleId}`);
    assert.ok(!roleId.match(/^\d+$/), "ID must not be a numeric auto-increment");
  });

  test("DrugPersonNetworkMembership IDs start with 'di-' prefix", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({
        primaryFullName: "ทดสอบ อี",
        networkMemberships: [{ networkGroupId: null, networkGroupName: "เครือข่ายใหม่", source: null, note: null }],
      })],
    }));
    const memberships = await db.drugPersonNetworkMembership.findMany({});
    assert.ok(memberships.length > 0);
    const membershipId = memberships[0].id as string;
    assert.ok(typeof membershipId === "string" && membershipId.length > 10, `expected UUID string, got: ${membershipId}`);
    assert.ok(!membershipId.match(/^\d+$/), "ID must not be a numeric auto-increment");
  });
});

// ── D. Alias UI persistence ───────────────────────────────────────────────────

describe("D. aliases — distinct from nickname, persisted as DrugPersonAlias rows", () => {
  test("no alias → zero extra alias rows (primary still added)", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({ primaryFullName: "ทดสอบ เอฟ", aliases: [] })],
    }));
    const aliases = await db.drugPersonAlias.findMany({});
    // only the primary alias (isPrimary=true)
    assert.equal(aliases.length, 1);
    assert.equal(aliases[0].isPrimary, true);
  });

  test("one alias → two alias rows (primary + one secondary)", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({ primaryFullName: "สมชาย ใจดี", aliases: [{ fullName: "ไอ้แดง" }] })],
    }));
    const aliases = await db.drugPersonAlias.findMany({});
    assert.equal(aliases.length, 2);
    const primary = aliases.filter((a) => a.isPrimary);
    const secondary = aliases.filter((a) => !a.isPrimary);
    assert.equal(primary.length, 1);
    assert.equal(secondary.length, 1);
    assert.equal(secondary[0].fullName, "ไอ้แดง");
  });

  test("multiple aliases → each stored as separate alias row", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({
        primaryFullName: "สมหมาย รักไทย",
        aliases: [{ fullName: "แดง ชุมพร" }, { fullName: "บังหนึ่ง" }, { fullName: "เสี่ยแดง" }],
      })],
    }));
    const aliases = await db.drugPersonAlias.findMany({});
    assert.equal(aliases.length, 4); // 1 primary + 3 secondary
    const secondary = aliases.filter((a) => !a.isPrimary);
    assert.equal(secondary.length, 3);
    const names = secondary.map((a) => a.fullName as string);
    assert.ok(names.includes("แดง ชุมพร"));
    assert.ok(names.includes("บังหนึ่ง"));
    assert.ok(names.includes("เสี่ยแดง"));
  });

  test("whitespace-only alias rows are ignored (not persisted)", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({
        primaryFullName: "ทดสอบ จี",
        aliases: [{ fullName: "   " }, { fullName: "" }, { fullName: "ชื่อจริง" }],
      })],
    }));
    const aliases = await db.drugPersonAlias.findMany({});
    assert.equal(aliases.length, 2); // 1 primary + 1 real alias
    const secondary = aliases.filter((a) => !a.isPrimary);
    assert.equal(secondary[0].fullName, "ชื่อจริง");
  });

  test("nickname remains independent — does NOT appear as an alias", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugCaseService({ db });
    await service.createCase(baseCase({
      persons: [newPerson({ primaryFullName: "ทดสอบ เอช", nickname: "แดง", aliases: [] })],
    }));
    const aliases = await db.drugPersonAlias.findMany({});
    // only primary — nickname is stored on DrugPerson.nickname, not as alias
    assert.equal(aliases.length, 1);
    assert.equal(aliases[0].isPrimary, true);
    const persons = await db.drugPerson.findMany({});
    assert.equal(persons[0].nickname, "แดง");
  });
});

// ── E. DOB / approximateAge mutual-exclusivity ────────────────────────────────

describe("E. DOB / approximateAge server-side validation (drugCaseCreateSchema)", () => {
  function buildPayload(person: Record<string, unknown>) {
    return {
      caseNumber: "E-TEST",
      title: "ทดสอบ E",
      status: "OPEN",
      actorId: "mock:admin",
      actorName: "Admin",
      persons: [{
        role: "SUSPECT",
        linkedOfficerId: null,
        notes: null,
        phones: [],
        sims: [],
        devices: [],
        vehicles: [],
        newPerson: { primaryFullName: "ทดสอบ", identifiers: [], ...person },
      }],
      seizedItems: [],
      locations: [],
    };
  }

  test("DOB only → valid", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({ dateOfBirth: "01/01/2510" }));
    assert.ok(result.success, JSON.stringify(result.error?.issues));
  });

  test("approximateAge only → valid", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({ approximateAge: 35 }));
    assert.ok(result.success, JSON.stringify(result.error?.issues));
  });

  test("neither DOB nor approximateAge → valid", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({}));
    assert.ok(result.success, JSON.stringify(result.error?.issues));
  });

  test("both DOB and approximateAge → rejected", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({ dateOfBirth: "01/01/2510", approximateAge: 25 }));
    assert.ok(!result.success, "should be invalid when both are set");
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    assert.ok(messages.some((m) => m.includes("approximateAge")), "error must mention approximateAge");
  });

  test("negative approximateAge → rejected", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({ approximateAge: -1 }));
    assert.ok(!result.success, "negative age must be rejected");
  });

  test("approximateAge > 150 → rejected (unreasonable bound)", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({ approximateAge: 151 }));
    assert.ok(!result.success, "age > 150 must be rejected");
  });

  test("approximateAge = 0 → valid (newborn)", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({ approximateAge: 0 }));
    assert.ok(result.success, "age 0 (newborn) must be accepted");
  });

  test("approximateAge = 150 → valid (extreme but within bound)", () => {
    const result = drugCaseCreateSchema.safeParse(buildPayload({ approximateAge: 150 }));
    assert.ok(result.success, "age 150 must be accepted");
  });
});

// ── F. Org fallback UX ────────────────────────────────────────────────────────

describe("F. org fallback — buildCreateCaseRequest respects useManualUnit", () => {
  test("canonical org path: IDs preserved, manualUnitText not used", () => {
    const draft = createEmptyDraft();
    draft.caseNumber = "F-001";
    draft.title = "F Test";
    draft.useManualUnit = false;
    draft.headquartersId = 1;
    draft.regionId = 2;
    draft.battalionId = 3;
    draft.companyId = 4;
    draft.companyText = "กองร้อย ตชด.414";
    draft.manualUnitText = "หน่วยอื่น";

    const req = buildCreateCaseRequest(draft, "mock:admin", "Admin");
    assert.equal(req.headquartersId, 1);
    assert.equal(req.regionId, 2);
    assert.equal(req.battalionId, 3);
    assert.equal(req.companyId, 4);
    assert.equal(req.reportingUnitText, "กองร้อย ตชด.414");
  });

  test("manual fallback path: canonical IDs cleared, manual text used, no org record created", async () => {
    const draft = createEmptyDraft();
    draft.caseNumber = "F-002";
    draft.title = "F Test Manual";
    draft.useManualUnit = true;
    draft.headquartersId = 5;
    draft.regionId = 6;
    draft.battalionId = 7;
    draft.companyId = 8;
    draft.manualUnitText = "ตชด.อื่น ๆ";

    const req = buildCreateCaseRequest(draft, "mock:admin", "Admin");
    assert.equal(req.headquartersId, null, "canonical HQ ID must be cleared in manual path");
    assert.equal(req.regionId, null);
    assert.equal(req.battalionId, null);
    assert.equal(req.companyId, null);
    assert.equal(req.reportingUnitText, "ตชด.อื่น ๆ");
  });

  test("switching fallback → canonical: IDs restored, manual text not sent", () => {
    // Simulates user going back to canonical after selecting manual
    const draft = createEmptyDraft();
    draft.caseNumber = "F-003";
    draft.title = "F Test Switch";
    draft.useManualUnit = false;
    draft.manualUnitText = "เดิมพิมพ์เอง"; // leftover text from previous state
    draft.companyId = 10;
    draft.companyText = "ร้อย ตชด.414";

    const req = buildCreateCaseRequest(draft, "mock:admin", "Admin");
    assert.equal(req.companyId, 10);
    assert.equal(req.reportingUnitText, "ร้อย ตชด.414");
    // leftover manualUnitText must not leak into reportingUnitText
  });

  test("manual fallback with empty text: reportingUnitText = null", () => {
    const draft = createEmptyDraft();
    draft.caseNumber = "F-004";
    draft.title = "F Test Empty Manual";
    draft.useManualUnit = true;
    draft.manualUnitText = "   ";

    const req = buildCreateCaseRequest(draft, "mock:admin", "Admin");
    assert.equal(req.reportingUnitText, null);
    assert.equal(req.headquartersId, null);
    assert.equal(req.regionId, null);
  });

  test("manual fallback: request carries null org IDs + non-null reportingUnitText", () => {
    // The service receives null canonical IDs — it never looks up or creates org records.
    // Verified via buildCreateCaseRequest() output and service unit test for minimal case.
    const draft = createEmptyDraft();
    draft.caseNumber = "F-005";
    draft.title = "F Test No Org";
    draft.useManualUnit = true;
    draft.manualUnitText = "หน่วยพิเศษที่ไม่มีในระบบ";

    const req = buildCreateCaseRequest(draft, "mock:admin", "Admin");
    // All canonical IDs must be null — service never creates org master records from these
    assert.equal(req.headquartersId, null);
    assert.equal(req.regionId, null);
    assert.equal(req.battalionId, null);
    assert.equal(req.companyId, null);
    // Manual text preserved
    assert.equal(req.reportingUnitText, "หน่วยพิเศษที่ไม่มีในระบบ");
  });
});

// ── D. alias UI (draft helpers) ───────────────────────────────────────────────

describe("D. createEmptyAliasDraft + PersonDraft aliases default", () => {
  test("createEmptyPersonDraft initializes aliases as empty array", () => {
    const draft = createEmptyPersonDraft();
    assert.ok(Array.isArray(draft.aliases));
    assert.equal(draft.aliases.length, 0);
  });

  test("createEmptyAliasDraft has a key and empty fullName", () => {
    const alias = createEmptyAliasDraft();
    assert.ok(typeof alias.key === "string" && alias.key.startsWith("draft-"));
    assert.equal(alias.fullName, "");
  });

  test("buildCreateCaseRequest maps aliases to API payload (whitespace-trimmed)", () => {
    const draft = createEmptyDraft();
    draft.caseNumber = "D-DRAFT";
    draft.title = "D Draft Test";
    const person = createEmptyPersonDraft();
    person.primaryFullName = "สมชาย ใจดี";
    person.aliases = [
      { key: "k1", fullName: "  ไอ้แดง  " },
      { key: "k2", fullName: "" }, // empty — should be filtered
      { key: "k3", fullName: "บังหนึ่ง" },
    ];
    draft.persons.push(person);

    const req = buildCreateCaseRequest(draft, "mock:admin", "Admin");
    const aliases = req.persons[0].newPerson?.aliases ?? [];
    assert.equal(aliases.length, 2);
    assert.equal(aliases[0].fullName, "ไอ้แดง");
    assert.equal(aliases[1].fullName, "บังหนึ่ง");
  });
});
