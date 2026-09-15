/**
 * DI-11E.2 — compact related-task list on an Analyst Note card.
 * Batch items are preview-only. Expansion loads the per-note page starting at 1.
 * Does not render Note body or Task description.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import { DrugInvestigationTaskStatusBadge } from "@/components/drug_intelligence/drug_investigation_task_status_badge";
import { DrugInvestigationTaskPriorityBadge } from "@/components/drug_intelligence/drug_investigation_task_priority_badge";
import { drugInvestigationTasksClient } from "@/lib/drug_intelligence/drug_investigation_tasks_client";
import { RELATED_TASKS_CARD_PREVIEW } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import { COLLABORATION_PAGE_DEFAULT } from "@/lib/drug_intelligence/drug_collaboration_options";
import {
  appendRelatedTaskPage,
  displayedRelatedTasks,
  mergeRelatedTaskPreviewWithPage,
  nextRelatedTasksExpandAction,
  relatedTasksExpansionContextKey,
} from "@/lib/drug_intelligence/drug_note_related_tasks_view";
import type { CollaborationTargetKind } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationPageMeta, InvestigationTaskDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export function DrugAnalystNoteRelatedTasks({
  items,
  meta,
  loading,
  error,
  onRetry,
  targetKind,
  targetId,
  noteId,
}: {
  items: InvestigationTaskDto[];
  meta: CollaborationPageMeta | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  targetKind?: CollaborationTargetKind;
  targetId?: string;
  noteId?: string;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const [authoritativeItems, setAuthoritativeItems] = useState<InvestigationTaskDto[] | null>(null);
  const [authoritativePage, setAuthoritativePage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const contextKey = relatedTasksExpansionContextKey(targetKind, targetId, noteId);
  const [boundKey, setBoundKey] = useState(contextKey);
  if (boundKey !== contextKey) {
    setBoundKey(contextKey);
    setExpanded(false);
    setAuthoritativeItems(null);
    setAuthoritativePage(0);
    setLoadMoreError(false);
  }

  const allItems = displayedRelatedTasks(items, authoritativeItems);
  const total = meta?.total ?? allItems.length;
  const pageSize = meta?.pageSize || COLLABORATION_PAGE_DEFAULT;
  const expandAction = nextRelatedTasksExpandAction({
    previewItems: items,
    total,
    expanded,
    authoritativePage,
    authoritativeItems,
  });

  if (loading && allItems.length === 0 && total === 0) {
    return (
      <p className="mt-3 text-xs text-muted" data-testid="analyst-note-related-loading">
        {t("di.collaboration.relatedTasksLoading")}
      </p>
    );
  }
  if (error && allItems.length === 0 && total === 0) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="analyst-note-related-error">
        <p className="text-xs text-critical">{t("di.collaboration.relatedTasksError")}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (total === 0) return null;

  const visible = expanded ? allItems : allItems.slice(0, RELATED_TASKS_CARD_PREVIEW);
  const canExpand = expandAction.type !== "none";

  async function loadMore() {
    if (expandAction.type === "none" || loadingMore) return;
    if (expandAction.type === "reveal") {
      setExpanded(true);
      return;
    }
    if (!targetKind || !targetId || !noteId) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = expandAction.page;
      const result =
        targetKind === "CASE"
          ? await drugInvestigationTasksClient.listCaseNoteTasks(targetId, noteId, page, pageSize)
          : await drugInvestigationTasksClient.listPersonNoteTasks(targetId, noteId, page, pageSize);
      setAuthoritativeItems((prev) =>
        page === 1
          ? mergeRelatedTaskPreviewWithPage(items, result.items)
          : appendRelatedTaskPage(prev ?? items, result.items)
      );
      setAuthoritativePage(page);
      setExpanded(true);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3" data-testid="analyst-note-related-tasks">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("di.collaboration.relatedTasks")}</p>
      <ul className="mt-2 space-y-2">
        {visible.map((task) => (
          <li key={task.id} className="rounded-lg border border-border bg-neutral-bg px-3 py-2" data-testid="analyst-note-related-task">
            <p className="break-words text-sm text-foreground">{task.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <DrugInvestigationTaskStatusBadge status={task.status} />
              <DrugInvestigationTaskPriorityBadge priority={task.priority} />
              <span>{task.assignedActorName ?? t("di.tasks.unassigned")}</span>
              <span>{task.dueAt ? formatDiDate(task.dueAt) : t("common.noData")}</span>
            </div>
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
          data-testid="analyst-note-related-more"
        >
          {t("di.collaboration.relatedTasksMore")}
        </Button>
      ) : null}
      {loadMoreError ? (
        <p className="mt-2 text-xs text-critical">{t("di.collaboration.relatedTasksError")}</p>
      ) : null}
    </div>
  );
}
