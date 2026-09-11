/**
 * DI-11B collaboration services — notes, tasks, pagination, transitions, isolation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugAnalystNoteService } from "@/lib/drug_intelligence/drug_analyst_note_service";
import { DrugInvestigationTaskService } from "@/lib/drug_intelligence/drug_investigation_task_service";
import { listAssignableCollaborationActors } from "@/lib/drug_intelligence/drug_collaboration_auth";
import { canTransitionTaskStatus, isTaskOverdue } from "@/lib/drug_intelligence/drug_collaboration_options";
import {
  CollaborationInvalidAssigneeError,
  CollaborationInvalidTransitionError,
  CollaborationPersonMergedError,
  CollaborationTargetNotFoundError,
  CollaborationValidationError,
  type CollaborationActor,
} from "@/lib/drug_intelligence/drug_collaboration_types";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());
const ADMIN: CollaborationActor = { actorId: "mock:admin", actorName: "Administrator" };
const COMMANDER: CollaborationActor = { actorId: "mock:bpp414", actorName: "Commander BPP414" };

function countingDb(db: DatabaseClient, models: string[]): { db: DatabaseClient; queries: () => number } {
  let n = 0;
  const keys = new Set(models);
  const proxied = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && keys.has(prop) && value && typeof value === "object") {
        return new Proxy(value as object, {
          get(delegate, method, delReceiver) {
            const fn = Reflect.get(delegate, method, delReceiver);
            if ((method === "findMany" || method === "count" || method === "findUnique" || method === "create" || method === "update") && typeof fn === "function") {
              return (args?: unknown) => {
                n += 1;
                return fn.apply(delegate, [args]);
              };
            }
            return fn;
          },
        });
      }
      if (prop === "$transaction" && typeof value === "function") {
        return (fn: (tx: DatabaseClient) => Promise<unknown>) => value.call(target, (tx: DatabaseClient) => fn(countingDb(tx, models).db));
      }
      return value;
    },
  });
  return { db: proxied as DatabaseClient, queries: () => n };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "COL-11B-001",
    title: "collaboration fixture",
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
    narrative: "factual-narrative-must-not-change",
    persons: [],
    seizedItems: [
      {
        drugCategory: "METHAMPHETAMINE_TABLET",
        otherDrugCategoryLabel: null,
        measurementKind: "COUNT",
        drugType: "ยาบ้า",
        subtype: null,
        quantity: 10,
        unit: "เม็ด",
        weightGrams: null,
        packageCount: null,
        notes: "seizure-note",
      },
    ],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

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

async function seed(db: InMemoryDatabaseClient) {
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({ persons: [person("สมชาย ทดสอบ"), person("วิไล ผู้รอด")] })
  );
  const links = (await db.drugCasePerson.findMany({ where: { caseId: created.caseId } })) as Array<{ personId: string }>;
  return { caseId: created.caseId, personIds: links.map((row) => row.personId) };
}

test("assignable directory includes drug.read actors and excludes the seeded officer", async () => {
  const users = await listAssignableCollaborationActors();
  const ids = users.map((user) => user.id);
  assert.ok(ids.includes("mock:admin"));
  assert.ok(ids.includes("mock:bpp414"));
  assert.equal(ids.includes("mock:1101700123456"), false);
});

test("analyst note create/list/update preserves author and omits body from audit", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seed(db);
  const notes = new DrugAnalystNoteService(db);
  const created = await notes.createForCase(caseId, { body: "  บันทึกนักวิเคราะห์ทดสอบ  " }, ADMIN);
  assert.equal(created.kind, "ANALYST_NOTE");
  assert.equal(created.body, "บันทึกนักวิเคราะห์ทดสอบ");
  assert.equal(created.targetKind, "CASE");
  assert.equal(created.authorActorId, "mock:admin");
  const storedNote = await db.drugAnalystNote.findUnique({ where: { id: created.id } });
  assert.equal(storedNote?.caseId, caseId);
  assert.equal(storedNote?.personId ?? null, null);
  const listed = await notes.listForCase(caseId, { page: 1, pageSize: 20 });
  assert.equal(listed.meta.total, 1);
  assert.equal(listed.items[0]?.id, created.id);

  const updated = await notes.update(created.id, { body: "แก้ไขแล้ว" }, COMMANDER);
  assert.equal(updated.body, "แก้ไขแล้ว");
  assert.equal(updated.authorActorId, "mock:admin");
  assert.equal(updated.updatedByActorId, "mock:bpp414");

  const audits = await db.drugAuditLog.findMany({ where: { entityId: created.id } });
  assert.ok(audits.some((row) => row.action === "analyst_note_created"));
  assert.ok(audits.some((row) => row.action === "analyst_note_updated"));
  for (const row of audits) {
    const detail = String(row.detail ?? "");
    assert.equal(detail.includes("บันทึกนักวิเคราะห์ทดสอบ"), false);
    assert.equal(detail.includes("แก้ไขแล้ว"), false);
  }
});

test("note validation: empty and too-long body", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seed(db);
  const notes = new DrugAnalystNoteService(db);
  await assert.rejects(() => notes.createForCase(caseId, { body: "   " }, ADMIN), CollaborationValidationError);
  await assert.rejects(() => notes.createForCase(caseId, { body: "x".repeat(5001) }, ADMIN), CollaborationValidationError);
  const ok = await notes.createForCase(caseId, { body: "x".repeat(5000) }, ADMIN);
  assert.equal(ok.body.length, 5000);
});

test("merged person writes are rejected with survivor id; missing target 404-equivalent", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId, personIds } = await seed(db);
  const [mergedId, survivorId] = personIds;
  assert.ok(mergedId && survivorId);
  await db.drugPerson.update({
    where: { id: mergedId },
    data: { status: "MERGED", mergedIntoPersonId: survivorId },
  });
  const notes = new DrugAnalystNoteService(db);
  const tasks = new DrugInvestigationTaskService(db);
  await assert.rejects(() => notes.createForPerson(mergedId, { body: "no" }, ADMIN), (error: unknown) => {
    assert.ok(error instanceof CollaborationPersonMergedError);
    assert.equal(error.survivorPersonId, survivorId);
    return true;
  });
  await assert.rejects(() => tasks.createForPerson(mergedId, { title: "no" }, ADMIN), CollaborationPersonMergedError);
  await assert.rejects(() => notes.createForCase("missing-case-id-0001", { body: "no" }, ADMIN), CollaborationTargetNotFoundError);
  const onSurvivor = await notes.createForPerson(survivorId, { body: "ok" }, ADMIN);
  assert.equal(onSurvivor.targetId, survivorId);
  const storedPersonNote = await db.drugAnalystNote.findUnique({ where: { id: onSurvivor.id } });
  assert.equal(storedPersonNote?.personId, survivorId);
  assert.equal(storedPersonNote?.caseId ?? null, null);
  void caseId;
});

test("task create, assignee eligibility, overdue, and terminal transitions", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seed(db);
  const tasks = new DrugInvestigationTaskService(db);
  const unassigned = await tasks.createForCase(caseId, { title: "  ติดตามพยาน  ", priority: "HIGH" }, ADMIN);
  assert.equal(unassigned.kind, "TASK");
  assert.equal(unassigned.title, "ติดตามพยาน");
  assert.equal(unassigned.assignedActorId, null);
  assert.equal(unassigned.status, "OPEN");
  assert.equal(unassigned.isOverdue, false);
  const storedTask = await db.drugInvestigationTask.findUnique({ where: { id: unassigned.id } });
  assert.equal(storedTask?.caseId, caseId);
  assert.equal(storedTask?.personId ?? null, null);

  await assert.rejects(
    () => tasks.createForCase(caseId, { title: "bad", assignedActorId: "mock:1101700123456" }, ADMIN),
    CollaborationInvalidAssigneeError
  );
  await assert.rejects(
    () => tasks.createForCase(caseId, { title: "bad", assignedActorId: "mock:unknown" }, ADMIN),
    CollaborationInvalidAssigneeError
  );

  const assigned = await tasks.createForCase(
    caseId,
    { title: "assign commander", assignedActorId: "mock:bpp414", dueAt: new Date("2020-01-01T00:00:00.000Z") },
    ADMIN
  );
  assert.equal(assigned.assignedActorId, "mock:bpp414");
  assert.equal(assigned.assignedActorName, "Commander BPP414");
  assert.equal(assigned.isOverdue, true);

  const future = await tasks.createForCase(
    caseId,
    { title: "future", assignedActorId: "mock:admin", dueAt: new Date("2099-01-01T00:00:00.000Z") },
    ADMIN
  );
  assert.equal(future.isOverdue, false);

  const done = await tasks.update(unassigned.id, { status: "DONE" }, COMMANDER);
  assert.equal(done.status, "DONE");
  assert.ok(done.completedAt);
  assert.equal(done.isOverdue, false);
  assert.equal(done.createdByActorId, "mock:admin");
  assert.equal(done.updatedByActorId, "mock:bpp414");
  await assert.rejects(() => tasks.update(unassigned.id, { status: "OPEN" }, ADMIN), CollaborationInvalidTransitionError);

  const cancelled = await tasks.update(assigned.id, { status: "CANCELLED" }, ADMIN);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.completedAt, null);
  await assert.rejects(() => tasks.update(assigned.id, { status: "IN_PROGRESS" }, ADMIN), CollaborationInvalidTransitionError);

  const progress = await tasks.update(future.id, { status: "IN_PROGRESS" }, ADMIN);
  const completed = await tasks.update(future.id, { status: "DONE" }, ADMIN);
  assert.equal(progress.status, "IN_PROGRESS");
  assert.equal(completed.status, "DONE");
  assert.equal(completed.targetKind, "CASE");
  assert.equal(completed.targetId, caseId);
});

test("every disallowed task transition is rejected", () => {
  assert.equal(canTransitionTaskStatus("OPEN", "OPEN"), true);
  assert.equal(canTransitionTaskStatus("IN_PROGRESS", "IN_PROGRESS"), true);
  assert.equal(canTransitionTaskStatus("DONE", "DONE"), true);
  assert.equal(canTransitionTaskStatus("CANCELLED", "CANCELLED"), true);
  assert.equal(canTransitionTaskStatus("OPEN", "IN_PROGRESS"), true);
  assert.equal(canTransitionTaskStatus("OPEN", "DONE"), true);
  assert.equal(canTransitionTaskStatus("OPEN", "CANCELLED"), true);
  assert.equal(canTransitionTaskStatus("IN_PROGRESS", "DONE"), true);
  assert.equal(canTransitionTaskStatus("IN_PROGRESS", "CANCELLED"), true);
  assert.equal(canTransitionTaskStatus("IN_PROGRESS", "OPEN"), false);
  assert.equal(canTransitionTaskStatus("DONE", "OPEN"), false);
  assert.equal(canTransitionTaskStatus("DONE", "IN_PROGRESS"), false);
  assert.equal(canTransitionTaskStatus("DONE", "CANCELLED"), false);
  assert.equal(canTransitionTaskStatus("CANCELLED", "OPEN"), false);
  assert.equal(canTransitionTaskStatus("CANCELLED", "DONE"), false);
  assert.equal(isTaskOverdue({ dueAt: new Date("2000-01-01"), status: "DONE" }), false);
  assert.equal(isTaskOverdue({ dueAt: new Date("2000-01-01"), status: "CANCELLED" }), false);
  const now = new Date("2026-09-10T00:00:00.000Z");
  assert.equal(isTaskOverdue({ dueAt: now, status: "OPEN", now }), false);
  assert.equal(isTaskOverdue({ dueAt: new Date(now.getTime() - 1), status: "OPEN", now }), true);
  assert.equal(isTaskOverdue({ dueAt: new Date(now.getTime() - 1), status: "IN_PROGRESS", now }), true);
});

test("task audit metadata excludes description; reassignment snapshots trusted name", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seed(db);
  const tasks = new DrugInvestigationTaskService(db);
  const created = await tasks.createForCase(
    caseId,
    { title: "secret-title", description: "sensitive-task-description", assignedActorId: "mock:admin" },
    ADMIN
  );
  assert.equal(created.assignedActorId, "mock:admin");
  const updated = await tasks.update(created.id, { assignedActorId: "mock:bpp414" }, ADMIN);
  assert.equal(updated.assignedActorId, "mock:bpp414");
  const audits = await db.drugAuditLog.findMany();
  const actions = audits.map((row) => row.action);
  assert.ok(actions.includes("investigation_task_created"), String(actions));
  assert.ok(actions.includes("investigation_task_assigned"), String(actions));
  assert.ok(actions.includes("investigation_task_reassigned"), String(actions));
  const blob = JSON.stringify(audits);
  assert.equal(blob.includes("sensitive-task-description"), false);
  const reassigned = audits.find((row) => row.action === "investigation_task_reassigned");
  assert.ok(reassigned);
  const detail = String(reassigned.detail ?? "");
  assert.match(detail, /fromAssigneeActorId":"mock:admin"/);
  assert.match(detail, /toAssigneeActorId":"mock:bpp414"/);
  assert.equal(detail.includes("mock:admin") && detail.includes("mock:bpp414"), true);
});

test("note adversarial bodies are stored as plain text; completedAt follows status", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seed(db);
  const notes = new DrugAnalystNoteService(db);
  const tasks = new DrugInvestigationTaskService(db);
  await assert.rejects(() => notes.createForCase(caseId, { body: "\n\n" }, ADMIN), CollaborationValidationError);
  const thai = await notes.createForCase(caseId, { body: "บันทึก ทดสอบ 🙂 <script>alert(1)</script>" }, ADMIN);
  assert.equal(thai.body, "บันทึก ทดสอบ 🙂 <script>alert(1)</script>");
  assert.equal(thai.kind, "ANALYST_NOTE");

  const open = await tasks.createForCase(caseId, { title: "complete-me" }, ADMIN);
  assert.equal(open.completedAt, null);
  const done = await tasks.update(open.id, { status: "DONE", title: "still-done" }, ADMIN);
  assert.ok(done.completedAt);
  assert.equal(done.title, "still-done");
  const stillDone = await tasks.update(open.id, { dueAt: new Date("2026-12-01T00:00:00.000Z") }, ADMIN);
  assert.equal(stillDone.status, "DONE");
  assert.equal(stillDone.completedAt, done.completedAt);
  await assert.rejects(() => tasks.update(open.id, { status: "CANCELLED" }, ADMIN), CollaborationInvalidTransitionError);
  await assert.rejects(() => tasks.update(open.id, { status: "OPEN" }, ADMIN), CollaborationInvalidTransitionError);
});

test("note and task list pagination is bounded and query count does not grow with N", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seed(db);
  const notes = new DrugAnalystNoteService(db);
  const zero = await notes.listForCase(caseId, { page: 1, pageSize: 20 });
  assert.equal(zero.meta.total, 0);
  assert.equal(zero.items.length, 0);
  assert.equal(zero.meta.pageSize, 20);
  assert.equal(zero.meta.totalPages, 1);

  const checkpoints = new Set([1, 20, 21, 50, 51, 100]);
  for (let i = 0; i < 100; i += 1) {
    await notes.createForCase(caseId, { body: `note-${String(i).padStart(3, "0")}` }, ADMIN);
    const total = i + 1;
    if (checkpoints.has(total)) {
      const listed = await notes.listForCase(caseId);
      assert.equal(listed.meta.pageSize, 20);
      assert.equal(listed.meta.total, total);
      assert.equal(listed.items.length, Math.min(20, total));
      assert.equal(listed.meta.totalPages, Math.max(1, Math.ceil(total / 20)));
    }
  }
  const empty = await notes.listForCase(caseId, { page: 1, pageSize: 20 });
  assert.equal(empty.meta.total, 100);
  assert.equal(empty.items.length, 20);
  assert.equal(empty.meta.totalPages, 5);
  const ordered = [...empty.items].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
  assert.deepEqual(
    empty.items.map((row) => row.id),
    ordered.map((row) => row.id)
  );
  const page3 = await notes.listForCase(caseId, { page: 3, pageSize: 20 });
  assert.equal(page3.items.length, 20);
  const maxPage = await notes.listForCase(caseId, { page: 1, pageSize: 50 });
  assert.equal(maxPage.items.length, 50);
  const clamped = await notes.listForCase(caseId, { page: 1, pageSize: 51 });
  assert.equal(clamped.meta.pageSize, 50);
  const last = await notes.listForCase(caseId, { page: 5, pageSize: 21 });
  assert.ok(last.items.length <= 21);

  const counted = countingDb(db, ["drugAnalystNote"]);
  const countedService = new DrugAnalystNoteService(counted.db);
  await countedService.listForCase(caseId, { page: 1, pageSize: 20 });
  assert.equal(counted.queries(), 2);

  const tasks = new DrugInvestigationTaskService(db);
  for (let i = 0; i < 21; i += 1) {
    await tasks.createForCase(caseId, { title: `task-${String(i).padStart(3, "0")}` }, ADMIN);
  }
  const taskPage = await tasks.listForCase(caseId);
  assert.equal(taskPage.meta.total, 21);
  assert.equal(taskPage.items.length, 20);
  assert.equal(taskPage.meta.pageSize, 20);
  assert.equal(taskPage.meta.totalPages, 2);
});

test("collaboration writes do not mutate factual case/person/graph rows", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId, personIds } = await seed(db);
  const before = {
    cases: await db.drugCase.findMany(),
    persons: await db.drugPerson.findMany(),
    links: await db.drugCasePerson.findMany(),
    seized: await db.drugSeizedItem.findMany(),
    locations: await db.drugCaseLocation.findMany(),
    phones: await db.drugCasePhone.findMany(),
    devices: await db.drugCaseDevice.findMany(),
    vehicles: await db.drugCaseVehicle.findMany(),
  };
  const notes = new DrugAnalystNoteService(db);
  const tasks = new DrugInvestigationTaskService(db);
  await notes.createForCase(caseId, { body: "overlay" }, ADMIN);
  await tasks.createForPerson(personIds[0]!, { title: "follow" }, ADMIN);
  const after = {
    cases: await db.drugCase.findMany(),
    persons: await db.drugPerson.findMany(),
    links: await db.drugCasePerson.findMany(),
    seized: await db.drugSeizedItem.findMany(),
    locations: await db.drugCaseLocation.findMany(),
    phones: await db.drugCasePhone.findMany(),
    devices: await db.drugCaseDevice.findMany(),
    vehicles: await db.drugCaseVehicle.findMany(),
  };
  assert.equal(JSON.stringify(after.cases), JSON.stringify(before.cases));
  assert.equal(JSON.stringify(after.persons), JSON.stringify(before.persons));
  assert.equal(JSON.stringify(after.links), JSON.stringify(before.links));
  assert.equal(JSON.stringify(after.seized), JSON.stringify(before.seized));
  assert.equal(JSON.stringify(after.locations), JSON.stringify(before.locations));
  assert.equal(JSON.stringify(after.phones), JSON.stringify(before.phones));
  assert.equal(JSON.stringify(after.devices), JSON.stringify(before.devices));
  assert.equal(JSON.stringify(after.vehicles), JSON.stringify(before.vehicles));
});

test("audit failure rolls back the note row", async () => {
  const db = new InMemoryDatabaseClient();
  const { caseId } = await seed(db);
  const logs = (db as unknown as { drugAuditLogs: { create: (data: Record<string, unknown>) => unknown } }).drugAuditLogs;
  const original = logs.create.bind(logs);
  logs.create = () => {
    throw new Error("audit fail");
  };
  const notes = new DrugAnalystNoteService(db);
  await assert.rejects(() => notes.createForCase(caseId, { body: "will-roll-back" }, ADMIN));
  logs.create = original;
  const remaining = await db.drugAnalystNote.findMany({ where: { caseId } });
  assert.equal(remaining.length, 0);
});

test("source isolation: collaboration is not wired into search/network/map/export/telegram UI", () => {
  const files = [
    "lib/drug_intelligence/drug_intelligence_search_service.ts",
    "lib/drug_intelligence/drug_network_graph_service.ts",
    "lib/drug_intelligence/drug_map_query.ts",
    "lib/drug_intelligence/drug_export_service.ts",
    "lib/personnel_search_telegram/drug_search_command.ts",
    "app/drug-intelligence/cases/[id]/page.tsx",
    "app/drug-intelligence/persons/[id]/page.tsx",
    "components/layout/app_shell.tsx",
  ];
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(src, /DrugAnalystNoteService|DrugInvestigationTaskService|analystNoteService|investigationTaskService/);
  }
  const noteRoute = readFileSync(join(ROOT, "app/api/drug-intelligence/notes/[noteId]/route.ts"), "utf8");
  const taskRoute = readFileSync(join(ROOT, "app/api/drug-intelligence/tasks/[taskId]/route.ts"), "utf8");
  assert.doesNotMatch(noteRoute, /export async function DELETE/);
  assert.doesNotMatch(taskRoute, /export async function DELETE/);
});
