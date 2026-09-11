/**
 * DI-11B collaboration API handlers — bound actor, spoofing, existence leakage.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { mintBoundSessionCookieHeader } from "@/lib/auth/bound_session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugAnalystNoteService } from "@/lib/drug_intelligence/drug_analyst_note_service";
import { DrugInvestigationTaskService } from "@/lib/drug_intelligence/drug_investigation_task_service";
import {
  handleCaseNotesCreate,
  handleCaseNotesList,
  handleNoteGet,
  handleNotePatch,
  handleCaseTasksCreate,
  handleTaskPatch,
} from "@/lib/drug_intelligence/drug_collaboration_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";
import { POST as sessionPost, DELETE as sessionDelete } from "@/app/api/auth/session/route";
import { boundSessionSecret, BoundSessionSecretError } from "@/lib/auth/bound_session";
import { assertConfirmActorId } from "@/lib/drug_intelligence/drug_collaboration_auth";

function boundRequest(actorId: string, url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("cookie", mintBoundSessionCookieHeader({ id: actorId }));
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(url, { ...init, headers });
}

function writeJson(actorId: string, extra: Record<string, unknown>): string {
  return JSON.stringify({ confirmActorId: actorId, ...extra });
}

function presenceOnly(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=1`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(url, { ...init, headers });
}

function baseCase(): DrugCaseCreateRequest {
  return {
    caseNumber: "COL-API-001",
    title: "api",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    leadUnitText: "ชุดจับกุม",
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    locationName: "จุดตรวจ",
    latitude: 10,
    longitude: 99,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
  };
}

test("session API sets HttpOnly bound actor cookie from credentials", async () => {
  const response = await sessionPost(
    new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "414", rememberMe: true }),
    })
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /bppis_actor=/);
  assert.match(cookie, /HttpOnly/i);
  assert.doesNotMatch(cookie, /actorId=mock:admin/);
});

test("client actorId spoofing cannot author as admin when bound as commander", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const notes = new DrugAnalystNoteService(db);
  const spoof = boundRequest("mock:bpp414", "http://localhost/notes", {
    method: "POST",
    body: writeJson("mock:bpp414", {
      actorId: "mock:admin",
      actorName: "Administrator",
      body: "spoofed-note",
    }),
  });
  const response = await handleCaseNotesCreate(notes, created.caseId, spoof);
  assert.equal(response.status, 403);

  const adminWrite = boundRequest("mock:admin", "http://localhost/notes", {
    method: "POST",
    body: writeJson("mock:admin", { actorId: "mock:bpp414", actorName: "Commander BPP414", body: "admin-authored" }),
  });
  const createdNote = await handleCaseNotesCreate(notes, created.caseId, adminWrite);
  assert.equal(createdNote.status, 201);
  const json = (await createdNote.json()) as { data: { authorActorId: string; authorName: string } };
  assert.equal(json.data.authorActorId, "mock:admin");
  assert.equal(json.data.authorName, "Administrator");
});

test("commander can GET notes but cannot POST/PATCH; officer is 403; missing bound session is 401", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const notes = new DrugAnalystNoteService(db);
  const adminCreate = await handleCaseNotesCreate(
    notes,
    created.caseId,
    boundRequest("mock:admin", "http://localhost/notes", { method: "POST", body: writeJson("mock:admin", { body: "visible" }) })
  );
  assert.equal(adminCreate.status, 201);
  const note = ((await adminCreate.json()) as { data: { id: string } }).data;

  const commanderGet = await handleCaseNotesList(
    notes,
    created.caseId,
    new URLSearchParams(),
    boundRequest("mock:bpp414", "http://localhost/notes")
  );
  assert.equal(commanderGet.status, 200);

  const commanderPost = await handleCaseNotesCreate(
    notes,
    created.caseId,
    boundRequest("mock:bpp414", "http://localhost/notes", { method: "POST", body: writeJson("mock:bpp414", { body: "nope" }) })
  );
  assert.equal(commanderPost.status, 403);

  const commanderPatch = await handleNotePatch(
    notes,
    note.id,
    boundRequest("mock:bpp414", "http://localhost/note", { method: "PATCH", body: writeJson("mock:bpp414", { body: "nope" }) })
  );
  assert.equal(commanderPatch.status, 403);

  const officerGet = await handleCaseNotesList(
    notes,
    created.caseId,
    new URLSearchParams(),
    boundRequest("mock:1101700123456", "http://localhost/notes")
  );
  assert.equal(officerGet.status, 403);

  const missing = await handleCaseNotesList(notes, created.caseId, new URLSearchParams(), presenceOnly("http://localhost/notes"));
  assert.equal(missing.status, 401);
});

test("unauthorized actors get 403 for existing and nonexistent targets; authorized get 404 for missing", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const notes = new DrugAnalystNoteService(db);
  const tasks = new DrugInvestigationTaskService(db);

  const officerExisting = await handleCaseNotesList(
    notes,
    created.caseId,
    new URLSearchParams(),
    boundRequest("mock:1101700123456", "http://localhost/notes")
  );
  const officerMissing = await handleCaseNotesList(
    notes,
    "missing-target-id-0001",
    new URLSearchParams(),
    boundRequest("mock:1101700123456", "http://localhost/notes")
  );
  assert.equal(officerExisting.status, 403);
  assert.equal(officerMissing.status, 403);

  const officerTaskMissing = await handleCaseTasksCreate(
    tasks,
    "missing-target-id-0001",
    boundRequest("mock:1101700123456", "http://localhost/tasks", { method: "POST", body: writeJson("mock:1101700123456", { title: "x" }) })
  );
  assert.equal(officerTaskMissing.status, 403);

  const adminMissing = await handleCaseNotesList(
    notes,
    "missing-target-id-0001",
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/notes")
  );
  assert.equal(adminMissing.status, 404);
});

test("note and task DTOs omit factual intelligence fields", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const notes = new DrugAnalystNoteService(db);
  const tasks = new DrugInvestigationTaskService(db);
  const noteRes = await handleCaseNotesCreate(
    notes,
    created.caseId,
    boundRequest("mock:admin", "http://localhost/notes", { method: "POST", body: writeJson("mock:admin", { body: "dto-note" }) })
  );
  const taskRes = await handleCaseTasksCreate(
    tasks,
    created.caseId,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "dto-task", description: "keep-in-dto" }),
    })
  );
  const noteJson = JSON.stringify(await noteRes.json());
  const taskJson = JSON.stringify(await taskRes.json());
  for (const blob of [noteJson, taskJson]) {
    assert.equal(blob.includes("nationalId"), false);
    assert.equal(blob.includes("narrative"), false);
    assert.equal(blob.includes("latitude"), false);
    assert.equal(blob.includes("seized"), false);
    assert.equal(blob.includes("imei"), false);
  }
  const noteBody = (JSON.parse(noteJson) as { data: { kind: string } }).data;
  const taskBody = (JSON.parse(taskJson) as { data: { kind: string; description: string } }).data;
  assert.equal(noteBody.kind, "ANALYST_NOTE");
  assert.equal(taskBody.kind, "TASK");
  assert.equal(taskBody.description, "keep-in-dto");

  const loaded = await handleNoteGet(notes, (JSON.parse(noteJson) as { data: { id: string } }).data.id, boundRequest("mock:admin", "http://localhost/note"));
  assert.equal(loaded.status, 200);
});

test("task patch cannot change target; trusted updater wins over body identity", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const tasks = new DrugInvestigationTaskService(db);
  const createdRes = await handleCaseTasksCreate(
    tasks,
    created.caseId,
    boundRequest("mock:admin", "http://localhost/tasks", { method: "POST", body: writeJson("mock:admin", { title: "stay-on-case" }) })
  );
  const task = ((await createdRes.json()) as { data: { id: string; targetId: string; createdByActorId: string } }).data;
  const patched = await handleTaskPatch(
    tasks,
    task.id,
    boundRequest("mock:admin", "http://localhost/task", {
      method: "PATCH",
      body: writeJson("mock:admin", {
        actorId: "mock:bpp414",
        status: "IN_PROGRESS",
        caseId: "other-case",
        personId: "other-person",
      }),
    })
  );
  assert.equal(patched.status, 200);
  const body = ((await patched.json()) as { data: { targetId: string; status: string; updatedByActorId: string; createdByActorId: string } }).data;
  assert.equal(body.targetId, created.caseId);
  assert.equal(body.status, "IN_PROGRESS");
  assert.equal(body.updatedByActorId, "mock:admin");
  assert.equal(body.createdByActorId, "mock:admin");
});

test("confirmActorId mismatch blocks write so a shared cookie cannot author as another UI identity", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const notes = new DrugAnalystNoteService(db);
  const mismatch = await handleCaseNotesCreate(
    notes,
    created.caseId,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:bpp414", { body: "tab-a-still-shows-commander" }),
    })
  );
  assert.equal(mismatch.status, 409);
  const missing = await handleCaseNotesCreate(
    notes,
    created.caseId,
    boundRequest("mock:admin", "http://localhost/notes", { method: "POST", body: JSON.stringify({ body: "no-confirm" }) })
  );
  assert.equal(missing.status, 400);
  const helper = assertConfirmActorId({ confirmActorId: "mock:admin" }, "mock:admin");
  assert.equal(helper.ok, true);
});

test("unauthenticated existing and missing targets are both 401; presence cookie is not identity", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const notes = new DrugAnalystNoteService(db);
  const existing = await handleCaseNotesList(notes, created.caseId, new URLSearchParams(), presenceOnly("http://localhost/notes"));
  const missing = await handleCaseNotesList(notes, "missing-target-id-0001", new URLSearchParams(), presenceOnly("http://localhost/notes"));
  const existingItem = await handleNoteGet(notes, "missing-note-id-0001", presenceOnly("http://localhost/note"));
  assert.equal(existing.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(existingItem.status, 401);
});

test("invalid pagination query is 400; pageSize 51 is rejected at the API", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase());
  const notes = new DrugAnalystNoteService(db);
  const page0 = await handleCaseNotesList(
    notes,
    created.caseId,
    new URLSearchParams("page=0"),
    boundRequest("mock:admin", "http://localhost/notes")
  );
  const size51 = await handleCaseNotesList(
    notes,
    created.caseId,
    new URLSearchParams("pageSize=51"),
    boundRequest("mock:admin", "http://localhost/notes")
  );
  assert.equal(page0.status, 400);
  assert.equal(size51.status, 400);
});

test("session DELETE clears the HttpOnly actor cookie; production secret has no known fallback", async () => {
  const cleared = await sessionDelete();
  assert.equal(cleared.status, 200);
  const cookie = cleared.headers.get("set-cookie") ?? "";
  assert.match(cookie, /bppis_actor=/);
  assert.match(cookie, /Max-Age=0/i);
  assert.match(cookie, /HttpOnly/i);

  assert.throws(
    () => boundSessionSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    BoundSessionSecretError
  );
  const local = boundSessionSecret({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
  assert.ok(local.length > 0);
});
