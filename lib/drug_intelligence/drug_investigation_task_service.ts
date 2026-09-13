/**
 * DI-11B Investigation Task service.
 *
 * CASE XOR PERSON. Assignment snapshots trusted directory names. Status
 * transitions are centralized. Target and createdBy are immutable after create.
 * Audit metadata excludes description. Overdue is derived, never stored.
 */

import type { DatabaseClient, DrugInvestigationTask } from "@/lib/database/database_types";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import {
  canTransitionTaskStatus,
  collaborationTotalPages,
  isDrugInvestigationTaskPriority,
  isDrugInvestigationTaskStatus,
  isTaskOverdue,
  normalizeCollaborationPage,
  RELATED_NOTE_TASKS_BATCH_MAX_IDS,
  RELATED_NOTE_TASKS_BATCH_MAX_ITEMS,
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
  type CollaborationTargetKind,
  type DrugInvestigationTaskPriority,
  type DrugInvestigationTaskStatus,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import { resolveAssignableActor } from "@/lib/drug_intelligence/drug_collaboration_auth";
import type {
  CollaborationActor,
  CollaborationListQuery,
  CollaborationPageMeta,
  InvestigationTaskCreateInput,
  InvestigationTaskDto,
  InvestigationTaskListQuery,
  InvestigationTaskPatchInput,
  SourceNoteProvenanceDto,
} from "@/lib/drug_intelligence/drug_collaboration_types";
import {
  CollaborationInvalidAssigneeError,
  CollaborationInvalidTransitionError,
  CollaborationNotFoundError,
  CollaborationPersonMergedError,
  CollaborationTargetNotFoundError,
  CollaborationValidationError,
} from "@/lib/drug_intelligence/drug_collaboration_types";

const ENTITY = "DrugInvestigationTask";

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function asStatus(value: unknown): DrugInvestigationTaskStatus {
  const status = String(value);
  if (!isDrugInvestigationTaskStatus(status)) return "OPEN";
  return status;
}

function asPriority(value: unknown): DrugInvestigationTaskPriority {
  const priority = String(value);
  if (!isDrugInvestigationTaskPriority(priority)) return "NORMAL";
  return priority;
}

function targetOf(row: Pick<DrugInvestigationTask, "caseId" | "personId">): { targetKind: CollaborationTargetKind; targetId: string } {
  const hasCase = Boolean(row.caseId);
  const hasPerson = Boolean(row.personId);
  if (hasCase === hasPerson) {
    throw new CollaborationValidationError("Collaboration target must be exactly one of CASE or PERSON");
  }
  if (hasCase) return { targetKind: "CASE", targetId: String(row.caseId) };
  return { targetKind: "PERSON", targetId: String(row.personId) };
}

function toDto(row: DrugInvestigationTask, now = new Date()): InvestigationTaskDto {
  const target = targetOf(row);
  const status = asStatus(row.status);
  return {
    kind: "TASK",
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    targetKind: target.targetKind,
    targetId: target.targetId,
    assignedActorId: row.assignedActorId ? String(row.assignedActorId) : null,
    assignedActorName: row.assignedActorName ? String(row.assignedActorName) : null,
    dueAt: iso(row.dueAt),
    priority: asPriority(row.priority),
    status,
    createdByActorId: String(row.createdByActorId),
    createdByName: String(row.createdByName),
    createdAt: requiredIso(row.createdAt),
    updatedAt: requiredIso(row.updatedAt),
    updatedByActorId: row.updatedByActorId ? String(row.updatedByActorId) : null,
    updatedByName: row.updatedByName ? String(row.updatedByName) : null,
    completedAt: iso(row.completedAt),
    isOverdue: isTaskOverdue({ dueAt: row.dueAt, status, now }),
    sourceNoteId: row.sourceNoteId ? String(row.sourceNoteId) : null,
  };
}

function normalizeTitle(raw: string): string {
  const title = raw.trim();
  if (title.length < 1) throw new CollaborationValidationError("Task title is required");
  if (title.length > TASK_TITLE_MAX) throw new CollaborationValidationError("Task title exceeds 200 characters");
  return title;
}

function normalizeDescription(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const description = raw.trim();
  if (description.length === 0) return null;
  if (description.length > TASK_DESCRIPTION_MAX) throw new CollaborationValidationError("Task description exceeds 5000 characters");
  return description;
}

function safeAuditDetail(fields: Record<string, string | null | undefined>): string {
  const compact: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== "") compact[key] = value;
  }
  return JSON.stringify(compact);
}

