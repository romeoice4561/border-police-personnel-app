/**
 * DI-11E.2.1 — Note-card related-task expansion.
 *
 * Batch related-note-tasks is preview-only. Authoritative pagination is the
 * per-note tasks route. First fetch is always page 1.
 */

import { RELATED_TASKS_CARD_PREVIEW } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import type { InvestigationTaskDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export type RelatedTasksExpandAction = { type: "none" } | { type: "reveal" } | { type: "fetch"; page: number };

export function relatedTasksExpansionContextKey(
  targetKind: string | undefined,
  targetId: string | undefined,
  noteId: string | undefined
): string {
  return `${targetKind ?? ""}:${targetId ?? ""}:${noteId ?? ""}`;
}

export function shouldResetRelatedTasksExpansion(previousKey: string, nextKey: string): boolean {
  return previousKey !== nextKey;
}

export function displayedRelatedTasks(
  previewItems: InvestigationTaskDto[],
  authoritativeItems: InvestigationTaskDto[] | null
): InvestigationTaskDto[] {
  return authoritativeItems ?? previewItems;
}

export function mergeRelatedTaskPreviewWithPage(
  previewItems: InvestigationTaskDto[],
  pageItems: InvestigationTaskDto[]
): InvestigationTaskDto[] {
  void previewItems;
  const seen = new Set<string>();
  const merged: InvestigationTaskDto[] = [];
  for (const item of pageItems) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

export function appendRelatedTaskPage(
  existing: InvestigationTaskDto[],
  nextPage: InvestigationTaskDto[]
): InvestigationTaskDto[] {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of nextPage) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

export function nextRelatedTasksExpandAction(input: {
  previewItems: InvestigationTaskDto[];
  total: number;
  expanded: boolean;
  authoritativePage: number;
  authoritativeItems: InvestigationTaskDto[] | null;
}): RelatedTasksExpandAction {
  if (input.total < 1) return { type: "none" };

  const shown = displayedRelatedTasks(input.previewItems, input.authoritativeItems);
  const complete = shown.length >= input.total;
  const canRevealLocal = !input.expanded && shown.length > RELATED_TASKS_CARD_PREVIEW;

  if (complete) {
    return canRevealLocal ? { type: "reveal" } : { type: "none" };
  }

  if (input.authoritativePage < 1) {
    return { type: "fetch", page: 1 };
  }

  if (canRevealLocal) return { type: "reveal" };
  return { type: "fetch", page: input.authoritativePage + 1 };
}
