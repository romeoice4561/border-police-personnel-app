/**
 * DrugCasePersonRepository (Phase DI-1 — Section 5).
 *
 * Repository-pattern access for the Case↔Person junction. Deliberately no
 * person_1/person_2/person_3 columns anywhere — every person on a case is
 * its own DrugCasePerson row, carrying that person's role IN THIS CASE.
 */

import type { DatabaseClient, DrugCasePerson } from "@/lib/database/database_types";

export interface DrugCasePersonCreateInput {
  caseId: string;
  personId: string;
  role: string;
  linkedOfficerId: string | null;
  notes: string | null;
  createdBy: string;
}

export class DrugCasePersonRepository {
  constructor(private readonly db: DatabaseClient) {}

  create(input: DrugCasePersonCreateInput): Promise<DrugCasePerson> {
    return this.db.drugCasePerson.create({ data: { ...input } });
  }

  forCase(caseId: string): Promise<DrugCasePerson[]> {
    return this.db.drugCasePerson.findMany({ where: { caseId } });
  }

  forPerson(personId: string): Promise<DrugCasePerson[]> {
    return this.db.drugCasePerson.findMany({ where: { personId } });
  }
}
