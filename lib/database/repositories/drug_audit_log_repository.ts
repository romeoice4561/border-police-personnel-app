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

  /**
   * DI-10E.4: actor-scoped recent export_created rows. take is clamped to 1–50.
   * Never returns other actors. Never unbounded.
   */
  recentExportsForActor(input: { actorId: string; take: number }): Promise<Array<Pick<DrugAuditLog, "id" | "createdAt" | "detail">>> {
    const take = Math.min(50, Math.max(1, Math.trunc(input.take)));
    return this.db.drugAuditLog.findMany({
      where: { actorId: input.actorId, action: "export_created" },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, createdAt: true, detail: true },
    }) as Promise<Array<Pick<DrugAuditLog, "id" | "createdAt" | "detail">>>;
  }
}
