/**
 * Entity Media service — upload, primary invariant, signed access, merge remap.
 *
 * Reuses the private DI object store + board-image byte validation.
 * Does not write public URLs. Does not change graph/search ranking.
 */

import type { DatabaseClient, DrugEntityMedia } from "@/lib/database/database_types";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { DrugEntityMediaRepository } from "@/lib/database/repositories/drug_entity_media_repository";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type { BoardImageObjectStore } from "@/lib/drug_intelligence/drug_investigation_board_image_storage";
import { BOARD_IMAGE_SIGNED_TTL_SECONDS } from "@/lib/drug_intelligence/drug_investigation_board_image_validation";
import {
  ENTITY_MEDIA_VISUAL_TYPES,
  visualLookupKey,
  type DrugEntityMediaActor,
  type DrugEntityMediaEntityType,
  type DrugEntityMediaRecord,
  type DrugEntityMediaVisual,
} from "@/lib/drug_intelligence/drug_entity_media_types";
import {
  EntityMediaMergedWriteError,
  EntityMediaNotFoundError,
  EntityMediaTargetNotFoundError,
  buildEntityMediaStoragePath,
  resolveMediaCategory,
  sanitizeOriginalFilename,
  validateBoardImageBytes,
} from "@/lib/drug_intelligence/drug_entity_media_validation";

const AUDIT_ENTITY = "DrugEntityMedia";
const THUMB = { width: 128, height: 128, resize: "cover" as const };

export class DrugEntityMediaService {
  private readonly media: DrugEntityMediaRepository;
  private readonly audit: DrugAuditLogRepository;

  constructor(
    private readonly db: DatabaseClient,
    private readonly store: BoardImageObjectStore
  ) {
    this.media = new DrugEntityMediaRepository(db);
    this.audit = new DrugAuditLogRepository(db);
  }

  async list(entityType: DrugEntityMediaEntityType, entityId: string): Promise<{
    items: DrugEntityMediaRecord[];
    photoCount: number;
    primaryId: string | null;
  }> {
    const resolvedId = await this.resolveReadEntityId(entityType, entityId);
    const rows = await this.media.listByEntity(entityType, resolvedId);
    const items = await Promise.all(rows.map((row) => this.toRecord(row, "full")));
    return {
      items,
      photoCount: items.length,
      primaryId: items.find((item) => item.isPrimary)?.id ?? null,
    };
  }

  async upload(
    input: {
      entityType: DrugEntityMediaEntityType;
      entityId: string;
      category?: string | null;
      caption?: string | null;
      description?: string | null;
      sourceCaseId?: string | null;
      capturedAt?: string | null;
      setPrimary?: boolean;
      bytes: Uint8Array;
      declaredMime?: string | null;
      originalName?: string | null;
    },
    actor: DrugEntityMediaActor
  ): Promise<DrugEntityMediaRecord> {
    const entityId = await this.assertWritableTarget(input.entityType, input.entityId);
    if (input.sourceCaseId) await this.assertCaseExists(input.sourceCaseId);
    const category = resolveMediaCategory(input.entityType, input.category);
    const validated = validateBoardImageBytes({ bytes: input.bytes, declaredMime: input.declaredMime });
    const mediaId = generateDrugId();
    const storagePath = buildEntityMediaStoragePath(input.entityType, entityId, mediaId, validated.extension);
    const existing = await this.media.listByEntity(input.entityType, entityId);
    const makePrimary = input.setPrimary === true || existing.length === 0;

    await this.store.put({ storagePath, bytes: input.bytes, mimeType: validated.mimeType });
    try {
      if (makePrimary) await this.media.clearPrimary(input.entityType, entityId);
      const row = await this.media.create({
        id: mediaId,
        entityType: input.entityType,
        entityId,
        category,
        storagePath,
        fileName: sanitizeOriginalFilename(input.originalName),
        mimeType: validated.mimeType,
        fileSize: input.bytes.byteLength,
        width: validated.width,
        height: validated.height,
        caption: emptyToNull(input.caption),
        description: emptyToNull(input.description),
        isPrimary: makePrimary,
        sourceCaseId: input.sourceCaseId || null,
        capturedAt: parseOptionalDate(input.capturedAt),
        uploadedBy: actor.actorId,
        uploadedByName: actor.actorName,
      });
      await this.audit.record({
        entityType: AUDIT_ENTITY,
        entityId: mediaId,
        action: "entity_media_uploaded",
        actorId: actor.actorId,
        actorName: actor.actorName,
        detail: JSON.stringify({
          targetType: input.entityType,
          targetId: entityId,
          category,
          isPrimary: makePrimary,
          sourceCaseId: input.sourceCaseId || null,
        }),
      });
      return this.toRecord(row, "full");
    } catch (error) {
      try {
        await this.store.remove(storagePath);
      } catch (cleanupError) {
        console.error("entity media upload compensation failed", cleanupError instanceof Error ? cleanupError.name : "unknown");
      }
      throw error;
    }
  }

