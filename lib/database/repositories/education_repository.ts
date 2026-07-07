/**
 * EducationRepository (Phase 23A — Officer Profile Workspace).
 *
 * Repository-pattern access for Education rows over an injected
 * DatabaseClient. Mirrors TimelineRepository's replace-all convention: saving
 * an officer's education list from the workspace's single "Save" action
 * deletes all existing rows for that officer and recreates them, so the
 * workspace never needs create/update/delete diffing logic — the same
 * simplification already proven safe for Timeline.
 *
 * Pure data access only — no business logic.
 */

import type { DatabaseClient } from "@/lib/database/database_types";

export interface EducationRowInput {
  year: string | null;
  institution: string;
  degree: string | null;
  notes: string | null;
}

export class EducationRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** Removes all education rows for an officer (used before a clean re-insert). */
  deleteForOfficer(officerId: number): Promise<{ count: number }> {
    return this.db.education.deleteMany({ where: { officerId } });
  }

  /** Replaces an officer's education rows with `rows` (delete-all then create). Returns the count written. */
  async replaceForOfficer(officerId: number, rows: EducationRowInput[]): Promise<number> {
    await this.deleteForOfficer(officerId);
    for (const row of rows) {
      await this.db.education.create({ data: { officerId, ...row } });
    }
    return rows.length;
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.education.count({ where: { officerId } });
  }
}
