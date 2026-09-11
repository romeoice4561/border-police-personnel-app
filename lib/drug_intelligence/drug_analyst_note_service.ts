/**
 * DI-11B Analyst Note service.
 *
 * CASE XOR PERSON targets. Author/updater come from trusted CollaborationActor
 * only. Notes are editable, never deleted. Audit metadata excludes note body.
 * Visibility is global among drug.read (enforced at the handler, not here).
 */

import type { DatabaseClient, DrugAnalystNote } from "@/lib/database/database_types";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import {
  ANALYST_NOTE_BODY_MAX,
  collaborationTotalPages,
  normalizeCollaborationPage,
  type CollaborationTargetKind,
} from "@/lib/drug_intelligence/drug_collaboration_options";
import type {
  AnalystNoteCreateInput,
  AnalystNoteDto,
  AnalystNoteUpdateInput,
  CollaborationActor,
  CollaborationListQuery,
  CollaborationPageMeta,
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

  async listForCase(caseId: string, query: CollaborationListQuery = {}): Promise<{ items: AnalystNoteDto[]; meta: CollaborationPageMeta }> {
    await this.assertCaseExists(caseId);
    return this.list({ caseId }, query);
  }

  async listForPerson(personId: string, query: CollaborationListQuery = {}): Promise<{ items: AnalystNoteDto[]; meta: CollaborationPageMeta }> {
    await this.assertPersonWritable(personId, { allowMergedRead: true });
    return this.list({ personId }, query);
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
        },
      });
      await new DrugAuditLogRepository(tx).record({
        entityType: ENTITY,
        entityId: id,
        action: "analyst_note_created",
        actorId: actor.actorId,
        actorName: actor.actorName,
        detail: safeAuditDetail({ noteId: id, targetKind: kind, targetId }),
      });
      return row;
    });
    return toDto(created);
  }

  private async list(
    where: { caseId?: string; personId?: string },
    query: CollaborationListQuery
  ): Promise<{ items: AnalystNoteDto[]; meta: CollaborationPageMeta }> {
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
      items: rows.map(toDto),
      meta: { page, pageSize, total, totalPages: collaborationTotalPages(total, pageSize) },
    };
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
