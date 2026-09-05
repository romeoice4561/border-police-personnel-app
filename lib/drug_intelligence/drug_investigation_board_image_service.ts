/**
 * Private investigation-board image service (DI-9.5D).
 *
 * Uploads, signed access, conservative delete, and duplicate copies.
 * Never writes factual Drug Intelligence records.
 *
 * Orphan policy (MVP): upload creates metadata immediately. Removing a canvas
 * annotation does not hard-delete the storage object. Explicit DELETE
 * /board-images or duplicate-failure compensation remove objects. Archive
 * retains objects. Hard purge is future governance work.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugInvestigationBoardImageRepository } from "@/lib/database/repositories/drug_investigation_board_image_repository";
import { DrugInvestigationBoardRepository } from "@/lib/database/repositories/drug_investigation_board_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type { BoardActor } from "@/lib/drug_intelligence/drug_investigation_board_service";
import {
  BoardForbiddenError,
  BoardNotFoundError,
} from "@/lib/drug_intelligence/drug_investigation_board_types";
import type { DrugInvestigationBoardStateV1 } from "@/lib/drug_intelligence/drug_investigation_board_state";
import {
  BoardImageStorageConfigError,
  type BoardImageObjectStore,
} from "@/lib/drug_intelligence/drug_investigation_board_image_storage";
import {
  BOARD_IMAGE_SIGNED_TTL_SECONDS,
  BoardImageValidationError,
  buildBoardImageStoragePath,
  sanitizeOriginalFilename,
  validateBoardImageBytes,
} from "@/lib/drug_intelligence/drug_investigation_board_image_validation";

const ENTITY = "DrugInvestigationBoard";

export class BoardImageUnavailableError extends Error {
  readonly code = "IMAGE_UNAVAILABLE";
  constructor() {
    super("Image is unavailable");
    this.name = "BoardImageUnavailableError";
  }
}

export class BoardImageReadOnlyError extends Error {
  readonly code = "BOARD_READ_ONLY";
  constructor() {
    super("This board is read-only");
    this.name = "BoardImageReadOnlyError";
  }
}

export interface BoardImageMetadata {
  id: string;
  boardId: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export interface BoardImageAccess {
  imageId: string;
  url: string;
  expiresAt: string;
}

export class DrugInvestigationBoardImageService {
  private readonly boards: DrugInvestigationBoardRepository;
  private readonly images: DrugInvestigationBoardImageRepository;
  private readonly audit: DrugAuditLogRepository;

  constructor(
    db: DatabaseClient,
    private readonly store: BoardImageObjectStore
  ) {
    this.boards = new DrugInvestigationBoardRepository(db);
    this.images = new DrugInvestigationBoardImageRepository(db);
    this.audit = new DrugAuditLogRepository(db);
  }

  async upload(
    boardId: string,
    actor: BoardActor,
    input: { bytes: Uint8Array; declaredMime?: string | null; originalName?: string | null }
  ): Promise<BoardImageMetadata> {
    const board = await this.boards.findById(boardId);
    if (!board) throw new BoardNotFoundError(boardId);
    if (board.ownerActorId !== actor.actorId) throw new BoardForbiddenError();
    if (board.status !== "ACTIVE") throw new BoardImageReadOnlyError();

    const validated = validateBoardImageBytes({ bytes: input.bytes, declaredMime: input.declaredMime });
    const imageId = generateDrugId();
    const storagePath = buildBoardImageStoragePath(boardId, imageId, validated.extension);

    await this.store.put({ storagePath, bytes: input.bytes, mimeType: validated.mimeType });
    try {
      const row = await this.images.create({
        id: imageId,
        boardId,
        storagePath,
        mimeType: validated.mimeType,
        byteSize: input.bytes.byteLength,
        width: validated.width,
        height: validated.height,
        originalName: sanitizeOriginalFilename(input.originalName),
        createdBy: actor.actorId,
      });
      await this.audit.record({
        entityType: ENTITY,
        entityId: boardId,
        action: "board_image_uploaded",
        actorId: actor.actorId,
        actorName: actor.actorName,
        detail: JSON.stringify({ imageId, mimeType: row.mimeType, byteSize: row.byteSize }),
      });
      return toMetadata(row);
    } catch (error) {
      try {
        await this.store.remove(storagePath);
      } catch (cleanupError) {
        console.error("board image upload compensation failed", cleanupError instanceof Error ? cleanupError.name : "unknown");
      }
      throw error;
    }
  }

  async access(boardId: string, imageId: string, actor: BoardActor): Promise<BoardImageAccess> {
    const board = await this.boards.findById(boardId);
    if (!board || board.ownerActorId !== actor.actorId) throw new BoardImageUnavailableError();
    const row = await this.images.findById(imageId);
    if (!row || row.boardId !== boardId) throw new BoardImageUnavailableError();
    const signed = await this.store.sign(row.storagePath, BOARD_IMAGE_SIGNED_TTL_SECONDS);
    return { imageId: row.id, url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  async accessMany(boardId: string, imageIds: string[], actor: BoardActor): Promise<BoardImageAccess[]> {
    const board = await this.boards.findById(boardId);
    if (!board || board.ownerActorId !== actor.actorId) throw new BoardImageUnavailableError();
    const unique = [...new Set(imageIds.filter(Boolean))].slice(0, 40);
    const resolved: BoardImageAccess[] = [];
    for (const imageId of unique) {
      try {
        resolved.push(await this.access(boardId, imageId, actor));
      } catch (error) {
        if (error instanceof BoardImageUnavailableError) continue;
        throw error;
      }
    }
    return resolved;
  }

  async remove(boardId: string, imageId: string, actor: BoardActor): Promise<void> {
    const board = await this.boards.findById(boardId);
    if (!board) throw new BoardNotFoundError(boardId);
    if (board.ownerActorId !== actor.actorId) throw new BoardForbiddenError();
    const row = await this.images.findById(imageId);
    if (!row || row.boardId !== boardId) throw new BoardImageUnavailableError();
    await this.images.deleteById(imageId);
    try {
      await this.store.remove(row.storagePath);
    } catch (error) {
      console.error("board image storage remove failed", error instanceof Error ? error.name : "unknown");
    }
    await this.audit.record({
      entityType: ENTITY,
      entityId: boardId,
      action: "board_image_removed",
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({ imageId }),
    });
  }

  /**
   * Copies private objects into destination board paths and returns remapped state.
   * On any copy failure, destination objects/metadata created so far are cleaned.
   */
  async copyImagesForDuplicate(
    sourceBoardId: string,
    destBoardId: string,
    state: DrugInvestigationBoardStateV1,
    actor: BoardActor
  ): Promise<DrugInvestigationBoardStateV1> {
    const sourceIds = [...new Set(state.annotations.map((ann) => ann.imageId).filter((id): id is string => Boolean(id)))];
    if (sourceIds.length === 0) return state;

    const remap = new Map<string, string>();
    const created: Array<{ imageId: string; storagePath: string }> = [];
    try {
      for (const sourceImageId of sourceIds) {
        const source = await this.images.findById(sourceImageId);
        if (!source || source.boardId !== sourceBoardId) {
          throw new BoardImageStorageConfigError("source image missing");
        }
        const destImageId = generateDrugId();
        const ext = source.storagePath.split(".").pop() || "bin";
        const storagePath = buildBoardImageStoragePath(destBoardId, destImageId, ext);
        const bytes = await this.store.get(source.storagePath);
        await this.store.put({ storagePath, bytes, mimeType: source.mimeType });
        await this.images.create({
          id: destImageId,
          boardId: destBoardId,
          storagePath,
          mimeType: source.mimeType,
          byteSize: source.byteSize,
          width: source.width,
          height: source.height,
          originalName: source.originalName,
          createdBy: actor.actorId,
        });
        created.push({ imageId: destImageId, storagePath });
        remap.set(sourceImageId, destImageId);
      }
    } catch (error) {
      for (const item of created) {
        await this.images.deleteById(item.imageId).catch(() => undefined);
        await this.store.remove(item.storagePath).catch(() => undefined);
      }
      throw error;
    }

    await this.audit.record({
      entityType: ENTITY,
      entityId: destBoardId,
      action: "board_image_copied",
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({ sourceBoardId, imageCount: created.length }),
    });

    return {
      ...state,
      annotations: state.annotations.map((ann) => {
        if (!ann.imageId) return ann;
        const nextId = remap.get(ann.imageId);
        return nextId ? { ...ann, imageId: nextId } : { ...ann, imageId: undefined };
      }),
    };
  }

  publicObjectUrlForTest(storagePath: string): string {
    return this.store.publicObjectUrl(storagePath);
  }
}

function toMetadata(row: {
  id: string;
  boardId: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}): BoardImageMetadata {
  return {
    id: row.id,
    boardId: row.boardId,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
  };
}

export { BoardImageValidationError };
