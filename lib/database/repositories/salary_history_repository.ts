/**
 * SalaryHistoryRepository (Phase 28A — Career Intelligence Foundation).
 *
 * Repository-pattern access for SalaryHistory rows over an injected
 * DatabaseClient. Mirrors EducationRepository/TrainingRepository's
 * replace-all convention: saving an officer's salary history from the
 * workspace's single "Save" action deletes all existing rows for that
 * officer and recreates them, so the workspace never needs create/update/
 * delete diffing logic — the same simplification already proven safe for
 * Education/Training/Timeline. `@@unique([officerId, yearBE])` at the
 * database level still guarantees one record per officer per year even
 * within this replace-all write.
 *
 * Pure data access only — no business logic (see career_salary_engine.ts
 * for pure calculation utilities over already-fetched rows).
 */

import type { DatabaseClient, SalaryHistory } from "@/lib/database/database_types";

export interface SalaryHistoryRowInput {
  yearBE: number;
  salaryStep: number;
  remarks: string | null;
}

export class SalaryHistoryRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** Every salary-history row for an officer, in no particular order (callers sort via career_salary_engine.ts's sortHistory). */
  getSalaryHistory(officerId: number): Promise<SalaryHistory[]> {
    return this.db.salaryHistory.findMany({ where: { officerId } });
  }

  /** Removes all salary-history rows for an officer (used before a clean re-insert). */
  deleteSalaryHistory(officerId: number): Promise<{ count: number }> {
    return this.db.salaryHistory.deleteMany({ where: { officerId } });
  }

  /** Upserts a single year's salary-step result for an officer, keyed on the (officerId, yearBE) unique constraint. */
  upsertSalaryHistory(officerId: number, row: SalaryHistoryRowInput): Promise<SalaryHistory> {
    return this.db.salaryHistory.upsert({
      where: { officerId_yearBE: { officerId, yearBE: row.yearBE } },
      create: { officerId, ...row },
      update: { ...row },
    });
  }

  /** Replaces an officer's whole salary-history list with `rows` (delete-all then create). Returns the count written. */
  async saveSalaryHistory(officerId: number, rows: SalaryHistoryRowInput[]): Promise<number> {
    await this.deleteSalaryHistory(officerId);
    for (const row of rows) {
      await this.db.salaryHistory.create({ data: { officerId, ...row } });
    }
    return rows.length;
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.salaryHistory.count({ where: { officerId } });
  }
}