export class DrugInvestigationTaskService {
  constructor(private readonly db: DatabaseClient) {}

  async createForCase(caseId: string, input: InvestigationTaskCreateInput, actor: CollaborationActor): Promise<InvestigationTaskDto> {
    return this.create("CASE", caseId, input, actor);
  }

  async createForPerson(personId: string, input: InvestigationTaskCreateInput, actor: CollaborationActor): Promise<InvestigationTaskDto> {
    return this.create("PERSON", personId, input, actor);
  }

  async get(taskId: string): Promise<InvestigationTaskDto> {
    const row = await this.db.drugInvestigationTask.findUnique({ where: { id: taskId } });
    if (!row) throw new CollaborationNotFoundError("TASK", taskId);
    return toDto(row);
  }

  async listForCase(caseId: string, query: InvestigationTaskListQuery = {}): Promise<{
    items: InvestigationTaskDto[];
    meta: CollaborationPageMeta;
    sourceNotes: SourceNoteProvenanceDto[];
  }> {
    await this.assertCaseExists(caseId);
    return this.list({ caseId }, query);
  }

  async listForPerson(personId: string, query: InvestigationTaskListQuery = {}): Promise<{
    items: InvestigationTaskDto[];
    meta: CollaborationPageMeta;
    sourceNotes: SourceNoteProvenanceDto[];
  }> {
    await this.assertPersonWritable(personId, { allowMergedRead: true });
    return this.list({ personId }, query);
  }

  async listBySourceNoteId(
    sourceNoteId: string,
    query: CollaborationListQuery = {}
  ): Promise<{ items: InvestigationTaskDto[]; meta: CollaborationPageMeta; sourceNotes: SourceNoteProvenanceDto[] }> {
    const note = await this.db.drugAnalystNote.findUnique({ where: { id: sourceNoteId } });
    if (!note) throw new CollaborationNotFoundError("NOTE", sourceNoteId);
    return this.list({ sourceNoteId }, query);
  }

  async listForTargetSourceNote(
    kind: CollaborationTargetKind,
    targetId: string,
    sourceNoteId: string,
    query: CollaborationListQuery = {}
  ): Promise<{ items: InvestigationTaskDto[]; meta: CollaborationPageMeta; sourceNotes: SourceNoteProvenanceDto[] }> {
    if (kind === "CASE") await this.assertCaseExists(targetId);
    else await this.assertPersonWritable(targetId, { allowMergedRead: true });
    await this.assertSourceNoteOnTarget(sourceNoteId, kind, targetId);
    return this.list({ sourceNoteId }, query);
  }

