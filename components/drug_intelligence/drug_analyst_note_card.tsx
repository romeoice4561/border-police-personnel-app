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
import type { AnalystNoteDto, CollaborationPageMeta, InvestigationTaskDto } from "@/lib/drug_intelligence/drug_collaboration_types";

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
}) {
  const { t } = useT();
  const edited = noteWasEdited(note);

  return (
    <article
      className="rounded-xl border border-border bg-surface p-4"
      data-testid="analyst-note-card"
      data-note-id={note.id}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <StickyNote className="h-3 w-3" aria-hidden="true" />
          {t("di.collaboration.noteTag")}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{t("di.collaboration.noteTagEn")}</span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.body}</p>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <div>
          <dt className="inline">{t("di.collaboration.author")}: </dt>
          <dd className="inline text-foreground">{note.authorName}</dd>
        </div>
        <div>
          <dt className="inline">{t("di.collaboration.createdAt")}: </dt>
          <dd className="inline text-foreground">{formatDiDateTime(note.createdAt)}</dd>
        </div>
        {edited ? (
          <div>
            <dt className="inline">{t("di.collaboration.updatedAt")}: </dt>
            <dd className="inline text-foreground">
              {formatDiDateTime(note.updatedAt)}
              {note.updatedByName ? ` · ${t("di.collaboration.updatedBy")} ${note.updatedByName}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
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
