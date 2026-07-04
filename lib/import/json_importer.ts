/**
 * JsonImporter (Phase 17) — the Production Import Engine.
 *
 * Completes the pipeline: PersonnelResult JSON → Validation → Transaction →
 * Upsert Officer → Replace Timeline → Replace Phones → Resolve Units →
 * ImportLog → Commit. Idempotent by construction: running the same input any
 * number of times updates in place and never duplicates officers, timelines,
 * phones, or units.
 *
 * It orchestrates the existing repositories (Phase 12) over the existing
 * `$transaction` — it does not duplicate data access, redesign the JSON, or
 * modify the OCR/extraction/schema. Each officer is imported in its own atomic
 * transaction; a failure rolls that officer back entirely and is logged, while
 * the rest of the batch continues.
 *
 * Dependency injection: the DatabaseClient is injected (no globals, no
 * singleton), so the engine runs against the real Prisma client in production
 * and a fake in tests.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { canonicalExtraction, resolveImportInput } from "@/lib/import/validation";
import { upsertOfficer } from "@/lib/import/officer_upsert";
import { replaceTimeline } from "@/lib/import/timeline_importer";
import { replacePhones } from "@/lib/import/phone_importer";
import { resolveUnits } from "@/lib/import/unit_resolver";
import { runInTransaction } from "@/lib/import/transaction_runner";
import { ImportLogger } from "@/lib/import/import_logger";
import {
  ImportConflictError,
  ImportError,
  type ImportRunSummary,
  type OfficerImportResult,
  type PersonnelExportFile,
} from "@/lib/import/types";

export interface JsonImporterDependencies {
  client: DatabaseClient;
  /** Optional progress callback, invoked after each officer (for CLI/live progress). */
  onProgress?: (result: OfficerImportResult, index: number, total: number) => void;
}

export class JsonImporter {
  private readonly client: DatabaseClient;
  private readonly onProgress?: JsonImporterDependencies["onProgress"];

  constructor(dependencies: JsonImporterDependencies) {
    this.client = dependencies.client;
    this.onProgress = dependencies.onProgress;
  }

  /**
   * Imports one already-parsed export file atomically and returns its outcome.
   * Validation runs first (outside the transaction); the four data operations
   * run inside a single transaction that commits together or rolls back
   * together.
   */
  async importOne(value: unknown, seenOfficerIds?: Set<string>): Promise<OfficerImportResult> {
    let officerId = "(unresolved)";
    try {
      const input = resolveImportInput(value);
      officerId = input.officerId;

      // Within one run, two different files resolving to the same officerId is
      // a conflict the engine refuses to silently collapse (the second would
      // overwrite the first). Re-running the SAME file across runs is fine.
      if (seenOfficerIds) {
        if (seenOfficerIds.has(officerId)) {
          throw new ImportConflictError(`Duplicate officerId within this run: ${officerId}`, officerId);
        }
        seenOfficerIds.add(officerId);
      }

      const extraction = canonicalExtraction(input.file);
      const timeline = Array.isArray(extraction.timeline) ? extraction.timeline : [];

      const outcome = await runInTransaction(this.client, async (tx) => {
        // 1. Upsert Officer (find-by-officerId → update, else create).
        const { officer, created } = await upsertOfficer(tx, input);

        // 2. Replace Timeline (delete-all + insert).
        const timelines = await replaceTimeline(tx, officer.id, timeline);

        // 3. Replace Phones (delete-all + insert).
        const phones = await replacePhones(tx, officer.id, extraction.phone, extraction.notes);

        // 4. Resolve/Upsert Units (by name, reuse ids).
        const units = await resolveUnits(
          tx,
          officer.currentUnit,
          timeline.map((e) => e.unit ?? null)
        );

        return { created, timelines, phones, unitsCreated: units.created };
      });

      return {
        officerId,
        action: outcome.created ? "created" : "updated",
        timelines: outcome.timelines,
        phones: outcome.phones,
        unitsCreated: outcome.unitsCreated,
      };
    } catch (error) {
      const message =
        error instanceof ImportError ? `${error.name}: ${error.message}` : error instanceof Error ? error.message : String(error);
      return { officerId, action: "failed", timelines: 0, phones: 0, unitsCreated: 0, error: message };
    }
  }

  /**
   * Imports a batch of parsed export files. Opens one ImportJob, imports each
   * file atomically (recording an ImportLog line per officer), and closes the
   * job with the run tallies. Returns the aggregate summary. A per-officer
   * failure never aborts the batch.
   */
  async importBatch(files: unknown[]): Promise<ImportRunSummary> {
    const startedAt = Date.now();
    const logger = new ImportLogger(this.client);
    const jobId = await logger.start();

    const seenOfficerIds = new Set<string>();
    let created = 0;
    let updated = 0;
    let failed = 0;
    let timelinesWritten = 0;
    let phonesWritten = 0;
    let unitsCreated = 0;

    for (let i = 0; i < files.length; i += 1) {
      const result = await this.importOne(files[i], seenOfficerIds);

      if (result.action === "created") created += 1;
      else if (result.action === "updated") updated += 1;
      else failed += 1;

      timelinesWritten += result.timelines;
      phonesWritten += result.phones;
      unitsCreated += result.unitsCreated;

      // Audit line per officer (outside the data transaction — survives rollback).
      await logger.record(result);
      this.onProgress?.(result, i, files.length);
    }

    await logger.finish({ total: files.length, imported: created + updated, failed });

    return {
      jobId,
      total: files.length,
      officers_created: created,
      officers_updated: updated,
      timelines_written: timelinesWritten,
      phones_written: phonesWritten,
      units_created: unitsCreated,
      failed,
      elapsed_ms: Date.now() - startedAt,
    };
  }
}

/** Convenience: is a parsed value shaped like an export file (has an extraction)? Used by the CLI to accept single-object or array inputs. */
export function looksLikeExportFile(value: unknown): value is PersonnelExportFile {
  return (
    typeof value === "object" &&
    value !== null &&
    ("normalized_extraction" in value || "original_extraction" in value)
  );
}
