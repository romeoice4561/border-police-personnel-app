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
  handleCaseTasksList,
  handlePersonTasksCreate,
  handleTaskPatch,
  handleCollaborationAssignees,
  handleCaseNoteRelatedTasksList,
  handlePersonNoteRelatedTasksList,
  handleCaseRelatedNoteTasksBatch,
  handlePersonRelatedNoteTasksBatch,
  handlePersonNotesCreate,
  handleCaseTaskRelatedNotesList,
  handlePersonTaskRelatedNotesList,
  handleCaseRelatedTaskNotesBatch,
} from "@/lib/drug_intelligence/drug_collaboration_api_handlers";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";
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
  const taskBody = (JSON.parse(taskJson) as { data: { kind: string; description: string; sourceNoteId: string | null } }).data;
  assert.equal(noteBody.kind, "ANALYST_NOTE");
  assert.equal(taskBody.kind, "TASK");
  assert.equal(taskBody.description, "keep-in-dto");
  assert.equal(taskBody.sourceNoteId, null);

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

test("assignee directory GET is drug.read, minimized, and excludes officer", async () => {
  const missing = await handleCollaborationAssignees(new Request("http://localhost/assignees"));
  assert.equal(missing.status, 401);

  const officer = await handleCollaborationAssignees(boundRequest("mock:1101700123456", "http://localhost/assignees"));
  assert.equal(officer.status, 403);

  const commander = await handleCollaborationAssignees(boundRequest("mock:bpp414", "http://localhost/assignees"));
  assert.equal(commander.status, 200);
  const commanderJson = (await commander.json()) as { data: Array<Record<string, unknown>> };
  const commanderIds = commanderJson.data.map((row) => row.id);
  assert.ok(commanderIds.includes("mock:admin"));
  assert.ok(commanderIds.includes("mock:bpp414"));
  assert.equal(commanderIds.includes("mock:1101700123456"), false);
  for (const row of commanderJson.data) {
    assert.deepEqual(Object.keys(row).sort(), ["displayName", "id"]);
    assert.equal(typeof row.id, "string");
    assert.equal(typeof row.displayName, "string");
    assert.equal("permissions" in row, false);
    assert.equal("role" in row, false);
    assert.equal("password" in row, false);
    assert.equal("officerId" in row, false);
  }

  const admin = await handleCollaborationAssignees(boundRequest("mock:admin", "http://localhost/assignees"));
  assert.equal(admin.status, 200);
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

const NOTE_BODY = "secret-note-body-must-never-copy <script>alert(1)</script>";
const TASK_DESC = "secret-task-description";

function person(name: string): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: "person-note",
      identifiers: [],
    },
    role: "SUSPECT",
    linkedOfficerId: null,
    notes: null,
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

async function seedLinkedTargets() {
  const db = new InMemoryDatabaseClient();
  const first = await new DrugCaseService({ db }).createCase({
    ...baseCase(),
    caseNumber: "COL-API-11E1-001",
    persons: [person("สมชาย เอ"), person("วิไล เอฟ")],
  });
  const second = await new DrugCaseService({ db }).createCase({
    ...baseCase(),
    caseNumber: "COL-API-11E1-002",
    title: "other-case",
  });
  const links = (await db.drugCasePerson.findMany({ where: { caseId: first.caseId } })) as Array<{ personId: string }>;
  return {
    db,
    caseX: first.caseId,
    caseY: second.caseId,
    personA: links[0]!.personId,
    personF: links[1]!.personId,
    notes: new DrugAnalystNoteService(db),
    tasks: new DrugInvestigationTaskService(db),
  };
}

test("Case and Person POST accept optional sourceNoteId and keep existing create unchanged", async () => {
  const { db, caseX, personA, notes, tasks } = await seedLinkedTargets();
  const caseNote = await notes.createForCase(caseX, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  const personNote = await notes.createForPerson(personA, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });

  const withoutNote = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", { method: "POST", body: writeJson("mock:admin", { title: "plain-task" }) })
  );
  assert.equal(withoutNote.status, 201);
  const plain = ((await withoutNote.json()) as { data: { sourceNoteId: string | null; description: string | null } }).data;
  assert.equal(plain.sourceNoteId, null);

  const caseLinked = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "from-note", sourceNoteId: caseNote.id }),
    })
  );
  assert.equal(caseLinked.status, 201);
  const caseTask = ((await caseLinked.json()) as { data: { sourceNoteId: string | null; title: string; description: string | null } }).data;
  assert.equal(caseTask.sourceNoteId, caseNote.id);
  assert.equal(caseTask.title, "from-note");
  assert.equal(caseTask.description, null);
  assert.equal(JSON.stringify(caseTask).includes(NOTE_BODY), false);

  const personLinked = await handlePersonTasksCreate(
    tasks,
    personA,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "person-from-note", sourceNoteId: personNote.id }),
    })
  );
  assert.equal(personLinked.status, 201);
  const personTask = ((await personLinked.json()) as { data: { sourceNoteId: string | null } }).data;
  assert.equal(personTask.sourceNoteId, personNote.id);

  const createdAudit = (await db.drugAuditLog.findMany({ where: { action: "investigation_task_created" } })).find((row) =>
    String(row.detail ?? "").includes(caseNote.id)
  );
  assert.ok(createdAudit);
  const detail = String(createdAudit.detail ?? "");
  assert.match(detail, new RegExp(`"sourceNoteId":"${caseNote.id}"`));
  assert.equal(detail.includes(NOTE_BODY), false);
  assert.equal(detail.includes("from-note"), false);
  assert.equal((await db.drugAuditLog.findMany({ where: { action: "note_linked_to_task" } })).length, 0);
});

