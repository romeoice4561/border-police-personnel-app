/**
 * DrugInvestigationBoardImageRepository (DI-9.5D).
 *
 * Metadata only — bytes live in private storage. Ownership lives in the service.
 */

import type { DatabaseClient, DrugInvestigationBoardImage } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";

export interface DrugInvestigationBoardImageCreateInput {
  id?: string;
  boardId: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  originalName?: string | null;
  createdBy: string;
}

export class DrugInvestigationBoardImageRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: string): Promise<DrugInvestigationBoardImage | null> {
    return this.db.drugInvestigationBoardImage.findUnique({ where: { id } });
  }

  listByBoard(boardId: string): Promise<DrugInvestigationBoardImage[]> {
    return this.db.drugInvestigationBoardImage.findMany({
      where: { boardId },
      orderBy: { createdAt: "asc" },
    });
  }

  create(input: DrugInvestigationBoardImageCreateInput): Promise<DrugInvestigationBoardImage> {
    return this.db.drugInvestigationBoardImage.create({
      data: {
        id: input.id ?? generateDrugId(),
        boardId: input.boardId,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        width: input.width ?? null,
        height: input.height ?? null,
        originalName: input.originalName ?? null,
        createdBy: input.createdBy,
      },
    });
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.drugInvestigationBoardImage.deleteMany({ where: { id } });
    return result.count === 1;
  }
}
