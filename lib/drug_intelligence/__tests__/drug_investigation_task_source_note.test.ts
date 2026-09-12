/**
 * DI-11E.1 — Note -> Task sourceNoteId foundation (service + schema).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugAnalystNoteService } from "@/lib/drug_intelligence/drug_analyst_note_service";
import { DrugInvestigationTaskService } from "@/lib/drug_intelligence/drug_investigation_task_service";
import {
  CollaborationNotFoundError,
  CollaborationPersonMergedError,
  CollaborationValidationError,
  type CollaborationActor,
} from "@/lib/drug_intelligence/drug_collaboration_types";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());
const ADMIN: CollaborationActor = { actorId: "mock:admin", actorName: "Administrator" };
const MIGRATION = "prisma/migrations/20260913000000_drug_investigation_task_source_note/migration.sql";
const SCHEMA = "prisma/schema.prisma";
const NOTE_BODY = "secret-note-body-must-never-copy <script>alert(1)</script>";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "COL-11E1-001",
    title: "source-note fixture",
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
  const second = await cases.createCase(baseCase({ caseNumber: "COL-11E1-002", title: "other-case" }));
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

test("schema and migration add nullable Restrict sourceNoteId without unique or rewrite", () => {
  const schema = readFileSync(join(ROOT, SCHEMA), "utf8");
  const migration = readFileSync(join(ROOT, MIGRATION), "utf8");
  assert.match(schema, /sourceNoteId String\?/);
  assert.match(schema, /sourceNote\s+DrugAnalystNote\? @relation\(fields: \[sourceNoteId\], references: \[id\], onDelete: Restrict\)/);
  assert.match(schema, /@@index\(\[sourceNoteId, createdAt, id\]\)/);
  assert.doesNotMatch(schema, /sourceTaskId|CollaborationLink|@@unique\(\[sourceNoteId/);
  assert.match(migration, /ADD COLUMN "sourceNoteId" TEXT/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /DrugInvestigationTask_sourceNoteId_createdAt_id_idx/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|UPDATE "Drug|UNIQUE/);
  assert.doesNotMatch(migration, /CREATE TYPE|ALTER TYPE/);
});

test("Case Note -> Case Task stores sourceNoteId and omits body from DTO and audit", async () => {
  const { db, caseX, notes, tasks } = await seedTwoCases();
  const note = await notes.createForCase(caseX, { body: NOTE_BODY }, ADMIN);
  const beforeNotes = await db.drugAnalystNote.count({ where: { caseId: caseX } });
  const task = await tasks.createForCase(caseX, { title: "ติดตามจากบันทึก", sourceNoteId: note.id }, ADMIN);
  assert.equal(task.sourceNoteId, note.id);
  assert.equal(task.description, null);
  assert.notEqual(task.title, NOTE_BODY);
  assert.equal(JSON.stringify(task).includes(NOTE_BODY), false);
  const stored = await db.drugInvestigationTask.findUnique({ where: { id: task.id } });
  assert.equal(stored?.sourceNoteId, note.id);
  assert.equal(stored?.description ?? null, null);
  const createdAudit = (await db.drugAuditLog.findMany({ where: { entityId: task.id } })).find(
    (row) => row.action === "investigation_task_created"
  );
  assert.ok(createdAudit);
  const detail = String(createdAudit.detail ?? "");
  assert.match(detail, new RegExp(`"sourceNoteId":"${note.id}"`));
  assert.equal(detail.includes(NOTE_BODY), false);
  assert.equal(detail.includes("ติดตามจากบันทึก"), false);
  assert.equal(detail.includes("note_linked_to_task"), false);
  assert.equal(await db.drugAnalystNote.count({ where: { caseId: caseX } }), beforeNotes);
});

test("Person Note -> Person Task succeeds on the same ACTIVE person", async () => {
  const { personA, notes, tasks } = await seedTwoCases();
  const note = await notes.createForPerson(personA, { body: NOTE_BODY }, ADMIN);
  const task = await tasks.createForPerson(personA, { title: "ตรวจเอกสาร", sourceNoteId: note.id }, ADMIN);
  assert.equal(task.targetKind, "PERSON");
  assert.equal(task.targetId, personA);
  assert.equal(task.sourceNoteId, note.id);
});

test("create without sourceNoteId remains null and backward compatible", async () => {
  const { caseX, tasks } = await seedTwoCases();
  const task = await tasks.createForCase(caseX, { title: "งานปกติ" }, ADMIN);
  assert.equal(task.sourceNoteId, null);
  const edited = await tasks.update(task.id, { title: "งานปกติ แก้ไข" }, ADMIN);
  const started = await tasks.update(task.id, { status: "IN_PROGRESS" }, ADMIN);
  const done = await tasks.update(task.id, { status: "DONE" }, ADMIN);
  assert.equal(edited.title, "งานปกติ แก้ไข");
  assert.equal(started.status, "IN_PROGRESS");
  assert.equal(done.status, "DONE");
  assert.equal(done.sourceNoteId, null);

  const cancel = await tasks.createForCase(caseX, { title: "ยกเลิกได้" }, ADMIN);
  const cancelled = await tasks.update(cancel.id, { status: "CANCELLED" }, ADMIN);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.sourceNoteId, null);
});

test("cross-target sourceNoteId is rejected and creates no Task", async () => {
  const { db, caseX, caseY, personA, personF, notes, tasks } = await seedTwoCases();
  const caseNote = await notes.createForCase(caseX, { body: NOTE_BODY }, ADMIN);
  const otherCaseNote = await notes.createForCase(caseY, { body: NOTE_BODY }, ADMIN);
  const personNote = await notes.createForPerson(personA, { body: NOTE_BODY }, ADMIN);
  const otherPersonNote = await notes.createForPerson(personF, { body: NOTE_BODY }, ADMIN);

  await assert.rejects(
    () => tasks.createForCase(caseY, { title: "no", sourceNoteId: caseNote.id }, ADMIN),
    CollaborationValidationError
  );
  await assert.rejects(
    () => tasks.createForPerson(personF, { title: "no", sourceNoteId: personNote.id }, ADMIN),
    CollaborationValidationError
  );
  await assert.rejects(
    () => tasks.createForPerson(personA, { title: "no", sourceNoteId: caseNote.id }, ADMIN),
    CollaborationValidationError
  );
  await assert.rejects(
    () => tasks.createForCase(caseX, { title: "no", sourceNoteId: personNote.id }, ADMIN),
    CollaborationValidationError
  );
  void otherCaseNote;
  void otherPersonNote;
  const leftover = await db.drugInvestigationTask.findMany({});
  assert.equal(leftover.length, 0);
});

test("missing sourceNoteId is not found and creates no Task", async () => {
  const { db, caseX, tasks } = await seedTwoCases();
  await assert.rejects(
    () => tasks.createForCase(caseX, { title: "no", sourceNoteId: "missing-note-id-0001" }, ADMIN),
    CollaborationNotFoundError
  );
  assert.equal((await db.drugInvestigationTask.findMany({})).length, 0);
});

test("MERGED Person create with sourceNoteId stays 409 and writes nothing", async () => {
  const { db, personA, personF, notes, tasks } = await seedTwoCases();
  const note = await notes.createForPerson(personA, { body: NOTE_BODY }, ADMIN);
  await db.drugPerson.update({
    where: { id: personA },
    data: { status: "MERGED", mergedIntoPersonId: personF },
  });
  await assert.rejects(
    () => tasks.createForPerson(personA, { title: "no", sourceNoteId: note.id }, ADMIN),
    (error: unknown) => {
      assert.ok(error instanceof CollaborationPersonMergedError);
      assert.equal(error.personId, personA);
      assert.equal(error.survivorPersonId, personF);
      return true;
    }
  );
  assert.equal((await db.drugInvestigationTask.findMany({})).length, 0);
  const survivorTasks = await db.drugInvestigationTask.findMany({ where: { personId: personF } });
  assert.equal(survivorTasks.length, 0);
  const stillOnMerged = await db.drugAnalystNote.findUnique({ where: { id: note.id } });
  assert.equal(stillOnMerged?.personId, personA);
});

test("Note create does not create a Task; Task DONE/CANCELLED does not create a Note", async () => {
  const { db, caseX, notes, tasks } = await seedTwoCases();
  const noteCount = async () => db.drugAnalystNote.count({ where: { caseId: caseX } });
  const taskCount = async () => db.drugInvestigationTask.count({ where: { caseId: caseX } });
  await notes.createForCase(caseX, { body: NOTE_BODY }, ADMIN);
  assert.equal(await noteCount(), 1);
  assert.equal(await taskCount(), 0);

  const open = await tasks.createForCase(caseX, { title: "complete-me" }, ADMIN);
  const notesAfterCreate = await noteCount();
  await tasks.update(open.id, { status: "DONE" }, ADMIN);
  assert.equal(await noteCount(), notesAfterCreate);

  const cancel = await tasks.createForCase(caseX, { title: "cancel-me" }, ADMIN);
  await tasks.update(cancel.id, { status: "CANCELLED" }, ADMIN);
  assert.equal(await noteCount(), notesAfterCreate);
});

test("listBySourceNoteId is bounded, sorted, and does not fetch-all", async () => {
  const { caseX, notes, tasks } = await seedTwoCases();
  const note = await notes.createForCase(caseX, { body: NOTE_BODY }, ADMIN);
  const other = await notes.createForCase(caseX, { body: "other-note" }, ADMIN);
  for (let i = 0; i < 21; i += 1) {
    await tasks.createForCase(caseX, { title: `from-note-${String(i).padStart(2, "0")}`, sourceNoteId: note.id }, ADMIN);
  }
  await tasks.createForCase(caseX, { title: "from-other", sourceNoteId: other.id }, ADMIN);
  await tasks.createForCase(caseX, { title: "unlinked" }, ADMIN);

  const first = await tasks.listBySourceNoteId(note.id);
  assert.equal(first.meta.pageSize, 20);
  assert.equal(first.meta.total, 21);
  assert.equal(first.items.length, 20);
  assert.equal(first.meta.totalPages, 2);
  assert.ok(first.items.every((row) => row.sourceNoteId === note.id));
  const ordered = [...first.items].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
  assert.deepEqual(
    first.items.map((row) => row.id),
    ordered.map((row) => row.id)
  );

  const max = await tasks.listBySourceNoteId(note.id, { page: 1, pageSize: 50 });
  assert.equal(max.items.length, 21);
  const clamped = await tasks.listBySourceNoteId(note.id, { page: 1, pageSize: 51 });
  assert.equal(clamped.meta.pageSize, 50);
  await assert.rejects(() => tasks.listBySourceNoteId("missing-note-id-0001"), CollaborationNotFoundError);
});

test("E.1 does not add Note/Task UI or generic link surface", () => {
  const noteCard = readFileSync(join(ROOT, "components/drug_intelligence/drug_analyst_note_card.tsx"), "utf8");
  const taskCard = readFileSync(join(ROOT, "components/drug_intelligence/drug_investigation_task_card.tsx"), "utf8");
  const editor = readFileSync(join(ROOT, "components/drug_intelligence/drug_investigation_task_editor.tsx"), "utf8");
  for (const src of [noteCard, taskCard, editor]) {
    assert.doesNotMatch(src, /สร้างงานติดตาม|งานที่เกี่ยวข้อง|ที่มา: บันทึกนักวิเคราะห์|sourceNoteId/);
  }
  const schema = readFileSync(join(ROOT, SCHEMA), "utf8");
  assert.doesNotMatch(schema, /model DrugCollaborationLink|sourceTaskId/);
});