test("sourceNoteId cross-target and missing-note writes fail without creating a Task", async () => {
  const { db, caseX, caseY, personA, personF, notes, tasks } = await seedLinkedTargets();
  const caseNote = await notes.createForCase(caseX, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  const personNote = await notes.createForPerson(personA, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });

  const crossCase = await handleCaseTasksCreate(
    tasks,
    caseY,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "no", sourceNoteId: caseNote.id }),
    })
  );
  const crossPerson = await handlePersonTasksCreate(
    tasks,
    personF,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "no", sourceNoteId: personNote.id }),
    })
  );
  const caseToPerson = await handlePersonTasksCreate(
    tasks,
    personA,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "no", sourceNoteId: caseNote.id }),
    })
  );
  const personToCase = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "no", sourceNoteId: personNote.id }),
    })
  );
  const missing = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "no", sourceNoteId: "missing-note-id-0001" }),
    })
  );

  assert.equal(crossCase.status, 400);
  assert.equal(crossPerson.status, 400);
  assert.equal(caseToPerson.status, 400);
  assert.equal(personToCase.status, 400);
  assert.equal(missing.status, 404);
  for (const response of [crossCase, crossPerson, caseToPerson, personToCase, missing]) {
    const blob = JSON.stringify(await response.json());
    assert.equal(blob.includes(NOTE_BODY), false);
    assert.doesNotMatch(blob, /<script>/);
  }
  assert.equal((await db.drugInvestigationTask.findMany({})).length, 0);
});

test("sourceNoteId create still requires confirmActorId; commander and officer stay blocked", async () => {
  const { db, caseX, notes, tasks } = await seedLinkedTargets();
  const note = await notes.createForCase(caseX, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });

  const missingConfirm = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "no", sourceNoteId: note.id }),
    })
  );
  assert.equal(missingConfirm.status, 400);

  const mismatch = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:bpp414", { title: "no", sourceNoteId: note.id }),
    })
  );
  assert.equal(mismatch.status, 409);
  const mismatchJson = (await mismatch.json()) as { error: { message: string; details?: { personId?: string } } };
  assert.match(mismatchJson.error.message, /confirmActorId/);
  assert.equal(mismatchJson.error.details?.personId, undefined);

  const commander = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:bpp414", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:bpp414", { title: "no", sourceNoteId: note.id }),
    })
  );
  assert.equal(commander.status, 403);

  const officer = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:1101700123456", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:1101700123456", { title: "no", sourceNoteId: note.id }),
    })
  );
  assert.equal(officer.status, 403);
  assert.equal((await db.drugInvestigationTask.findMany({})).length, 0);
});

