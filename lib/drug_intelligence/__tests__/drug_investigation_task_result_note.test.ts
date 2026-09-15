/**
 * DI-11E.3 — Task -> Analyst Note sourceTaskId foundation (service + schema).
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
import {
  CollaborationNotFoundError,
  CollaborationPersonMergedError,
  CollaborationValidationError,
  type CollaborationActor,
} from "@/lib/drug_intelligence/drug_collaboration_types";
import {
  RELATED_TASK_NOTES_BATCH_MAX_IDS,
  RELATED_TASK_NOTES_BATCH_MAX_ITEMS,
  RELATED_TASK_NOTES_BATCH_RAW_MAX,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());
const ADMIN: CollaborationActor = { actorId: "mock:admin", actorName: "Administrator" };
const MIGRATION = "prisma/migrations/20260915000000_drug_analyst_note_source_task/migration.sql";
const SCHEMA = "prisma/schema.prisma";
const NOTE_BODY = "secret-result-body-must-never-audit <script>alert(1)</script>";
const TASK_DESCRIPTION = "secret-task-description-must-never-audit";
const TASK_TITLE = "ตรวจสอบรถ TEST-9009";

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
            if (
              (method === "findMany" ||
                method === "count" ||
                method === "findUnique" ||
                method === "groupBy") &&
              typeof fn === "function"
            ) {
              return (args?: unknown) => {
                n += 1;
                return fn.apply(delegate, [args]);
              };
            }
            return fn;
          },
        });
      }
      return value;
    },
  });
  return { db: proxied as DatabaseClient, queries: () => n };
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "COL-11E3-001",
    title: "task-to-note fixture",
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
    narrative: "factual-narrative",
    persons: [],
    seizedItems: [],
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

async function seedTwoCases() {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const first = await cases.createCase(baseCase({ persons: [person("สมชาย เอ"), person("วิไล เอฟ")] }));
  const second = await cases.createCase(baseCase({ caseNumber: "COL-11E3-002", title: "other-case" }));
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

test("schema and migration add nullable Restrict sourceTaskId without unique or rewrite", () => {
  const schema = readFileSync(join(ROOT, SCHEMA), "utf8");
  const migration = readFileSync(join(ROOT, MIGRATION), "utf8");
  assert.match(schema, /sourceTaskId String\?/);
  assert.match(
    schema,
    /sourceTask\s+DrugInvestigationTask\? @relation\("TaskResultNotes", fields: \[sourceTaskId\], references: \[id\], onDelete: Restrict\)/
  );
  assert.match(schema, /resultNotes DrugAnalystNote\[] @relation\("TaskResultNotes"\)/);
  assert.match(schema, /@@index\(\[sourceTaskId, createdAt, id\]\)/);
  assert.match(schema, /sourceNoteId String\?/);
  assert.doesNotMatch(schema, /model DrugCollaborationLink|@@unique\(\[sourceTaskId/);
  assert.match(migration, /ADD COLUMN "sourceTaskId" TEXT/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /DrugAnalystNote_sourceTaskId_createdAt_id_idx/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|UPDATE "Drug|UNIQUE/);
  assert.doesNotMatch(migration, /CREATE TYPE|ALTER TYPE/);
});

test("batch limits match E.2 inverted safeguards", () => {
  assert.equal(RELATED_TASK_NOTES_BATCH_MAX_IDS, 20);
  assert.equal(RELATED_TASK_NOTES_BATCH_RAW_MAX, 50);
  assert.equal(RELATED_TASK_NOTES_BATCH_MAX_ITEMS, 400);
});

test("Case Task -> Case Note stores sourceTaskId and omits bodies from DTO kind and audit", async () => {
  const { db, caseX, notes, tasks } = await seedTwoCases();
  const original = await notes.createForCase(caseX, { body: "พบเบาะแสรถ TEST-9009" }, ADMIN);
  const task = await tasks.createForCase(
    caseX,
    { title: TASK_TITLE, description: TASK_DESCRIPTION, sourceNoteId: original.id },
    ADMIN
  );
  const beforeStatus = task.status;
  const beforeCompleted = task.completedAt;
  const result = await notes.createForCase(caseX, { body: NOTE_BODY, sourceTaskId: task.id }, ADMIN);
  assert.equal(result.kind, "ANALYST_NOTE");
  assert.equal(result.sourceTaskId, task.id);
  assert.equal(result.body, NOTE_BODY);
  assert.notEqual(result.body, TASK_TITLE);
  assert.notEqual(result.body, TASK_DESCRIPTION);
  assert.notEqual(result.body, original.body);
  const stored = await db.drugAnalystNote.findUnique({ where: { id: result.id } });
  assert.equal(stored?.sourceTaskId, task.id);
  const reloaded = await tasks.get(task.id);
  assert.equal(reloaded.status, beforeStatus);
  assert.equal(reloaded.completedAt, beforeCompleted);
  assert.equal(reloaded.sourceNoteId, original.id);
  const createdAudit = (await db.drugAuditLog.findMany({ where: { entityId: result.id } })).find(
    (row) => row.action === "analyst_note_created"
  );
  assert.ok(createdAudit);
  const detail = String(createdAudit.detail ?? "");
  assert.match(detail, new RegExp(`"sourceTaskId":"${task.id}"`));
  assert.equal(detail.includes(NOTE_BODY), false);
  assert.equal(detail.includes(TASK_DESCRIPTION), false);
  assert.equal(detail.includes(TASK_TITLE), false);
});

test("Person Task -> Person Note succeeds on the same ACTIVE person", async () => {
  const { personA, notes, tasks } = await seedTwoCases();
  const task = await tasks.createForPerson(personA, { title: "ตรวจเอกสาร" }, ADMIN);
  const note = await notes.createForPerson(personA, { body: NOTE_BODY, sourceTaskId: task.id }, ADMIN);
  assert.equal(note.targetKind, "PERSON");
  assert.equal(note.targetId, personA);
  assert.equal(note.sourceTaskId, task.id);
  assert.equal(note.kind, "ANALYST_NOTE");
});

test("one Task may source many follow-up Notes", async () => {
  const { caseX, notes, tasks } = await seedTwoCases();
  const task = await tasks.createForCase(caseX, { title: TASK_TITLE }, ADMIN);
  const first = await notes.createForCase(caseX, { body: "ผลครั้งแรก", sourceTaskId: task.id }, ADMIN);
  const second = await notes.createForCase(caseX, { body: "ผลครั้งที่สอง", sourceTaskId: task.id }, ADMIN);
  assert.equal(first.sourceTaskId, task.id);
  assert.equal(second.sourceTaskId, task.id);
  const listed = await notes.listForTargetSourceTask("CASE", caseX, task.id);
  assert.equal(listed.meta.total, 2);
  assert.equal(listed.items.length, 2);
  assert.ok(listed.items.every((row) => !("body" in row)));
});

test("OPEN, IN_PROGRESS, and DONE Tasks can create a result Note; CANCELLED cannot", async () => {
  const { db, caseX, notes, tasks } = await seedTwoCases();
  const open = await tasks.createForCase(caseX, { title: "open" }, ADMIN);
  const inProgress = await tasks.createForCase(caseX, { title: "progress" }, ADMIN);
  await tasks.update(inProgress.id, { status: "IN_PROGRESS" }, ADMIN);
  const done = await tasks.createForCase(caseX, { title: "done" }, ADMIN);
  await tasks.update(done.id, { status: "DONE" }, ADMIN);
  const cancelled = await tasks.createForCase(caseX, { title: "cancelled" }, ADMIN);
  await tasks.update(cancelled.id, { status: "CANCELLED" }, ADMIN);

  const fromOpen = await notes.createForCase(caseX, { body: "from-open", sourceTaskId: open.id }, ADMIN);
  const fromProgress = await notes.createForCase(caseX, { body: "from-progress", sourceTaskId: inProgress.id }, ADMIN);
  const fromDone = await notes.createForCase(caseX, { body: "from-done", sourceTaskId: done.id }, ADMIN);
  assert.equal(fromOpen.sourceTaskId, open.id);
  assert.equal(fromProgress.sourceTaskId, inProgress.id);
  assert.equal(fromDone.sourceTaskId, done.id);
  await assert.rejects(
    () => notes.createForCase(caseX, { body: "from-cancelled", sourceTaskId: cancelled.id }, ADMIN),
    CollaborationValidationError
  );
  assert.equal((await db.drugAnalystNote.findMany({ where: { sourceTaskId: cancelled.id } })).length, 0);
  assert.equal((await tasks.get(cancelled.id)).status, "CANCELLED");
});

test("creating a result Note does not mutate Task status or completedAt", async () => {
  const { caseX, notes, tasks } = await seedTwoCases();
  const task = await tasks.createForCase(caseX, { title: TASK_TITLE }, ADMIN);
  const started = await tasks.update(task.id, { status: "IN_PROGRESS" }, ADMIN);
  await notes.createForCase(caseX, { body: NOTE_BODY, sourceTaskId: started.id }, ADMIN);
  const after = await tasks.get(started.id);
  assert.equal(after.status, "IN_PROGRESS");
  assert.equal(after.completedAt, null);
});

test("Task DONE does not create a Note", async () => {
  const { db, caseX, notes, tasks } = await seedTwoCases();
  const before = await db.drugAnalystNote.count({ where: { caseId: caseX } });
  const task = await tasks.createForCase(caseX, { title: "complete-me" }, ADMIN);
  await tasks.update(task.id, { status: "DONE" }, ADMIN);
  assert.equal(await db.drugAnalystNote.count({ where: { caseId: caseX } }), before);
  const done = await tasks.get(task.id);
  assert.equal(done.status, "DONE");
  void notes;
});

test("ordinary Note without sourceTaskId still works; Note -> Task sourceNoteId is unchanged", async () => {
  const { caseX, notes, tasks } = await seedTwoCases();
  const note = await notes.createForCase(caseX, { body: "ordinary" }, ADMIN);
  assert.equal(note.sourceTaskId, null);
  const task = await tasks.createForCase(caseX, { title: "from-ordinary", sourceNoteId: note.id }, ADMIN);
  assert.equal(task.sourceNoteId, note.id);
  const chain = await notes.createForCase(caseX, { body: "result", sourceTaskId: task.id }, ADMIN);
  assert.equal(chain.sourceTaskId, task.id);
  assert.equal((await tasks.get(task.id)).sourceNoteId, note.id);
});

test("Original Note -> Task -> Result Note chain is structurally traceable and remains ANALYST_NOTE", async () => {
  const { caseX, notes, tasks } = await seedTwoCases();
  const noteA = await notes.createForCase(caseX, { body: "พบเบาะแสรถ TEST-9009" }, ADMIN);
  const taskB = await tasks.createForCase(caseX, { title: TASK_TITLE, sourceNoteId: noteA.id }, ADMIN);
  const noteC = await notes.createForCase(caseX, { body: "ผลการตรวจสอบ...", sourceTaskId: taskB.id }, ADMIN);
  assert.equal(noteA.kind, "ANALYST_NOTE");
  assert.equal(taskB.kind, "TASK");
  assert.equal(noteC.kind, "ANALYST_NOTE");
  assert.equal(taskB.sourceNoteId, noteA.id);
  assert.equal(noteC.sourceTaskId, taskB.id);
  assert.equal(noteA.sourceTaskId, null);
  assert.equal((await tasks.get(taskB.id)).status, "OPEN");
});

test("cross-target sourceTaskId is rejected and creates no Note", async () => {
  const { db, caseX, caseY, personA, personF, notes, tasks } = await seedTwoCases();
  const caseTask = await tasks.createForCase(caseX, { title: "case-x" }, ADMIN);
  const otherCaseTask = await tasks.createForCase(caseY, { title: "case-y" }, ADMIN);
  const personTask = await tasks.createForPerson(personA, { title: "person-a" }, ADMIN);
  const otherPersonTask = await tasks.createForPerson(personF, { title: "person-f" }, ADMIN);

  await assert.rejects(
    () => notes.createForCase(caseY, { body: "no", sourceTaskId: caseTask.id }, ADMIN),
    CollaborationValidationError
  );
  await assert.rejects(
    () => notes.createForPerson(personF, { body: "no", sourceTaskId: personTask.id }, ADMIN),
    CollaborationValidationError
  );
  await assert.rejects(
    () => notes.createForPerson(personA, { body: "no", sourceTaskId: caseTask.id }, ADMIN),
    CollaborationValidationError
  );
  await assert.rejects(
    () => notes.createForCase(caseX, { body: "no", sourceTaskId: personTask.id }, ADMIN),
    CollaborationValidationError
  );
  void otherCaseTask;
  void otherPersonTask;
  const leftover = await db.drugAnalystNote.findMany({ where: { sourceTaskId: { in: [caseTask.id, personTask.id] } } });
  assert.equal(leftover.length, 0);
});

test("missing sourceTaskId is not found and creates no Note", async () => {
  const { db, caseX, notes } = await seedTwoCases();
  const before = await db.drugAnalystNote.count({ where: { caseId: caseX } });
  await assert.rejects(
    () => notes.createForCase(caseX, { body: "no", sourceTaskId: "missing-task-id-0001" }, ADMIN),
    CollaborationNotFoundError
  );
  assert.equal(await db.drugAnalystNote.count({ where: { caseId: caseX } }), before);
});

test("MERGED Person create with sourceTaskId stays fail-closed and writes nothing", async () => {
  const { db, personA, personF, notes, tasks } = await seedTwoCases();
  const task = await tasks.createForPerson(personA, { title: "before-merge" }, ADMIN);
  await db.drugPerson.update({
    where: { id: personA },
    data: { status: "MERGED", mergedIntoPersonId: personF },
  });
  await assert.rejects(
    () => notes.createForPerson(personA, { body: "no", sourceTaskId: task.id }, ADMIN),
    (error: unknown) => {
      assert.ok(error instanceof CollaborationPersonMergedError);
      assert.equal(error.personId, personA);
      assert.equal(error.survivorPersonId, personF);
      return true;
    }
  );
  assert.equal((await db.drugAnalystNote.findMany({ where: { sourceTaskId: task.id } })).length, 0);
  assert.equal((await db.drugAnalystNote.findMany({ where: { personId: personF } })).length, 0);
});

test("PATCH cannot change sourceTaskId after create", async () => {
  const { caseX, notes, tasks } = await seedTwoCases();
  const task = await tasks.createForCase(caseX, { title: TASK_TITLE }, ADMIN);
  const other = await tasks.createForCase(caseX, { title: "other" }, ADMIN);
  const created = await notes.createForCase(caseX, { body: "result", sourceTaskId: task.id }, ADMIN);
  const updated = await notes.update(created.id, { body: "edited-result" }, ADMIN);
  assert.equal(updated.sourceTaskId, task.id);
  assert.notEqual(updated.sourceTaskId, other.id);
  const stored = await notes.get(created.id);
  assert.equal(stored.sourceTaskId, task.id);
});

test("list provenance is one batched Task read without description, and batch is not N+1", async () => {
  const { db, caseX, notes, tasks } = await seedTwoCases();
  const taskIds: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const task = await tasks.createForCase(caseX, { title: `batch-${i}`, description: TASK_DESCRIPTION }, ADMIN);
    taskIds.push(task.id);
    await notes.createForCase(caseX, { body: `${NOTE_BODY}-${i}`, sourceTaskId: task.id }, ADMIN);
  }
  const countedList = countingDb(db, ["drugInvestigationTask"]);
  const listed = await new DrugAnalystNoteService(countedList.db).listForCase(caseX);
  assert.ok(listed.sourceTasks.some((row) => row.title.startsWith("batch-")));
  assert.equal(listed.sourceTasks.some((row) => "description" in row), false);
  assert.equal(JSON.stringify(listed.sourceTasks).includes(TASK_DESCRIPTION), false);
  assert.equal(countedList.queries(), 1);

  const countedBatch = countingDb(db, ["drugAnalystNote", "drugInvestigationTask"]);
  const batched = await new DrugAnalystNoteService(countedBatch.db).listForTargetSourceTasks("CASE", caseX, taskIds);
  assert.equal(batched.length, 8);
  assert.ok(batched.every((row) => row.items.length === 1));
  assert.ok(batched.every((row) => row.items.every((item) => !("body" in item))));
  assert.equal(JSON.stringify(batched).includes(NOTE_BODY), false);
  assert.ok(countedBatch.queries() <= 4);
  assert.ok(countedBatch.queries() < taskIds.length);
});