  async update(
    mediaId: string,
    patch: {
      category?: string | null;
      caption?: string | null;
      description?: string | null;
      sourceCaseId?: string | null;
      capturedAt?: string | null;
      isPrimary?: boolean;
    },
    actor: DrugEntityMediaActor
  ): Promise<DrugEntityMediaRecord> {
    const row = await this.media.findById(mediaId);
    if (!row) throw new EntityMediaNotFoundError();
    await this.assertWritableTarget(row.entityType as DrugEntityMediaEntityType, row.entityId);
    if (patch.sourceCaseId) await this.assertCaseExists(patch.sourceCaseId);

    const nextCategory =
      patch.category !== undefined
        ? resolveMediaCategory(row.entityType as DrugEntityMediaEntityType, patch.category)
        : row.category;

    if (patch.isPrimary === true && !row.isPrimary) {
      await this.media.clearPrimary(row.entityType, row.entityId);
    }

    const updated = await this.media.update(mediaId, {
      category: nextCategory,
      caption: patch.caption !== undefined ? emptyToNull(patch.caption) : row.caption,
      description: patch.description !== undefined ? emptyToNull(patch.description) : row.description,
      sourceCaseId: patch.sourceCaseId !== undefined ? patch.sourceCaseId || null : row.sourceCaseId,
      capturedAt: patch.capturedAt !== undefined ? parseOptionalDate(patch.capturedAt) : row.capturedAt,
      isPrimary: patch.isPrimary === true ? true : row.isPrimary,
    });

    await this.audit.record({
      entityType: AUDIT_ENTITY,
      entityId: mediaId,
      action: patch.isPrimary === true ? "entity_media_primary_set" : "entity_media_updated",
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({
        targetType: row.entityType,
        targetId: row.entityId,
        isPrimary: updated.isPrimary,
      }),
    });
    return this.toRecord(updated, "full");
  }

  async remove(mediaId: string, actor: DrugEntityMediaActor): Promise<void> {
    const row = await this.media.findById(mediaId);
    if (!row) throw new EntityMediaNotFoundError();
    await this.assertWritableTarget(row.entityType as DrugEntityMediaEntityType, row.entityId);
    await this.media.deleteById(mediaId);
    try {
      await this.store.remove(row.storagePath);
    } catch (error) {
      console.error("entity media storage remove failed", error instanceof Error ? error.name : "unknown");
    }
    await this.audit.record({
      entityType: AUDIT_ENTITY,
      entityId: mediaId,
      action: "entity_media_removed",
      actorId: actor.actorId,
      actorName: actor.actorName,
      detail: JSON.stringify({
        targetType: row.entityType,
        targetId: row.entityId,
        wasPrimary: row.isPrimary,
      }),
    });
  }