test("MERGED Person Task create with sourceNoteId remains 409 fail-closed", async () => {
  const { db, personA, personF, notes, tasks } = await seedLinkedTargets();
  const note = await notes.createForPerson(personA, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  await db.drugPerson.update({
    where: { id: personA },
    data: { status: "MERGED", mergedIntoPersonId: personF },
  });

  const merged = await handlePersonTasksCreate(
    tasks,
    personA,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "no", sourceNoteId: note.id }),
    })
  );
  assert.equal(merged.status, 409);
  const body = (await merged.json()) as { error: { message: string; details: { personId: string; survivorPersonId: string } } };
  assert.equal(body.error.details.personId, personA);
  assert.equal(body.error.details.survivorPersonId, personF);
  assert.equal(JSON.stringify(body).includes(NOTE_BODY), false);
  assert.equal((await db.drugInvestigationTask.findMany({})).length, 0);
  assert.equal((await db.drugInvestigationTask.findMany({ where: { personId: personF } })).length, 0);
  const stillOnMerged = await db.drugAnalystNote.findUnique({ where: { id: note.id } });
  assert.equal(stillOnMerged?.personId, personA);
});

test("PATCH cannot change sourceNoteId after create", async () => {
  const { caseX, notes, tasks } = await seedLinkedTargets();
  const note = await notes.createForCase(caseX, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  const created = await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "linked", sourceNoteId: note.id }),
    })
  );
  const task = ((await created.json()) as { data: { id: string; sourceNoteId: string } }).data;
  const patched = await handleTaskPatch(
    tasks,
    task.id,
    boundRequest("mock:admin", "http://localhost/task", {
      method: "PATCH",
      body: writeJson("mock:admin", { title: "still-linked", sourceNoteId: "other-note-id-0001" }),
    })
  );
  assert.equal(patched.status, 200);
  const body = ((await patched.json()) as { data: { title: string; sourceNoteId: string | null } }).data;
  assert.equal(body.title, "still-linked");
  assert.equal(body.sourceNoteId, note.id);
});

