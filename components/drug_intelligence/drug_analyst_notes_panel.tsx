/**
 * DI-11C — Analyst Notes panel for Case and Person workspaces.
 *
 * Shared UI: Case/Person supply targetKind + targetId only. Uses DI-11B note
 * APIs. DI-11E.2 reuses the shared Task editor for create-from-note.
 * No factual mutation. No delete. No Task→Note UX.
 */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Plus, StickyNote } from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Pagination } from "@/components/common/pagination";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DrugAnalystNoteCard } from "@/components/drug_intelligence/drug_analyst_note_card";
import { DrugAnalystNoteEditor } from "@/components/drug_intelligence/drug_analyst_note_editor";
import { DrugInvestigationTaskEditor } from "@/components/drug_intelligence/drug_investigation_task_editor";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  useAnalystNotes,
  useCreateAnalystNote,
  useUpdateAnalystNote,
} from "@/lib/drug_intelligence/drug_analyst_notes_hooks";
import { useCreateInvestigationTask, useRelatedNoteTasksBatch } from "@/lib/drug_intelligence/drug_investigation_tasks_hooks";
import {
  classifyInvestigationTasksError,
  draftToCreateFields,
  emptyInvestigationTaskDraft,
  investigationTasksErrorMessageKey,
  validateTaskTitle,
  type InvestigationTaskDraft,
} from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import {
  classifyAnalystNotesError,
  validateNoteBody,
  analystNotesErrorMessageKey,
  analystNotesListVisibility,
  type AnalystNotesErrorKind,
} from "@/lib/drug_intelligence/drug_analyst_notes_view";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationTargetKind } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { AnalystNoteDto } from "@/lib/drug_intelligence/drug_collaboration_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function writeErrorMessage(kind: AnalystNotesErrorKind, t: (key: TranslationKey) => string): string {
  return t(analystNotesErrorMessageKey(kind));
}

