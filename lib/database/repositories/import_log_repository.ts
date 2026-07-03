/**
 * ImportLogRepository (Phase 12).
 *
 * Repository-pattern access for ImportLog rows — one per officer processed in
 * an import job, recording the action taken (created/updated/skipped/error)
 * and an optional message. Over an injected DatabaseClient. Pure data access.
 */

import type { DatabaseClient, ImportLog, ImportAction } from "@/lib/database/database_types";

export class ImportLogRepository {
  constructor(private readonly db: DatabaseClient) {}

  record(jobId: number, officerId: string, action: ImportAction, message?: string): Promise<ImportLog> {
    return this.db.importLog.create({
      data: { jobId, officerId, action, message: message ?? null },
    });
  }

  countForJob(jobId: number): Promise<number> {
    return this.db.importLog.count({ where: { jobId } });
  }
}
