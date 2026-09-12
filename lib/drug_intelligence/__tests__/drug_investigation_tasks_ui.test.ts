/**
 * DI-11D.1 Investigation Tasks read-only UI — helpers, source contracts, render.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiClientError } from "@/lib/ui/api_client";
import { translate } from "@/lib/i18n/dictionary";
import { isTaskOverdue } from "@/lib/drug_intelligence/drug_collaboration_options";
import {
  classifyInvestigationTasksError,
  investigationTaskPriorityLabelKey,
  investigationTaskStatusLabelKey,
  investigationTasksErrorMessageKey,
  investigationTasksListVisibility,
  taskShowsCompletedAt,
} from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import { DrugInvestigationTaskCard } from "@/components/drug_intelligence/drug_investigation_task_card";
import { toCollaborationAssigneeDto } from "@/lib/drug_intelligence/drug_collaboration_auth";
import type { InvestigationTaskDto } from "@/lib/drug_intelligence/drug_collaboration_types";
import type { AuthUser } from "@/lib/auth/types";

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
    sourceNoteId: null,
    ...overrides,
  };
}

test("status and priority Thai labels match planned vocabulary", () => {
  assert.equal(translate(investigationTaskStatusLabelKey("OPEN"), "th"), "เปิดงาน");
  assert.equal(translate(investigationTaskStatusLabelKey("IN_PROGRESS"), "th"), "กำลังดำเนินการ");
  assert.equal(translate(investigationTaskStatusLabelKey("DONE"), "th"), "เสร็จสิ้น");
  assert.equal(translate(investigationTaskStatusLabelKey("CANCELLED"), "th"), "ยกเลิก");
  assert.equal(translate(investigationTaskPriorityLabelKey("LOW"), "th"), "ต่ำ");
  assert.equal(translate(investigationTaskPriorityLabelKey("NORMAL"), "th"), "ปกติ");
  assert.equal(translate(investigationTaskPriorityLabelKey("HIGH"), "th"), "สูง");
  assert.equal(translate(investigationTaskPriorityLabelKey("URGENT"), "th"), "เร่งด่วน");
  assert.equal(translate("di.tasks.priority", "th"), "ความสำคัญ");
});

test("overdue helper is reused and not reimplemented in the card", () => {
  const now = new Date("2026-09-12T00:00:00.000Z");
  assert.equal(isTaskOverdue({ dueAt: new Date("2026-09-11T00:00:00.000Z"), status: "OPEN", now }), true);
  assert.equal(isTaskOverdue({ dueAt: new Date("2026-09-11T00:00:00.000Z"), status: "DONE", now }), false);
  const card = read("components/drug_intelligence/drug_investigation_task_card.tsx");
  assert.match(card, /isTaskOverdue/);
  assert.doesNotMatch(card, /dueAt < now/);
  assert.match(read("lib/drug_intelligence/drug_investigation_tasks_view.ts"), /export \{ isTaskOverdue/);
});

test("API load failure is not classified as empty tasks", () => {
  const failed = classifyInvestigationTasksError(new ApiClientError("boom", 500, "INTERNAL_ERROR"));
  assert.equal(failed.kind, "load");
  assert.match(translate(investigationTasksErrorMessageKey(failed.kind), "th"), /ไม่สามารถโหลดงานติดตามได้/);

  const firstFail = investigationTasksListVisibility({ hasData: false, isPending: false, isError: true, itemCount: 0 });
  assert.equal(firstFail.showError, true);
  assert.equal(firstFail.showEmpty, false);

  const firstLoad = investigationTasksListVisibility({ hasData: false, isPending: true, isError: false, itemCount: 0 });
  assert.equal(firstLoad.showLoading, true);
  assert.equal(firstLoad.showEmpty, false);

  const placeholder = investigationTasksListVisibility({ hasData: true, isPending: true, isError: false, itemCount: 2 });
  assert.equal(placeholder.showList, true);
  assert.equal(placeholder.showLoading, false);

  const empty = investigationTasksListVisibility({ hasData: true, isPending: false, isError: false, itemCount: 0 });
  assert.equal(empty.showEmpty, true);
  assert.equal(empty.showError, false);
});

test("HTML-looking title and description render as text without write or delete controls", () => {
  const html = renderToStaticMarkup(
    createElement(DrugInvestigationTaskCard, {
      task: sampleTask({
        title: "<script>alert(1)</script>",
        description: "<img src=x onerror=alert(1)>",
        assignedActorId: "mock:admin",
        assignedActorName: "Administrator",
      }),
    })
  );
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /งานติดตาม/);
  assert.match(html, /TASK/);
  assert.match(html, /ผู้รับผิดชอบ/);
  assert.match(html, /Administrator/);
  assert.match(html, /ผู้สร้างงาน/);
  assert.doesNotMatch(html, /mock:admin/);
  assert.doesNotMatch(html, /เพิ่มงาน|แก้ไข|เริ่มดำเนินการ|เสร็จสิ้น|ยกเลิกงาน|ลบ|Delete/i);
});

test("unassigned, overdue, DONE completedAt, and CANCELLED cards keep distinct metadata", () => {
  const unassigned = renderToStaticMarkup(createElement(DrugInvestigationTaskCard, { task: sampleTask({ assignedActorId: null, assignedActorName: null }) }));
  assert.match(unassigned, /ยังไม่มอบหมาย/);

  const overdue = renderToStaticMarkup(
    createElement(DrugInvestigationTaskCard, {
      task: sampleTask({ dueAt: "2000-01-01T00:00:00.000Z", status: "OPEN", isOverdue: true }),
    })
  );
  assert.match(overdue, /เกินกำหนด/);

  const done = sampleTask({
    status: "DONE",
    completedAt: "2026-09-11T08:00:00.000Z",
    isOverdue: false,
  });
  assert.equal(taskShowsCompletedAt(done), true);
  const doneHtml = renderToStaticMarkup(createElement(DrugInvestigationTaskCard, { task: done }));
  assert.match(doneHtml, /เสร็จสิ้นเมื่อ/);
  assert.doesNotMatch(doneHtml, /เกินกำหนด/);

  const cancelled = renderToStaticMarkup(
    createElement(DrugInvestigationTaskCard, {
      task: sampleTask({ status: "CANCELLED", completedAt: null, dueAt: "2000-01-01T00:00:00.000Z" }),
    })
  );
  assert.match(cancelled, /ยกเลิก/);
  assert.doesNotMatch(cancelled, /เสร็จสิ้นเมื่อ/);
  assert.doesNotMatch(cancelled, /เกินกำหนด/);
});

test("assignee DTO keeps only id and displayName", () => {
  const user: AuthUser = {
    id: "mock:admin",
    username: "admin",
    displayName: "Administrator",
    role: "admin",
    permissions: ["drug.read", "drug.edit"],
    officerId: null,
    mustChangePassword: false,
    isActive: true,
  };
  assert.deepEqual(toCollaborationAssigneeDto(user), { id: "mock:admin", displayName: "Administrator" });
});

test("shared panel is used by Case and Person with target mode only", () => {
  const caseSrc = read("app/drug-intelligence/cases/[id]/page.tsx");
  const personSrc = read("app/drug-intelligence/persons/[id]/page.tsx");
  const panel = read("components/drug_intelligence/drug_investigation_tasks_panel.tsx");
  assert.match(caseSrc, /DrugInvestigationTasksPanel/);
  assert.match(caseSrc, /targetKind="CASE"/);
  assert.match(caseSrc, /investigation-tasks/);
  assert.match(personSrc, /DrugInvestigationTasksPanel/);
  assert.match(personSrc, /targetKind="PERSON"/);
  assert.match(personSrc, /investigation-tasks/);
  assert.match(panel, /targetKind: CollaborationTargetKind/);
  assert.match(panel, /di\.tasks\.emptyCase/);
  assert.match(panel, /di\.tasks\.emptyPerson/);
  assert.match(panel, /di\.tasks\.loadError/);
  assert.match(panel, /di\.tasks\.overdueOnly/);
  assert.match(panel, /LoadingState/);
  assert.match(panel, /Pagination/);
  assert.doesNotMatch(panel, /onDelete|method: "DELETE"|ลบงาน/);
  assert.doesNotMatch(caseSrc, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(personSrc, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
});

test("client lists use existing task routes, honors filters, and never DELETEs", () => {
  const client = read("lib/drug_intelligence/drug_investigation_tasks_client.ts");
  assert.match(client, /\/drug-intelligence\/cases\//);
  assert.match(client, /\/drug-intelligence\/persons\//);
  assert.match(client, /\/drug-intelligence\/collaboration\/assignees/);
  assert.match(client, /overdue", "true"/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /method: "PATCH"/);
  assert.doesNotMatch(client, /method: "DELETE"/);
  assert.match(client, /credentials: "include"/);
  assert.match(client, /confirmActorId/);
  assert.doesNotMatch(client, /assignedActorName/);
  assert.doesNotMatch(client, /createdByName/);
});

test("merged Person list is allowed and D.1 does not redirect to survivor", () => {
  const service = read("lib/drug_intelligence/drug_investigation_task_service.ts");
  assert.match(service, /allowMergedRead: true/);
  const panel = read("components/drug_intelligence/drug_investigation_tasks_panel.tsx");
  assert.match(panel, /survivorPersonId/);
  assert.doesNotMatch(panel, /createPersonTask\(classified|mutateAsync\(survivor|redirect/);
});

test("no write UI, no schema, and no Search\/Network\/Map\/Timeline\/Export\/Telegram\/AI wiring", () => {
  const files = [
    "components/drug_intelligence/drug_investigation_tasks_panel.tsx",
    "components/drug_intelligence/drug_investigation_task_card.tsx",
    "lib/drug_intelligence/drug_investigation_tasks_client.ts",
    "lib/drug_intelligence/drug_investigation_tasks_hooks.ts",
    "app/api/drug-intelligence/collaboration/assignees/route.ts",
  ];
  for (const file of files) {
    const src = read(file);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(src, /prisma|migrate/);
    assert.doesNotMatch(src, /เฉพาะหน่วยของคุณ/);
  }
  const isolated = [
    "lib/drug_intelligence/drug_intelligence_search_service.ts",
    "lib/drug_intelligence/drug_network_graph_service.ts",
    "lib/drug_intelligence/drug_map_query.ts",
    "lib/drug_intelligence/drug_export_service.ts",
    "lib/personnel_search_telegram/drug_search_command.ts",
    "components/layout/app_shell.tsx",
    "app/drug-intelligence/search/page.tsx",
    "app/drug-intelligence/network/page.tsx",
    "app/drug-intelligence/map/page.tsx",
    "app/drug-intelligence/timeline/page.tsx",
    "app/drug-intelligence/reports/page.tsx",
    "app/drug-intelligence/command/page.tsx",
  ];
  for (const file of isolated) {
    const src = read(file);
    assert.doesNotMatch(src, /DrugInvestigationTasksPanel|drugInvestigationTasksClient|useInvestigationTasks/);
  }
});
