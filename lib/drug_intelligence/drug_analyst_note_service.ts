/**
 * DI-11B Analyst Note service.
 *
 * CASE XOR PERSON targets. Author/updater come from trusted CollaborationActor
 * only. Notes are editable, never deleted. Audit metadata excludes note body.
 * Visibility is global among drug.read (enforced at the handler, not here).
 * DI-11E.3: optional sourceTaskId is create-time provenance only.
 */

import type { DatabaseClient, DrugAnalystNote, DrugInvestigationTask } from "@/lib/database/database_types";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import {
  ANALYST_NOTE_BODY_MAX,
  collaborationTotalPages,
  normalizeCollaborationPage,
  RELATED_TASK_NOTES_BATCH_MAX_IDS,
  RELATED_TASK_NOTES_BATCH_MAX_ITEMS,
  type CollaborationTargetKind,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import type {
  AnalystNoteCreateInput,
  AnalystNoteDto,
  AnalystNoteUpdateInput,
  CollaborationActor,
  CollaborationListQuery,
  CollaborationPageMeta,
  RelatedTaskNotesPage,
  ResultNoteSummaryDto,
  SourceTaskProvenanceDto,
} from "@/lib/drug_intelligence/drug_collaboration_types";
import {
  CollaborationNotFoundError,
  CollaborationPersonMergedError,
  CollaborationTargetNotFoundError,
  CollaborationValidationError,
} from "@/lib/drug_intelligence/drug_collaboration_types";

const ENTITY = "DrugAnalystNote";

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function targetOf(row: Pick<DrugAnalystNote, "caseId" | "personId">): { targetKind: CollaborationTargetKind; targetId: string } {
  const hasCase = Boolean(row.caseId);
  const hasPerson = Boolean(row.personId);
  if (hasCase === hasPerson) {
    throw new CollaborationValidationError("Collaboration target must be exactly one of CASE or PERSON");
  }
  if (hasCase) return { targetKind: "CASE", targetId: String(row.caseId) };
  return { targetKind: "PERSON", targetId: String(row.personId) };
}

function taskTargetOf(row: Pick<DrugInvestigationTask, "caseId" | "personId">): { targetKind: CollaborationTargetKind; targetId: string } {
  const hasCase = Boolean(row.caseId);
  const hasPerson = Boolean(row.personId);
  if (hasCase === hasPerson) {
    throw new CollaborationValidationError("Collaboration target must be exactly one of CASE or PERSON");
  }
  if (hasCase) return { targetKind: "CASE", targetId: String(row.caseId) };
  return { targetKind: "PERSON", targetId: String(row.personId) };
}

function toDto(row: DrugAnalystNote): AnalystNoteDto {
  const target = targetOf(row);
  return {
    kind: "ANALYST_NOTE",
    id: String(row.id),
    body: String(row.body),
    targetKind: target.targetKind,
    targetId: target.targetId,
    authorActorId: String(row.authorActorId),
    authorName: String(row.authorName),
    createdAt: requiredIso(row.createdAt),
    updatedAt: requiredIso(row.updatedAt),
    updatedByActorId: row.updatedByActorId ? String(row.updatedByActorId) : null,
    updatedByName: row.updatedByName ? String(row.updatedByName) : null,
    sourceTaskId: row.sourceTaskId ? String(row.sourceTaskId) : null,
  };
}

function toSummary(row: DrugAnalystNote): ResultNoteSummaryDto {
  return {
    id: String(row.id),
    authorName: String(row.authorName),
    createdAt: requiredIso(row.createdAt),
  };
}

function normalizeBody(raw: string): string {
  const body = raw.trim();
  if (body.length < 1) throw new CollaborationValidationError("Note body is required");
  if (body.length > ANALYST_NOTE_BODY_MAX) throw new CollaborationValidationError("Note body exceeds 5000 characters");
  return body;
}

function safeAuditDetail(fields: Record<string, string | null | undefined>): string {
  const compact: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== "") compact[key] = value;
  }
  return JSON.stringify(compact);
}

