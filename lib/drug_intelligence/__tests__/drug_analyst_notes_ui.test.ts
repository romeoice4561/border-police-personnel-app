/**
 * DI-11C Analyst Notes UI — helpers, source contracts, and presentational render.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiClientError } from "@/lib/ui/api_client";
import { translate } from "@/lib/i18n/dictionary";
import { formatDiDateTime } from "@/lib/drug_intelligence/di_date_helpers";
import {
  ANALYST_NOTE_BODY_MAX,
  analystNotesErrorMessageKey,
  classifyAnalystNotesError,
  noteWasEdited,
  parseMergedPersonDetails,
  validateNoteBody,
  analystNotesListVisibility,
} from "@/lib/drug_intelligence/drug_analyst_notes_view";
import { DrugAnalystNoteCard } from "@/components/drug_intelligence/drug_analyst_note_card";
import { DrugAnalystNoteEditor } from "@/components/drug_intelligence/drug_analyst_note_editor";
import type { AnalystNoteDto } from "@/lib/drug_intelligence/drug_collaboration_types";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function sampleNote(overrides: Partial<AnalystNoteDto> = {}): AnalystNoteDto {
  return {
    kind: "ANALYST_NOTE",
    id: "note-1",
    body: "ต้นฉบับบันทึก",
    targetKind: "CASE",
    targetId: "case-1",
    authorActorId: "mock:admin",
    authorName: "Administrator",
    createdAt: "2026-09-11T03:00:00.000Z",
    updatedAt: "2026-09-11T03:00:00.000Z",
    updatedByActorId: null,
    updatedByName: null,
    ...overrides,
  };
}

test("validateNoteBody accepts 1–5000 trimmed chars and rejects empty or 5001", () => {
  assert.deepEqual(validateNoteBody("  hello  "), { ok: true, body: "hello" });
  assert.equal(validateNoteBody("x".repeat(5000)).ok, true);
  assert.equal(validateNoteBody("x".repeat(ANALYST_NOTE_BODY_MAX)).ok, true);
  assert.deepEqual(validateNoteBody("   "), { ok: false, reason: "empty", length: 0 });
  assert.equal(validateNoteBody("").ok, false);
  const tooLong = validateNoteBody("x".repeat(5001));
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.reason, "too_long");
});

test("noteWasEdited keeps original author distinct from updater metadata", () => {
  assert.equal(noteWasEdited(sampleNote()), false);
  assert.equal(
    noteWasEdited(sampleNote({ updatedAt: "2026-09-11T04:00:00.000Z", updatedByName: "Commander BPP414" })),
    true
  );
});

test("409 confirmActorId mismatch is distinct from merged-person 409", () => {
  const mismatch = classifyAnalystNotesError(new ApiClientError("Bound actor does not match confirmActorId", 409, "CONFLICT"), "save");
  assert.equal(mismatch.kind, "mismatch");
  assert.equal(mismatch.survivorPersonId, null);
  assert.match(translate(analystNotesErrorMessageKey(mismatch.kind), "th"), /ไม่ตรงกับเซสชันปัจจุบัน/);

  const mergedErr = new ApiClientError("Cannot create collaboration on a MERGED person", 409, "CONFLICT", {
    personId: "old-person",
    survivorPersonId: "survivor-1",
  });
  const merged = classifyAnalystNotesError(mergedErr, "save");
  assert.equal(merged.kind, "merged");
  assert.equal(merged.survivorPersonId, "survivor-1");
  assert.deepEqual(parseMergedPersonDetails(mergedErr.details), { personId: "old-person", survivorPersonId: "survivor-1" });
  assert.match(translate(analystNotesErrorMessageKey(merged.kind), "th"), /ถูกรวมแล้ว/);
});

test("API load failure is not classified as empty notes", () => {
  const failed = classifyAnalystNotesError(new ApiClientError("boom", 500, "INTERNAL_ERROR"), "load");
  assert.equal(failed.kind, "load");
  assert.notEqual(analystNotesErrorMessageKey(failed.kind), "di.collaboration.emptyCase");
  assert.match(translate(analystNotesErrorMessageKey(failed.kind), "th"), /ไม่สามารถโหลดบันทึกนักวิเคราะห์ได้/);

  const firstFail = analystNotesListVisibility({ hasData: false, isPending: false, isError: true, itemCount: 0, composing: false });
  assert.equal(firstFail.showError, true);
  assert.equal(firstFail.showEmpty, false);
  assert.equal(firstFail.showList, false);

  const firstLoad = analystNotesListVisibility({ hasData: false, isPending: true, isError: false, itemCount: 0, composing: false });
  assert.equal(firstLoad.showLoading, true);
  assert.equal(firstLoad.showEmpty, false);

  const pagePlaceholder = analystNotesListVisibility({ hasData: true, isPending: true, isError: false, itemCount: 3, composing: false });
  assert.equal(pagePlaceholder.showList, true);
  assert.equal(pagePlaceholder.showEmpty, false);
  assert.equal(pagePlaceholder.showLoading, false);

  const caseEmpty = analystNotesListVisibility({ hasData: true, isPending: false, isError: false, itemCount: 0, composing: false });
  assert.equal(caseEmpty.showEmpty, true);
  assert.equal(caseEmpty.showError, false);
});

test("HTML-looking note body renders as text, without delete, and without actor ids", () => {
  const html = renderToStaticMarkup(
    createElement(DrugAnalystNoteCard, {
      note: sampleNote({
        body: "<script>alert(1)</script>",
        updatedAt: "2026-09-11T04:00:00.000Z",
        updatedByName: "Administrator",
      }),
      canEdit: true,
    })
  );
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /บันทึกนักวิเคราะห์/);
  assert.match(html, /ANALYST NOTE/);
  assert.match(html, /ผู้บันทึก/);
  assert.match(html, /Administrator/);
  assert.match(html, /แก้ไขล่าสุด/);
  assert.doesNotMatch(html, /mock:admin/);
  assert.doesNotMatch(html, /Delete|ลบ|trash/i);
  assert.match(html, /แก้ไขบันทึก/);
});

test("commander card is read-only: no edit or delete controls", () => {
  const html = renderToStaticMarkup(createElement(DrugAnalystNoteCard, { note: sampleNote(), canEdit: false }));
  assert.doesNotMatch(html, /แก้ไขบันทึก/);
  assert.doesNotMatch(html, /เพิ่มบันทึก/);
  assert.doesNotMatch(html, /ลบ/);
  assert.match(html, /ต้นฉบับบันทึก/);
});

test("editor enforces 5000 boundary and keeps 5001 unsavable", () => {
  const ok = renderToStaticMarkup(
    createElement(DrugAnalystNoteEditor, {
      value: "x".repeat(5000),
      onChange: () => undefined,
      onSave: () => undefined,
      onCancel: () => undefined,
      pending: false,
      saveError: null,
      mode: "create",
    })
  );
  assert.match(ok, /5000 \/ 5000/);
  assert.match(ok, /data-testid="analyst-note-save"/);
  assert.doesNotMatch(ok, /\sdisabled(?:=|"|\s|>)[^>]*data-testid="analyst-note-save"|data-testid="analyst-note-save"[^>]*\sdisabled(?:=|"|\s|>)/);

  const over = renderToStaticMarkup(
    createElement(DrugAnalystNoteEditor, {
      value: "x".repeat(5001),
      onChange: () => undefined,
      onSave: () => undefined,
      onCancel: () => undefined,
      pending: false,
      saveError: null,
      mode: "create",
    })
  );
  assert.match(over, /5001 \/ 5000/);
  assert.match(over, /ยาวเกิน 5,000/);
  assert.match(over, /data-testid="analyst-note-save"[^>]*\sdisabled(?:=|"|\s|>)|\sdisabled(?:=|"|\s|>)[^>]*data-testid="analyst-note-save"/);
});

test("409 mismatch error copy is shown in the editor without discarding the draft value", () => {
  const html = renderToStaticMarkup(
    createElement(DrugAnalystNoteEditor, {
      value: "draft that must remain",
      onChange: () => undefined,
      onSave: () => undefined,
      onCancel: () => undefined,
      pending: false,
      saveError: translate("di.collaboration.actorMismatch", "th"),
      mode: "create",
    })
  );
  assert.match(html, /draft that must remain/);
  assert.match(html, /ไม่ตรงกับเซสชันปัจจุบัน/);
});

test("formatDiDateTime uses Thai B.E. vocabulary and includes local time", () => {
  const rendered = formatDiDateTime("2026-08-14T10:05:00+07:00");
  assert.match(rendered, /ส\.ค\./);
  assert.match(rendered, /2569/);
  assert.match(rendered, /\d{2}:\d{2}/);
  assert.equal(formatDiDateTime(null), "ไม่มีข้อมูล");
  assert.equal(formatDiDateTime("not-a-date"), "ไม่มีข้อมูล");
});

test("client writes send confirmActorId only and include credentials", () => {
  const src = read("lib/drug_intelligence/drug_analyst_notes_client.ts");
  assert.match(src, /credentials: "include"/);
  assert.match(src, /confirmActorId: input\.confirmActorId/);
  assert.doesNotMatch(src, /actorName/);
  assert.doesNotMatch(src, /authorName/);
  assert.doesNotMatch(src, /method: "DELETE"/);
});

test("hooks pass confirmActorId from the authenticated client user", () => {
  const src = read("lib/drug_intelligence/drug_analyst_notes_hooks.ts");
  assert.match(src, /confirmActorId/);
  assert.match(src, /createCaseNote/);
  assert.match(src, /createPersonNote/);
  assert.match(src, /updateNote/);
  assert.doesNotMatch(src, /actorName\s*:/);
  assert.doesNotMatch(src, /authorName\s*:/);
});

test("shared panel is used by Case and Person with target mode only", () => {
  const caseSrc = read("app/drug-intelligence/cases/[id]/page.tsx");
  const personSrc = read("app/drug-intelligence/persons/[id]/page.tsx");
  const panel = read("components/drug_intelligence/drug_analyst_notes_panel.tsx");
  assert.match(caseSrc, /DrugAnalystNotesPanel/);
  assert.match(caseSrc, /targetKind="CASE"/);
  assert.match(personSrc, /DrugAnalystNotesPanel/);
  assert.match(personSrc, /targetKind="PERSON"/);
  assert.match(panel, /targetKind: CollaborationTargetKind/);
  assert.match(panel, /di\.collaboration\.emptyCase/);
  assert.match(panel, /di\.collaboration\.emptyPerson/);
  assert.match(panel, /di\.collaboration\.loadError/);
  assert.match(panel, /LoadingState/);
  assert.match(panel, /Pagination/);
  assert.match(panel, /analystNotesListVisibility/);
  assert.match(panel, /saveInFlightRef/);
  assert.match(panel, /can\("drug\.edit"\)/);
  assert.match(panel, /di\.collaboration\.readOnlyHint/);
  assert.match(panel, /di\.profile\.openSurvivor/);
  assert.doesNotMatch(panel, /Delete|ลบ|onDelete/);
  assert.doesNotMatch(panel, /DrugInvestigationTasksPanel/);
  assert.doesNotMatch(caseSrc, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(personSrc, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
});

test("existing Case notes tab remains audit metadata, distinct from analyst notes", () => {
  const caseSrc = read("app/drug-intelligence/cases/[id]/page.tsx");
  assert.match(caseSrc, /di\.workspace\.tabNotes/);
  assert.match(caseSrc, /di\.collaboration\.tabAnalystNotes/);
  assert.match(caseSrc, /function NotesTab/);
});

test("no task UI, search, network, map, timeline, reports, telegram, or AI integration", () => {
  const notesOnly = [
    "components/drug_intelligence/drug_analyst_notes_panel.tsx",
    "components/drug_intelligence/drug_analyst_note_card.tsx",
    "components/drug_intelligence/drug_analyst_note_editor.tsx",
    "lib/drug_intelligence/drug_analyst_notes_client.ts",
    "lib/drug_intelligence/drug_analyst_notes_hooks.ts",
  ];
  for (const file of notesOnly) {
    const src = read(file);
    assert.doesNotMatch(src, /DrugInvestigationTaskService|investigationTaskService|DrugInvestigationTasksPanel/);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
  }
  const pages = ["app/drug-intelligence/cases/[id]/page.tsx", "app/drug-intelligence/persons/[id]/page.tsx"];
  for (const file of pages) {
    const src = read(file);
    assert.doesNotMatch(src, /DrugInvestigationTaskService|investigationTaskService/);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
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
    assert.doesNotMatch(src, /DrugAnalystNotesPanel|drugAnalystNotesClient|useAnalystNotes/);
  }
});

test("no Prisma schema or migration files changed by analyst notes UI source", () => {
  const panel = read("components/drug_intelligence/drug_analyst_notes_panel.tsx");
  assert.doesNotMatch(panel, /prisma|migrate/);
  const client = read("lib/drug_intelligence/drug_analyst_notes_client.ts");
  assert.match(client, /\/drug-intelligence\/cases\//);
  assert.match(client, /\/drug-intelligence\/persons\//);
  assert.match(client, /\/drug-intelligence\/notes\//);
});
