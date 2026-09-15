/**
 * DI-11E.3 — Task -> Analyst Note UX (create-from-task, provenance, related results).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { translate } from "@/lib/i18n/dictionary";
import { DrugAnalystNoteCard } from "@/components/drug_intelligence/drug_analyst_note_card";
import { DrugAnalystNoteEditor } from "@/components/drug_intelligence/drug_analyst_note_editor";
import { DrugInvestigationTaskCard } from "@/components/drug_intelligence/drug_investigation_task_card";
import { DrugInvestigationTaskResultNotes } from "@/components/drug_intelligence/drug_investigation_task_result_notes";
import { canCreateResultNoteFromTask, RELATED_RESULT_NOTES_CARD_PREVIEW } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import {
  appendResultNotePage,
  displayedResultNotes,
  mergeResultNotePreviewWithPage,
  nextResultNotesExpandAction,
  resultNotesExpansionContextKey,
  shouldResetResultNotesExpansion,
} from "@/lib/drug_intelligence/drug_task_result_notes_view";
import { analystNoteCreatePayload, analystNotePatchPayload } from "@/lib/drug_intelligence/drug_analyst_notes_client";
import type {
  AnalystNoteDto,
  InvestigationTaskDto,
  ResultNoteSummaryDto,
  SourceTaskProvenanceDto,
} from "@/lib/drug_intelligence/drug_collaboration_types";

const ROOT = join(process.cwd());
const SECRET_NOTE = "SECRET-SOURCE-NOTE-BODY";
const SECRET_TASK_DESC = "SECRET-TASK-DESCRIPTION";
const TASK_TITLE = "ตรวจสอบผู้ครอบครองรถ TEST-9009";
const RESULT_BODY = "SECRET-RESULT-NOTE-BODY";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function sampleNote(overrides: Partial<AnalystNoteDto> = {}): AnalystNoteDto {
  return {
    kind: "ANALYST_NOTE",
    id: "note-e3-1",
    body: SECRET_NOTE,
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
    id: "task-e3-1",
    title: TASK_TITLE,
    description: SECRET_TASK_DESC,
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

function sampleSummary(overrides: Partial<ResultNoteSummaryDto> = {}): ResultNoteSummaryDto {
  return {
    id: "note-result-1",
    authorName: "Administrator",
    createdAt: "2026-09-11T04:00:00.000Z",
    ...overrides,
  };
}

function summaries(count: number, prefix = "note-result"): ResultNoteSummaryDto[] {
  return Array.from({ length: count }, (_, i) =>
    sampleSummary({ id: `${prefix}-${i}`, authorName: `Officer ${i}` })
  );
}

test("Thai copy uses บันทึกผลการติดตาม and ที่มา: งานติดตาม", () => {
  assert.equal(translate("di.collaboration.createResultNote", "th"), "บันทึกผลการติดตาม");
  assert.equal(translate("di.collaboration.sourceTaskProvenance", "th"), "ที่มา: งานติดตาม");
  assert.equal(translate("di.collaboration.relatedResultNotes", "th"), "ผลการติดตามที่บันทึกไว้");
  assert.doesNotMatch(translate("di.collaboration.createResultNote", "th"), /ยืนยันข้อมูล/);
});

test("OPEN / IN_PROGRESS / DONE may create a result Note; CANCELLED may not", () => {
  assert.equal(canCreateResultNoteFromTask("OPEN"), true);
  assert.equal(canCreateResultNoteFromTask("IN_PROGRESS"), true);
  assert.equal(canCreateResultNoteFromTask("DONE"), true);
  assert.equal(canCreateResultNoteFromTask("CANCELLED"), false);
});

test("Admin Task card shows result-note action for OPEN and hides it for CANCELLED and commander", () => {
  const open = renderToStaticMarkup(
    createElement(DrugInvestigationTaskCard, {
      task: sampleTask(),
      canEdit: true,
      onCreateResultNote: () => undefined,
    })
  );
  assert.match(open, /บันทึกผลการติดตาม/);
  assert.match(open, /data-testid="investigation-task-create-result-note"/);
  assert.doesNotMatch(open, /ยืนยันข้อมูล/);

  const cancelled = renderToStaticMarkup(
    createElement(DrugInvestigationTaskCard, {
      task: sampleTask({ status: "CANCELLED" }),
      canEdit: true,
      onCreateResultNote: () => undefined,
    })
  );
  assert.doesNotMatch(cancelled, /บันทึกผลการติดตาม/);
  assert.doesNotMatch(cancelled, /data-testid="investigation-task-create-result-note"/);

  const commander = renderToStaticMarkup(createElement(DrugInvestigationTaskCard, { task: sampleTask(), canEdit: false }));
  assert.doesNotMatch(commander, /บันทึกผลการติดตาม/);
});

test("Note editor from-task context shows task title but body starts empty and copies nothing", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DrugAnalystNoteEditor, {
        mode: "create",
        value: "",
        onChange: () => undefined,
        onSave: () => undefined,
        onCancel: () => undefined,
        pending: false,
        saveError: null,
        sourceTask: { title: TASK_TITLE, createdAt: "2026-09-11T03:00:00.000Z" },
      })
    )
  );
  assert.match(html, /บันทึกผลจากงานติดตาม/);
  assert.match(html, /ตรวจสอบผู้ครอบครองรถ TEST-9009/);
  assert.match(html, /data-testid="analyst-note-source-task-context"/);
  assert.match(html, /<textarea[^>]*><\/textarea>|<textarea[^>]*>\s*<\/textarea>/);
  assert.doesNotMatch(html, /SECRET-TASK-DESCRIPTION/);
  assert.doesNotMatch(html, /SECRET-SOURCE-NOTE-BODY/);
  assert.doesNotMatch(html, /task-e3-1/);
});

test("create payload sends sourceTaskId + confirmActorId without Task title/description or Note body copy", () => {
  const payload = analystNoteCreatePayload({
    body: "ผลการตรวจสอบจากเจ้าหน้าที่",
    confirmActorId: "mock:admin",
    sourceTaskId: "task-e3-1",
  });
  assert.equal(payload.sourceTaskId, "task-e3-1");
  assert.equal(payload.confirmActorId, "mock:admin");
  assert.equal(payload.body, "ผลการตรวจสอบจากเจ้าหน้าที่");
  assert.notEqual(payload.body, TASK_TITLE);
  assert.notEqual(payload.body, SECRET_TASK_DESC);
  assert.notEqual(payload.body, SECRET_NOTE);
  assert.equal("actorName" in payload, false);
  const plain = analystNoteCreatePayload({ body: "บันทึกปกติ", confirmActorId: "mock:admin" });
  assert.equal("sourceTaskId" in plain, false);
});

test("PATCH payload cannot include sourceTaskId", () => {
  const payload = analystNotePatchPayload({ body: "แก้ไข", confirmActorId: "mock:admin" });
  assert.equal("sourceTaskId" in payload, false);
});

test("follow-up Note card provenance shows ที่มา: งานติดตาม and task title, not raw id or description", () => {
  const provenance: SourceTaskProvenanceDto = {
    id: "task-e3-1",
    title: TASK_TITLE,
    createdAt: "2026-09-11T03:00:00.000Z",
  };
  const html = renderToStaticMarkup(
    createElement(DrugAnalystNoteCard, {
      note: sampleNote({ body: RESULT_BODY, sourceTaskId: "task-e3-1" }),
      canEdit: false,
      sourceTask: provenance,
    })
  );
  assert.match(html, /ที่มา: งานติดตาม/);
  assert.match(html, /ตรวจสอบผู้ครอบครองรถ TEST-9009/);
  assert.match(html, /บันทึกนักวิเคราะห์/);
  assert.match(html, /ANALYST NOTE/);
  assert.doesNotMatch(html, /SECRET-TASK-DESCRIPTION/);
  assert.doesNotMatch(html, />task-e3-1</);
});

test("related result preview shows author/time, hides Note body, and previews max 5", () => {
  const items = summaries(6);
  const html = renderToStaticMarkup(
    createElement(DrugInvestigationTaskResultNotes, {
      items,
      meta: { page: 1, pageSize: 20, total: 6, totalPages: 1 },
      loading: false,
      error: false,
      onRetry: () => undefined,
    })
  );
  assert.match(html, /ผลการติดตามที่บันทึกไว้/);
  assert.match(html, /Officer 0/);
  assert.match(html, /ดูเพิ่มเติม/);
  assert.doesNotMatch(html, /SECRET-RESULT-NOTE-BODY/);
  assert.doesNotMatch(html, /Officer 5/);
  assert.equal(RELATED_RESULT_NOTES_CARD_PREVIEW, 5);
  void RESULT_BODY;
});

test("empty preview with positive total still offers expansion", () => {
  const html = renderToStaticMarkup(
    createElement(DrugInvestigationTaskResultNotes, {
      items: [],
      meta: { page: 1, pageSize: 20, total: 4, totalPages: 1 },
      loading: false,
      error: false,
      onRetry: () => undefined,
      targetKind: "CASE",
      targetId: "case-1",
      taskId: "task-b",
    })
  );
  assert.match(html, /ผลการติดตามที่บันทึกไว้/);
  assert.match(html, /ดูเพิ่มเติม/);
  assert.doesNotMatch(html, /data-testid="investigation-task-result-note"/);
});

test("zero total does not render the result-note section", () => {
  const html = renderToStaticMarkup(
    createElement(DrugInvestigationTaskResultNotes, {
      items: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      loading: false,
      error: false,
      onRetry: () => undefined,
      targetKind: "CASE",
      targetId: "case-1",
      taskId: "task-b",
    })
  );
  assert.equal(html, "");
});

test("empty preview with total 4 expands by requesting authoritative page 1", () => {
  const action = nextResultNotesExpandAction({
    previewItems: [],
    total: 4,
    expanded: false,
    authoritativePage: 0,
    authoritativeItems: null,
  });
  assert.deepEqual(action, { type: "fetch", page: 1 });
});

test("authoritative page 1 is never skipped for incomplete preview", () => {
  const starved = nextResultNotesExpandAction({
    previewItems: [],
    total: 4,
    expanded: false,
    authoritativePage: 0,
    authoritativeItems: null,
  });
  const partial = nextResultNotesExpandAction({
    previewItems: summaries(2),
    total: 8,
    expanded: false,
    authoritativePage: 0,
    authoritativeItems: null,
  });
  const batchLooksLikePage1 = nextResultNotesExpandAction({
    previewItems: summaries(20),
    total: 25,
    expanded: false,
    authoritativePage: 0,
    authoritativeItems: null,
  });
  assert.deepEqual(starved, { type: "fetch", page: 1 });
  assert.deepEqual(partial, { type: "fetch", page: 1 });
  assert.deepEqual(batchLooksLikePage1, { type: "fetch", page: 1 });
});

test("partial preview fetches page 1 then dedupes against preview ids", () => {
  const preview = summaries(2);
  const page1 = [...summaries(2), ...summaries(6, "page1")];
  assert.deepEqual(
    nextResultNotesExpandAction({
      previewItems: preview,
      total: 8,
      expanded: false,
      authoritativePage: 0,
      authoritativeItems: null,
    }),
    { type: "fetch", page: 1 }
  );
  const merged = mergeResultNotePreviewWithPage(preview, page1);
  assert.equal(merged.length, 8);
  assert.deepEqual(
    merged.map((row) => row.id),
    page1.map((row) => row.id)
  );
  assert.equal(new Set(merged.map((row) => row.id)).size, 8);
});

test("complete preview does not fetch merely to display loaded items", () => {
  const preview = summaries(8);
  const action = nextResultNotesExpandAction({
    previewItems: preview,
    total: 8,
    expanded: false,
    authoritativePage: 0,
    authoritativeItems: null,
  });
  assert.deepEqual(action, { type: "reveal" });
  const afterReveal = nextResultNotesExpandAction({
    previewItems: preview,
    total: 8,
    expanded: true,
    authoritativePage: 0,
    authoritativeItems: null,
  });
  assert.deepEqual(afterReveal, { type: "none" });
});

test("more than 20 results fetches page 1 then page 2 without skip", () => {
  const preview = summaries(20);
  const first = nextResultNotesExpandAction({
    previewItems: preview,
    total: 25,
    expanded: false,
    authoritativePage: 0,
    authoritativeItems: null,
  });
  assert.deepEqual(first, { type: "fetch", page: 1 });
  const page1 = summaries(20);
  const afterPage1 = nextResultNotesExpandAction({
    previewItems: preview,
    total: 25,
    expanded: true,
    authoritativePage: 1,
    authoritativeItems: page1,
  });
  assert.deepEqual(afterPage1, { type: "fetch", page: 2 });
  const afterPage2 = nextResultNotesExpandAction({
    previewItems: preview,
    total: 25,
    expanded: true,
    authoritativePage: 2,
    authoritativeItems: appendResultNotePage(page1, summaries(5, "page2")),
  });
  assert.deepEqual(afterPage2, { type: "none" });
});

test("duplicate Note ids never render twice after merge or append", () => {
  const preview = summaries(2);
  const page1 = [preview[0]!, ...summaries(7, "auth")];
  const merged = mergeResultNotePreviewWithPage(preview, [...page1, page1[0]!]);
  assert.equal(merged.filter((row) => row.id === preview[0]!.id).length, 1);
  assert.equal(new Set(merged.map((row) => row.id)).size, merged.length);
  const appended = appendResultNotePage(merged, [merged[0]!, sampleSummary({ id: "later-1" })]);
  assert.equal(appended.filter((row) => row.id === merged[0]!.id).length, 1);
  assert.ok(appended.some((row) => row.id === "later-1"));
  assert.equal(new Set(appended.map((row) => row.id)).size, appended.length);
});

test("zero total never requests a per-task page", () => {
  assert.deepEqual(
    nextResultNotesExpandAction({
      previewItems: [],
      total: 0,
      expanded: false,
      authoritativePage: 0,
      authoritativeItems: null,
    }),
    { type: "none" }
  );
});

test("Task A expansion context cannot leak into Task B", () => {
  const taskA = resultNotesExpansionContextKey("CASE", "case-1", "task-a");
  const taskB = resultNotesExpansionContextKey("CASE", "case-1", "task-b");
  assert.equal(shouldResetResultNotesExpansion(taskA, taskA), false);
  assert.equal(shouldResetResultNotesExpansion(taskA, taskB), true);
  const component = read("components/drug_intelligence/drug_investigation_task_result_notes.tsx");
  assert.match(component, /resultNotesExpansionContextKey\(targetKind, targetId, taskId\)/);
  assert.match(component, /if \(boundKey !== contextKey\) \{[\s\S]*setAuthoritativeItems\(null\)/);
  assert.equal(displayedResultNotes(summaries(2, "a"), summaries(4, "b")).every((row) => row.id.startsWith("b-")), true);
});

test("result-note expansion fetches page 1 first and does not use page \\+ 1 as the first request", () => {
  const component = read("components/drug_intelligence/drug_investigation_task_result_notes.tsx");
  assert.match(component, /nextResultNotesExpandAction/);
  assert.match(component, /mergeResultNotePreviewWithPage/);
  assert.match(component, /listCaseTaskNotes\(targetId, taskId, page, pageSize\)/);
  assert.doesNotMatch(component, /const nextPage = page \+ 1/);
});

test("Task panel opens empty Note editor from Task and uses one batch related-notes query", () => {
  const panel = read("components/drug_intelligence/drug_investigation_tasks_panel.tsx");
  const card = read("components/drug_intelligence/drug_investigation_task_card.tsx");
  assert.match(card, /di\.collaboration\.createResultNote/);
  assert.match(panel, /onCreateResultNote=\{canEdit \? openCreateFromTask/);
  assert.match(panel, /setNoteDraft\(""\)/);
  assert.match(panel, /sourceTaskId: creatingFromTask\.id/);
  assert.match(panel, /useRelatedTaskNotesBatch\(targetKind, targetId, relatedTaskIds\)/);
  assert.doesNotMatch(panel, /listCaseTaskNotes|listPersonTaskNotes/);
  const resultNotes = read("components/drug_intelligence/drug_investigation_task_result_notes.tsx");
  assert.match(resultNotes, /async function loadMore\([\s\S]*listCaseTaskNotes\(targetId, taskId, page, pageSize\)/);
  assert.doesNotMatch(resultNotes, /useEffect\(/);
  assert.match(panel, /data-testid="analyst-note-editor-from-task"/);
  const hooks = read("lib/drug_intelligence/drug_analyst_notes_hooks.ts");
  assert.match(hooks, /listRelatedTaskNotesBatch/);
  assert.match(hooks, /relatedTaskNotesQueryKey/);
  const service = read("lib/drug_intelligence/drug_analyst_note_service.ts");
  assert.match(service, /loadSourceTaskProvenance/);
  assert.match(service, /id: \{ in: unique \}/);
});

test("E.3 does not add Search/Network/Map/Timeline/Export/Telegram/AI wiring", () => {
  const files = [
    "components/drug_intelligence/drug_investigation_tasks_panel.tsx",
    "components/drug_intelligence/drug_investigation_task_card.tsx",
    "lib/drug_intelligence/drug_analyst_notes_hooks.ts",
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
    assert.doesNotMatch(src, /createResultNote|related-task-notes|useRelatedTaskNotesBatch/);
  }
});
