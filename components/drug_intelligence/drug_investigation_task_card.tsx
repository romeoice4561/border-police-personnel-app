/**
 * DI-11D — Investigation Task card.
 *
 * Plain-text title/description. No actor IDs, no delete, no factual fields.
 * Write actions render only when the parent grants canEdit.
 */
"use client";

import { useId, useState } from "react";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DrugInvestigationTaskActions } from "@/components/drug_intelligence/drug_investigation_task_actions";
import { useT } from "@/components/i18n/language_provider";
import { formatDiDate, formatDiDateTime } from "@/lib/drug_intelligence/di_date_helpers";
import { isTaskOverdue, taskShowsCompletedAt } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import { DrugInvestigationTaskStatusBadge } from "@/components/drug_intelligence/drug_investigation_task_status_badge";
import { DrugInvestigationTaskPriorityBadge } from "@/components/drug_intelligence/drug_investigation_task_priority_badge";
import type { DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { InvestigationTaskDto, SourceNoteProvenanceDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export function DrugInvestigationTaskCard({
  task,
  canEdit = false,
  writesLocked = false,
  pending = false,
  actionError = null,
  onEdit,
  onStatus,
  sourceNote = null,
}: {
  task: InvestigationTaskDto;
  canEdit?: boolean;
  writesLocked?: boolean;
  pending?: boolean;
  actionError?: string | null;
  onEdit?: (task: InvestigationTaskDto) => void;
  onStatus?: (task: InvestigationTaskDto, next: DrugInvestigationTaskStatus) => void;
  sourceNote?: SourceNoteProvenanceDto | null;
}) {
  const { t } = useT();
  const descriptionId = useId();
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const overdue = isTaskOverdue({
    dueAt: task.dueAt ? new Date(task.dueAt) : null,
    status: task.status,
  });
  const hasDescription = Boolean(task.description);
  const writeDisabled = writesLocked || pending;

  return (
    <article
      className="rounded-xl border border-border bg-surface p-4"
      data-testid="investigation-task-card"
      data-task-id={task.id}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <ListChecks className="h-3 w-3" aria-hidden="true" />
          {t("di.tasks.noteTag")}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{t("di.tasks.noteTagEn")}</span>
      </div>
      <h3 className="break-words text-sm font-semibold text-foreground">{task.title}</h3>
      {task.sourceNoteId ? (
        <p className="mt-1 text-xs text-muted" data-testid="investigation-task-provenance">
          {t("di.collaboration.sourceNoteProvenance")}
          {sourceNote ? (
            <>
              {" · "}
              {t("di.collaboration.author")} {sourceNote.authorName}
              {" · "}
              {formatDiDateTime(sourceNote.createdAt)}
            </>
          ) : null}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DrugInvestigationTaskStatusBadge status={task.status} />
        <DrugInvestigationTaskPriorityBadge priority={task.priority} />
        {overdue ? <Badge tone="serious">{t("di.tasks.overdue")}</Badge> : null}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <div>
          <dt className="inline">{t("di.tasks.assignee")}: </dt>
          <dd className="inline text-foreground">{task.assignedActorName ?? t("di.tasks.unassigned")}</dd>
        </div>
        <div>
          <dt className="inline">{t("di.tasks.dueAt")}: </dt>
          <dd className="inline text-foreground">{task.dueAt ? formatDiDate(task.dueAt) : t("common.noData")}</dd>
        </div>
        <div>
          <dt className="inline">{t("di.tasks.creator")}: </dt>
          <dd className="inline text-foreground">{task.createdByName}</dd>
        </div>
        <div>
          <dt className="inline">{t("di.tasks.createdAt")}: </dt>
          <dd className="inline text-foreground">{formatDiDateTime(task.createdAt)}</dd>
        </div>
        {taskShowsCompletedAt(task) ? (
          <div>
            <dt className="inline">{t("di.tasks.completedAt")}: </dt>
            <dd className="inline text-foreground">{formatDiDateTime(task.completedAt)}</dd>
          </div>
        ) : null}
      </dl>
      {hasDescription ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={descriptionOpen}
            aria-controls={descriptionId}
            onClick={() => setDescriptionOpen((open) => !open)}
            data-testid="investigation-task-description-toggle"
          >
            {descriptionOpen ? t("di.tasks.hideDescription") : t("di.tasks.showDescription")}
          </Button>
          {descriptionOpen ? (
            <p id={descriptionId} className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
              {task.description}
            </p>
          ) : null}
        </div>
      ) : null}
      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={writeDisabled}
            onClick={() => onEdit?.(task)}
            data-testid="investigation-task-edit"
          >
            {t("di.tasks.editTask")}
          </Button>
          <DrugInvestigationTaskActions
            status={task.status}
            disabled={writeDisabled}
            pending={pending}
            onTransition={(next) => onStatus?.(task, next)}
          />
        </div>
      ) : null}
      {actionError ? (
        <p className="mt-2 text-sm text-critical" role="alert" data-testid="investigation-task-action-error">
          {actionError}
        </p>
      ) : null}
    </article>
  );
}
