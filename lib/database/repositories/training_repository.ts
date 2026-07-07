/**
 * TrainingRepository (Phase 23A — Officer Profile Workspace).
 *
 * Repository-pattern access for Training rows over an injected
 * DatabaseClient. Mirrors TimelineRepository/EducationRepository's
 * replace-all convention: saving an officer's training list from the
 * workspace's single "Save" action deletes all existing rows for that
 * officer and recreates them.
 *
 * Pure data access only — no business logic.
 */

import type { DatabaseClient } from "@/lib/database/database_types";

export interface TrainingRowInput {
  year: string | null;
  course: string;
  organization: string | null;
  notes: string | null;
}

export class TrainingRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** Removes all training rows for an officer (used before a clean re-insert). */
  deleteForOfficer(officerId: number): Promise<{ count: number }> {
    return this.db.training.deleteMany({ where: { officerId } });
  }

  /** Replaces an officer's training rows with `rows` (delete-all then create). Returns the count written. */
  async replaceForOfficer(officerId: number, rows: TrainingRowInput[]): Promise<number> {
    await this.deleteForOfficer(officerId);
    for (const row of rows) {
      await this.db.training.create({ data: { officerId, ...row } });
    }
    return rows.length;
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.training.count({ where: { officerId } });
  }
}
