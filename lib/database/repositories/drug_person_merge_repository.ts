/**
 * DrugPersonMergeRepository (Phase DI-2 — Section 16).
 *
 * Repository-pattern access for the append-only merge history trail. Never
 * updated or deleted after creation — the same convention as DrugAuditLog.
 */

import type { DatabaseClient, DrugPersonMerge } from "@/lib/database/database_types";

export interface DrugPersonMergeCreateInput {
  id: string;
  survivorPersonId: string;
  mergedPersonId: string;
  reason: string | null;
  detail: unknown;
  mergedBy: string;
  mergedByName: string;
}

export class DrugPersonMergeRepository {
  constructor(private readonly db: DatabaseClient) {}

  create(input: DrugPersonMergeCreateInput): Promise<DrugPersonMerge> {
    return this.db.drugPersonMerge.create({ data: { ...input } });
  }

  /** DI-2 Section 18 (unmerge readiness): full history for one person, whichever side (survivor or merged) it appeared on — lets a future admin trace either direction. */
  async forPerson(personId: string): Promise<DrugPersonMerge[]> {
    const asSurvivor = await this.db.drugPersonMerge.findMany({ where: { survivorPersonId: personId } });
    const asMerged = await this.db.drugPersonMerge.findMany({ where: { mergedPersonId: personId } });
    return [...asSurvivor, ...asMerged];
  }
}
