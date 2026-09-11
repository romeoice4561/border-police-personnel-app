/**
 * DI-11B collaboration domain types.
 *
 * FACT ≠ ANALYST_NOTE ≠ TASK. DTOs expose semantic kind for future UI/AI.
 * Targets are CASE or PERSON only. No factual intelligence is copied here.
 */

import type {
  CollaborationTargetKind,
  DrugInvestigationTaskPriority,
  DrugInvestigationTaskStatus,
} from "@/lib/drug_intelligence/drug_collaboration_options";

export class CollaborationTargetNotFoundError extends Error {
  constructor(kind: CollaborationTargetKind, id: string) {
    super(`${kind} not found: ${id}`);
    this.name = "CollaborationTargetNotFoundError";
  }
}

export class CollaborationPersonMergedError extends Error {
  constructor(
    public readonly personId: string,
    public readonly survivorPersonId: string | null
  ) {
    super("Cannot create collaboration on a MERGED person");
    this.name = "CollaborationPersonMergedError";
  }
}

export class CollaborationNotFoundError extends Error {
  constructor(kind: "NOTE" | "TASK", id: string) {
    super(`${kind} not found: ${id}`);
    this.name = "CollaborationNotFoundError";
  }
}

export class CollaborationInvalidTransitionError extends Error {
  constructor(
    public readonly from: DrugInvestigationTaskStatus,
    public readonly to: DrugInvestigationTaskStatus
  ) {
    super(`Invalid task status transition ${from} → ${to}`);
    this.name = "CollaborationInvalidTransitionError";
  }
}

export class CollaborationInvalidAssigneeError extends Error {
  constructor(message = "Assignee is not an assignable Drug Intelligence actor") {
    super(message);
    this.name = "CollaborationInvalidAssigneeError";
  }
}

export class CollaborationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollaborationValidationError";
  }
}

export interface CollaborationActor {
  actorId: string;
  actorName: string;
}

export interface CollaborationPageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AnalystNoteDto {
  kind: "ANALYST_NOTE";
  id: string;
  body: string;
  targetKind: CollaborationTargetKind;
  targetId: string;
  authorActorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  updatedByActorId: string | null;
  updatedByName: string | null;
}

export interface InvestigationTaskDto {
  kind: "TASK";
  id: string;
  title: string;
  description: string | null;
  targetKind: CollaborationTargetKind;
  targetId: string;
  assignedActorId: string | null;
  assignedActorName: string | null;
  dueAt: string | null;
  priority: DrugInvestigationTaskPriority;
  status: DrugInvestigationTaskStatus;
  createdByActorId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  updatedByActorId: string | null;
  updatedByName: string | null;
  completedAt: string | null;
  isOverdue: boolean;
}

export interface AnalystNoteCreateInput {
  body: string;
}

export interface AnalystNoteUpdateInput {
  body: string;
}

export interface InvestigationTaskCreateInput {
  title: string;
  description?: string | null;
  assignedActorId?: string | null;
  dueAt?: Date | null;
  priority?: DrugInvestigationTaskPriority;
}

export interface InvestigationTaskPatchInput {
  title?: string;
  description?: string | null;
  assignedActorId?: string | null;
  dueAt?: Date | null;
  priority?: DrugInvestigationTaskPriority;
  status?: DrugInvestigationTaskStatus;
}

export interface CollaborationListQuery {
  page?: number;
  pageSize?: number;
}

export interface InvestigationTaskListQuery extends CollaborationListQuery {
  status?: DrugInvestigationTaskStatus;
  assignedActorId?: string;
  priority?: DrugInvestigationTaskPriority;
  overdue?: boolean;
}