test("related Tasks GET is drug.read, target-scoped, and does not leak Note body", async () => {
  const { caseX, caseY, personA, personF, notes, tasks } = await seedLinkedTargets();
  const caseNote = await notes.createForCase(caseX, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  const otherCaseNote = await notes.createForCase(caseY, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  const personNote = await notes.createForPerson(personA, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  const personFNote = await notes.createForPerson(personF, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  await handleCaseTasksCreate(
    tasks,
    caseX,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "linked-case", sourceNoteId: caseNote.id }),
    })
  );
  await handlePersonTasksCreate(
    tasks,
    personA,
    boundRequest("mock:admin", "http://localhost/tasks", {
      method: "POST",
      body: writeJson("mock:admin", { title: "linked-person", sourceNoteId: personNote.id }),
    })
  );

  const adminCase = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    caseNote.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  assert.equal(adminCase.status, 200);
  const adminJson = (await adminCase.json()) as { data: Array<{ sourceNoteId: string; title: string; description: string | null }> };
  assert.equal(adminJson.data.length, 1);
  assert.equal(adminJson.data[0]?.sourceNoteId, caseNote.id);
  assert.equal(JSON.stringify(adminJson).includes(NOTE_BODY), false);

  const commander = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    caseNote.id,
    new URLSearchParams(),
    boundRequest("mock:bpp414", "http://localhost/related")
  );
  assert.equal(commander.status, 200);

  const officer = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    caseNote.id,
    new URLSearchParams(),
    boundRequest("mock:1101700123456", "http://localhost/related")
  );
  assert.equal(officer.status, 403);

  const officerBatch = await handleCaseRelatedNoteTasksBatch(
    tasks,
    caseX,
    new URLSearchParams({ ids: caseNote.id }),
    boundRequest("mock:1101700123456", "http://localhost/batch")
  );
  assert.equal(officerBatch.status, 403);

  const crossCase = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    otherCaseNote.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  const caseReadsPerson = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    personNote.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  const personCross = await handlePersonNoteRelatedTasksList(
    tasks,
    personA,
    personFNote.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  const missing = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    "missing-note-id-0001",
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  assert.equal(crossCase.status, 400);
  assert.equal(caseReadsPerson.status, 400);
  assert.equal(personCross.status, 400);
  assert.equal(missing.status, 404);

  const batchCross = await handlePersonRelatedNoteTasksBatch(
    tasks,
    personA,
    new URLSearchParams({ ids: personFNote.id }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(batchCross.status, 400);
});

test("related Tasks query stays bounded and Task list provenance omits Note body", async () => {
  const { caseX, notes, tasks } = await seedLinkedTargets();
  const note = await notes.createForCase(caseX, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  for (let i = 0; i < 21; i += 1) {
    await handleCaseTasksCreate(
      tasks,
      caseX,
      boundRequest("mock:admin", "http://localhost/tasks", {
        method: "POST",
        body: writeJson("mock:admin", { title: `rel-${String(i).padStart(2, "0")}`, sourceNoteId: note.id }),
      })
    );
  }

  const first = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    note.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  const firstBody = (await first.json()) as {
    data: Array<{ id: string; sourceNoteId: string }>;
    meta: { pageSize: number; total: number; totalPages: number };
  };
  assert.equal(first.status, 200);
  assert.equal(firstBody.meta.pageSize, 20);
  assert.equal(firstBody.meta.total, 21);
  assert.equal(firstBody.data.length, 20);
  assert.equal(firstBody.meta.totalPages, 2);

  const max = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    note.id,
    new URLSearchParams({ pageSize: "50" }),
    boundRequest("mock:admin", "http://localhost/related")
  );
  const maxBody = (await max.json()) as { data: unknown[]; meta: { pageSize: number } };
  assert.equal(maxBody.data.length, 21);
  assert.equal(maxBody.meta.pageSize, 50);

  const clamped = await handleCaseNoteRelatedTasksList(
    tasks,
    caseX,
    note.id,
    new URLSearchParams({ pageSize: "51" }),
    boundRequest("mock:admin", "http://localhost/related")
  );
  assert.equal(clamped.status, 400);

  const listed = await handleCaseTasksList(
    tasks,
    caseX,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/tasks")
  );
  const listedBody = (await listed.json()) as {
    data: Array<{ sourceNoteId: string | null }>;
    meta: { sourceNotes?: Array<{ id: string; authorName: string; createdAt: string; body?: string }> };
  };
  assert.equal(listed.status, 200);
  assert.ok((listedBody.meta.sourceNotes ?? []).some((row) => row.id === note.id));
  assert.equal(JSON.stringify(listedBody).includes(NOTE_BODY), false);
  for (const row of listedBody.meta.sourceNotes ?? []) {
    assert.equal("body" in row, false);
  }
});

test("related-note-tasks batch rejects empty, malformed, oversized, and mixed-target ids", async () => {
  const { caseX, caseY, notes, tasks } = await seedLinkedTargets();
  const note = await notes.createForCase(caseX, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });
  const other = await notes.createForCase(caseY, { body: NOTE_BODY }, { actorId: "mock:admin", actorName: "Administrator" });

  const empty = await handleCaseRelatedNoteTasksBatch(
    tasks,
    caseX,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(empty.status, 400);

  const malformed = await handleCaseRelatedNoteTasksBatch(
    tasks,
    caseX,
    new URLSearchParams({ ids: "not a valid id!!" }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(malformed.status, 400);

  const duplicates = await handleCaseRelatedNoteTasksBatch(
    tasks,
    caseX,
    new URLSearchParams({ ids: `${note.id},${note.id},${note.id}` }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(duplicates.status, 200);
  const dupBody = (await duplicates.json()) as { data: Array<{ sourceNoteId: string; items: unknown[] }> };
  assert.equal(dupBody.data.length, 1);
  assert.equal(dupBody.data[0]?.sourceNoteId, note.id);

  const tooMany = await handleCaseRelatedNoteTasksBatch(
    tasks,
    caseX,
    new URLSearchParams({ ids: Array.from({ length: 21 }, (_, i) => `note-id-${String(i).padStart(2, "0")}`).join(",") }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(tooMany.status, 400);

  const mixed = await handleCaseRelatedNoteTasksBatch(
    tasks,
    caseX,
    new URLSearchParams({ ids: `${note.id},${other.id}` }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(mixed.status, 400);
});

test("Case and Person POST accept optional sourceTaskId and keep existing note create unchanged", async () => {
  const { db, caseX, personA, notes, tasks } = await seedLinkedTargets();
  const caseTask = await tasks.createForCase(caseX, { title: "case-task", description: TASK_DESC }, { actorId: "mock:admin", actorName: "Administrator" });
  const personTask = await tasks.createForPerson(personA, { title: "person-task" }, { actorId: "mock:admin", actorName: "Administrator" });

  const withoutTask = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", { method: "POST", body: writeJson("mock:admin", { body: "plain-note" }) })
  );
  assert.equal(withoutTask.status, 201);
  const plain = ((await withoutTask.json()) as { data: { sourceTaskId: string | null; kind: string } }).data;
  assert.equal(plain.sourceTaskId, null);
  assert.equal(plain.kind, "ANALYST_NOTE");

  const caseLinked = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "from-task", sourceTaskId: caseTask.id }),
    })
  );
  assert.equal(caseLinked.status, 201);
  const caseNote = ((await caseLinked.json()) as { data: { sourceTaskId: string | null; kind: string; body: string } }).data;
  assert.equal(caseNote.sourceTaskId, caseTask.id);
  assert.equal(caseNote.kind, "ANALYST_NOTE");
  assert.equal(caseNote.body, "from-task");
  assert.equal(JSON.stringify(caseNote).includes(TASK_DESC), false);

  const personLinked = await handlePersonNotesCreate(
    notes,
    personA,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "person-from-task", sourceTaskId: personTask.id }),
    })
  );
  assert.equal(personLinked.status, 201);
  const personNote = ((await personLinked.json()) as { data: { sourceTaskId: string | null } }).data;
  assert.equal(personNote.sourceTaskId, personTask.id);

  const createdAudit = (await db.drugAuditLog.findMany({ where: { action: "analyst_note_created" } })).find((row) =>
    String(row.detail ?? "").includes(caseTask.id)
  );
  assert.ok(createdAudit);
  const detail = String(createdAudit.detail ?? "");
  assert.match(detail, new RegExp(`"sourceTaskId":"${caseTask.id}"`));
  assert.equal(detail.includes("from-task"), false);
  assert.equal(detail.includes(TASK_DESC), false);
  assert.equal((await tasks.get(caseTask.id)).status, "OPEN");
});

