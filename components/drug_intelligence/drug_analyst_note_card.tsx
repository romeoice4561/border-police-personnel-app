/**
 * DI-11C — presentational Analyst Note card.
 *
 * Renders note DTO fields only. Body is plain text (no HTML). No actor IDs,
 * no delete control, no factual Case/Person fields.
 */
"use client";

import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { formatDiDateTime } from "@/lib/drug_intelligence/di_date_helpers";
import { noteWasEdited } from "@/lib/drug_intelligence/drug_analyst_notes_view";
import { DrugAnalystNoteRelatedTasks } from "@/components/drug_intelligence/drug_analyst_note_related_tasks";
import type { AnalystNoteDto, CollaborationPageMeta, InvestigationTaskDto, SourceTaskProvenanceDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export function DrugAnalystNoteCard({
  note,
  canEdit,
  onEdit,
  onCreateTask,
  relatedTasks = [],
  relatedMeta = null,
  relatedLoading = false,
  relatedError = false,
  onRetryRelated,
  sourceTask = null,
}: {
  note: AnalystNoteDto;
  canEdit: boolean;
  onEdit?: (note: AnalystNoteDto) => void;
  onCreateTask?: (note: AnalystNoteDto) => void;
  relatedTasks?: InvestigationTaskDto[];
  relatedMeta?: CollaborationPageMeta | null;
  relatedLoading?: boolean;
  relatedError?: boolean;
  onRetryRelated?: () => void;
  sourceTask?: SourceTaskProvenanceDto | null;
}) {
  const { t } = useT();
  const edited = noteWasEdited(note);

  return (
    <article
      className="rounded-xl border border-dashed border-border/80 bg-neutral-bg/30 p-3 shadow-none"
      data-testid="analyst-note-card"
      data-note-id={note.id}
      data-note-kind="analyst-observation"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
          <StickyNote className="h-3 w-3" aria-hidden="true" />
          {t("di.collaboration.noteTag")}
        </span>
        <p className="text-[11px] text-muted">
          {formatDiDateTime(note.createdAt)} · {note.authorName}
        </p>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{t("di.collaboration.noteTagEn")}</p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">{note.body}</p>
      {note.sourceTaskId ? (
        <p className="mt-2 text-xs text-muted" data-testid="analyst-note-source-task-provenance">
          {t("di.collaboration.sourceTaskProvenance")}
          {sourceTask ? (
            <>
              {" · "}
              {sourceTask.title}
              {" · "}
              {formatDiDateTime(sourceTask.createdAt)}
            </>
          ) : null}
        </p>
      ) : null}
      {edited ? (
        <p className="mt-3 text-xs text-muted">
          {t("di.collaboration.updatedAt")}: {formatDiDateTime(note.updatedAt)}
          {note.updatedByName ? ` · ${t("di.collaboration.updatedBy")} ${note.updatedByName}` : ""}
        </p>
      ) : null}
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit?.(note)} data-testid="analyst-note-edit">
            {t("di.collaboration.editNote")}
          </Button>
          {onCreateTask ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCreateTask(note)}
              data-testid="analyst-note-create-task"
            >
              {t("di.collaboration.createFollowUpTask")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <DrugAnalystNoteRelatedTasks
        items={relatedTasks}
        meta={relatedMeta}
        loading={relatedLoading}
        error={relatedError}
        onRetry={onRetryRelated ?? (() => undefined)}
        targetKind={note.targetKind}
        targetId={note.targetId}
        noteId={note.id}
      />
    </article>
  );
}
