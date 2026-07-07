/**
 * TimelineRepository (Phase 12).
 *
 * Repository-pattern access for Timeline rows over an injected DatabaseClient.
 * Idempotency: on re-import an officer's timeline is REPLACED (delete-all for
 * the officer, then recreate in sequence order), so re-running the import
 * never produces duplicate timeline rows. The unique (officerId, sequence)
 * constraint backs this at the schema level.
 *
 * The `year` string is stored verbatim from the export (never re-derived);
 * `yearValue` is the parsed numeric year (or null) the importer supplies.
 * Pure data access — no business logic, no OpenAI/OCR/Drive.
 */

import type { DatabaseClient, Timeline } from "@/lib/database/database_types";

export interface TimelineRowInput {
  sequence: number;
  year: string;
  yearValue: number | null;
  position: string;
  unit: string | null;
  /** Phase 23A: per-row rank + provenance/verification — optional so existing import callers are unaffected (DB defaults apply). */
  rank?: string | null;
  source?: string | null;
  verified?: string;
}

export class TimelineRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** Removes all timeline rows for an officer (used before a clean re-insert). */
  deleteForOfficer(officerId: number): Promise<{ count: number }> {
    return this.db.timeline.deleteMany({ where: { officerId } });
  }

  /**
   * Replaces an officer's timeline with `rows` (delete-all then create),
   * making timeline persistence idempotent. Returns the number of rows written.
   */
  async replaceForOfficer(officerId: number, rows: TimelineRowInput[]): Promise<number> {
    await this.deleteForOfficer(officerId);
    for (const row of rows) {
      await this.db.timeline.create({ data: { officerId, ...row } });
    }
    return rows.length;
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.timeline.count({ where: { officerId } });
  }

  findByOfficerAndSequence(officerId: number, sequence: number): Promise<Timeline | null> {
    return this.db.timeline.findUnique({ where: { officerId_sequence: { officerId, sequence } } });
  }
}
