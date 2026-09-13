/**
 * DI-11D — Investigation Tasks view helpers (no React, no fetch).
 */

import { ApiClientError } from "@/lib/ui/api_client";
import {
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
  canTransitionTaskStatus,
  isTaskOverdue,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import { serializeTaskDueAt, taskDueAtToPickerValue } from "@/lib/drug_intelligence/drug_investigation_task_due_at";
import type {
  DrugInvestigationTaskPriority,
  DrugInvestigationTaskStatus,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import type { InvestigationTaskDto, InvestigationTaskPatchInput } from "@/lib/drug_intelligence/drug_collaboration_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export { isTaskOverdue, TASK_TITLE_MAX, TASK_DESCRIPTION_MAX };
export { serializeTaskDueAt, taskDueAtToPickerValue };

export type InvestigationTasksErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "validation"
  | "load"
  | "save"
  | "network"
  | "mismatch"
  | "merged";

export interface MergedPersonDetails {
  personId: string;
  survivorPersonId: string | null;
}

export interface InvestigationTaskDraft {
  title: string;
  description: string;
  assignedActorId: string;
  priority: DrugInvestigationTaskPriority;
  dueDate: string;
}

export function emptyInvestigationTaskDraft(): InvestigationTaskDraft {
  return { title: "", description: "", assignedActorId: "", priority: "NORMAL", dueDate: "" };
}

export function draftFromInvestigationTask(task: InvestigationTaskDto): InvestigationTaskDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    assignedActorId: task.assignedActorId ?? "",
    priority: task.priority,
    dueDate: taskDueAtToPickerValue(task.dueAt),
  };
}

export function validateTaskTitle(
  raw: string,
  max = TASK_TITLE_MAX
): { ok: true; title: string } | { ok: false; reason: "empty" | "too_long"; length: number } {
  const title = raw.trim();
  if (!title) return { ok: false, reason: "empty", length: 0 };
  if (title.length > max) return { ok: false, reason: "too_long", length: title.length };
  return { ok: true, title };
}

export function validateTaskDescription(
  raw: string,
  max = TASK_DESCRIPTION_MAX
): { ok: true; description: string | null } | { ok: false; reason: "too_long"; length: number } {
  const description = raw.trim();
  if (description.length > max) return { ok: false, reason: "too_long", length: description.length };
  return { ok: true, description: description.length === 0 ? null : description };
}

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

export function legalTaskStatusTransitions(status: DrugInvestigationTaskStatus): DrugInvestigationTaskStatus[] {
  return (["IN_PROGRESS", "DONE", "CANCELLED"] as const).filter(
    (next) => next !== status && canTransitionTaskStatus(status, next)
  );
}

export function parseMergedPersonDetails(details: unknown): MergedPersonDetails | null {
  if (!details || typeof details !== "object") return null;
  const rec = details as Record<string, unknown>;
  if (typeof rec.personId !== "string" || rec.personId.trim() === "") return null;
  const survivor = rec.survivorPersonId;
  return {
    personId: rec.personId,
    survivorPersonId: typeof survivor === "string" && survivor.trim() !== "" ? survivor : null,
  };
}

export function classifyInvestigationTasksError(
  error: unknown,
  mode: "load" | "save" = "load"
): { kind: InvestigationTasksErrorKind; survivorPersonId: string | null } {
  if (!(error instanceof ApiClientError)) {
    return { kind: mode === "load" ? "load" : "save", survivorPersonId: null };
  }
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return { kind: "network", survivorPersonId: null };
  }
  if (error.status === 401 || error.code === "UNAUTHENTICATED") {
    return { kind: "unauthenticated", survivorPersonId: null };
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return { kind: "forbidden", survivorPersonId: null };
  }
  if (error.status === 400 || error.code === "BAD_REQUEST") {
    return { kind: "validation", survivorPersonId: null };
  }
  if (error.status === 409 || error.code === "CONFLICT") {
    const merged = parseMergedPersonDetails(error.details);
    if (merged) return { kind: "merged", survivorPersonId: merged.survivorPersonId };
    return { kind: "mismatch", survivorPersonId: null };
  }
  return { kind: mode === "load" ? "load" : "save", survivorPersonId: null };
}

