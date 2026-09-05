/**
 * DrugInvestigationBoardRepository (DI-9.5B).
 *
 * Persistence only — ownership and permission live in the service.
 * Optimistic concurrency uses updateMany WHERE id + version (CAS).
 */

import type { DatabaseClient, DrugInvestigationBoard } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";
import type { DrugInvestigationBoardStateV1 } from "@/lib/drug_intelligence/drug_investigation_board_state";
import type { DrugInvestigationBoardStatus } from "@/lib/drug_intelligence/drug_investigation_board_types";

export interface DrugInvestigationBoardCreateInput {
  title: string;
  description: string | null;
  ownerActorId: string;
  ownerActorName: string;
  actorId: string;
  actorName: string;
  focusType: string | null;
  focusId: string | null;
  state: DrugInvestigationBoardStateV1;
}

export interface DrugInvestigationBoardUpdateInput {
  title?: string;
  description?: string | null;
  focusType?: string | null;
  focusId?: string | null;
  state?: DrugInvestigationBoardStateV1;
  status?: DrugInvestigationBoardStatus;
  updatedBy: string;
  updatedByName: string;
}

export class DrugInvestigationBoardRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: string): Promise<DrugInvestigationBoard | null> {
    return this.db.drugInvestigationBoard.findUnique({ where: { id } });
  }

  listByOwner(ownerActorId: string, status: DrugInvestigationBoardStatus = "ACTIVE"): Promise<DrugInvestigationBoard[]> {
    return this.db.drugInvestigationBoard.findMany({
      where: { ownerActorId, status },
      orderBy: { updatedAt: "desc" },
    });
  }

  create(input: DrugInvestigationBoardCreateInput): Promise<DrugInvestigationBoard> {
    return this.db.drugInvestigationBoard.create({
      data: {
        id: generateDrugId(),
        title: input.title,
        description: input.description,
        status: "ACTIVE",
        ownerActorId: input.ownerActorId,
        ownerActorName: input.ownerActorName,
        createdBy: input.actorId,
        createdByName: input.actorName,
        updatedBy: input.actorId,
        updatedByName: input.actorName,
        version: 1,
        schemaVersion: 1,
        focusType: input.focusType,
        focusId: input.focusId,
        state: input.state,
      },
    });
  }

  /**
   * Compare-and-swap: updates only when `version === expectedVersion`,
   * then sets version to expectedVersion + 1. Returns null on mismatch/missing.
   */
  async updateIfVersion(
    id: string,
    expectedVersion: number,
    patch: DrugInvestigationBoardUpdateInput
  ): Promise<DrugInvestigationBoard | null> {
    const data: Record<string, unknown> = {
      version: expectedVersion + 1,
      updatedBy: patch.updatedBy,
      updatedByName: patch.updatedByName,
    };
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.focusType !== undefined) data.focusType = patch.focusType;
    if (patch.focusId !== undefined) data.focusId = patch.focusId;
    if (patch.state !== undefined) data.state = patch.state;
    if (patch.status !== undefined) data.status = patch.status;

    const result = await this.db.drugInvestigationBoard.updateMany({
      where: { id, version: expectedVersion },
      data,
    });
    if (result.count !== 1) return null;
    return this.findById(id);
  }

  async touchLastOpenedAt(id: string): Promise<void> {
    await this.db.drugInvestigationBoard.updateMany({
      where: { id },
      data: { lastOpenedAt: new Date() },
    });
  }
}