  async listForTargetSourceNotes(
    kind: CollaborationTargetKind,
    targetId: string,
    sourceNoteIds: string[],
    query: CollaborationListQuery = {}
  ): Promise<Array<{ sourceNoteId: string; items: InvestigationTaskDto[]; meta: CollaborationPageMeta }>> {
    if (kind === "CASE") await this.assertCaseExists(targetId);
    else await this.assertPersonWritable(targetId, { allowMergedRead: true });
    const unique = [...new Set(sourceNoteIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length < 1) throw new CollaborationValidationError("ids is required");
    if (unique.length > RELATED_NOTE_TASKS_BATCH_MAX_IDS) {
      throw new CollaborationValidationError("Too many sourceNoteIds");
    }
    const notes = await this.db.drugAnalystNote.findMany({ where: { id: { in: unique } } });
    const notesById = new Map(notes.map((row) => [String(row.id), row]));
    for (const sourceNoteId of unique) {
      const note = notesById.get(sourceNoteId);
      if (!note) throw new CollaborationNotFoundError("NOTE", sourceNoteId);
      const noteTarget = targetOf(note);
      if (noteTarget.targetKind !== kind || noteTarget.targetId !== targetId) {
        throw new CollaborationValidationError("sourceNoteId must belong to the same CASE or PERSON target");
      }
    }

    const { pageSize } = normalizeCollaborationPage(1, query.pageSize);
    const boundedPageSize = Math.min(pageSize, RELATED_NOTE_TASKS_BATCH_MAX_ITEMS);
    const take = Math.min(unique.length * boundedPageSize, RELATED_NOTE_TASKS_BATCH_MAX_ITEMS);
    const groupBy = this.db.drugInvestigationTask.groupBy;
    if (!groupBy) throw new CollaborationValidationError("Related-task batch aggregate is unavailable");
    const [groups, rows] = await Promise.all([
      groupBy.call(this.db.drugInvestigationTask, {
        by: ["sourceNoteId"],
        where: { sourceNoteId: { in: unique } },
        _count: { _all: true },
      }),
      this.db.drugInvestigationTask.findMany({
        where: { sourceNoteId: { in: unique } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
      }),
    ]);
    const totals = new Map<string, number>();
    for (const group of groups) {
      const sourceNoteId = String(group.sourceNoteId ?? "");
      const count = typeof group._count === "object" && group._count && "_all" in group._count
        ? Number(group._count._all ?? 0)
        : 0;
      totals.set(sourceNoteId, count);
    }
    const grouped = new Map<string, InvestigationTaskDto[]>();
    for (const row of rows) {
      const sourceNoteId = row.sourceNoteId ? String(row.sourceNoteId) : "";
      const list = grouped.get(sourceNoteId) ?? [];
      if (list.length < boundedPageSize) list.push(toDto(row));
      grouped.set(sourceNoteId, list);
    }
    return unique.map((sourceNoteId) => {
      const items = grouped.get(sourceNoteId) ?? [];
      const total = totals.get(sourceNoteId) ?? 0;
      return {
        sourceNoteId,
        items,
        meta: { page: 1, pageSize: boundedPageSize, total, totalPages: collaborationTotalPages(total, boundedPageSize) },
      };
    });
  }

  async update(taskId: string, patch: InvestigationTaskPatchInput, actor: CollaborationActor): Promise<InvestigationTaskDto> {
    const existing = await this.db.drugInvestigationTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new CollaborationNotFoundError("TASK", taskId);

    const fromStatus = asStatus(existing.status);
    const fromAssignee = existing.assignedActorId ? String(existing.assignedActorId) : "";
    const nextStatus = patch.status ?? fromStatus;
    if (!canTransitionTaskStatus(fromStatus, nextStatus)) {
      throw new CollaborationInvalidTransitionError(fromStatus, nextStatus);
    }

    const assignee =
      patch.assignedActorId === undefined
        ? { actorId: existing.assignedActorId ? String(existing.assignedActorId) : null, actorName: existing.assignedActorName ? String(existing.assignedActorName) : null }
        : await this.resolveAssignee(patch.assignedActorId);

    const title = patch.title === undefined ? String(existing.title) : normalizeTitle(patch.title);
    const description = patch.description === undefined ? (existing.description ? String(existing.description) : null) : normalizeDescription(patch.description);
    const priority = patch.priority ?? asPriority(existing.priority);
    const dueAt = patch.dueAt === undefined ? existing.dueAt : patch.dueAt;
    const completedAt = nextStatus === "DONE" ? existing.completedAt ?? new Date() : null;
    const now = new Date();

    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.drugInvestigationTask.update({
        where: { id: taskId },
        data: {
          title,
          description,
          assignedActorId: assignee.actorId,
          assignedActorName: assignee.actorName,
          dueAt,
          priority,
          status: nextStatus,
          completedAt,
          updatedByActorId: actor.actorId,
          updatedByName: actor.actorName,
          updatedAt: now,
        },
      });
      const audit = new DrugAuditLogRepository(tx);
      const target = targetOf(existing);
      const base = { taskId, targetKind: target.targetKind, targetId: target.targetId };
      const toAssignee = assignee.actorId ?? "";
      if (fromAssignee !== toAssignee) {
        await audit.record({
          entityType: ENTITY,
          entityId: taskId,
          action: fromAssignee === "" ? "investigation_task_assigned" : toAssignee === "" ? "investigation_task_updated" : "investigation_task_reassigned",
          actorId: actor.actorId,
          actorName: actor.actorName,
          detail: safeAuditDetail({ ...base, fromAssigneeActorId: fromAssignee || null, toAssigneeActorId: toAssignee || null }),
        });
      }
      if (fromStatus !== nextStatus) {
        const action =
          nextStatus === "DONE"
            ? "investigation_task_completed"
            : nextStatus === "CANCELLED"
              ? "investigation_task_cancelled"
              : "investigation_task_status_changed";
        await audit.record({
          entityType: ENTITY,
          entityId: taskId,
          action,
          actorId: actor.actorId,
          actorName: actor.actorName,
          detail: safeAuditDetail({ ...base, fromStatus, toStatus: nextStatus }),
        });
      }
      const otherPatch =
        patch.title !== undefined || patch.description !== undefined || patch.dueAt !== undefined || patch.priority !== undefined;
      if (otherPatch && fromStatus === nextStatus && fromAssignee === toAssignee) {
        await audit.record({
          entityType: ENTITY,
          entityId: taskId,
          action: "investigation_task_updated",
          actorId: actor.actorId,
          actorName: actor.actorName,
          detail: safeAuditDetail({ ...base, priority }),
        });
      }
      return row;
    });
    return toDto(updated);
  }