export function investigationTasksErrorMessageKey(kind: InvestigationTasksErrorKind): TranslationKey {
  if (kind === "mismatch") return "di.tasks.actorMismatch";
  if (kind === "merged") return "di.tasks.mergedPerson";
  if (kind === "unauthenticated") return "di.collaboration.unauthenticated";
  if (kind === "forbidden") return "di.error.permissionDenied";
  if (kind === "validation") return "di.error.validation";
  if (kind === "save") return "di.tasks.saveError";
  return "di.tasks.loadError";
}

/** Failure must never look like empty; page-change placeholders must keep the list. */
export function investigationTasksListVisibility(input: {
  hasData: boolean;
  isPending: boolean;
  isError: boolean;
  itemCount: number;
  composing?: boolean;
}): { showLoading: boolean; showError: boolean; showEmpty: boolean; showList: boolean } {
  return {
    showLoading: input.isPending && !input.hasData,
    showError: input.isError,
    showEmpty: input.hasData && !input.isError && input.itemCount === 0 && !input.composing,
    showList: input.hasData && input.itemCount > 0,
  };
}

export function taskIsDone(task: Pick<InvestigationTaskDto, "status">): boolean {
  return task.status === "DONE";
}

export function taskShowsCompletedAt(task: Pick<InvestigationTaskDto, "status" | "completedAt">): boolean {
  return task.status === "DONE" && task.completedAt != null;
}

export function buildDirtyTaskPatch(
  original: InvestigationTaskDto,
  draft: InvestigationTaskDraft
): InvestigationTaskPatchInput | null {
  const title = validateTaskTitle(draft.title);
  const description = validateTaskDescription(draft.description);
  if (!title.ok || !description.ok) return null;

  const patch: InvestigationTaskPatchInput = {};
  if (title.title !== original.title) patch.title = title.title;

  const nextDescription = description.description;
  const originalDescription = original.description ?? null;
  if (nextDescription !== originalDescription) patch.description = nextDescription;

  const nextAssignee = draft.assignedActorId.trim() || null;
  if (nextAssignee !== (original.assignedActorId ?? null)) patch.assignedActorId = nextAssignee;

  if (draft.priority !== original.priority) patch.priority = draft.priority;

  const nextDue = serializeTaskDueAt(draft.dueDate);
  const originalDueDay = taskDueAtToPickerValue(original.dueAt);
  if ((draft.dueDate || "") !== originalDueDay) patch.dueAt = nextDue ? new Date(nextDue) : null;

  return Object.keys(patch).length === 0 ? null : patch;
}

export function draftToCreateFields(
  draft: InvestigationTaskDraft,
  sourceNoteId?: string | null
): {
  title: string;
  description: string | null;
  assignedActorId: string | null;
  dueAt: string | null;
  priority: DrugInvestigationTaskPriority;
  sourceNoteId?: string;
} | null {
  const title = validateTaskTitle(draft.title);
  const description = validateTaskDescription(draft.description);
  if (!title.ok || !description.ok) return null;
  const fields: {
    title: string;
    description: string | null;
    assignedActorId: string | null;
    dueAt: string | null;
    priority: DrugInvestigationTaskPriority;
    sourceNoteId?: string;
  } = {
    title: title.title,
    description: description.description,
    assignedActorId: draft.assignedActorId.trim() || null,
    dueAt: serializeTaskDueAt(draft.dueDate),
    priority: draft.priority,
  };
  if (sourceNoteId) fields.sourceNoteId = sourceNoteId;
  return fields;
}

export const RELATED_TASKS_CARD_PREVIEW = 5;
