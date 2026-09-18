/**
 * DrugEntityMediaRepository — metadata only. Bytes live in private storage.
 */

import type { DatabaseClient, DrugEntityMedia } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";

export interface DrugEntityMediaCreateInput {
  id?: string;
  entityType: string;
  entityId: string;
  mediaType?: string;
  category: string;
  storagePath: string;
  fileName?: string | null;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  description?: string | null;
  isPrimary?: boolean;
  sourceCaseId?: string | null;
  capturedAt?: Date | null;
  uploadedBy: string;
  uploadedByName: string;
}

export class DrugEntityMediaRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: string): Promise<DrugEntityMedia | null> {
    return this.db.drugEntityMedia.findUnique({ where: { id } });
  }

  listByEntity(entityType: string, entityId: string): Promise<DrugEntityMedia[]> {
    return this.db.drugEntityMedia.findMany({
      where: { entityType, entityId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
  }

  findPrimaries(entityType: string, entityIds: string[]): Promise<DrugEntityMedia[]> {
    if (entityIds.length === 0) return Promise.resolve([]);
    return this.db.drugEntityMedia.findMany({
      where: { entityType, entityId: { in: entityIds }, isPrimary: true },
    });
  }

  countByEntity(entityType: string, entityId: string): Promise<number> {
    return this.db.drugEntityMedia.count({ where: { entityType, entityId } });
  }

  async countByEntities(entityType: string, entityIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (entityIds.length === 0) return counts;
    const rows = await this.db.drugEntityMedia.findMany({
      where: { entityType, entityId: { in: entityIds } },
    });
    for (const row of rows) {
      counts.set(row.entityId, (counts.get(row.entityId) ?? 0) + 1);
    }
    return counts;
  }

  create(input: DrugEntityMediaCreateInput): Promise<DrugEntityMedia> {
    return this.db.drugEntityMedia.create({
      data: {
        id: input.id ?? generateDrugId(),
        entityType: input.entityType,
        entityId: input.entityId,
        mediaType: input.mediaType ?? "PHOTO",
        category: input.category,
        storagePath: input.storagePath,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        width: input.width ?? null,
        height: input.height ?? null,
        caption: input.caption ?? null,
        description: input.description ?? null,
        isPrimary: input.isPrimary ?? false,
        sourceCaseId: input.sourceCaseId ?? null,
        capturedAt: input.capturedAt ?? null,
        uploadedBy: input.uploadedBy,
        uploadedByName: input.uploadedByName,
      },
    });
  }

  update(
    id: string,
    data: Partial<
      Pick<
        DrugEntityMedia,
        "category" | "caption" | "description" | "isPrimary" | "sourceCaseId" | "capturedAt"
      >
    >
  ): Promise<DrugEntityMedia> {
    return this.db.drugEntityMedia.update({ where: { id }, data });
  }

  clearPrimary(entityType: string, entityId: string): Promise<{ count: number }> {
    return this.db.drugEntityMedia.updateMany({
      where: { entityType, entityId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  reassignEntity(entityType: string, fromEntityId: string, toEntityId: string): Promise<{ count: number }> {
    return this.db.drugEntityMedia.updateMany({
      where: { entityType, entityId: fromEntityId },
      data: { entityId: toEntityId, isPrimary: false },
    });
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.drugEntityMedia.deleteMany({ where: { id } });
    return result.count === 1;
  }
}
