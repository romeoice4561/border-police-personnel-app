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

import type { DatabaseClient, DrugPerson, DrugPersonIdentifier, DrugPersonAlias } from "@/lib/database/database_types";

export interface DrugPersonCreateInput {
  id: string;
  primaryFullName: string;
  /** DI-7.2: dedicated nickname — optional; defaults to null */
  nickname?: string | null;
  nationality: string | null;
  /** DI-7.2: MALE / FEMALE / UNKNOWN — optional; defaults to null */
  sex?: string | null;
  dateOfBirth: Date | null;
  /** DI-7.2: only when dateOfBirth is null — optional; defaults to null */
  approximateAge?: number | null;
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
    return this.db.drugPerson.create({
      data: {
        nickname: null,
        sex: null,
        approximateAge: null,
        ...input,
        updatedBy: null,
        updatedByName: null,
        status: "ACTIVE",
        mergedIntoPersonId: null,
      },
    });
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

  /** Phase DI-5: Person↔SIM edge traversal — DrugCaseSim.personId is nullable (a SIM sighting can exist with no person attached), so callers must filter out null-personId rows themselves when this scan is used generically. */
  caseSimsForPerson(personId: string) {
    return this.db.drugCaseSim.findMany({ where: { personId } });
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

  /** DI-2 Section 21 / DI-7.2: profile edit — canonical identity fields. Identifier/alias edits go through addIdentifier/addAlias, so those additions can carry their own audit trail entries. */
  async updateProfile(
    personId: string,
    input: {
      primaryFullName?: string;
      nickname?: string | null;
      nationality?: string | null;
      sex?: string | null;
      dateOfBirth?: Date | null;
      approximateAge?: number | null;
      notes?: string | null;
    },
    updatedBy: string,
    updatedByName: string
  ): Promise<DrugPerson> {
    return this.db.drugPerson.update({ where: { id: personId }, data: { ...input, updatedBy, updatedByName } });
  }

  // ── DI-7.2: Network Memberships ────────────────────────────────────────────

  networkMembershipsForPerson(personId: string) {
    return this.db.drugPersonNetworkMembership.findMany({
      where: { personId },
      orderBy: { createdAt: "asc" },
    });
  }

  // ── DI-7.3: Network Roles ──────────────────────────────────────────────────

  networkRolesForPerson(personId: string) {
    return this.db.drugPersonNetworkRole.findMany({
      where: { personId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * DI-3 Section 8: exact identifier VALUE lookup across every type — Global
   * Search doesn't know a priori whether a 13-digit query is a THAI_ID vs.
   * an ALIEN_ID vs. an OTHER-typed value, so (unlike findCandidatesByIdentifier,
   * which requires a known type) this scans every identifier row for an
   * exact value match. Same "candidates list, never a single winner" contract
   * as the rest of Section 14's identifier lookups.
   */
  findIdentifiersByValue(value: string): Promise<DrugPersonIdentifier[]> {
    return this.db.drugPersonIdentifier.findMany({}).then((rows) => rows.filter((r) => r.value === value));
  }

  /** DI-3 Section 8: every alias row, for Global Search's broad in-memory alias-name scan. */
  findAllAliases(): Promise<DrugPersonAlias[]> {
    return this.db.drugPersonAlias.findMany({});
  }

  /** DI-3 Section 8: every identifier row, for Global Search's broad in-memory identifier-value substring scan. */
  findAllIdentifiers(): Promise<DrugPersonIdentifier[]> {
    return this.db.drugPersonIdentifier.findMany({});
  }
}
