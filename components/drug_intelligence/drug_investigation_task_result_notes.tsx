/**
 * DI-11E.3 — compact related result-note summaries on a Task card.
 * Batch items are preview-only. Expansion loads the per-task page starting at 1.
 * Does not render Note body unless the officer explicitly opens one note.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { formatDiDateTime } from "@/lib/drug_intelligence/di_date_helpers";
import { drugAnalystNotesClient } from "@/lib/drug_intelligence/drug_analyst_notes_client";
import { RELATED_RESULT_NOTES_CARD_PREVIEW } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import {
  appendResultNotePage,
  displayedResultNotes,
  mergeResultNotePreviewWithPage,
  nextResultNotesExpandAction,
  resultNotesExpansionContextKey,
} from "@/lib/drug_intelligence/drug_task_result_notes_view";
import type { CollaborationTargetKind } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationPageMeta, ResultNoteSummaryDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export function DrugInvestigationTaskResultNotes({
  items,
  meta,
  loading,
  error,
  onRetry,
  targetKind,
  targetId,
  taskId,
}: {
  items: ResultNoteSummaryDto[];
  meta: CollaborationPageMeta | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  targetKind?: CollaborationTargetKind;
  targetId?: string;
  taskId?: string;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const [authoritativeItems, setAuthoritativeItems] = useState<ResultNoteSummaryDto[] | null>(null);
  const [authoritativePage, setAuthoritativePage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [openBody, setOpenBody] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);
  const [opening, setOpening] = useState(false);
  const contextKey = resultNotesExpansionContextKey(targetKind, targetId, taskId);
  const [boundKey, setBoundKey] = useState(contextKey);
  if (boundKey !== contextKey) {
    setBoundKey(contextKey);
    setExpanded(false);
    setAuthoritativeItems(null);
    setAuthoritativePage(0);
    setLoadMoreError(false);
    setOpenNoteId(null);
    setOpenBody(null);
    setOpenError(false);
  }

  const allItems = displayedResultNotes(items, authoritativeItems);
  const total = meta?.total ?? allItems.length;
  const pageSize = meta?.pageSize || COLLABORATION_PAGE_DEFAULT;
  const expandAction = nextResultNotesExpandAction({
    previewItems: items,
    total,
    expanded,
    authoritativePage,
    authoritativeItems,
  });

  if (loading && allItems.length === 0 && total === 0) {
    return (
      <p className="mt-3 text-xs text-muted" data-testid="investigation-task-result-notes-loading">
        {t("di.collaboration.relatedResultNotesLoading")}
      </p>
    );
  }
  if (error && allItems.length === 0 && total === 0) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="investigation-task-result-notes-error">
        <p className="text-xs text-critical">{t("di.collaboration.relatedResultNotesError")}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (total === 0) return null;

  const visible = expanded ? allItems : allItems.slice(0, RELATED_RESULT_NOTES_CARD_PREVIEW);
  const canExpand = expandAction.type !== "none";

  async function loadMore() {
    if (expandAction.type === "none" || loadingMore) return;
    if (expandAction.type === "reveal") {
      setExpanded(true);
      return;
    }
    if (!targetKind || !targetId || !taskId) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = expandAction.page;
      const result =
        targetKind === "CASE"
          ? await drugAnalystNotesClient.listCaseTaskNotes(targetId, taskId, page, pageSize)
          : await drugAnalystNotesClient.listPersonTaskNotes(targetId, taskId, page, pageSize);
      setAuthoritativeItems((prev) =>
        page === 1
          ? mergeResultNotePreviewWithPage(items, result.items)
          : appendResultNotePage(prev ?? items, result.items)
      );
      setAuthoritativePage(page);
      setExpanded(true);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleNote(noteId: string) {
    if (openNoteId === noteId) {
      setOpenNoteId(null);
      setOpenBody(null);
      setOpenError(false);
      return;
    }
    setOpening(true);
    setOpenError(false);
    setOpenNoteId(noteId);
    setOpenBody(null);
    try {
      const note = await drugAnalystNotesClient.getNote(noteId);
      setOpenBody(note.body);
    } catch {
      setOpenError(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3" data-testid="investigation-task-result-notes">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {t("di.collaboration.relatedResultNotes")}
      </p>
      <ul className="mt-2 space-y-2">
        {visible.map((note) => (
          <li key={note.id} className="rounded-lg border border-border bg-neutral-bg px-3 py-2" data-testid="investigation-task-result-note">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                {t("di.collaboration.author")} {note.authorName}
              </span>
              <span>{formatDiDateTime(note.createdAt)}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={() => void toggleNote(note.id)}
              disabled={opening && openNoteId === note.id}
              data-testid="investigation-task-result-note-view"
            >
              {openNoteId === note.id ? t("di.collaboration.hideResultNote") : t("di.collaboration.viewResultNote")}
            </Button>
            {openNoteId === note.id && openBody != null ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground" data-testid="investigation-task-result-note-body">
                {openBody}
              </p>
            ) : null}
            {openNoteId === note.id && openError ? (
              <p className="mt-2 text-xs text-critical">{t("di.collaboration.loadError")}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {canExpand ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          data-testid="investigation-task-result-notes-more"
        >
          {t("di.collaboration.relatedTasksMore")}
        </Button>
      ) : null}
      {loadMoreError ? (
        <p className="mt-2 text-xs text-critical">{t("di.collaboration.relatedResultNotesError")}</p>
      ) : null}
    </div>
  );
}
