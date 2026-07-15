/**
 * OfficerSkillRepository (Phase 44 — Personnel Capability Intelligence).
 *
 * Repository-pattern access for OfficerSkill rows over an injected
 * DatabaseClient. Mirrors SalaryHistoryRepository/Education/Training's
 * replace-all convention: saving an officer's skills from the workspace's
 * single "Save" action deletes all existing rows for that officer and
 * recreates them, so the workspace never needs create/update/delete diffing.
 * `@@unique([officerId, skillId])` at the database level still guarantees one
 * row per officer per skill even within this replace-all write.
 *
 * Pure data access only — no business logic. The inline certificate fields are
 * written here; the forward-compatible OfficerSkillCertificate child table is
 * NOT written by this phase's UI (it stays empty until a future multi-cert UI).
 */

import type { DatabaseClient, OfficerSkill } from "@/lib/database/database_types";

export interface OfficerSkillRowInput {
  skillId: number;
  levelId: number | null;
  yearsExperience: number | null;
  certificateNumber: string | null;
  issuingOrganization: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  verified: boolean;
  verifiedBy: string | null;
  verifiedDate: Date | null;
  availableForDeployment: boolean;
  remarks: string | null;
}

export class OfficerSkillRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** Every skill row for an officer. */
  getForOfficer(officerId: number): Promise<OfficerSkill[]> {
    return this.db.officerSkill.findMany({ where: { officerId } });
  }

  /** Removes all skill rows for an officer (used before a clean re-insert). */
  deleteForOfficer(officerId: number): Promise<{ count: number }> {
    return this.db.officerSkill.deleteMany({ where: { officerId } });
  }

  /**
   * Replaces an officer's whole skill list with `rows` (delete-all then
   * create). Returns the count written. Deleting the OfficerSkill rows cascades
   * to any OfficerSkillCertificate children (schema onDelete: Cascade).
   */
  async replaceForOfficer(officerId: number, rows: OfficerSkillRowInput[]): Promise<number> {
    await this.deleteForOfficer(officerId);
    for (const row of rows) {
      await this.db.officerSkill.create({ data: { officerId, ...row } });
    }
    return rows.length;
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.officerSkill.count({ where: { officerId } });
  }
}
