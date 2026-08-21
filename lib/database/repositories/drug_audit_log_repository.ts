/**
 * DrugAuditLogRepository (Phase DI-1 — Section 21).
 *
 * Append-only audit trail for the whole Drug Intelligence module. Every
 * write goes through `record()` — never updated or deleted afterward.
 */

import type { DatabaseClient, DrugAuditLog } from "@/lib/database/database_types";

export interface DrugAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorName: string;
  detail?: string | null;
}

export class DrugAuditLogRepository {
  constructor(private readonly db: DatabaseClient) {}

  record(input: DrugAuditLogInput): Promise<DrugAuditLog> {
    return this.db.drugAuditLog.create({ data: { ...input, detail: input.detail ?? null } });
  }

  forEntity(entityType: string, entityId: string): Promise<DrugAuditLog[]> {
    return this.db.drugAuditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
  }
}