export function DrugAnalystNotesPanel({
  targetKind,
  targetId,
}: {
  targetKind: CollaborationTargetKind;
  targetId: string;
}) {
  const { user, can } = useAuth();
  const { t } = useT();
  const canEdit = can("drug.edit");
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [editingNote, setEditingNote] = useState<AnalystNoteDto | null>(null);
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [survivorPersonId, setSurvivorPersonId] = useState<string | null>(null);
  const [creatingFromNote, setCreatingFromNote] = useState<AnalystNoteDto | null>(null);
  const [taskDraft, setTaskDraft] = useState<InvestigationTaskDraft>(emptyInvestigationTaskDraft());
  const [taskSaveError, setTaskSaveError] = useState<string | null>(null);
  const [taskSurvivorPersonId, setTaskSurvivorPersonId] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const taskSaveInFlightRef = useRef(false);

  const notes = useAnalystNotes(targetKind, targetId, page);
  const createNote = useCreateAnalystNote(targetKind, targetId, user?.id ?? null);
  const updateNote = useUpdateAnalystNote(targetKind, targetId, user?.id ?? null);
  const createTask = useCreateInvestigationTask(targetKind, targetId, user?.id ?? null);
  const relatedNoteIds = (notes.data?.items ?? []).map((note) => note.id);
  const relatedTasks = useRelatedNoteTasksBatch(targetKind, targetId, relatedNoteIds);

  const emptyTitle =
    targetKind === "CASE" ? t("di.collaboration.emptyCase") : t("di.collaboration.emptyPerson");

  function openCreate() {
    setEditingNote(null);
    setDraft("");
    setSaveError(null);
    setSurvivorPersonId(null);
    setComposing(true);
  }

  function openEdit(note: AnalystNoteDto) {
    setComposing(false);
    setCreatingFromNote(null);
    setEditingNote(note);
    setDraft(note.body);
    setSaveError(null);
    setSurvivorPersonId(null);
  }

  function openCreateFromNote(note: AnalystNoteDto) {
    setComposing(false);
    setEditingNote(null);
    setCreatingFromNote(note);
    setTaskDraft(emptyInvestigationTaskDraft());
    setTaskSaveError(null);
    setTaskSurvivorPersonId(null);
  }

  function closeTaskEditor() {
    setCreatingFromNote(null);
    setTaskSaveError(null);
    setTaskSurvivorPersonId(null);
    setTaskDraft(emptyInvestigationTaskDraft());
  }

  async function handleCreateTaskFromNote() {
    if (!creatingFromNote || taskSaveInFlightRef.current) return;
    const title = validateTaskTitle(taskDraft.title);
    if (!title.ok) {
      setTaskSaveError(title.reason === "too_long" ? t("di.tasks.titleTooLong") : t("di.tasks.titleRequired"));
      return;
    }
    const fields = draftToCreateFields(taskDraft, creatingFromNote.id);
    if (!fields) {
      setTaskSaveError(t("di.error.validation"));
      return;
    }
    taskSaveInFlightRef.current = true;
    try {
      await createTask.mutateAsync(fields);
      closeTaskEditor();
    } catch (error) {
      const classified = classifyInvestigationTasksError(error, "save");
      setTaskSaveError(t(investigationTasksErrorMessageKey(classified.kind)));
      setTaskSurvivorPersonId(classified.kind === "merged" ? classified.survivorPersonId : null);
    } finally {
      taskSaveInFlightRef.current = false;
    }
  }

  function closeEditor() {
    setComposing(false);
    setEditingNote(null);
    setSaveError(null);
    setSurvivorPersonId(null);
    queueMicrotask(() => {
      document.querySelector<HTMLButtonElement>("[data-testid='analyst-notes-add']")?.focus();
    });
  }

  async function handleSave() {
    if (saveInFlightRef.current) return;
    const parsed = validateNoteBody(draft);
    if (!parsed.ok) {
      setSaveError(parsed.reason === "too_long" ? t("di.collaboration.tooLong") : t("di.error.validation"));
      return;
    }
    saveInFlightRef.current = true;
    try {
      if (editingNote) {
        await updateNote.mutateAsync({ noteId: editingNote.id, body: parsed.body });
        setEditingNote(null);
        setDraft("");
        setSaveError(null);
        setSurvivorPersonId(null);
      } else {
        await createNote.mutateAsync(parsed.body);
        setComposing(false);
        setDraft("");
        setSaveError(null);
        setSurvivorPersonId(null);
        setPage(1);
      }
    } catch (error) {
      const classified = classifyAnalystNotesError(error, "save");
      setSaveError(writeErrorMessage(classified.kind, t));
      setSurvivorPersonId(classified.kind === "merged" ? classified.survivorPersonId : null);
    } finally {
      saveInFlightRef.current = false;
    }
  }

  const meta = notes.data?.meta;
  const items = notes.data?.items ?? [];
  const { showLoading, showError, showEmpty, showList } = analystNotesListVisibility({
    hasData: notes.data != null,
    isPending: notes.isPending,
    isError: notes.isError,
    itemCount: items.length,
    composing,
  });
  const pendingWrite = createNote.isPending || updateNote.isPending;

  return (
    <Card data-testid="analyst-notes-panel" data-target-kind={targetKind}>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.collaboration.sectionTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("di.collaboration.notFactual")}</p>
            {meta ? (
              <p className="mt-1 text-sm text-muted">
                {t("di.collaboration.count").replace("{count}", String(meta.total))}
                {" · "}
                {t("di.collaboration.showingPageSize").replace("{pageSize}", String(meta.pageSize || COLLABORATION_PAGE_DEFAULT))}
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openCreate}
              data-testid="analyst-notes-add"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("di.collaboration.addNote")}
            </Button>
          ) : (
            <p className="text-xs text-muted" data-testid="analyst-notes-readonly">
              {t("di.collaboration.readOnlyHint")}
            </p>
          )}
        </div>

        {creatingFromNote && canEdit ? (
          <div data-testid="investigation-task-editor-from-note" data-source-note-id={creatingFromNote.id}>
            <DrugInvestigationTaskEditor
              mode="create"
              draft={taskDraft}
              onChange={setTaskDraft}
              onSave={() => void handleCreateTaskFromNote()}
              onCancel={closeTaskEditor}
              pending={createTask.isPending}
              saveError={taskSaveError}
              survivorPersonId={taskSurvivorPersonId}
              sourceNote={{ authorName: creatingFromNote.authorName, createdAt: creatingFromNote.createdAt }}
            />
          </div>
        ) : null}

        {composing && canEdit ? (
          <DrugAnalystNoteEditor
            mode="create"
            value={draft}
            onChange={(next) => {
              setDraft(next);
            }}
            onSave={() => void handleSave()}
            onCancel={closeEditor}
            pending={pendingWrite}
            saveError={saveError}
          />
        ) : null}

        {showLoading ? <LoadingState rows={3} /> : null}

        {showError ? (
          <ErrorState
            title={t("di.collaboration.loadError")}
            message={writeErrorMessage(classifyAnalystNotesError(notes.error, "load").kind, t)}
            onRetry={() => void notes.refetch()}
          />
        ) : null}

        {showEmpty ? (
          <EmptyState
            title={emptyTitle}
            icon={<StickyNote className="h-8 w-8" />}
            message={canEdit ? t("di.collaboration.emptyHint") : undefined}
          />
        ) : null}

        {showList && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((note) =>
              editingNote?.id === note.id && canEdit ? (
                <DrugAnalystNoteEditor
                  key={note.id}
                  mode="edit"
                  value={draft}
                  onChange={(next) => {
                    setDraft(next);
                  }}
                  onSave={() => void handleSave()}
                  onCancel={closeEditor}
                  pending={pendingWrite}
                  saveError={saveError}
                />
              ) : (
                <DrugAnalystNoteCard
                  key={note.id}
                  note={note}
                  canEdit={canEdit}
                  onEdit={openEdit}
                  onCreateTask={canEdit ? openCreateFromNote : undefined}
                  relatedTasks={relatedTasks.data?.find((row) => row.sourceNoteId === note.id)?.items ?? []}
                  relatedMeta={relatedTasks.data?.find((row) => row.sourceNoteId === note.id)?.meta ?? null}
                  relatedLoading={relatedNoteIds.length > 0 && relatedTasks.isPending}
                  relatedError={relatedTasks.isError}
                  onRetryRelated={() => void relatedTasks.refetch()}
                />
              )
            )}
          </div>
        ) : null}

        {survivorPersonId ? (
          <p className="text-sm">
            <Link
              href={`/drug-intelligence/persons/${encodeURIComponent(survivorPersonId)}`}
              className="text-accent hover:underline"
              data-testid="analyst-notes-open-survivor"
            >
              {t("di.profile.openSurvivor")}
            </Link>
          </p>
        ) : null}

        {meta && meta.total > 0 ? (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            onPageChange={setPage}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}