  async visualsFor(
    refs: Array<{ entityType: string; entityId: string }>
  ): Promise<Map<string, DrugEntityMediaVisual>> {
    const wanted = refs.filter((ref) => (ENTITY_MEDIA_VISUAL_TYPES as readonly string[]).includes(ref.entityType));
    const personIds = [...new Set(wanted.filter((ref) => ref.entityType === "PERSON").map((ref) => ref.entityId))];
    const persons =
      personIds.length > 0 ? await this.db.drugPerson.findMany({ where: { id: { in: personIds } } }) : [];
    const personMap = new Map(persons.map((person) => [person.id, person]));
    const resolveId = (entityType: string, entityId: string): string => {
      if (entityType !== "PERSON") return entityId;
      const person = personMap.get(entityId);
      return person?.status === "MERGED" && person.mergedIntoPersonId ? person.mergedIntoPersonId : entityId;
    };

    const byType = new Map<string, Set<string>>();
    for (const ref of wanted) {
      const set = byType.get(ref.entityType) ?? new Set<string>();
      set.add(resolveId(ref.entityType, ref.entityId));
      byType.set(ref.entityType, set);
    }

    const byResolved = new Map<string, DrugEntityMediaVisual>();
    for (const [entityType, ids] of byType) {
      const rows = await this.media.findPrimaries(entityType, [...ids]);
      await Promise.all(
        rows.map(async (row) => {
          const signed = await this.safeSign(row.storagePath, true);
          byResolved.set(visualLookupKey(entityType, row.entityId), {
            mediaId: row.id,
            thumbnailUrl: signed?.url ?? null,
            expiresAt: signed?.expiresAt ?? null,
          });
        })
      );
    }

    const remapped = new Map<string, DrugEntityMediaVisual>();
    for (const ref of wanted) {
      const visual = byResolved.get(visualLookupKey(ref.entityType, resolveId(ref.entityType, ref.entityId)));
      if (visual) remapped.set(visualLookupKey(ref.entityType, ref.entityId), visual);
    }
    return remapped;
  }

  async photoCountsFor(
    refs: Array<{ entityType: string; entityId: string }>
  ): Promise<Map<string, number>> {
    const wanted = refs.filter((ref) => (ENTITY_MEDIA_VISUAL_TYPES as readonly string[]).includes(ref.entityType));
    const personIds = [...new Set(wanted.filter((ref) => ref.entityType === "PERSON").map((ref) => ref.entityId))];
    const persons =
      personIds.length > 0 ? await this.db.drugPerson.findMany({ where: { id: { in: personIds } } }) : [];
    const personMap = new Map(persons.map((person) => [person.id, person]));
    const resolveId = (entityType: string, entityId: string): string => {
      if (entityType !== "PERSON") return entityId;
      const person = personMap.get(entityId);
      return person?.status === "MERGED" && person.mergedIntoPersonId ? person.mergedIntoPersonId : entityId;
    };

    const byType = new Map<string, Set<string>>();
    for (const ref of wanted) {
      const set = byType.get(ref.entityType) ?? new Set<string>();
      set.add(resolveId(ref.entityType, ref.entityId));
      byType.set(ref.entityType, set);
    }

    const byResolved = new Map<string, number>();
    for (const [entityType, ids] of byType) {
      const counts = await this.media.countByEntities(entityType, [...ids]);
      for (const [entityId, count] of counts) {
        byResolved.set(visualLookupKey(entityType, entityId), count);
      }
    }

    const remapped = new Map<string, number>();
    for (const ref of wanted) {
      remapped.set(
        visualLookupKey(ref.entityType, ref.entityId),
        byResolved.get(visualLookupKey(ref.entityType, resolveId(ref.entityType, ref.entityId))) ?? 0
      );
    }
    return remapped;
  }

