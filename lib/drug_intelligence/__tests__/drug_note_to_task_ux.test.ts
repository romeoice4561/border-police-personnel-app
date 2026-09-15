/**
 * DI-11E.2 — Note -> Task UX (create-from-note, provenance, related tasks).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugAnalystNoteService } from "@/lib/drug_intelligence/drug_analyst_note_service";
import { DrugInvestigationTaskService } from "@/lib/drug_intelligence/drug_investigation_task_service";
import { translate } from "@/lib/i18n/dictionary";
import { DrugAnalystNoteCard } from "@/components/drug_intelligence/drug_analyst_note_card";
import { DrugInvestigationTaskCard } from "@/components/drug_intelligence/drug_investigation_task_card";
import { DrugInvestigationTaskEditor } from "@/components/drug_intelligence/drug_investigation_task_editor";
import {
  classifyInvestigationTasksError,
  draftToCreateFields,
  emptyInvestigationTaskDraft,
  RELATED_TASKS_CARD_PREVIEW,
} from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import { investigationTaskCreatePayload, investigationTaskPatchPayload } from "@/lib/drug_intelligence/drug_investigation_tasks_client";
import { ApiClientError } from "@/lib/ui/api_client";
import {
  CollaborationNotFoundError,
  CollaborationValidationError,
  type CollaborationActor,
  type AnalystNoteDto,
  type InvestigationTaskDto,
  type SourceNoteProvenanceDto,
} from "@/lib/drug_intelligence/drug_collaboration_types";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());
const SECRET = "SECRET-NOTE-BODY-XYZ";
const ADMIN: CollaborationActor = { actorId: "mock:admin", actorName: "Administrator" };

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
    caseNumber: "COL-11E2-001",
    title: "note-to-task",
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
    ...overrides,
  };
}

function person(name: string): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
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

async function seedTargets() {
  const db = new InMemoryDatabaseClient();
  const first = await new DrugCaseService({ db }).createCase({
    ...baseCase(),
    persons: [person("สมชาย เอ"), person("วิไล เอฟ")],
  });
  const second = await new DrugCaseService({ db }).createCase(baseCase({ caseNumber: "COL-11E2-002", title: "other" }));
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

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function sampleNote(overrides: Partial<AnalystNoteDto> = {}): AnalystNoteDto {
  return {
    kind: "ANALYST_NOTE",
    id: "note-e2-1",
    body: SECRET,
    targetKind: "CASE",
    targetId: "case-1",
    authorActorId: "mock:admin",
    authorName: "Administrator",
    createdAt: "2026-09-11T03:00:00.000Z",
    updatedAt: "2026-09-11T03:00:00.000Z",
    updatedByActorId: null,
    updatedByName: null,
    sourceTaskId: null,
    ...overrides,
  };
}

function sampleTask(overrides: Partial<InvestigationTaskDto> = {}): InvestigationTaskDto {
  return {
    kind: "TASK",
    id: "task-e2-1",
    title: "ติดตามพยาน",
    description: null,
    targetKind: "CASE",
    targetId: "case-1",
    assignedActorId: null,
    assignedActorName: null,
    dueAt: null,
    priority: "NORMAL",
    status: "OPEN",
    createdByActorId: "mock:admin",
    createdByName: "Administrator",
    createdAt: "2026-09-11T03:00:00.000Z",
    updatedAt: "2026-09-11T03:00:00.000Z",
    updatedByActorId: null,
    updatedByName: null,
    completedAt: null,
    isOverdue: false,
    sourceNoteId: null,
    ...overrides,
  };
}

test("Thai copy uses สร้างงานติดตาม, ที่มา, and งานที่เกี่ยวข้อง", () => {
  assert.equal(translate("di.collaboration.createFollowUpTask", "th"), "สร้างงานติดตาม");
  assert.equal(translate("di.collaboration.sourceNoteProvenance", "th"), "ที่มา: บันทึกนักวิเคราะห์");
  assert.equal(translate("di.collaboration.relatedTasks", "th"), "งานที่เกี่ยวข้อง");
});

test("Admin Note card shows create-from-note; commander card does not", () => {
  const admin = renderToStaticMarkup(
    createElement(DrugAnalystNoteCard, { note: sampleNote(), canEdit: true, onCreateTask: () => undefined })
  );
  assert.match(admin, /สร้างงานติดตาม/);
  assert.match(admin, /data-testid="analyst-note-create-task"/);
  assert.doesNotMatch(admin, /ยืนยันข้อเท็จจริง|ผลการสืบสวนสำเร็จ/);

  const commander = renderToStaticMarkup(createElement(DrugAnalystNoteCard, { note: sampleNote(), canEdit: false }));
  assert.doesNotMatch(commander, /สร้างงานติดตาม/);
  assert.doesNotMatch(commander, /data-testid="analyst-note-create-task"/);
});

test("create-from-note draft stays blank and payload sends sourceNoteId + confirmActorId without Note body", () => {
  const draft = emptyInvestigationTaskDraft();
  assert.equal(draft.title, "");
  assert.equal(draft.description, "");
  assert.equal(draft.title.includes(SECRET), false);
  const fields = draftToCreateFields({ ...draft, title: "งานจากบันทึก" }, "note-e2-1");
  assert.ok(fields);
  assert.equal(fields?.sourceNoteId, "note-e2-1");
  assert.notEqual(fields?.title, SECRET);
  assert.equal(fields?.description, null);
  const payload = investigationTaskCreatePayload({ ...fields!, confirmActorId: "mock:admin" });
  assert.equal(payload.sourceNoteId, "note-e2-1");
  assert.equal(payload.confirmActorId, "mock:admin");
  assert.equal(JSON.stringify(payload).includes(SECRET), false);
  assert.equal("sourceNoteBody" in payload, false);
  assert.equal("actorName" in payload, false);
});

test("normal Task create still omits sourceNoteId", () => {
  const fields = draftToCreateFields({ ...emptyInvestigationTaskDraft(), title: "งานปกติ" });
  assert.ok(fields);
  assert.equal("sourceNoteId" in (fields ?? {}), false);
  const payload = investigationTaskCreatePayload({ ...fields!, confirmActorId: "mock:admin" });
  assert.equal("sourceNoteId" in payload, false);
});

test("Task editor from-note context shows provenance and does not include Note body", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DrugInvestigationTaskEditor, {
        mode: "create",
        draft: emptyInvestigationTaskDraft(),
        onChange: () => undefined,
        onSave: () => undefined,
        onCancel: () => undefined,
        pending: false,
        saveError: null,
        sourceNote: { authorName: "Administrator", createdAt: "2026-09-11T03:00:00.000Z" },
      })
    )
  );
  assert.match(html, /ที่มา: บันทึกนักวิเคราะห์/);
  assert.match(html, /ผู้บันทึก/);
  assert.match(html, /Administrator/);
  assert.doesNotMatch(html, /SECRET-NOTE-BODY-XYZ/);
  assert.doesNotMatch(html, /caseId|personId|target selector/i);
});

test("Task card provenance shows source line without Note body; unlinked Task has none", () => {
  const provenance: SourceNoteProvenanceDto = {
    id: "note-e2-1",
    authorName: "Administrator",
    createdAt: "2026-09-11T03:00:00.000Z",
  };
  const linked = renderToStaticMarkup(
    createElement(DrugInvestigationTaskCard, {
      task: sampleTask({ sourceNoteId: "note-e2-1" }),
      sourceNote: provenance,
    })
  );
  assert.match(linked, /ที่มา: บันทึกนักวิเคราะห์/);
  assert.match(linked, /Administrator/);
  assert.doesNotMatch(linked, /SECRET-NOTE-BODY-XYZ/);
  assert.doesNotMatch(linked, /FACT|หลักฐาน|ข้อมูลยืนยัน/);

  const plain = renderToStaticMarkup(createElement(DrugInvestigationTaskCard, { task: sampleTask() }));
  assert.doesNotMatch(plain, /ที่มา: บันทึกนักวิเคราะห์/);
});

test("related Tasks on a Note are compact and omit description by default", () => {
  const html = renderToStaticMarkup(
    createElement(DrugAnalystNoteCard, {
      note: sampleNote(),
      canEdit: false,
      relatedTasks: [
        sampleTask({ id: "t1", title: "งานหนึ่ง", description: "HIDDEN-DESCRIPTION" }),
        sampleTask({ id: "t2", title: "งานสอง" }),
      ],
      relatedMeta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    })
  );
  assert.match(html, /งานที่เกี่ยวข้อง/);
  assert.match(html, /งานหนึ่ง/);
  assert.doesNotMatch(html, /HIDDEN-DESCRIPTION/);
});

test("Note card create action is a labeled button; no schema/migration in E.2 UI", () => {
  const card = read("components/drug_intelligence/drug_analyst_note_card.tsx");
  assert.match(card, /type="button"/);
  assert.match(card, /di\.collaboration\.createFollowUpTask/);
  assert.doesNotMatch(card, /dangerouslySetInnerHTML/);
  const panel = read("components/drug_intelligence/drug_analyst_notes_panel.tsx");
  assert.match(panel, /DrugInvestigationTaskEditor/);
  assert.match(panel, /creatingFromNote\.id/);
  assert.match(panel, /useCreateInvestigationTask/);
  assert.match(panel, /useRelatedNoteTasksBatch/);
  assert.doesNotMatch(panel, /prisma|migrate/);
});

test("N+1 strategy: one batch related-tasks query, not one request per Note or Task card", () => {
  const panel = read("components/drug_intelligence/drug_analyst_notes_panel.tsx");
  assert.match(panel, /useRelatedNoteTasksBatch\(targetKind, targetId, relatedNoteIds\)/);
  assert.doesNotMatch(panel, /listCaseNoteTasks|listPersonNoteTasks/);
  const hooks = read("lib/drug_intelligence/drug_investigation_tasks_hooks.ts");
  assert.match(hooks, /listRelatedNoteTasksBatch/);
  assert.match(hooks, /relatedNoteTasksQueryKey/);
  const service = read("lib/drug_intelligence/drug_investigation_task_service.ts");
  assert.match(service, /loadSourceNoteProvenance/);
  assert.match(service, /id: \{ in: unique \}/);
});

test("Task PATCH payload cannot include sourceNoteId; editor has no unlink control", () => {
  const payload = investigationTaskPatchPayload({ title: "ชื่อใหม่" }, "mock:admin");
  assert.equal("sourceNoteId" in payload, false);
  const editor = read("components/drug_intelligence/drug_investigation_task_editor.tsx");
  assert.doesNotMatch(editor, /sourceNoteId|ยกเลิกที่มา|เปลี่ยนบันทึก/);
  const view = read("lib/drug_intelligence/drug_investigation_tasks_view.ts");
  assert.doesNotMatch(view, /patch\.sourceNoteId|sourceNoteId:/);
});

test("related-task routes stay target-scoped and do not add a global sourceNote filter", () => {
  const caseRoute = read("app/api/drug-intelligence/cases/[id]/notes/[noteId]/tasks/route.ts");
  const personRoute = read("app/api/drug-intelligence/persons/[id]/notes/[noteId]/tasks/route.ts");
  assert.match(caseRoute, /handleCaseNoteRelatedTasksList/);
  assert.match(personRoute, /handlePersonNoteRelatedTasksList/);
  const listSchema = read("lib/drug_intelligence/drug_collaboration_api_schemas.ts");
  assert.doesNotMatch(listSchema, /investigationTaskListQuerySchema[\s\S]*sourceNoteId/);
  const tasksList = read("app/api/drug-intelligence/cases/[id]/tasks/route.ts");
  assert.doesNotMatch(tasksList, /sourceNoteId/);
});

test("E.2 does not add Search/Network/Map/Timeline/Export/Telegram/AI wiring", () => {
  const files = [
    "components/drug_intelligence/drug_analyst_notes_panel.tsx",
    "components/drug_intelligence/drug_analyst_note_card.tsx",
    "lib/drug_intelligence/drug_investigation_tasks_hooks.ts",
  ];
  for (const file of files) {
    const src = read(file);
    assert.doesNotMatch(src, /DrugCollaborationLink|activity stream|เฉพาะหน่วยของคุณ/);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
  }
  const isolated = [
    "lib/drug_intelligence/drug_intelligence_search_service.ts",
    "lib/drug_intelligence/drug_network_graph_service.ts",
    "lib/drug_intelligence/drug_map_query.ts",
    "lib/drug_intelligence/drug_export_service.ts",
    "app/drug-intelligence/command/page.tsx",
  ];
  for (const file of isolated) {
    const src = read(file);
    assert.doesNotMatch(src, /createFollowUpTask|related-note-tasks|useRelatedNoteTasksBatch/);
  }
  void RELATED_TASKS_CARD_PREVIEW;
});

test("create-from-note UI keeps draft + sourceNoteId on actor mismatch and merged Person", () => {
  const panel = read("components/drug_intelligence/drug_analyst_notes_panel.tsx");
  assert.match(panel, /creatingFromNote\.id/);
  assert.match(panel, /classifyInvestigationTasksError\(error, "save"\)/);
  assert.match(panel, /setTaskSurvivorPersonId/);
  assert.doesNotMatch(panel, /mutateAsync\(fields\)[\s\S]{0,80}mutateAsync/);
  assert.doesNotMatch(panel, /survivorPersonId[\s\S]{0,120}createPersonTask|createCaseTask/);
  const mismatch = classifyInvestigationTasksError(
    new ApiClientError("Bound actor does not match confirmActorId", 409, "CONFLICT"),
    "save"
  );
  assert.equal(mismatch.kind, "mismatch");
  const merged = classifyInvestigationTasksError(
    new ApiClientError("merged", 409, "CONFLICT", { personId: "p1", survivorPersonId: "p2" }),
    "save"
  );
  assert.equal(merged.kind, "merged");
  assert.equal(merged.kind === "merged" ? merged.survivorPersonId : null, "p2");
});

test("related Tasks stay target-scoped; provenance is one batched Note read without body", async () => {
  const { db, caseX, caseY, personA, personF, notes, tasks } = await seedTargets();
  const caseNote = await notes.createForCase(caseX, { body: SECRET }, ADMIN);
  const caseYNote = await notes.createForCase(caseY, { body: SECRET }, ADMIN);
  const personNote = await notes.createForPerson(personA, { body: SECRET }, ADMIN);
  const personFNote = await notes.createForPerson(personF, { body: SECRET }, ADMIN);
  await tasks.createForCase(caseX, { title: "from-x", sourceNoteId: caseNote.id }, ADMIN);
  await tasks.createForPerson(personA, { title: "from-a", sourceNoteId: personNote.id }, ADMIN);

  const same = await tasks.listForTargetSourceNote("CASE", caseX, caseNote.id);
  assert.equal(same.items.length, 1);
  assert.equal(same.items[0]?.sourceNoteId, caseNote.id);
  assert.equal(JSON.stringify(same).includes(SECRET), false);

  await assert.rejects(
    () => tasks.listForTargetSourceNote("CASE", caseX, caseYNote.id),
    CollaborationValidationError
  );
  await assert.rejects(
    () => tasks.listForTargetSourceNote("CASE", caseX, personNote.id),
    CollaborationValidationError
  );
  await assert.rejects(
    () => tasks.listForTargetSourceNote("PERSON", personA, personFNote.id),
    CollaborationValidationError
  );
  await assert.rejects(
    () => tasks.listForTargetSourceNote("CASE", caseX, "missing-note-id-0001"),
    CollaborationNotFoundError
  );

  const counted = countingDb(db, ["drugAnalystNote"]);
  const listed = await new DrugInvestigationTaskService(counted.db).listForCase(caseX);
  assert.ok(listed.sourceNotes.some((row) => row.id === caseNote.id));
  assert.equal(listed.sourceNotes.some((row) => "body" in row), false);
  assert.equal(JSON.stringify(listed.sourceNotes).includes(SECRET), false);
  assert.equal(counted.queries(), 1);
});

test("editing a Note does not mutate the linked Task; creating a Note does not create a Task", async () => {
  const { db, caseX, notes, tasks } = await seedTargets();
  const note = await notes.createForCase(caseX, { body: SECRET }, ADMIN);
  assert.equal((await db.drugInvestigationTask.count({ where: { caseId: caseX } })) as number, 0);
  const task = await tasks.createForCase(caseX, { title: "คงเดิม", description: "คำอธิบายเดิม", sourceNoteId: note.id }, ADMIN);
  await notes.update(note.id, { body: "edited-body-must-not-copy" }, ADMIN);
  const after = await tasks.get(task.id);
  assert.equal(after.sourceNoteId, note.id);
  assert.equal(after.title, "คงเดิม");
  assert.equal(after.description, "คำอธิบายเดิม");
  assert.notEqual(after.title, "edited-body-must-not-copy");
  assert.notEqual(after.description, "edited-body-must-not-copy");
});

test("same-target create-from-note is wired in the shared panel without a target selector", () => {
  const panel = read("components/drug_intelligence/drug_analyst_notes_panel.tsx");
  assert.match(panel, /useCreateInvestigationTask\(targetKind, targetId/);
  assert.match(panel, /data-testid="investigation-task-editor-from-note"/);
  assert.match(panel, /data-source-note-id=\{creatingFromNote\.id\}/);
  assert.match(panel, /emptyInvestigationTaskDraft\(\)/);
  assert.doesNotMatch(panel, /target selector|เลือกเป้าหมาย|caseId=|personId=/);
  const caseSrc = read("app/drug-intelligence/cases/[id]/page.tsx");
  const personSrc = read("app/drug-intelligence/persons/[id]/page.tsx");
  assert.match(caseSrc, /DrugAnalystNotesPanel key=\{caseId\}/);
  assert.match(personSrc, /DrugAnalystNotesPanel key=\{personId\}/);
  const editor = read("components/drug_intelligence/drug_investigation_task_editor.tsx");
  assert.doesNotMatch(editor, /targetKind|เลือกคดี|เลือกบุคคล/);
});

test("from-note cancel/success and Note A->B reset sourceNoteId; normal create stays unlinked", () => {
  const fromA = draftToCreateFields({ ...emptyInvestigationTaskDraft(), title: "จากเอ" }, "note-a");
  assert.equal(fromA?.sourceNoteId, "note-a");
  const fromB = draftToCreateFields({ ...emptyInvestigationTaskDraft(), title: "จากบี" }, "note-b");
  assert.equal(fromB?.sourceNoteId, "note-b");
  assert.notEqual(fromB?.sourceNoteId, fromA?.sourceNoteId);
  const afterClose = draftToCreateFields({ ...emptyInvestigationTaskDraft(), title: "งานปกติ" });
  assert.equal("sourceNoteId" in (afterClose ?? {}), false);
  const payload = investigationTaskCreatePayload({ ...afterClose!, confirmActorId: "mock:admin" });
  assert.equal("sourceNoteId" in payload, false);

  const notesPanel = read("components/drug_intelligence/drug_analyst_notes_panel.tsx");
  assert.match(notesPanel, /function closeTaskEditor/);
  assert.match(notesPanel, /setCreatingFromNote\(null\)/);
  assert.match(notesPanel, /setTaskDraft\(emptyInvestigationTaskDraft\(\)\)/);
  assert.match(notesPanel, /openCreateFromNote[\s\S]*setCreatingFromNote\(note\)/);
  assert.match(notesPanel, /openCreateFromNote[\s\S]*emptyInvestigationTaskDraft\(\)/);
  const tasksPanel = read("components/drug_intelligence/drug_investigation_tasks_panel.tsx");
  assert.match(tasksPanel, /draftToCreateFields\(draft\)/);
  assert.doesNotMatch(tasksPanel, /draftToCreateFields\(draft,\s/);
  assert.doesNotMatch(tasksPanel, /creatingFromNote/);
});

test("batch related-tasks uses a bounded query count independent of Note cardinality", async () => {
  const { db, caseX, notes, tasks } = await seedTargets();
  const noteIds: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const note = await notes.createForCase(caseX, { body: `${SECRET}-${i}` }, ADMIN);
    noteIds.push(note.id);
    await tasks.createForCase(caseX, { title: `batch-${i}`, sourceNoteId: note.id }, ADMIN);
  }
  const counted = countingDb(db, ["drugAnalystNote", "drugInvestigationTask"]);
  const listed = await new DrugInvestigationTaskService(counted.db).listForTargetSourceNotes("CASE", caseX, noteIds);
  assert.equal(listed.length, 8);
  assert.ok(listed.every((row) => row.items.length === 1));
  assert.ok(counted.queries() <= 4);
  assert.ok(counted.queries() < noteIds.length);
});
