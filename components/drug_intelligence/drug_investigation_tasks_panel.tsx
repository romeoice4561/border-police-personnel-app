/**
 * DI-11D — Investigation Tasks panel for Case and Person.
 *
 * Shared UI: Case/Person supply targetKind + targetId only.
 * Writes require drug.edit. No delete. No factual mutation.
 */
"use client";

import { useRef, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Pagination } from "@/components/common/pagination";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DrugInvestigationTaskCard } from "@/components/drug_intelligence/drug_investigation_task_card";
import { DrugInvestigationTaskEditor } from "@/components/drug_intelligence/drug_investigation_task_editor";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  useCreateInvestigationTask,
  useInvestigationTasks,
  useUpdateInvestigationTask,
} from "@/lib/drug_intelligence/drug_investigation_tasks_hooks";
import { useCreateAnalystNote, useRelatedTaskNotesBatch } from "@/lib/drug_intelligence/drug_analyst_notes_hooks";
import {
  buildDirtyTaskPatch,
  classifyInvestigationTasksError,
  draftFromInvestigationTask,
  draftToCreateFields,
  emptyInvestigationTaskDraft,
  investigationTasksErrorMessageKey,
  investigationTasksListVisibility,
  validateTaskTitle,
  type InvestigationTaskDraft,
} from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import {
  classifyAnalystNotesError,
  validateNoteBody,
  analystNotesErrorMessageKey,
} from "@/lib/drug_intelligence/drug_analyst_notes_view";
import { DrugAnalystNoteEditor } from "@/components/drug_intelligence/drug_analyst_note_editor";
import { COLLABORATION_PAGE_DEFAULT, DRUG_INVESTIGATION_TASK_STATUSES } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationTargetKind, DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { InvestigationTaskDto, SourceNoteProvenanceDto } from "@/lib/drug_intelligence/drug_collaboration_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const STATUS_LABEL: Record<DrugInvestigationTaskStatus, TranslationKey> = {
  OPEN: "di.tasks.statusOpen",
  IN_PROGRESS: "di.tasks.statusInProgress",
  DONE: "di.tasks.statusDone",
  CANCELLED: "di.tasks.statusCancelled",
};

