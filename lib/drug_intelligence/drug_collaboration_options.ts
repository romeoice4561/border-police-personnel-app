/**
 * DI-11B collaboration constants, transitions, and overdue rules.
 *
 * MVP visibility is GLOBAL among `drug.read` holders — same as current Drug
 * Intelligence case/person read. Not organization-scoped. Not private notes.
 * Writes require `drug.edit`. No unit assignment.
 *
 * Length/page/transition/assignee bounds are the 11B abuse controls.
 * Note/task spam rate limiting is future hardening — no reusable limiter exists.
 */

export const COLLABORATION_PAGE_DEFAULT = 20;
export const COLLABORATION_PAGE_MAX = 50;
/** DI-11E.2: batch related-task read is first-page only. Per-note routes paginate further. */
export const RELATED_NOTE_TASKS_BATCH_MAX_IDS = COLLABORATION_PAGE_DEFAULT;
export const RELATED_NOTE_TASKS_BATCH_RAW_MAX = COLLABORATION_PAGE_MAX;
export const RELATED_NOTE_TASKS_BATCH_MAX_ITEMS = RELATED_NOTE_TASKS_BATCH_MAX_IDS * COLLABORATION_PAGE_DEFAULT;
export const ANALYST_NOTE_BODY_MAX = 5000;
export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 5000;

export const DRUG_INVESTIGATION_TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export type DrugInvestigationTaskStatus = (typeof DRUG_INVESTIGATION_TASK_STATUSES)[number];

export const DRUG_INVESTIGATION_TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type DrugInvestigationTaskPriority = (typeof DRUG_INVESTIGATION_TASK_PRIORITIES)[number];

export const COLLABORATION_TARGET_KINDS = ["CASE", "PERSON"] as const;
export type CollaborationTargetKind = (typeof COLLABORATION_TARGET_KINDS)[number];

const ALLOWED_TRANSITIONS: Record<DrugInvestigationTaskStatus, readonly DrugInvestigationTaskStatus[]> = {
  OPEN: ["IN_PROGRESS", "DONE", "CANCELLED"],
  IN_PROGRESS: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export function isDrugInvestigationTaskStatus(value: string): value is DrugInvestigationTaskStatus {
  return (DRUG_INVESTIGATION_TASK_STATUSES as readonly string[]).includes(value);
}

export function isDrugInvestigationTaskPriority(value: string): value is DrugInvestigationTaskPriority {
  return (DRUG_INVESTIGATION_TASK_PRIORITIES as readonly string[]).includes(value);
}

export function canTransitionTaskStatus(from: DrugInvestigationTaskStatus, to: DrugInvestigationTaskStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isOpenTaskStatus(status: DrugInvestigationTaskStatus): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}

/** Derived — never stored. DONE/CANCELLED are never overdue. */
export function isTaskOverdue(input: { dueAt: Date | null; status: DrugInvestigationTaskStatus; now?: Date }): boolean {
  if (!input.dueAt || !isOpenTaskStatus(input.status)) return false;
  return input.dueAt.getTime() < (input.now ?? new Date()).getTime();
}

export function normalizeCollaborationPage(page?: number, pageSize?: number): { page: number; pageSize: number } {
  const nextPage = Number.isInteger(page) && (page as number) >= 1 ? (page as number) : 1;
  const nextSize =
    !Number.isInteger(pageSize) || (pageSize as number) < 1
      ? COLLABORATION_PAGE_DEFAULT
      : Math.min(pageSize as number, COLLABORATION_PAGE_MAX);
  return { page: nextPage, pageSize: nextSize };
}

export function collaborationTotalPages(total: number, pageSize: number): number {
  if (pageSize < 1) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