test("sourceTaskId cross-target and missing-task writes fail without creating a Note", async () => {
  const { db, caseX, caseY, personA, personF, notes, tasks } = await seedLinkedTargets();
  const caseTask = await tasks.createForCase(caseX, { title: "case-x" }, { actorId: "mock:admin", actorName: "Administrator" });
  const personTask = await tasks.createForPerson(personA, { title: "person-a" }, { actorId: "mock:admin", actorName: "Administrator" });
  const before = await db.drugAnalystNote.count({});

  const crossCase = await handleCaseNotesCreate(
    notes,
    caseY,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "no", sourceTaskId: caseTask.id }),
    })
  );
  const crossPerson = await handlePersonNotesCreate(
    notes,
    personF,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "no", sourceTaskId: personTask.id }),
    })
  );
  const caseToPerson = await handlePersonNotesCreate(
    notes,
    personA,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "no", sourceTaskId: caseTask.id }),
    })
  );
  const personToCase = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "no", sourceTaskId: personTask.id }),
    })
  );
  const missing = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "no", sourceTaskId: "missing-task-id-0001" }),
    })
  );

  assert.equal(crossCase.status, 400);
  assert.equal(crossPerson.status, 400);
  assert.equal(caseToPerson.status, 400);
  assert.equal(personToCase.status, 400);
  assert.equal(missing.status, 404);
  assert.equal(await db.drugAnalystNote.count({}), before);
});