export function DrugInvestigationTasksPanel({
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
  const [status, setStatus] = useState<DrugInvestigationTaskStatus | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [composing, setComposing] = useState(false);
  const [editingTask, setEditingTask] = useState<InvestigationTaskDto | null>(null);
  const [draft, setDraft] = useState<InvestigationTaskDraft>(emptyInvestigationTaskDraft());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [survivorPersonId, setSurvivorPersonId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ taskId: string; message: string } | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [creatingFromTask, setCreatingFromTask] = useState<InvestigationTaskDto | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  const [noteSurvivorPersonId, setNoteSurvivorPersonId] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const noteSaveInFlightRef = useRef(false);

  const tasks = useInvestigationTasks(targetKind, targetId, { page, status, overdueOnly });
  const createTask = useCreateInvestigationTask(targetKind, targetId, user?.id ?? null);
  const updateTask = useUpdateInvestigationTask(targetKind, targetId, user?.id ?? null);
  const createNote = useCreateAnalystNote(targetKind, targetId, user?.id ?? null);
  const relatedTaskIds = (tasks.data?.items ?? []).map((task) => task.id);
  const relatedResultNotes = useRelatedTaskNotesBatch(targetKind, targetId, relatedTaskIds);

  const emptyTitle = targetKind === "CASE" ? t("di.tasks.emptyCase") : t("di.tasks.emptyPerson");
  const meta = tasks.data?.meta;
  const items = tasks.data?.items ?? [];
  const sourceNotesById = new Map(
    (tasks.data?.sourceNotes ?? []).map((note: SourceNoteProvenanceDto) => [note.id, note])
  );
  const { showLoading, showError, showEmpty, showList } = investigationTasksListVisibility({
    hasData: tasks.data != null,
    isPending: tasks.isPending,
    isError: tasks.isError,
    itemCount: items.length,
    composing,
  });
  const writesLocked = tasks.isFetching && tasks.data != null;
  const pendingWrite = createTask.isPending || updateTask.isPending || createNote.isPending;

  function openCreate() {
    setEditingTask(null);
    setCreatingFromTask(null);
    setDraft(emptyInvestigationTaskDraft());
    setSaveError(null);
    setSurvivorPersonId(null);
    setComposing(true);
  }

  function openEdit(task: InvestigationTaskDto) {
    setComposing(false);
    setCreatingFromTask(null);
    setEditingTask(task);
    setDraft(draftFromInvestigationTask(task));
    setSaveError(null);
    setSurvivorPersonId(null);
  }

  function openCreateFromTask(task: InvestigationTaskDto) {
    setComposing(false);
    setEditingTask(null);
    setCreatingFromTask(task);
    setNoteDraft("");
    setNoteSaveError(null);
    setNoteSurvivorPersonId(null);
  }

  function closeNoteEditor() {
    setCreatingFromTask(null);
    setNoteDraft("");
    setNoteSaveError(null);
    setNoteSurvivorPersonId(null);
  }

  function closeEditor() {
    setComposing(false);
    setEditingTask(null);
    setSaveError(null);
    setSurvivorPersonId(null);
  }

  async function handleSave() {
    if (saveInFlightRef.current) return;
    const title = validateTaskTitle(draft.title);
    if (!title.ok) {
      setSaveError(title.reason === "too_long" ? t("di.tasks.titleTooLong") : t("di.tasks.titleRequired"));
      return;
    }
    saveInFlightRef.current = true;
    try {
      if (editingTask) {
        const patch = buildDirtyTaskPatch(editingTask, draft);
        if (!patch) {
          closeEditor();
          return;
        }
        await updateTask.mutateAsync({ taskId: editingTask.id, patch });
        closeEditor();
      } else {
        const fields = draftToCreateFields(draft);
        if (!fields) {
          setSaveError(t("di.error.validation"));
          return;
        }
        await createTask.mutateAsync(fields);
        setComposing(false);
        setDraft(emptyInvestigationTaskDraft());
        setSaveError(null);
        setSurvivorPersonId(null);
        setPage(1);
      }
    } catch (error) {
      const classified = classifyInvestigationTasksError(error, "save");
      setSaveError(t(investigationTasksErrorMessageKey(classified.kind)));
      setSurvivorPersonId(classified.kind === "merged" ? classified.survivorPersonId : null);
    } finally {
      saveInFlightRef.current = false;
    }
  }

  async function handleStatus(task: InvestigationTaskDto, next: DrugInvestigationTaskStatus) {
    if (saveInFlightRef.current || pendingTaskId) return;
    saveInFlightRef.current = true;
    setPendingTaskId(task.id);
    setActionError(null);
    try {
      await updateTask.mutateAsync({ taskId: task.id, patch: { status: next } });
    } catch (error) {
      const classified = classifyInvestigationTasksError(error, "save");
      setActionError({ taskId: task.id, message: t(investigationTasksErrorMessageKey(classified.kind)) });
    } finally {
      saveInFlightRef.current = false;
      setPendingTaskId(null);
    }
  }

  async function handleCreateNoteFromTask() {
    if (!creatingFromTask || noteSaveInFlightRef.current) return;
    const parsed = validateNoteBody(noteDraft);
    if (!parsed.ok) {
      setNoteSaveError(parsed.reason === "too_long" ? t("di.collaboration.tooLong") : t("di.error.validation"));
      return;
    }
    noteSaveInFlightRef.current = true;
    try {
      await createNote.mutateAsync({ body: parsed.body, sourceTaskId: creatingFromTask.id });
      closeNoteEditor();
    } catch (error) {
      const classified = classifyAnalystNotesError(error, "save");
      setNoteSaveError(t(analystNotesErrorMessageKey(classified.kind)));
      setNoteSurvivorPersonId(classified.kind === "merged" ? classified.survivorPersonId : null);
    } finally {
      noteSaveInFlightRef.current = false;
    }
  }

  return (
    <Card data-testid="investigation-tasks-panel" data-target-kind={targetKind}>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.tasks.sectionTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("di.tasks.notFactual")}</p>
            {meta ? (
              <p className="mt-1 text-sm text-muted">
                {t("di.tasks.count").replace("{count}", String(meta.total))}
                {" · "}
                {t("di.tasks.showingPageSize").replace("{pageSize}", String(meta.pageSize || COLLABORATION_PAGE_DEFAULT))}
              </p>
            ) : null}
            {writesLocked ? <p className="mt-1 text-xs text-muted">{t("di.tasks.updating")}</p> : null}
          </div>
          {canEdit ? (
            <Button type="button" variant="ghost" size="sm" onClick={openCreate} data-testid="investigation-tasks-add">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("di.tasks.addTask")}
            </Button>
          ) : (
            <p className="text-xs text-muted" data-testid="investigation-tasks-readonly">
              {t("di.tasks.readOnlyHint")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1 space-y-1 text-xs text-muted">
            <span>{t("di.tasks.status")}</span>
            <Select
              value={status}
              disabled={overdueOnly}
              onChange={(event) => {
                setStatus(event.target.value as DrugInvestigationTaskStatus | "");
                setPage(1);
              }}
              placeholder={t("di.tasks.statusAll")}
              options={DRUG_INVESTIGATION_TASK_STATUSES.map((value) => ({
                value,
                label: t(STATUS_LABEL[value]),
              }))}
              data-testid="investigation-tasks-status-filter"
              aria-label={t("di.tasks.status")}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              checked={overdueOnly}
              onChange={(event) => {
                setOverdueOnly(event.target.checked);
                setPage(1);
              }}
              data-testid="investigation-tasks-overdue-filter"
            />
            {t("di.tasks.overdueOnly")}
          </label>
        </div>

        {creatingFromTask && canEdit ? (
          <div data-testid="analyst-note-editor-from-task" data-source-task-id={creatingFromTask.id}>
            <DrugAnalystNoteEditor
              mode="create"
              value={noteDraft}
              onChange={setNoteDraft}
              onSave={() => void handleCreateNoteFromTask()}
              onCancel={closeNoteEditor}
              pending={createNote.isPending}
              saveError={noteSaveError}
              sourceTask={{ title: creatingFromTask.title, createdAt: creatingFromTask.createdAt }}
            />
            {noteSurvivorPersonId ? (
              <p className="mt-2 text-sm text-critical">{t("di.collaboration.mergedPerson")}</p>
            ) : null}
          </div>
        ) : null}

        {composing && canEdit ? (
          <DrugInvestigationTaskEditor
            mode="create"
            draft={draft}
            onChange={setDraft}
            onSave={() => void handleSave()}
            onCancel={closeEditor}
            pending={pendingWrite}
            saveError={saveError}
            survivorPersonId={survivorPersonId}
          />
        ) : null}

        {showLoading ? <LoadingState rows={3} /> : null}

        {showError ? (
          <ErrorState
            title={t("di.tasks.loadError")}
            message={t(investigationTasksErrorMessageKey(classifyInvestigationTasksError(tasks.error).kind))}
            onRetry={() => void tasks.refetch()}
          />
        ) : null}

        {showEmpty ? (
          <EmptyState title={emptyTitle} icon={<ListChecks className="h-8 w-8" />} message={canEdit ? t("di.tasks.emptyHint") : undefined} />
        ) : null}

        {showList ? (
          <div className="space-y-3">
            {items.map((task) =>
              editingTask?.id === task.id && canEdit ? (
                <DrugInvestigationTaskEditor
                  key={task.id}
                  mode="edit"
                  draft={draft}
                  onChange={setDraft}
                  onSave={() => void handleSave()}
                  onCancel={closeEditor}
                  pending={pendingWrite}
                  saveError={saveError}
                  saveDisabled={!buildDirtyTaskPatch(task, draft)}
                  survivorPersonId={survivorPersonId}
                  fallbackAssigneeLabel={task.assignedActorName}
                />
              ) : (
                <DrugInvestigationTaskCard
                  key={task.id}
                  task={task}
                  canEdit={canEdit}
                  writesLocked={writesLocked}
                  pending={pendingTaskId === task.id}
                  actionError={actionError?.taskId === task.id ? actionError.message : null}
                  onEdit={openEdit}
                  onStatus={handleStatus}
                  onCreateResultNote={canEdit ? openCreateFromTask : undefined}
                  sourceNote={task.sourceNoteId ? sourceNotesById.get(task.sourceNoteId) ?? null : null}
                  relatedResultNotes={relatedResultNotes.data?.find((row) => row.sourceTaskId === task.id)?.items ?? []}
                  relatedResultMeta={relatedResultNotes.data?.find((row) => row.sourceTaskId === task.id)?.meta ?? null}
                  relatedResultLoading={relatedTaskIds.length > 0 && relatedResultNotes.isPending}
                  relatedResultError={relatedResultNotes.isError}
                  onRetryRelatedResults={() => void relatedResultNotes.refetch()}
                />
              )
            )}
          </div>
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
