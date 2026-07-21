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
  /**
   * Phase 41 Part 1: structured Position Level — additive alongside the
   * free-text `position` above (never merged). Optional so existing import
   * callers that don't set it leave the column null (readers treat null as
   * Unknown). The Officer Profile workspace always sends a canonical value.
   */
  positionLevel?: string | null;
  source?: string | null;
  verified?: string;
  /**
   * Phase 26B Part 3: structured date model, additive alongside `year`/
   * `yearValue` above (never replaced — every caller that doesn't know about
   * these fields, e.g. the Phase 25 import pipeline, simply omits them and
   * the DB defaults/nulls apply, exactly like `rank`/`source` above).
   */
  day?: number | null;
  month?: number | null;
  yearBE?: number | null;
  appointmentCycle?: number | null;
  isPresent?: boolean;
  effectiveDate?: Date | null;
  /**
   * Phase 26B Part C: structured org hierarchy, additive alongside `unit`
   * above (never replaced — omitted by any caller that doesn't know about
   * these fields, same convention as day/month/yearBE above).
   */
  headquartersId?: number | null;
  regionId?: number | null;
  battalionId?: number | null;
  companyId?: number | null;
  /**
   * Phase 49A.2B: free-text org labels per hierarchy level — additive
   * alongside the id FKs above. Omitted by callers that don't know about
   * them (import path); workspace always sends them for exact round-trip.
   */
  headquartersText?: string | null;
  regionText?: string | null;
  battalionText?: string | null;
  companyText?: string | null;
  /** Phase 49A.3: official order reference + work line — additive free text. */
  appointmentOrder?: string | null;
  workLine?: string | null;
  /**
   * Phase 26B Part 5 Part D/H/M: verification triad — ADDITIVE alongside the
   * existing free-text `verified` column above (untouched). A NEW closed
   * 4-value status (see verification_options.ts) plus who/when/why verified
   * it. Omitted by any caller that doesn't know about these fields, same
   * convention as day/month/yearBE — every historical row permanently keeps
   * whatever verification state it had when it was saved.
   */
  verificationStatus?: string | null;
  verifiedBy?: string | null;
  verifiedDate?: Date | null;
  verificationRemark?: string | null;
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
