/**
 * ImportLogger (Phase 17).
 *
 * Owns the ImportJob lifecycle and per-officer ImportLog writes, reusing the
 * existing ImportJobRepository / ImportLogRepository. One ImportJob is opened
 * per run and closed with the final tallies (imported / failed counts +
 * elapsed time); each officer produces one ImportLog line recording the action
 * (created / updated / error) and, on failure, the structured error message.
 *
 * Log writes are intentionally performed OUTSIDE the per-officer data
 * transaction: a rolled-back officer must still leave an audit trail of WHY it
 * failed, which a log written inside the same transaction would lose on
 * rollback.
 */

import type { DatabaseClient, ImportJob } from "@/lib/database/database_types";
import { ImportJobRepository } from "@/lib/database/repositories/import_job_repository";
import { ImportLogRepository } from "@/lib/database/repositories/import_log_repository";
import type { OfficerImportResult } from "@/lib/import/types";

export class ImportLogger {
  private readonly jobRepo: ImportJobRepository;
  private readonly logRepo: ImportLogRepository;
  private job: ImportJob | undefined;

  constructor(private readonly client: DatabaseClient) {
    this.jobRepo = new ImportJobRepository(client);
    this.logRepo = new ImportLogRepository(client);
  }

  /** Opens the ImportJob for this run. Returns its id. */
  async start(): Promise<number> {
    this.job = await this.jobRepo.start();
    return this.job.id;
  }

  private requireJobId(): number {
    if (!this.job) throw new Error("ImportLogger.start() must be called before logging.");
    return this.job.id;
  }

  /** Records one officer's outcome as an ImportLog line (action + optional error). */
  async record(result: OfficerImportResult): Promise<void> {
    const action = result.action === "failed" ? "error" : result.action;
    await this.logRepo.record(this.requireJobId(), result.officerId, action, result.error);
  }

  /** Closes the ImportJob with the run's tallies. */
  async finish(tallies: { total: number; imported: number; failed: number }): Promise<void> {
    await this.jobRepo.finish(this.requireJobId(), {
      images: tallies.total,
      imported: tallies.imported,
      skipped: 0,
      errors: tallies.failed,
    });
  }
}