  async remapPersonMediaOnMerge(survivorPersonId: string, mergedPersonId: string): Promise<number> {
    const incoming = await this.media.listByEntity("PERSON", mergedPersonId);
    if (incoming.length === 0) return 0;
    const survivorHasPrimary = (await this.media.listByEntity("PERSON", survivorPersonId)).some((row) => row.isPrimary);
    await this.media.reassignEntity("PERSON", mergedPersonId, survivorPersonId);
    if (!survivorHasPrimary) {
      const first = incoming[0];
      if (first) await this.media.update(first.id, { isPrimary: true });
    }
    return incoming.length;
  }

  private async toRecord(row: DrugEntityMedia, variant: "full" | "thumb"): Promise<DrugEntityMediaRecord> {
    const signed = await this.safeSign(row.storagePath, variant === "thumb");
    const thumb = variant === "full" ? await this.safeSign(row.storagePath, true) : signed;
    return {
      id: row.id,
      entityType: row.entityType as DrugEntityMediaEntityType,
      entityId: row.entityId,
      mediaType: "PHOTO",
      category: row.category,
      fileName: row.fileName,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      width: row.width,
      height: row.height,
      caption: row.caption,
      description: row.description,
      isPrimary: row.isPrimary,
      sourceCaseId: row.sourceCaseId,
      capturedAt: row.capturedAt ? row.capturedAt.toISOString() : null,
      uploadedBy: row.uploadedBy,
      uploadedByName: row.uploadedByName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      url: variant === "full" ? signed?.url ?? null : null,
      thumbnailUrl: thumb?.url ?? null,
      expiresAt: signed?.expiresAt ?? null,
    };
  }

  private async safeSign(storagePath: string, thumbnail: boolean): Promise<{ url: string; expiresAt: string } | null> {
    try {
      const signed = await this.store.sign(
        storagePath,
        BOARD_IMAGE_SIGNED_TTL_SECONDS,
        thumbnail ? THUMB : undefined
      );
      return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
    } catch {
      return null;
    }
  }

  private async assertWritableTarget(entityType: DrugEntityMediaEntityType, entityId: string): Promise<string> {
    if (entityType === "PERSON") {
      const person = await this.db.drugPerson.findUnique({ where: { id: entityId } });
      if (!person) throw new EntityMediaTargetNotFoundError(entityType, entityId);
      if (person.status === "MERGED") throw new EntityMediaMergedWriteError();
      return person.id;
    }
    const exists = await this.entityExists(entityType, entityId);
    if (!exists) throw new EntityMediaTargetNotFoundError(entityType, entityId);
    return entityId;
  }

  private async resolveReadEntityId(entityType: DrugEntityMediaEntityType, entityId: string): Promise<string> {
    if (entityType !== "PERSON") return entityId;
    const person = await this.db.drugPerson.findUnique({ where: { id: entityId } });
    if (person?.status === "MERGED" && person.mergedIntoPersonId) return person.mergedIntoPersonId;
    return entityId;
  }

  private async assertCaseExists(caseId: string): Promise<void> {
    const found = await this.db.drugCase.findUnique({ where: { id: caseId } });
    if (!found) throw new EntityMediaTargetNotFoundError("CASE", caseId);
  }

  private async entityExists(entityType: DrugEntityMediaEntityType, entityId: string): Promise<boolean> {
    if (entityType === "VEHICLE") return Boolean(await this.db.drugVehicle.findUnique({ where: { id: entityId } }));
    if (entityType === "CASE") return Boolean(await this.db.drugCase.findUnique({ where: { id: entityId } }));
    if (entityType === "LOCATION") return Boolean(await this.db.drugLocation.findUnique({ where: { id: entityId } }));
    if (entityType === "SEIZED_ITEM") return Boolean(await this.db.drugSeizedItem.findUnique({ where: { id: entityId } }));
    if (entityType === "DEVICE") return Boolean(await this.db.drugDevice.findUnique({ where: { id: entityId } }));
    return false;
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 400) : null;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
