/**
 * DrugCaseParticipatingUnitRepository (Phase DI-7.6).
 *
 * หน่วยร่วมจับกุม (participating unit) rows. `unitText` mirrors
 * DrugCase.reportingUnitText/leadUnitText's convention exactly — always
 * populated by the client (manual fallback text OR the picker's resolved
 * canonical label), never re-derived server-side from the *Id columns
 * (which exist purely for filtering/joins). Never auto-creates an org
 * master row.
 */

import type { DatabaseClient, DrugCaseParticipatingUnit } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";

export interface DrugCaseParticipatingUnitCreateInput {
  caseId: string;
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  unitText: string | null;
  role: string;
  note: string | null;
  createdBy: string;
  createdByName: string;
}

export class DrugCaseParticipatingUnitRepository {
  constructor(private readonly db: DatabaseClient) {}

  create(input: DrugCaseParticipatingUnitCreateInput): Promise<DrugCaseParticipatingUnit> {
    return this.db.drugCaseParticipatingUnit.create({
      data: { id: generateDrugId(), ...input },
    });
  }

  forCase(caseId: string): Promise<DrugCaseParticipatingUnit[]> {
    return this.db.drugCaseParticipatingUnit.findMany({ where: { caseId } });
  }

  async remove(id: string): Promise<void> {
    await this.db.drugCaseParticipatingUnit.deleteMany({ where: { id } });
  }

  findById(id: string): Promise<DrugCaseParticipatingUnit | null> {
    return this.db.drugCaseParticipatingUnit.findUnique({ where: { id } });
  }
}