test("CANCELLED Task cannot create a result Note; OPEN still can", async () => {
  const { db, caseX, notes, tasks } = await seedLinkedTargets();
  const cancelled = await tasks.createForCase(caseX, { title: "cancel-me" }, { actorId: "mock:admin", actorName: "Administrator" });
  await handleTaskPatch(
    tasks,
    cancelled.id,
    boundRequest("mock:admin", "http://localhost/task", {
      method: "PATCH",
      body: writeJson("mock:admin", { status: "CANCELLED" }),
    })
  );
  const rejected = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "no", sourceTaskId: cancelled.id }),
    })
  );
  assert.equal(rejected.status, 400);
  assert.equal((await db.drugAnalystNote.findMany({ where: { sourceTaskId: cancelled.id } })).length, 0);
  assert.equal((await tasks.get(cancelled.id)).status, "CANCELLED");
});

test("sourceTaskId create still requires confirmActorId; commander and officer stay blocked; missing session is 401", async () => {
  const { db, caseX, notes, tasks } = await seedLinkedTargets();
  const task = await tasks.createForCase(caseX, { title: "auth" }, { actorId: "mock:admin", actorName: "Administrator" });

  const missingConfirm = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: JSON.stringify({ body: "no", sourceTaskId: task.id }),
    })
  );
  assert.equal(missingConfirm.status, 400);

  const mismatch = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:bpp414", { body: "no", sourceTaskId: task.id }),
    })
  );
  assert.equal(mismatch.status, 409);

  const commander = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:bpp414", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:bpp414", { body: "no", sourceTaskId: task.id }),
    })
  );
  assert.equal(commander.status, 403);

  const officer = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:1101700123456", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:1101700123456", { body: "no", sourceTaskId: task.id }),
    })
  );
  assert.equal(officer.status, 403);

  const unauthenticated = await handleCaseNotesCreate(
    notes,
    caseX,
    new Request("http://localhost/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: writeJson("mock:admin", { body: "no", sourceTaskId: task.id }),
    })
  );
  assert.equal(unauthenticated.status, 401);
  assert.equal((await db.drugAnalystNote.findMany({ where: { sourceTaskId: task.id } })).length, 0);
});

test("MERGED Person Note create with sourceTaskId remains 409 fail-closed", async () => {
  const { db, personA, personF, notes, tasks } = await seedLinkedTargets();
  const task = await tasks.createForPerson(personA, { title: "before-merge" }, { actorId: "mock:admin", actorName: "Administrator" });
  await db.drugPerson.update({
    where: { id: personA },
    data: { status: "MERGED", mergedIntoPersonId: personF },
  });
  const merged = await handlePersonNotesCreate(
    notes,
    personA,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "no", sourceTaskId: task.id }),
    })
  );
  assert.equal(merged.status, 409);
  const body = (await merged.json()) as { error: { details: { personId: string; survivorPersonId: string } } };
  assert.equal(body.error.details.personId, personA);
  assert.equal(body.error.details.survivorPersonId, personF);
  assert.equal((await db.drugAnalystNote.findMany({ where: { sourceTaskId: task.id } })).length, 0);
  assert.equal((await db.drugAnalystNote.findMany({ where: { personId: personF } })).length, 0);
});

test("PATCH cannot change sourceTaskId after create", async () => {
  const { caseX, notes, tasks } = await seedLinkedTargets();
  const task = await tasks.createForCase(caseX, { title: "linked" }, { actorId: "mock:admin", actorName: "Administrator" });
  const created = await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: "linked", sourceTaskId: task.id }),
    })
  );
  const note = ((await created.json()) as { data: { id: string; sourceTaskId: string } }).data;
  const patched = await handleNotePatch(
    notes,
    note.id,
    boundRequest("mock:admin", "http://localhost/note", {
      method: "PATCH",
      body: writeJson("mock:admin", { body: "still-linked", sourceTaskId: "other-task-id-0001" }),
    })
  );
  assert.equal(patched.status, 200);
  const body = ((await patched.json()) as { data: { body: string; sourceTaskId: string | null } }).data;
  assert.equal(body.body, "still-linked");
  assert.equal(body.sourceTaskId, task.id);
});

