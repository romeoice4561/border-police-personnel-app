/**
 * ImportJobRepository (Phase 12).
 *
 * Repository-pattern access for ImportJob rows (one per database-import run)
 * over an injected DatabaseClient. Records the run's start/finish and its
 * created/updated/skipped/error tallies for auditing. Pure data access — no
 * business logic, no OpenAI/OCR/Drive.
 */

import type { DatabaseClient, ImportJob } from "@/lib/database/database_types";

export interface ImportJobResult {
  images: number;
  imported: number;
  skipped: number;
  errors: number;
}

export class ImportJobRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** Opens a new import job (startedAt defaults to now). */
  start(): Promise<ImportJob> {
    return this.db.importJob.create({ data: {} });
  }

  /** Closes a job with its finishedAt timestamp and final tallies. */
  finish(jobId: number, result: ImportJobResult): Promise<ImportJob> {
    return this.db.importJob.update({
      where: { id: jobId },
      data: {
        finishedAt: new Date(),
        images: result.images,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      },
    });
  }

  count(): Promise<number> {
    return this.db.importJob.count();
  }
}