  private async create(
    kind: CollaborationTargetKind,
    targetId: string,
    input: InvestigationTaskCreateInput,
    actor: CollaborationActor
  ): Promise<InvestigationTaskDto> {
    const title = normalizeTitle(input.title);
    const description = normalizeDescription(input.description);
    const priority = input.priority ?? "NORMAL";
    if (kind === "CASE") await this.assertCaseExists(targetId);
    else await this.assertPersonWritable(targetId, { allowMergedRead: false });
    const assignee = await this.resolveAssignee(input.assignedActorId ?? null);
    const sourceNoteId = await this.resolveSourceNote(input.sourceNoteId, kind, targetId);

    const id = generateDrugId();
    const now = new Date();
    const created = await this.db.$transaction(async (tx) => {
      const row = await tx.drugInvestigationTask.create({
        data: {
          id,
          title,
          description,
          caseId: kind === "CASE" ? targetId : null,
          personId: kind === "PERSON" ? targetId : null,
          assignedActorId: assignee.actorId,
          assignedActorName: assignee.actorName,
          dueAt: input.dueAt ?? null,
          priority,
          status: "OPEN",
          createdByActorId: actor.actorId,
          createdByName: actor.actorName,
          createdAt: now,
          updatedAt: now,
          updatedByActorId: null,
          updatedByName: null,
          completedAt: null,
          sourceNoteId,
        },
      });
      const audit = new DrugAuditLogRepository(tx);
      await audit.record({
        entityType: ENTITY,
        entityId: id,
        action: "investigation_task_created",
        actorId: actor.actorId,
        actorName: actor.actorName,
        detail: safeAuditDetail({ taskId: id, targetKind: kind, targetId, priority, status: "OPEN", sourceNoteId }),
      });
      if (assignee.actorId) {
        await audit.record({
          entityType: ENTITY,
          entityId: id,
          action: "investigation_task_assigned",
          actorId: actor.actorId,
          actorName: actor.actorName,
          detail: safeAuditDetail({ taskId: id, targetKind: kind, targetId, toAssigneeActorId: assignee.actorId }),
        });
      }
      return row;
    });
    return toDto(created);
  }

