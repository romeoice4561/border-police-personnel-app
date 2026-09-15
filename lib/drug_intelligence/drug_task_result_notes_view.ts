/**
 * DI-11E.3 — Task-card result-note expansion.
 *
 * Batch related-task-notes is preview-only. Authoritative pagination is the
 * per-task notes route. First fetch is always page 1.
 */

import { RELATED_RESULT_NOTES_CARD_PREVIEW } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import type { ResultNoteSummaryDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export type ResultNotesExpandAction = { type: "none" } | { type: "reveal" } | { type: "fetch"; page: number };

export function resultNotesExpansionContextKey(
  targetKind: string | undefined,
  targetId: string | undefined,
  taskId: string | undefined
): string {
  return `${targetKind ?? ""}:${targetId ?? ""}:${taskId ?? ""}`;
}

export function shouldResetResultNotesExpansion(previousKey: string, nextKey: string): boolean {
  return previousKey !== nextKey;
}

export function displayedResultNotes(
  previewItems: ResultNoteSummaryDto[],
  authoritativeItems: ResultNoteSummaryDto[] | null
): ResultNoteSummaryDto[] {
  return authoritativeItems ?? previewItems;
}

export function mergeResultNotePreviewWithPage(
  previewItems: ResultNoteSummaryDto[],
  pageItems: ResultNoteSummaryDto[]
): ResultNoteSummaryDto[] {
  void previewItems;
  const seen = new Set<string>();
  const merged: ResultNoteSummaryDto[] = [];
  for (const item of pageItems) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

export function appendResultNotePage(
  existing: ResultNoteSummaryDto[],
  nextPage: ResultNoteSummaryDto[]
): ResultNoteSummaryDto[] {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of nextPage) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

export function nextResultNotesExpandAction(input: {
  previewItems: ResultNoteSummaryDto[];
  total: number;
  expanded: boolean;
  authoritativePage: number;
  authoritativeItems: ResultNoteSummaryDto[] | null;
}): ResultNotesExpandAction {
  if (input.total < 1) return { type: "none" };

  const shown = displayedResultNotes(input.previewItems, input.authoritativeItems);
  const complete = shown.length >= input.total;
  const canRevealLocal = !input.expanded && shown.length > RELATED_RESULT_NOTES_CARD_PREVIEW;

  if (complete) {
    return canRevealLocal ? { type: "reveal" } : { type: "none" };
  }

  if (input.authoritativePage < 1) {
    return { type: "fetch", page: 1 };
  }

  if (canRevealLocal) return { type: "reveal" };
  return { type: "fetch", page: input.authoritativePage + 1 };
}