export class DrugAnalystNoteService {
  private readonly audit: DrugAuditLogRepository;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new DrugAuditLogRepository(db);
  }

  async createForCase(caseId: string, input: AnalystNoteCreateInput, actor: CollaborationActor): Promise<AnalystNoteDto> {
    return this.create("CASE", caseId, input, actor);
  }

  async createForPerson(personId: string, input: AnalystNoteCreateInput, actor: CollaborationActor): Promise<AnalystNoteDto> {
    return this.create("PERSON", personId, input, actor);
  }

  async get(noteId: string): Promise<AnalystNoteDto> {
    const row = await this.db.drugAnalystNote.findUnique({ where: { id: noteId } });
    if (!row) throw new CollaborationNotFoundError("NOTE", noteId);
    return toDto(row);
  }

  async listForCase(
    caseId: string,
    query: CollaborationListQuery = {}
  ): Promise<{ items: AnalystNoteDto[]; meta: CollaborationPageMeta; sourceTasks: SourceTaskProvenanceDto[] }> {
    await this.assertCaseExists(caseId);
    return this.list({ caseId }, query);
  }

  async listForPerson(
    personId: string,
    query: CollaborationListQuery = {}
  ): Promise<{ items: AnalystNoteDto[]; meta: CollaborationPageMeta; sourceTasks: SourceTaskProvenanceDto[] }> {
    await this.assertPersonWritable(personId, { allowMergedRead: true });
    return this.list({ personId }, query);
  }

  async listForTargetSourceTask(
    kind: CollaborationTargetKind,
    targetId: string,
    sourceTaskId: string,
    query: CollaborationListQuery = {}
  ): Promise<{ items: ResultNoteSummaryDto[]; meta: CollaborationPageMeta }> {
    if (kind === "CASE") await this.assertCaseExists(targetId);
    else await this.assertPersonWritable(targetId, { allowMergedRead: true });
    await this.assertSourceTaskOnTarget(sourceTaskId, kind, targetId);
    return this.listSummaries({ sourceTaskId }, query);
  }

  async listForTargetSourceTasks(
    kind: CollaborationTargetKind,
    targetId: string,
    sourceTaskIds: string[],
    query: CollaborationListQuery = {}
  ): Promise<RelatedTaskNotesPage[]> {
    if (kind === "CASE") await this.assertCaseExists(targetId);
    else await this.assertPersonWritable(targetId, { allowMergedRead: true });
    const unique = [...new Set(sourceTaskIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length < 1) throw new CollaborationValidationError("ids is required");
    if (unique.length > RELATED_TASK_NOTES_BATCH_MAX_IDS) {
      throw new CollaborationValidationError("Too many sourceTaskIds");
    }
    const tasks = await this.db.drugInvestigationTask.findMany({ where: { id: { in: unique } } });
    const tasksById = new Map(tasks.map((row) => [String(row.id), row]));
    for (const sourceTaskId of unique) {
      const task = tasksById.get(sourceTaskId);
      if (!task) throw new CollaborationNotFoundError("TASK", sourceTaskId);
      const taskTarget = taskTargetOf(task);
      if (taskTarget.targetKind !== kind || taskTarget.targetId !== targetId) {
        throw new CollaborationValidationError("sourceTaskId must belong to the same CASE or PERSON target");
      }
    }

    const { pageSize } = normalizeCollaborationPage(1, query.pageSize);
    const boundedPageSize = Math.min(pageSize, RELATED_TASK_NOTES_BATCH_MAX_ITEMS);
    const take = Math.min(unique.length * boundedPageSize, RELATED_TASK_NOTES_BATCH_MAX_ITEMS);
    const groupBy = this.db.drugAnalystNote.groupBy;
    if (!groupBy) throw new CollaborationValidationError("Related-note batch aggregate is unavailable");
    const [groups, rows] = await Promise.all([
      groupBy.call(this.db.drugAnalystNote, {
        by: ["sourceTaskId"],
        where: { sourceTaskId: { in: unique } },
        _count: { _all: true },
      }),
      this.db.drugAnalystNote.findMany({
        where: { sourceTaskId: { in: unique } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
      }),
    ]);
    const totals = new Map<string, number>();
    for (const group of groups) {
      const sourceTaskId = String(group.sourceTaskId ?? "");
      const count =
        typeof group._count === "object" && group._count && "_all" in group._count ? Number(group._count._all ?? 0) : 0;
      totals.set(sourceTaskId, count);
    }
    const grouped = new Map<string, ResultNoteSummaryDto[]>();
    for (const row of rows) {
      const sourceTaskId = row.sourceTaskId ? String(row.sourceTaskId) : "";
      const list = grouped.get(sourceTaskId) ?? [];
      if (list.length < boundedPageSize) list.push(toSummary(row));
      grouped.set(sourceTaskId, list);
    }
    return unique.map((sourceTaskId) => {
      const items = grouped.get(sourceTaskId) ?? [];
      const total = totals.get(sourceTaskId) ?? 0;
      return {
        sourceTaskId,
        items,
        meta: { page: 1, pageSize: boundedPageSize, total, totalPages: collaborationTotalPages(total, boundedPageSize) },
      };
    });
  }

  async update(noteId: string, input: AnalystNoteUpdateInput, actor: CollaborationActor): Promise<AnalystNoteDto> {
    const existing = await this.db.drugAnalystNote.findUnique({ where: { id: noteId } });
    if (!existing) throw new CollaborationNotFoundError("NOTE", noteId);
    const body = normalizeBody(input.body);
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.drugAnalystNote.update({
        where: { id: noteId },
        data: {
          body,
          updatedByActorId: actor.actorId,
          updatedByName: actor.actorName,
          updatedAt: now,
        },
      });
      await new DrugAuditLogRepository(tx).record({
        entityType: ENTITY,
        entityId: noteId,
        action: "analyst_note_updated",
        actorId: actor.actorId,
        actorName: actor.actorName,
        detail: safeAuditDetail({
          noteId,
          targetKind: targetOf(existing).targetKind,
          targetId: targetOf(existing).targetId,
        }),
      });
      return row;
    });
    return toDto(updated);
  }

  private async create(
    kind: CollaborationTargetKind,
    targetId: string,
    input: AnalystNoteCreateInput,
    actor: CollaborationActor
  ): Promise<AnalystNoteDto> {
    const body = normalizeBody(input.body);
    if (kind === "CASE") await this.assertCaseExists(targetId);
    else await this.assertPersonWritable(targetId, { allowMergedRead: false });
    const sourceTaskId = await this.resolveSourceTask(input.sourceTaskId, kind, targetId);

    const id = generateDrugId();
    const now = new Date();
    const created = await this.db.$transaction(async (tx) => {
      const row = await tx.drugAnalystNote.create({
        data: {
          id,
          body,
          caseId: kind === "CASE" ? targetId : null,
          personId: kind === "PERSON" ? targetId : null,
          authorActorId: actor.actorId,
          authorName: actor.actorName,
          createdAt: now,
          updatedAt: now,
          updatedByActorId: null,
          updatedByName: null,
          sourceTaskId,
        },
      });
      await new DrugAuditLogRepository(tx).record({
        entityType: ENTITY,
        entityId: id,
        action: "analyst_note_created",
        actorId: actor.actorId,
        actorName: actor.actorName,
        detail: safeAuditDetail({ noteId: id, targetKind: kind, targetId, sourceTaskId }),
      });
      return row;
    });
    return toDto(created);
  }

  private async list(
    where: { caseId?: string; personId?: string; sourceTaskId?: string },
    query: CollaborationListQuery
  ): Promise<{ items: AnalystNoteDto[]; meta: CollaborationPageMeta; sourceTasks: SourceTaskProvenanceDto[] }> {
    const { page, pageSize } = normalizeCollaborationPage(query.page, query.pageSize);
    const [total, rows] = await Promise.all([
      this.db.drugAnalystNote.count({ where }),
      this.db.drugAnalystNote.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const items = rows.map(toDto);
    const targetFilter =
      typeof where.caseId === "string"
        ? { caseId: where.caseId }
        : typeof where.personId === "string"
          ? { personId: where.personId }
          : undefined;
    return {
      items,
      meta: { page, pageSize, total, totalPages: collaborationTotalPages(total, pageSize) },
      sourceTasks: await this.loadSourceTaskProvenance(
        items.map((row) => row.sourceTaskId),
        targetFilter
      ),
    };
  }

  private async listSummaries(
    where: { sourceTaskId: string },
    query: CollaborationListQuery
  ): Promise<{ items: ResultNoteSummaryDto[]; meta: CollaborationPageMeta }> {
    const { page, pageSize } = normalizeCollaborationPage(query.page, query.pageSize);
    const [total, rows] = await Promise.all([
      this.db.drugAnalystNote.count({ where }),
      this.db.drugAnalystNote.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map(toSummary),
      meta: { page, pageSize, total, totalPages: collaborationTotalPages(total, pageSize) },
    };
  }

  private async assertSourceTaskOnTarget(
    sourceTaskId: string,
    kind: CollaborationTargetKind,
    targetId: string
  ): Promise<void> {
    const task = await this.db.drugInvestigationTask.findUnique({ where: { id: sourceTaskId } });
    if (!task) throw new CollaborationNotFoundError("TASK", sourceTaskId);
    const taskTarget = taskTargetOf(task);
    if (taskTarget.targetKind !== kind || taskTarget.targetId !== targetId) {
      throw new CollaborationValidationError("sourceTaskId must belong to the same CASE or PERSON target");
    }
  }

  private async loadSourceTaskProvenance(
    sourceTaskIds: Array<string | null>,
    target?: { caseId?: string; personId?: string }
  ): Promise<SourceTaskProvenanceDto[]> {
    const unique = [...new Set(sourceTaskIds.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return [];
    const rows = await this.db.drugInvestigationTask.findMany({ where: { id: { in: unique } } });
    return rows
      .filter((row) => {
        if (target?.caseId) return String(row.caseId ?? "") === target.caseId;
        if (target?.personId) return String(row.personId ?? "") === target.personId;
        return true;
      })
      .map((row) => ({
        id: String(row.id),
        title: String(row.title),
        createdAt: requiredIso(row.createdAt),
      }));
  }

  private async resolveSourceTask(
    sourceTaskId: string | null | undefined,
    kind: CollaborationTargetKind,
    targetId: string
  ): Promise<string | null> {
    if (sourceTaskId == null) return null;
    const id = sourceTaskId.trim();
    if (id === "") return null;
    const task = await this.db.drugInvestigationTask.findUnique({ where: { id } });
    if (!task) throw new CollaborationNotFoundError("TASK", id);
    const taskTarget = taskTargetOf(task);
    if (taskTarget.targetKind !== kind || taskTarget.targetId !== targetId) {
      throw new CollaborationValidationError("sourceTaskId must belong to the same CASE or PERSON target");
    }
    if (String(task.status) === "CANCELLED") {
      throw new CollaborationValidationError("Cannot create a result note for a cancelled task");
    }
    return id;
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