  private async list(
    targetWhere: { caseId?: string; personId?: string; sourceNoteId?: string },
    query: InvestigationTaskListQuery
  ): Promise<{ items: InvestigationTaskDto[]; meta: CollaborationPageMeta; sourceNotes: SourceNoteProvenanceDto[] }> {
    const { page, pageSize } = normalizeCollaborationPage(query.page, query.pageSize);
    const where: Record<string, unknown> = { ...targetWhere };
    if (query.status) where.status = query.status;
    if (query.assignedActorId) where.assignedActorId = query.assignedActorId;
    if (query.priority) where.priority = query.priority;
    if (query.sourceNoteId) where.sourceNoteId = query.sourceNoteId;
    if (query.overdue) {
      where.dueAt = { lt: new Date() };
      where.status = { in: ["OPEN", "IN_PROGRESS"] };
    }
    const [total, rows] = await Promise.all([
      this.db.drugInvestigationTask.count({ where }),
      this.db.drugInvestigationTask.findMany({
        where,
        // Simple createdAt DESC + id ASC. Unfinished-before-terminal / dueAt nulls-last is deferred.
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const items = rows.map((row) => toDto(row));
    const targetFilter =
      typeof targetWhere.caseId === "string"
        ? { caseId: targetWhere.caseId }
        : typeof targetWhere.personId === "string"
          ? { personId: targetWhere.personId }
          : undefined;
    return {
      items,
      meta: { page, pageSize, total, totalPages: collaborationTotalPages(total, pageSize) },
      sourceNotes: await this.loadSourceNoteProvenance(
        items.map((row) => row.sourceNoteId),
        targetFilter
      ),
    };
  }

  private async assertSourceNoteOnTarget(
    sourceNoteId: string,
    kind: CollaborationTargetKind,
    targetId: string
  ): Promise<void> {
    const note = await this.db.drugAnalystNote.findUnique({ where: { id: sourceNoteId } });
    if (!note) throw new CollaborationNotFoundError("NOTE", sourceNoteId);
    const noteTarget = targetOf(note);
    if (noteTarget.targetKind !== kind || noteTarget.targetId !== targetId) {
      throw new CollaborationValidationError("sourceNoteId must belong to the same CASE or PERSON target");
    }
  }

  private async loadSourceNoteProvenance(
    sourceNoteIds: Array<string | null>,
    target?: { caseId?: string; personId?: string }
  ): Promise<SourceNoteProvenanceDto[]> {
    const unique = [...new Set(sourceNoteIds.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return [];
    const rows = await this.db.drugAnalystNote.findMany({ where: { id: { in: unique } } });
    return rows
      .filter((row) => {
        if (target?.caseId) return String(row.caseId ?? "") === target.caseId;
        if (target?.personId) return String(row.personId ?? "") === target.personId;
        return true;
      })
      .map((row) => ({
        id: String(row.id),
        authorName: String(row.authorName),
        createdAt: requiredIso(row.createdAt),
      }));
  }

  private async resolveSourceNote(
    sourceNoteId: string | null | undefined,
    kind: CollaborationTargetKind,
    targetId: string
  ): Promise<string | null> {
    if (sourceNoteId == null) return null;
    const id = sourceNoteId.trim();
    if (id === "") return null;
    const note = await this.db.drugAnalystNote.findUnique({ where: { id } });
    if (!note) throw new CollaborationNotFoundError("NOTE", id);
    const noteTarget = targetOf(note);
    if (noteTarget.targetKind !== kind || noteTarget.targetId !== targetId) {
      throw new CollaborationValidationError("sourceNoteId must belong to the same CASE or PERSON target");
    }
    return id;
  }

  private async resolveAssignee(assignedActorId: string | null): Promise<{ actorId: string | null; actorName: string | null }> {
    if (assignedActorId == null || assignedActorId.trim() === "") return { actorId: null, actorName: null };
    const resolved = await resolveAssignableActor(assignedActorId);
    if (!resolved) throw new CollaborationInvalidAssigneeError();
    return { actorId: resolved.actorId, actorName: resolved.actorName };
  }

  private async assertCaseExists(caseId: string): Promise<void> {
    const row = await this.db.drugCase.findUnique({ where: { id: caseId } });
    if (!row) throw new CollaborationTargetNotFoundError("CASE", caseId);
  }

  private async assertPersonWritable(personId: string, opts: { allowMergedRead: boolean }): Promise<void> {
    const row = await this.db.drugPerson.findUnique({ where: { id: personId } });
    if (!row) throw new CollaborationTargetNotFoundError("PERSON", personId);
    if (String(row.status) === "MERGED" && !opts.allowMergedRead) {
      throw new CollaborationPersonMergedError(personId, row.mergedIntoPersonId ? String(row.mergedIntoPersonId) : null);
    }
  }
}