/**
 * DatabaseImporter (Phase 12).
 *
 * Persists the exported personnel data into the relational database,
 * idempotently. It CONSUMES the existing layers rather than duplicating their
 * logic: officers + derived fields come from the Phase 11A Knowledge Layer,
 * quality scores from the Phase 11B Quality Layer, and timeline year parsing
 * from the knowledge layer's `extractTimelineYear`. No OpenAI/OCR/Drive; no
 * pipeline modification.
 *
 * Per officer, inside a single transaction (so a failure rolls back that
 * officer cleanly):
 *   1. upsert Officer by unique officerId (create vs. update tallied),
 *   2. replace the officer's Timeline rows (delete-all then insert in order),
 *   3. upsert the officer's Phone (unique per officer+number),
 *   4. upsert each served Unit by unique name.
 * Re-running produces 0 duplicate officers and 0 duplicate timelines.
 *
 * Repositories and the client are constructor-injected (repository pattern,
 * dependency injection, no globals/singleton).
 */

import type { DatabaseClient, ImportAction } from "@/lib/database/database_types";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository, type TimelineRowInput } from "@/lib/database/repositories/timeline_repository";
import { PhoneRepository } from "@/lib/database/repositories/phone_repository";
import { UnitRepository } from "@/lib/database/repositories/unit_repository";
import { ImportJobRepository } from "@/lib/database/repositories/import_job_repository";
import { ImportLogRepository } from "@/lib/database/repositories/import_log_repository";
import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import { extractTimelineYear } from "@/lib/knowledge/timeline_index";

/** One officer to persist: the knowledge model plus its computed quality score. */
export interface ImportableOfficer {
  officer: KnowledgeOfficer;
  qualityScore: number | null;
}

/** The logs/database_import_summary.json shape. */
export interface DatabaseImportSummary {
  officers_created: number;
  officers_updated: number;
  timelines_created: number;
  units_created: number;
  phones_created: number;
  duplicates_skipped: number;
  errors: number;
  elapsed_ms: number;
}

export interface DatabaseImporterDependencies {
  client: DatabaseClient;
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Maps a KnowledgeOfficer + quality score to the OfficerRepository input. */
function toOfficerInput(item: ImportableOfficer): OfficerInput {
  const { officer, qualityScore } = item;
  return {
    officerId: officer.identity.id,
    rank: officer.identity.rank,
    firstName: officer.identity.first_name,
    lastName: officer.identity.last_name,
    currentPosition: officer.career.current_position,
    currentUnit: officer.career.current_unit,
    phone: nonEmpty(officer.career.phone),
    careerYears: officer.career.career_length,
    qualityScore,
    // Knowledge score: the officer's own extraction confidence, as carried
    // through the knowledge model (a knowledge-layer signal, not recomputed).
    knowledgeScore: Number.isFinite(officer.confidence) ? Math.round(officer.confidence) : null,
    region: nonEmpty(officer.identity.region),
    confidence: Number.isFinite(officer.confidence) ? Math.round(officer.confidence) : null,
  };
}

/** Maps the officer's timeline to sequenced rows (source `year` verbatim + parsed numeric year). */
function toTimelineRows(officer: KnowledgeOfficer): TimelineRowInput[] {
  return officer.timeline.map((entry, index) => ({
    sequence: index,
    year: entry.year ?? "",
    yearValue: extractTimelineYear(entry.year ?? ""),
    position: entry.position ?? "",
    unit: nonEmpty(entry.unit ?? null),
  }));
}

export class DatabaseImporter {
  private readonly client: DatabaseClient;

  constructor(dependencies: DatabaseImporterDependencies) {
    this.client = dependencies.client;
  }

  /**
   * Imports every officer, recording an ImportJob + per-officer ImportLog.
   * Each officer is persisted in its own transaction; an officer that throws
   * is rolled back, logged as an error, and does not abort the run.
   */
  async import(officers: ImportableOfficer[]): Promise<DatabaseImportSummary> {
    const startedAt = Date.now();

    const jobRepo = new ImportJobRepository(this.client);
    const logRepo = new ImportLogRepository(this.client);
    const job = await jobRepo.start();

    let officersCreated = 0;
    let officersUpdated = 0;
    let timelinesCreated = 0;
    let unitsCreated = 0;
    let phonesCreated = 0;
    let duplicatesSkipped = 0;
    let errors = 0;

    for (const item of officers) {
      const officerId = item.officer.identity.id;
      try {
        const result = await this.client.$transaction(async (tx) => this.persistOfficer(tx, item));

        if (result.created) officersCreated += 1;
        else {
          officersUpdated += 1;
          // An update on a second run means this officer already existed —
          // counted as a "duplicate" that was skipped-as-new (not inserted twice).
          duplicatesSkipped += 1;
        }
        timelinesCreated += result.timelines;
        unitsCreated += result.unitsCreated;
        phonesCreated += result.phonesCreated;

        await logRepo.record(job.id, officerId, result.created ? "created" : "updated");
      } catch (error) {
        errors += 1;
        const message = error instanceof Error ? error.message : String(error);
        await logRepo.record(job.id, officerId, "error" as ImportAction, message);
      }
    }

    const summary: DatabaseImportSummary = {
      officers_created: officersCreated,
      officers_updated: officersUpdated,
      timelines_created: timelinesCreated,
      units_created: unitsCreated,
      phones_created: phonesCreated,
      duplicates_skipped: duplicatesSkipped,
      errors,
      elapsed_ms: Date.now() - startedAt,
    };

    await jobRepo.finish(job.id, {
      images: officers.length,
      imported: officersCreated + officersUpdated,
      skipped: duplicatesSkipped,
      errors,
    });

    return summary;
  }

  /** Persists one officer + its timeline/phone/units within the given (transaction) client. */
  private async persistOfficer(
    tx: DatabaseClient,
    item: ImportableOfficer
  ): Promise<{ created: boolean; timelines: number; unitsCreated: number; phonesCreated: number }> {
    const officerRepo = new OfficerRepository(tx);
    const timelineRepo = new TimelineRepository(tx);
    const phoneRepo = new PhoneRepository(tx);
    const unitRepo = new UnitRepository(tx);

    const { officer, created } = await officerRepo.upsert(toOfficerInput(item));

    // Replace timeline (idempotent — never duplicates on re-import).
    const timelines = await timelineRepo.replaceForOfficer(officer.id, toTimelineRows(item.officer));

    // Phone (unique per officer+number).
    let phonesCreated = 0;
    const phone = nonEmpty(item.officer.career.phone);
    if (phone) {
      const { created: phoneCreated } = await phoneRepo.upsert(officer.id, phone);
      if (phoneCreated) phonesCreated += 1;
    }

    // Units served (deduped by unique name).
    let unitsCreated = 0;
    for (const unitName of item.officer.units) {
      const { created: unitCreated } = await unitRepo.upsert(unitName, 0);
      if (unitCreated) unitsCreated += 1;
    }

    return { created, timelines, unitsCreated, phonesCreated };
  }
}
