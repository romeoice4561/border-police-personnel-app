/**
 * DI-11D.2 Investigation Tasks write workflow — helpers, payloads, render.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/ui/api_client";
import { translate } from "@/lib/i18n/dictionary";
import {
  buildDirtyTaskPatch,
  classifyInvestigationTasksError,
  draftFromInvestigationTask,
  draftToCreateFields,
  emptyInvestigationTaskDraft,
  investigationTasksErrorMessageKey,
  investigationTasksListVisibility,
  legalTaskStatusTransitions,
  serializeTaskDueAt,
  taskDueAtToPickerValue,
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
  validateTaskDescription,
  validateTaskTitle,
} from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import {
  investigationTaskCreatePayload,
  investigationTaskPatchPayload,
} from "@/lib/drug_intelligence/drug_investigation_tasks_client";
import { DrugInvestigationTaskCard } from "@/components/drug_intelligence/drug_investigation_task_card";
import { DrugInvestigationTaskActions } from "@/components/drug_intelligence/drug_investigation_task_actions";
import { DrugInvestigationTaskEditor } from "@/components/drug_intelligence/drug_investigation_task_editor";
import type { InvestigationTaskDto } from "@/lib/drug_intelligence/drug_collaboration_types";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function sampleTask(overrides: Partial<InvestigationTaskDto> = {}): InvestigationTaskDto {
  return {
    kind: "TASK",
    id: "task-1",
    title: "ติดตามพยาน",
    description: null,
    targetKind: "CASE",
    targetId: "case-1",
    assignedActorId: "mock:bpp414",
    assignedActorName: "Commander BPP414",
    dueAt: "2026-09-20T16:59:59.999Z",
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
    ...overrides,
  };
}

function renderEditor(overrides: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
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
        ...overrides,
      })
    )
  );
}

test("title and description validation mirror the 200 / 5000 server bounds", () => {
  assert.deepEqual(validateTaskTitle("  ติดตาม  "), { ok: true, title: "ติดตาม" });
  assert.equal(validateTaskTitle("x".repeat(TASK_TITLE_MAX)).ok, true);
  assert.equal(validateTaskTitle("").ok, false);
  assert.equal(validateTaskTitle("   ").ok, false);
  const tooLong = validateTaskTitle("x".repeat(TASK_TITLE_MAX + 1));
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.reason, "too_long");

  assert.deepEqual(validateTaskDescription("  "), { ok: true, description: null });
  assert.equal(validateTaskDescription("x".repeat(TASK_DESCRIPTION_MAX)).ok, true);
  const descLong = validateTaskDescription("x".repeat(TASK_DESCRIPTION_MAX + 1));
  assert.equal(descLong.ok, false);
});

test("create draft defaults priority NORMAL and omits status / target / completedAt", () => {
  const draft = emptyInvestigationTaskDraft();
  assert.equal(draft.priority, "NORMAL");
  assert.equal(draft.title, "");
  assert.equal(draft.assignedActorId, "");
  assert.equal(draft.dueDate, "");
  const fields = draftToCreateFields({ ...draft, title: "งานใหม่" });
  assert.ok(fields);
  assert.equal(fields?.priority, "NORMAL");
  assert.equal(fields?.assignedActorId, null);
  assert.equal(fields?.dueAt, null);
  assert.equal("status" in (fields ?? {}), false);
  const payload = investigationTaskCreatePayload({ ...fields!, confirmActorId: "mock:admin" });
  assert.equal(payload.confirmActorId, "mock:admin");
  assert.equal("status" in payload, false);
  assert.equal("caseId" in payload, false);
  assert.equal("personId" in payload, false);
  assert.equal("createdByName" in payload, false);
  assert.equal("assignedActorName" in payload, false);
  assert.equal("completedAt" in payload, false);
});

test("dueAt serializes the selected calendar day as Asia/Bangkok end-of-day", () => {
  assert.equal(serializeTaskDueAt("2026-09-12"), "2026-09-12T16:59:59.999Z");
  assert.equal(serializeTaskDueAt(""), null);
  assert.equal(serializeTaskDueAt("   "), null);
  assert.equal(taskDueAtToPickerValue("2026-09-12T16:59:59.999Z"), "2026-09-12");
  assert.equal(taskDueAtToPickerValue(null), "");
  const draft = draftFromInvestigationTask(sampleTask());
  assert.equal(draft.dueDate, "2026-09-20");
  const cleared = buildDirtyTaskPatch(sampleTask(), { ...draft, dueDate: "" });
  assert.ok(cleared);
  assert.equal(cleared?.dueAt, null);
});

test("dirty PATCH sends only changed fields plus confirmActorId and never completedAt", () => {
  const task = sampleTask({ description: "เดิม" });
  const unchanged = buildDirtyTaskPatch(task, draftFromInvestigationTask(task));
  assert.equal(unchanged, null);

  const dirty = buildDirtyTaskPatch(task, {
    ...draftFromInvestigationTask(task),
    title: "ชื่อใหม่",
    assignedActorId: "",
  });
  assert.ok(dirty);
  assert.deepEqual(Object.keys(dirty!).sort(), ["assignedActorId", "title"]);
  assert.equal(dirty?.assignedActorId, null);
  const payload = investigationTaskPatchPayload(dirty!, "mock:admin");
  assert.equal(payload.confirmActorId, "mock:admin");
  assert.equal(payload.title, "ชื่อใหม่");
  assert.equal("status" in payload, false);
  assert.equal("completedAt" in payload, false);
  assert.equal("assignedActorName" in payload, false);
  assert.equal("createdByActorId" in payload, false);
});

test("legal status transitions match OPEN / IN_PROGRESS / terminal rules", () => {
  assert.deepEqual(legalTaskStatusTransitions("OPEN"), ["IN_PROGRESS", "DONE", "CANCELLED"]);
  assert.deepEqual(legalTaskStatusTransitions("IN_PROGRESS"), ["DONE", "CANCELLED"]);
  assert.deepEqual(legalTaskStatusTransitions("DONE"), []);
  assert.deepEqual(legalTaskStatusTransitions("CANCELLED"), []);
});

test("409 actor mismatch is distinct from merged-person 409 and uses a role alert", () => {
  const mismatch = classifyInvestigationTasksError(
    new ApiClientError("Bound actor does not match confirmActorId", 409, "CONFLICT"),
    "save"
  );
  assert.equal(mismatch.kind, "mismatch");
  assert.equal(mismatch.survivorPersonId, null);
  assert.match(translate(investigationTasksErrorMessageKey("mismatch"), "th"), /ไม่ตรงกับเซสชันปัจจุบัน/);

  const merged = classifyInvestigationTasksError(
    new ApiClientError("Cannot create collaboration on a MERGED person", 409, "CONFLICT", {
      personId: "old-person",
      survivorPersonId: "survivor-1",
    }),
    "save"
  );
  assert.equal(merged.kind, "merged");
  assert.equal(merged.survivorPersonId, "survivor-1");

  const html = renderEditor({
    draft: { ...emptyInvestigationTaskDraft(), title: "draft that must remain" },
    saveError: translate("di.tasks.actorMismatch", "th"),
    survivorPersonId: null,
  });
  assert.match(html, /draft that must remain/);
  assert.match(html, /ไม่ตรงกับเซสชันปัจจุบัน/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /status|สถานะเลือก|investigation-task-status-select/);
});

test("merged Person create error preserves draft and offers survivor navigation only", () => {
  const html = renderEditor({
    draft: { ...emptyInvestigationTaskDraft(), title: "งานบนบุคคลที่ถูกรวม" },
    saveError: translate("di.tasks.mergedPerson", "th"),
    survivorPersonId: "survivor-1",
  });
  assert.match(html, /งานบนบุคคลที่ถูกรวม/);
  assert.match(html, /ถูกรวมแล้ว/);
  assert.match(html, /investigation-task-open-survivor/);
  assert.match(html, /survivor-1/);
  assert.doesNotMatch(html, /method: "POST"/);
});

test("Admin write controls appear; commander card stays read-only; no delete", () => {
  const admin = renderToStaticMarkup(
    createElement(DrugInvestigationTaskCard, { task: sampleTask(), canEdit: true })
  );
  assert.match(admin, /แก้ไข/);
  assert.match(admin, /เริ่มดำเนินการ/);
  assert.match(admin, /ยกเลิกงาน/);
  assert.doesNotMatch(admin, /ลบงาน|onDelete|Delete/);

  const commander = renderToStaticMarkup(createElement(DrugInvestigationTaskCard, { task: sampleTask(), canEdit: false }));
  assert.doesNotMatch(commander, /data-testid="investigation-task-edit"/);
  assert.doesNotMatch(commander, /data-testid="investigation-task-start"/);
  assert.doesNotMatch(commander, /data-testid="investigation-task-complete"/);
  assert.doesNotMatch(commander, /data-testid="investigation-task-cancel"/);

  const done = renderToStaticMarkup(
    createElement(DrugInvestigationTaskActions, {
      status: "DONE",
      onTransition: () => undefined,
    })
  );
  assert.equal(done, "");
  const cancelled = renderToStaticMarkup(
    createElement(DrugInvestigationTaskActions, {
      status: "CANCELLED",
      onTransition: () => undefined,
    })
  );
  assert.equal(cancelled, "");

  const inProgress = renderToStaticMarkup(
    createElement(DrugInvestigationTaskActions, {
      status: "IN_PROGRESS",
      onTransition: () => undefined,
    })
  );
  assert.doesNotMatch(inProgress, /เริ่มดำเนินการ/);
  assert.match(inProgress, /investigation-task-complete/);
  assert.match(inProgress, /investigation-task-cancel/);
});

test("pending write disables save and status actions", () => {
  const html = renderEditor({
    draft: { ...emptyInvestigationTaskDraft(), title: "งาน" },
    pending: true,
  });
  assert.match(html, /data-testid="investigation-task-save"[^>]*disabled|disabled[^>]*data-testid="investigation-task-save"/);

  const actions = renderToStaticMarkup(
    createElement(DrugInvestigationTaskActions, {
      status: "OPEN",
      pending: true,
      onTransition: () => undefined,
    })
  );
  assert.match(actions, /data-testid="investigation-task-start"[^>]*disabled|disabled[^>]*data-testid="investigation-task-start"/);
});

test("editor uses ThaiDatePicker iso wire format and assignee directory hook", () => {
  const editor = read("components/drug_intelligence/drug_investigation_task_editor.tsx");
  assert.match(editor, /ThaiDatePicker/);
  assert.match(editor, /outputFormat="iso"/);
  assert.match(editor, /DrugInvestigationTaskAssigneeSelect/);
  assert.doesNotMatch(editor, /type="date"/);
  assert.doesNotMatch(editor, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(editor, /investigation-task-status|di\.tasks\.status[^A-Za-z]/);
  const select = read("components/drug_intelligence/drug_investigation_task_assignee_select.tsx");
  assert.match(select, /useCollaborationAssignees/);
  assert.match(select, /di\.tasks\.unassigned/);
  assert.match(select, /displayName/);
});

test("write failure is not classified as an empty list", () => {
  const visibility = investigationTasksListVisibility({
    hasData: true,
    isPending: false,
    isError: false,
    itemCount: 2,
    composing: false,
  });
  assert.equal(visibility.showList, true);
  assert.equal(visibility.showEmpty, false);
  const saveFail = classifyInvestigationTasksError(new ApiClientError("boom", 500, "INTERNAL_ERROR"), "save");
  assert.equal(saveFail.kind, "save");
  assert.notEqual(saveFail.kind, "load");
});

test("panel write wiring is permission-gated, shared, and has no DELETE or reopen", () => {
  const panel = read("components/drug_intelligence/drug_investigation_tasks_panel.tsx");
  assert.match(panel, /can\("drug.edit"\)/);
  assert.match(panel, /di\.tasks\.addTask/);
  assert.match(panel, /confirmActorId|user\?\.id/);
  assert.match(panel, /writesLocked/);
  assert.match(panel, /buildDirtyTaskPatch/);
  assert.match(panel, /patch: \{ status: next \}/);
  assert.doesNotMatch(panel, /completedAt:/);
  assert.doesNotMatch(panel, /OPEN["']\s*\)|status: "OPEN"/);
  assert.doesNotMatch(panel, /method: "DELETE"|ลบงาน/);
  assert.doesNotMatch(panel, /เฉพาะหน่วยของคุณ/);

  const hooks = read("lib/drug_intelligence/drug_investigation_tasks_hooks.ts");
  assert.match(hooks, /confirmActorId/);
  assert.match(hooks, /invalidateQueries/);
  assert.doesNotMatch(hooks, /createdByName|assignedActorName|completedAt/);

  const caseSrc = read("app/drug-intelligence/cases/[id]/page.tsx");
  const personSrc = read("app/drug-intelligence/persons/[id]/page.tsx");
  assert.match(caseSrc, /DrugInvestigationTasksPanel/);
  assert.match(personSrc, /DrugInvestigationTasksPanel/);
});

test("no Search\/Network\/Map\/Timeline\/Export\/Telegram\/AI wiring and no schema change", () => {
  const files = [
    "components/drug_intelligence/drug_investigation_tasks_panel.tsx",
    "components/drug_intelligence/drug_investigation_task_editor.tsx",
    "lib/drug_intelligence/drug_investigation_tasks_client.ts",
    "lib/drug_intelligence/drug_investigation_task_due_at.ts",
  ];
  for (const file of files) {
    const src = read(file);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(src, /prisma|migrate/);
  }
  const isolated = [
    "lib/drug_intelligence/drug_intelligence_search_service.ts",
    "lib/drug_intelligence/drug_network_graph_service.ts",
    "lib/drug_intelligence/drug_map_query.ts",
    "lib/drug_intelligence/drug_export_service.ts",
    "lib/personnel_search_telegram/drug_search_command.ts",
    "app/drug-intelligence/search/page.tsx",
    "app/drug-intelligence/network/page.tsx",
    "app/drug-intelligence/map/page.tsx",
    "app/drug-intelligence/timeline/page.tsx",
    "app/drug-intelligence/reports/page.tsx",
    "app/drug-intelligence/command/page.tsx",
  ];
  for (const file of isolated) {
    const src = read(file);
    assert.doesNotMatch(src, /DrugInvestigationTaskEditor|useCreateInvestigationTask|useUpdateInvestigationTask/);
  }
});