test("related result Notes GET is drug.read, target-scoped, and does not leak Note body", async () => {
  const { caseX, caseY, personA, personF, notes, tasks } = await seedLinkedTargets();
  const caseTask = await tasks.createForCase(caseX, { title: "case-task" }, { actorId: "mock:admin", actorName: "Administrator" });
  const otherCaseTask = await tasks.createForCase(caseY, { title: "other-case" }, { actorId: "mock:admin", actorName: "Administrator" });
  const personTask = await tasks.createForPerson(personA, { title: "person-task" }, { actorId: "mock:admin", actorName: "Administrator" });
  const personFTask = await tasks.createForPerson(personF, { title: "person-f" }, { actorId: "mock:admin", actorName: "Administrator" });
  await handleCaseNotesCreate(
    notes,
    caseX,
    boundRequest("mock:admin", "http://localhost/notes", {
      method: "POST",
      body: writeJson("mock:admin", { body: NOTE_BODY, sourceTaskId: caseTask.id }),
    })
  );

  const adminCase = await handleCaseTaskRelatedNotesList(
    notes,
    caseX,
    caseTask.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  assert.equal(adminCase.status, 200);
  const adminJson = (await adminCase.json()) as { data: Array<{ authorName: string; body?: string }> };
  assert.equal(adminJson.data.length, 1);
  assert.equal(JSON.stringify(adminJson).includes(NOTE_BODY), false);
  assert.equal("body" in (adminJson.data[0] ?? {}), false);

  const commander = await handleCaseTaskRelatedNotesList(
    notes,
    caseX,
    caseTask.id,
    new URLSearchParams(),
    boundRequest("mock:bpp414", "http://localhost/related")
  );
  assert.equal(commander.status, 200);

  const officer = await handleCaseTaskRelatedNotesList(
    notes,
    caseX,
    caseTask.id,
    new URLSearchParams(),
    boundRequest("mock:1101700123456", "http://localhost/related")
  );
  assert.equal(officer.status, 403);

  const officerBatch = await handleCaseRelatedTaskNotesBatch(
    notes,
    caseX,
    new URLSearchParams({ ids: caseTask.id }),
    boundRequest("mock:1101700123456", "http://localhost/batch")
  );
  assert.equal(officerBatch.status, 403);

  const crossCase = await handleCaseTaskRelatedNotesList(
    notes,
    caseX,
    otherCaseTask.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  const caseReadsPerson = await handleCaseTaskRelatedNotesList(
    notes,
    caseX,
    personTask.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  const personCross = await handlePersonTaskRelatedNotesList(
    notes,
    personA,
    personFTask.id,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/related")
  );
  assert.equal(crossCase.status, 400);
  assert.equal(caseReadsPerson.status, 400);
  assert.equal(personCross.status, 400);
});

test("related-task-notes batch rejects empty, malformed, oversized, and mixed-target ids", async () => {
  const { caseX, caseY, notes, tasks } = await seedLinkedTargets();
  const task = await tasks.createForCase(caseX, { title: "batch" }, { actorId: "mock:admin", actorName: "Administrator" });
  const other = await tasks.createForCase(caseY, { title: "other" }, { actorId: "mock:admin", actorName: "Administrator" });

  const empty = await handleCaseRelatedTaskNotesBatch(
    notes,
    caseX,
    new URLSearchParams(),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(empty.status, 400);

  const malformed = await handleCaseRelatedTaskNotesBatch(
    notes,
    caseX,
    new URLSearchParams({ ids: "not a valid id!!" }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(malformed.status, 400);

  const tooManyUnique = await handleCaseRelatedTaskNotesBatch(
    notes,
    caseX,
    new URLSearchParams({ ids: Array.from({ length: 21 }, (_, i) => `task-id-${String(i).padStart(2, "0")}`).join(",") }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(tooManyUnique.status, 400);

  const tooManyRaw = await handleCaseRelatedTaskNotesBatch(
    notes,
    caseX,
    new URLSearchParams({
      ids: Array.from({ length: 51 }, (_, i) => `task-id-${String(i).padStart(2, "0")}`).join(","),
    }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(tooManyRaw.status, 400);

  const mixed = await handleCaseRelatedTaskNotesBatch(
    notes,
    caseX,
    new URLSearchParams({ ids: `${task.id},${other.id}` }),
    boundRequest("mock:admin", "http://localhost/batch")
  );
  assert.equal(mixed.status, 400);
});
