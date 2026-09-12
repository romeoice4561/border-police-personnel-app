/**
 * DI-11D.1 — pure Investigation Tasks view helpers (no React, no fetch).
 */

import { ApiClientError } from "@/lib/ui/api_client";
import { isTaskOverdue } from "@/lib/drug_intelligence/drug_collaboration_options";
import type {
  DrugInvestigationTaskPriority,
  DrugInvestigationTaskStatus,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import type { InvestigationTaskDto } from "@/lib/drug_intelligence/drug_collaboration_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export { isTaskOverdue };

export type InvestigationTasksErrorKind = "unauthenticated" | "forbidden" | "validation" | "load" | "network";

export function investigationTaskStatusLabelKey(status: DrugInvestigationTaskStatus): TranslationKey {
  if (status === "IN_PROGRESS") return "di.tasks.statusInProgress";
  if (status === "DONE") return "di.tasks.statusDone";
  if (status === "CANCELLED") return "di.tasks.statusCancelled";
  return "di.tasks.statusOpen";
}

export function investigationTaskPriorityLabelKey(priority: DrugInvestigationTaskPriority): TranslationKey {
  if (priority === "LOW") return "di.tasks.priorityLow";
  if (priority === "HIGH") return "di.tasks.priorityHigh";
  if (priority === "URGENT") return "di.tasks.priorityUrgent";
  return "di.tasks.priorityNormal";
}

export function classifyInvestigationTasksError(error: unknown): InvestigationTasksErrorKind {
  if (!(error instanceof ApiClientError)) return "load";
  if (error.status === 0 || error.code === "NETWORK_ERROR") return "network";
  if (error.status === 401 || error.code === "UNAUTHENTICATED") return "unauthenticated";
  if (error.status === 403 || error.code === "FORBIDDEN") return "forbidden";
  if (error.status === 400 || error.code === "BAD_REQUEST") return "validation";
  return "load";
}

export function investigationTasksErrorMessageKey(kind: InvestigationTasksErrorKind): TranslationKey {
  if (kind === "unauthenticated") return "di.collaboration.unauthenticated";
  if (kind === "forbidden") return "di.error.permissionDenied";
  if (kind === "validation") return "di.error.validation";
  return "di.tasks.loadError";
}

/** Failure must never look like empty; page-change placeholders keep the list. */
export function investigationTasksListVisibility(input: {
  hasData: boolean;
  isPending: boolean;
  isError: boolean;
  itemCount: number;
}): { showLoading: boolean; showError: boolean; showEmpty: boolean; showList: boolean } {
  return {
    showLoading: input.isPending && !input.hasData,
    showError: input.isError,
    showEmpty: input.hasData && !input.isError && input.itemCount === 0,
    showList: input.hasData && input.itemCount > 0,
  };
}

export function taskIsDone(task: Pick<InvestigationTaskDto, "status">): boolean {
  return task.status === "DONE";
}

export function taskShowsCompletedAt(task: Pick<InvestigationTaskDto, "status" | "completedAt">): boolean {
  return task.status === "DONE" && task.completedAt != null;
}
