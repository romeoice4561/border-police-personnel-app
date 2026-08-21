/**
 * DrugPersonRepository (Phase DI-1 — Drug Intelligence Core Data Model).
 *
 * Repository-pattern data access for DrugPerson and its identifier/alias
 * child rows. Section 3's core rule lives here at the query level: person
 * lookups never key on a national ID (there is no findByIdentifier that
 * returns a single row — see findCandidatesByIdentifier below, which always
 * returns a LIST, because Section 14 explicitly forbids automatic merge on
 * an identifier match alone).
 */

import type { DatabaseClient, DrugPerson, DrugPersonIdentifier } from "@/lib/database/database_types";

export interface DrugPersonCreateInput {
  id: string;
  primaryFullName: string;
  nationality: string | null;
  dateOfBirth: Date | null;
  notes: string | null;
  createdBy: string;
  createdByName: string;
}

export class DrugPersonRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: string): Promise<DrugPerson | null> {
    return this.db.drugPerson.findUnique({ where: { id } });
  }

  create(input: DrugPersonCreateInput): Promise<DrugPerson> {
    return this.db.drugPerson.create({ data: { ...input, updatedBy: null, updatedByName: null, status: "ACTIVE", mergedIntoPersonId: null } });
  }

  async addIdentifier(personId: string, type: string, value: string, notes: string | null, createdBy: string): Promise<DrugPersonIdentifier> {
    return this.db.drugPersonIdentifier.create({
      data: { personId, type, value, notes, createdBy },
    });
  }

  async addAlias(personId: string, fullName: string, isPrimary: boolean, createdBy: string): Promise<void> {
    await this.db.drugPersonAlias.create({ data: { personId, fullName, isPrimary, createdBy } });
  }

  identifiersForPerson(personId: string): Promise<DrugPersonIdentifier[]> {
    return this.db.drugPersonIdentifier.findMany({ where: { personId } });
  }

  aliasesForPerson(personId: string) {
    return this.db.drugPersonAlias.findMany({ where: { personId } });
  }

  /**
   * Section 14: candidate lookup, never a single-row "the" match. Returns
   * every DrugPersonIdentifier row with this exact (type, value) — deliberately
   * NOT deduplicated to one DrugPerson, since Section 14 requires the caller
   * to review every candidate rather than the repository silently picking one.
   */
  findCandidatesByIdentifier(type: string, value: string): Promise<DrugPersonIdentifier[]> {
    return this.db.drugPersonIdentifier.findMany({ where: { type, value } });
  }

  /** Section 14: name+DOB candidate lookup — same "return every match, never merge" contract. */
  findCandidatesByNameAndDob(primaryFullName: string, dateOfBirth: Date): Promise<DrugPerson[]> {
    return this.db.drugPerson.findMany({ where: { primaryFullName, dateOfBirth } });
  }

  search(query: string): Promise<DrugPerson[]> {
    return this.db.drugPerson.findMany({ where: {} }).then((rows) =>
      rows.filter((r) => r.primaryFullName.toLowerCase().includes(query.toLowerCase()))
    );
  }

  /** Section 18's Person Detail Drawer — every phone number link across ALL of this person's cases (not scoped to one case), for the "phones" list. */
  casePhonesForPerson(personId: string) {
    return this.db.drugCasePhone.findMany({ where: { personId } });
  }

  // ── DI-2: Entity Resolution additions ──────────────────────────────────

  /**
   * DI-2 Section 7/9: every ACTIVE person, for the Person Directory and the
   * matching engine's candidate pool. Same "load then filter in JS"
   * DI-1-established shape as `search()` above (no DB-side text index exists
   * yet) — acceptable at this module's current data scale, same call already
   * made for `search()`. MERGED persons are excluded so a resolved duplicate
   * never resurfaces in the directory or as a fresh matching candidate.
   */
  async findAllActive(): Promise<DrugPerson[]> {
    const rows = await this.db.drugPerson.findMany({ where: { status: "ACTIVE" } });
    return rows.filter((r) => r.status === "ACTIVE");
  }

  /** DI-2 Section 15/16: marks a person MERGED and points it at the surviving canonical person. Called only from inside the merge service's transaction. */
  async markMerged(personId: string, mergedIntoPersonId: string): Promise<DrugPerson> {
    return this.db.drugPerson.update({ where: { id: personId }, data: { status: "MERGED", mergedIntoPersonId } });
  }

  /** DI-2 Section 21: profile edit — canonical name/nationality/DOB/notes. Identifier/alias edits go through addIdentifier/addAlias above, never through this generic update, so those additions can carry their own audit trail entries. */
  async updateProfile(
    personId: string,
    input: { primaryFullName?: string; nationality?: string | null; dateOfBirth?: Date | null; notes?: string | null },
    updatedBy: string,
    updatedByName: string
  ): Promise<DrugPerson> {
    return this.db.drugPerson.update({ where: { id: personId }, data: { ...input, updatedBy, updatedByName } });
  }
}
