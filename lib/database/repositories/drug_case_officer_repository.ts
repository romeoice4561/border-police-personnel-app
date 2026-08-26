/**
 * DrugCaseOfficerRepository (Phase DI-7.6).
 *
 * ชุดจับกุม / เจ้าหน้าที่ผู้ร่วมปฏิบัติ (arrest-team member) rows. `officerId`
 * mirrors DrugCasePerson.linkedOfficerId's convention exactly: a String
 * business-key reference to Officer.officerId (never Officer's numeric
 * `id`), so this table never locks the Personnel schema. Manual/external
 * officers use the manual* fields instead and are never promoted into a
 * canonical Officer row.
 */

import type { DatabaseClient, DrugCaseOfficer } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";

export interface DrugCaseOfficerCreateInput {
  caseId: string;
  officerId: string | null;
  manualRank: string | null;
  manualFullName: string | null;
  manualPosition: string | null;
  manualUnitText: string | null;
  role: string;
  note: string | null;
  createdBy: string;
  createdByName: string;
}

export class DrugCaseOfficerRepository {
  constructor(private readonly db: DatabaseClient) {}

  create(input: DrugCaseOfficerCreateInput): Promise<DrugCaseOfficer> {
    return this.db.drugCaseOfficer.create({
      data: { id: generateDrugId(), ...input },
    });
  }

  forCase(caseId: string): Promise<DrugCaseOfficer[]> {
    return this.db.drugCaseOfficer.findMany({ where: { caseId } });
  }

  /**
   * Batch lookup across many cases at once (Case Workspace / future Commander
   * Dashboard aggregation). No `where: { in: [...] }` support in the
   * DatabaseClient contract (the InMemoryDatabaseClient test fake only does
   * strict equality per key), so this fans out one findMany per case id in
   * parallel — matches DrugCaseService.getCase()'s existing
   * Promise.all-over-individual-lookups convention exactly.
   */
  async forCases(caseIds: string[]): Promise<DrugCaseOfficer[]> {
    const results = await Promise.all(caseIds.map((caseId) => this.forCase(caseId)));
    return results.flat();
  }

  /** Every case an internal officer has participated in (Section 14: personnel-profile readiness). */
  forOfficer(officerId: string): Promise<DrugCaseOfficer[]> {
    return this.db.drugCaseOfficer.findMany({ where: { officerId } });
  }

  async remove(id: string): Promise<void> {
    await this.db.drugCaseOfficer.deleteMany({ where: { id } });
  }

  findById(id: string): Promise<DrugCaseOfficer | null> {
    return this.db.drugCaseOfficer.findUnique({ where: { id } });
  }
}
