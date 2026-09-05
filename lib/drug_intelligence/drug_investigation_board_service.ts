/**
 * Saved Investigation Board service (DI-9.5B).
 *
 * Analyst workspace overlay only. This service writes investigation-board
 * rows and audit log entries — never factual graph, junction, group,
 * membership, role, or merge records.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugInvestigationBoardRepository } from "@/lib/database/repositories/drug_investigation_board_repository";
import type { DrugInvestigationBoard } from "@/lib/database/database_types";
import {
  assertBoardStatePayloadSize,
  drugInvestigationBoardStateV1Schema,
} from "@/lib/drug_intelligence/drug_investigation_board_api_schemas";
import type { DrugInvestigationBoardStateV1 } from "@/lib/drug_intelligence/drug_investigation_board_state";
import {
  BoardConflictError,
  BoardForbiddenError,
  BoardNotFoundError,
  BoardPayloadTooLargeError,
  type DrugInvestigationBoardRecord,
  type DrugInvestigationBoardStatus,
  type DrugInvestigationBoardSummary,
} from "@/lib/drug_intelligence/drug_investigation_board_types";
import type { DrugInvestigationBoardImageService } from "@/lib/drug_intelligence/drug_investigation_board_image_service";

const ENTITY = "DrugInvestigationBoard";

export interface BoardActor {
  actorId: string;
  actorName: string;
}

function asState(raw: unknown): DrugInvestigationBoardStateV1 {
  const parsed = drugInvestigationBoardStateV1Schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Stored board state failed validation");
  }
  return parsed.data;
}

function toRecord(row: DrugInvestigationBoard): DrugInvestigationBoardRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as DrugInvestigationBoardStatus,
    ownerActorId: row.ownerActorId,
    ownerActorName: row.ownerActorName,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    updatedBy: row.updatedBy,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastOpenedAt: row.lastOpenedAt,
    version: row.version,
    schemaVersion: row.schemaVersion,
    focusType: row.focusType,
    focusId: row.focusId,
    state: asState(row.state),
  };
}

function toSummary(row: DrugInvestigationBoard): DrugInvestigationBoardSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as DrugInvestigationBoardStatus,
    ownerActorId: row.ownerActorId,
    ownerActorName: row.ownerActorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastOpenedAt: row.lastOpenedAt,
    version: row.version,
    schemaVersion: row.schemaVersion,
    focusType: row.focusType,
    focusId: row.focusId,
  };
}

function assertOwner(row: DrugInvestigationBoard, actorId: string): void {
  if (row.ownerActorId !== actorId) throw new BoardForbiddenError();
}

function assertStateSize(state: DrugInvestigationBoardStateV1): void {
  const sized = assertBoardStatePayloadSize(state);
  if (!sized.ok) throw new BoardPayloadTooLargeError(sized.bytes);
}

export class DrugInvestigationBoardService {
  private readonly boards: DrugInvestigationBoardRepository;
  private readonly audit: DrugAuditLogRepository;

  constructor(
    db: DatabaseClient,
    private readonly images?: DrugInvestigationBoardImageService
  ) {
    this.boards = new DrugInvestigationBoardRepository(db);
    this.audit = new DrugAuditLogRepository(db);
  }

  async listBoards(actor: BoardActor, status: DrugInvestigationBoardStatus = "ACTIVE"): Promise<DrugInvestigationBoardSummary[]> {
    const rows = await this.boards.listByOwner(actor.actorId, status);
    return rows.map(toSummary);
  }

  async getBoard(id: string, actor: BoardActor): Promise<DrugInvestigationBoardRecord> {
    const row = await this.boards.findById(id);
    if (!row) throw new BoardNotFoundError(id);
    assertOwner(row, actor.actorId);
    await this.boards.touchLastOpenedAt(id);
    const refreshed = await this.boards.findById(id);
    return toRecord(refreshed ?? row);
  }

  async createBoard(
    actor: BoardActor,
    input: { title: string; description?: string | null; state: DrugInvestigationBoardStateV1 }
  ): Promise<DrugInvestigationBoardRecord> {
    assertStateSize(input.state);
    const row = await this.boards.create({
      title: input.title,
      description: input.description ?? null,
      ownerActorId: actor.actorId,
      ownerActorName: actor.actorName,
      actorId: actor.actorId,
      actorName: actor.actorName,
      focusType: input.state.graphContext.focusType,
      focusId: input.state.graphContext.focusId,
      state: input.state,
    });
    await this.audit.record({
      entityType: ENTITY,
      entityId: row.id,
      action: "board_created",
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({ title: row.title, version: row.version }),
    });
    return toRecord(row);
  }

  async updateBoard(
    id: string,
    actor: BoardActor,
    input: {
      expectedVersion: number;
      title?: string;
      description?: string | null;
      state?: DrugInvestigationBoardStateV1;
    }
  ): Promise<DrugInvestigationBoardRecord> {
    const current = await this.boards.findById(id);
    if (!current) throw new BoardNotFoundError(id);
    assertOwner(current, actor.actorId);
    if (input.state) assertStateSize(input.state);

    const renamed = input.title !== undefined && input.title !== current.title;
    const stateSaved = input.state !== undefined;

    const updated = await this.boards.updateIfVersion(id, input.expectedVersion, {
      title: input.title,
      description: input.description,
      state: input.state,
      focusType: input.state?.graphContext.focusType,
      focusId: input.state?.graphContext.focusId,
      updatedBy: actor.actorId,
      updatedByName: actor.actorName,
    });
    if (!updated) {
      const latest = await this.boards.findById(id);
      if (!latest) throw new BoardNotFoundError(id);
      throw new BoardConflictError(latest.version, input.expectedVersion, latest.title, latest.updatedAt);
    }

    const action = stateSaved ? "board_saved" : renamed ? "board_renamed" : "board_saved";
    await this.audit.record({
      entityType: ENTITY,
      entityId: updated.id,
      action,
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({ title: updated.title, version: updated.version }),
    });
    return toRecord(updated);
  }

  async duplicateBoard(id: string, actor: BoardActor, title?: string): Promise<DrugInvestigationBoardRecord> {
    const source = await this.boards.findById(id);
    if (!source) throw new BoardNotFoundError(id);
    assertOwner(source, actor.actorId);
    const state = asState(source.state);
    assertStateSize(state);

    const initialState: DrugInvestigationBoardStateV1 = this.images
      ? {
          ...state,
          annotations: state.annotations.map((ann) => {
            if (!ann.imageId) return ann;
            const { imageId: _imageId, ...rest } = ann;
            void _imageId;
            return rest;
          }),
        }
      : state;

    const row = await this.boards.create({
      title: title?.trim() || `${source.title} (สำเนา)`,
      description: source.description,
      ownerActorId: actor.actorId,
      ownerActorName: actor.actorName,
      actorId: actor.actorId,
      actorName: actor.actorName,
      focusType: source.focusType,
      focusId: source.focusId,
      state: initialState,
    });

    let finalRow = row;
    if (this.images) {
      try {
        const remapped = await this.images.copyImagesForDuplicate(source.id, row.id, state, actor);
        const updated = await this.boards.updateIfVersion(row.id, row.version, {
          state: remapped,
          updatedBy: actor.actorId,
          updatedByName: actor.actorName,
        });
        if (updated) finalRow = updated;
      } catch (error) {
        await this.boards.updateIfVersion(row.id, row.version, {
          status: "ARCHIVED",
          updatedBy: actor.actorId,
          updatedByName: actor.actorName,
        }).catch(() => undefined);
        throw error;
      }
    }

    await this.audit.record({
      entityType: ENTITY,
      entityId: finalRow.id,
      action: "board_duplicated",
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({ title: finalRow.title, version: finalRow.version, sourceBoardId: source.id }),
    });
    return toRecord(finalRow);
  }

  async archiveBoard(id: string, actor: BoardActor): Promise<DrugInvestigationBoardRecord> {
    const current = await this.boards.findById(id);
    if (!current) throw new BoardNotFoundError(id);
    assertOwner(current, actor.actorId);

    const updated = await this.boards.updateIfVersion(id, current.version, {
      status: "ARCHIVED",
      updatedBy: actor.actorId,
      updatedByName: actor.actorName,
    });
    if (!updated) {
      const latest = await this.boards.findById(id);
      if (!latest) throw new BoardNotFoundError(id);
      throw new BoardConflictError(latest.version, current.version, latest.title, latest.updatedAt);
    }
    await this.audit.record({
      entityType: ENTITY,
      entityId: updated.id,
      action: "board_archived",
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({ title: updated.title, version: updated.version }),
    });
    return toRecord(updated);
  }
}
