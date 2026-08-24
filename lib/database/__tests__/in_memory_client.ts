/**
 * In-memory fake DatabaseClient for Phase 12 tests.
 *
 * Models just enough of the Prisma delegate surface the repositories use
 * (findUnique / create / update / upsert / deleteMany / count) over plain
 * arrays, honoring the schema's unique constraints (Officer.officerId,
 * Timeline (officerId, sequence), Unit.name, Phone (officerId, number)) and a
 * transaction that ROLLS BACK on a thrown error by snapshotting/restoring
 * state. This lets every repository/importer/idempotency/rollback test run
 * with NO live database — the same fake-based convention used across this
 * codebase.
 *
 * Not exhaustive Prisma behavior — only what the repositories exercise.
 */

import type { DatabaseClient } from "@/lib/database/database_types";

interface Row {
  id: number;
  [key: string]: unknown;
}

/** A single in-memory table with an auto-increment id and a unique-key matcher. */
class Table {
  rows: Row[] = [];
  private nextId = 1;

  constructor(private readonly matchUnique: (row: Row, where: Record<string, unknown>) => boolean) {}

  find(where: Record<string, unknown>): Row | null {
    return this.rows.find((r) => this.matchUnique(r, where)) ?? null;
  }

  findMany(where?: Record<string, unknown>): Row[] {
    if (!where) return this.rows.map((r) => ({ ...r }));
    return this.rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }));
  }

  create(data: Record<string, unknown>): Row {
    const row: Row = { id: this.nextId++, ...applyDefaults(data) };
    this.rows.push(row);
    return { ...row };
  }

  update(where: Record<string, unknown>, data: Record<string, unknown>): Row {
    const row = this.rows.find((r) => this.matchUnique(r, where));
    if (!row) throw new Error("Record to update not found");
    Object.assign(row, data);
    return { ...row };
  }

  upsert(where: Record<string, unknown>, create: Record<string, unknown>, update: Record<string, unknown>): Row {
    const existing = this.rows.find((r) => this.matchUnique(r, where));
    if (existing) {
      Object.assign(existing, update);
      return { ...existing };
    }
    return this.create({ ...create });
  }

  deleteMany(where?: Record<string, unknown>): { count: number } {
    if (!where) {
      const count = this.rows.length;
      this.rows = [];
      return { count };
    }
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !Object.entries(where).every(([k, v]) => r[k] === v));
    return { count: before - this.rows.length };
  }

  count(where?: Record<string, unknown>): number {
    if (!where) return this.rows.length;
    return this.rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)).length;
  }

  snapshot(): { rows: Row[]; nextId: number } {
    return { rows: this.rows.map((r) => ({ ...r })), nextId: this.nextId };
  }

  restore(snap: { rows: Row[]; nextId: number }): void {
    this.rows = snap.rows.map((r) => ({ ...r }));
    this.nextId = snap.nextId;
  }
}

/** Applies the schema defaults the tests rely on. */
function applyDefaults(data: Record<string, unknown>): Record<string, unknown> {
  const now = new Date();
  return {
    careerYears: 0,
    officerCount: 0,
    images: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    ...data,
  };
}

/** Builds a delegate object over a Table matching the ModelDelegate contract. */
function delegate(table: Table) {
  return {
    async findUnique(args: { where: Record<string, unknown> }) {
      return table.find(args.where);
    },
    async findMany(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">> }) {
      const rows = table.findMany(args?.where);
      const orderByRaw = args?.orderBy;
      const orderBy = Array.isArray(orderByRaw) ? orderByRaw[0] : orderByRaw;
      if (orderBy) {
        const [field, dir] = Object.entries(orderBy)[0];
        rows.sort((a, b) => {
          const av = a[field] as unknown as number | string;
          const bv = b[field] as unknown as number | string;
          if (av === bv) return 0;
          const cmp = av > bv ? 1 : -1;
          return dir === "asc" ? cmp : -cmp;
        });
      }
      return rows;
    },
    async create(args: { data: Record<string, unknown> }) {
      return table.create(args.data);
    },
    async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      return table.update(args.where, args.data);
    },
    async upsert(args: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      return table.upsert(args.where, args.create, args.update);
    },
    async deleteMany(args?: { where?: Record<string, unknown> }) {
      return table.deleteMany(args?.where);
    },
    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const matches = table.findMany(args.where);
      for (const row of matches) {
        table.update({ id: row.id }, args.data);
      }
      return { count: matches.length };
    },
    async count(args?: { where?: Record<string, unknown> }) {
      return table.count(args?.where);
    },
  };
}

/** Extracts a composite key value (Prisma nests composite unique keys under a `field_field` object). */
function composite(where: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  return where[key] as Record<string, unknown> | undefined;
}

export class InMemoryDatabaseClient implements DatabaseClient {
  private readonly officers = new Table((r, w) => r.officerId === w.officerId);
  private readonly timelines = new Table((r, w) => {
    const c = composite(w, "officerId_sequence");
    return c ? r.officerId === c.officerId && r.sequence === c.sequence : false;
  });
  private readonly units = new Table((r, w) => r.name === w.name);
  private readonly phonesTable = new Table((r, w) => {
    const c = composite(w, "officerId_number");
    return c ? r.officerId === c.officerId && r.number === c.number : false;
  });
  private readonly jobs = new Table((r, w) => r.id === w.id);
  private readonly logs = new Table((r, w) => r.id === w.id);
  private readonly educations = new Table((r, w) => r.id === w.id);
  private readonly trainings = new Table((r, w) => r.id === w.id);
  private readonly salaryHistories = new Table((r, w) => {
    const c = composite(w, "officerId_yearBE");
    if (c) return r.officerId === c.officerId && r.yearBE === c.yearBE;
    return r.id === w.id;
  });
  private readonly officerDocuments = new Table((r, w) => r.id === w.id);
  // Phase 44: skills master + per-officer skills.
  private readonly skillCategories = new Table((r, w) => (w.code !== undefined ? r.code === w.code : r.id === w.id));
  private readonly skills = new Table((r, w) => (w.code !== undefined ? r.code === w.code : r.id === w.id));
  private readonly skillLevels = new Table((r, w) => (w.code !== undefined ? r.code === w.code : r.id === w.id));
  private readonly officerSkills = new Table((r, w) => {
    const c = composite(w, "officerId_skillId");
    if (c) return r.officerId === c.officerId && r.skillId === c.skillId;
    return r.id === w.id;
  });

  // Phase DI-1: Drug Intelligence tables. cuid() string ids (not the
  // autoincrement Int ids Table.create() normally assigns) — the fake's
  // simple id matcher (r.id === w.id) works unchanged either way since it
  // only compares whatever value is present, but callers must supply their
  // own id via data.id since Table.create() would otherwise overwrite it
  // with a numeric nextId; DrugRepository (Round 1 backend) generates cuids
  // itself before calling create(), matching how the real Prisma client's
  // @default(cuid()) behaves from the caller's perspective in every other
  // repository in this codebase (never relies on the DB to invent an id it
  // then has to read back).
  private readonly drugCases = new Table((r, w) => r.id === w.id);
  private readonly drugPersons = new Table((r, w) => r.id === w.id);
  private readonly drugPersonIdentifiers = new Table((r, w) => r.id === w.id);
  private readonly drugPersonAliases = new Table((r, w) => r.id === w.id);
  private readonly drugCasePersons = new Table((r, w) => {
    const c = composite(w, "caseId_personId");
    if (c) return r.caseId === c.caseId && r.personId === c.personId;
    return r.id === w.id;
  });
  private readonly drugPhoneNumbers = new Table((r, w) => (w.normalizedNumber !== undefined ? r.normalizedNumber === w.normalizedNumber : r.id === w.id));
  private readonly drugCasePhones = new Table((r, w) => r.id === w.id);
  private readonly drugSims = new Table((r, w) => (w.iccid !== undefined ? r.iccid === w.iccid : r.id === w.id));
  private readonly drugCaseSims = new Table((r, w) => r.id === w.id);
  private readonly drugDevices = new Table((r, w) => r.id === w.id);
  private readonly drugPersonDevices = new Table((r, w) => r.id === w.id);
  private readonly drugCaseDevices = new Table((r, w) => r.id === w.id);
  private readonly drugVehicles = new Table((r, w) => r.id === w.id);
  private readonly drugPersonVehicles = new Table((r, w) => r.id === w.id);
  private readonly drugCaseVehicles = new Table((r, w) => r.id === w.id);
  private readonly drugLocations = new Table((r, w) => r.id === w.id);
  private readonly drugCaseLocations = new Table((r, w) => r.id === w.id);
  private readonly drugSeizedItems = new Table((r, w) => r.id === w.id);
  private readonly drugAuditLogs = new Table((r, w) => r.id === w.id);

  // Phase DI-2: Entity Resolution tables — same cuid()-string-id convention.
  private readonly drugPersonMatchReviews = new Table((r, w) => {
    const c = composite(w, "personAId_personBId");
    if (c) return r.personAId === c.personAId && r.personBId === c.personBId;
    return r.id === w.id;
  });
  private readonly drugPersonMerges = new Table((r, w) => r.id === w.id);

  // Phase DI-6: Intelligence Alerts — deduplicated via the unique
  // `dedupeKey`, same upsert-by-unique-key convention as DrugPersonMatchReview above.
  private readonly drugIntelligenceAlerts = new Table((r, w) => {
    if (w.dedupeKey !== undefined) return r.dedupeKey === w.dedupeKey;
    return r.id === w.id;
  });

  // Phase DI-7.2/7.3: Network groups, memberships, and network-role assertions.
  private readonly drugNetworkGroups = new Table((r, w) => r.id === w.id);
  private readonly drugPersonNetworkMemberships = new Table((r, w) => r.id === w.id);
  private readonly drugPersonNetworkRoles = new Table((r, w) => r.id === w.id);

  /**
   * When set, any timeline.create for an officer whose row has this string
   * officerId throws — simulating a mid-transaction failure AFTER the officer
   * was upserted, so the test can assert the whole officer transaction rolls
   * back. Resolved via the officers already written in this transaction.
   */
  failOnOfficerId?: string;

  get officer() {
    return delegate(this.officers) as unknown as DatabaseClient["officer"];
  }
  get timeline() {
    const base = delegate(this.timelines);
    const officersTable = this.officers;
    const failId = this.failOnOfficerId;
    return {
      ...base,
      async create(args: { data: Record<string, unknown> }) {
        if (failId !== undefined) {
          const numericOfficerId = args.data.officerId;
          const owner = officersTable.rows.find((r) => r.id === numericOfficerId);
          if (owner && owner.officerId === failId) {
            throw new Error(`simulated timeline failure for officer ${failId}`);
          }
        }
        return base.create(args);
      },
    } as unknown as DatabaseClient["timeline"];
  }
  get unit() {
    return delegate(this.units) as unknown as DatabaseClient["unit"];
  }
  get phone() {
    return delegate(this.phonesTable) as unknown as DatabaseClient["phone"];
  }
  get importJob() {
    return delegate(this.jobs) as unknown as DatabaseClient["importJob"];
  }
  get importLog() {
    return delegate(this.logs) as unknown as DatabaseClient["importLog"];
  }
  get education() {
    return delegate(this.educations) as unknown as DatabaseClient["education"];
  }
  get training() {
    return delegate(this.trainings) as unknown as DatabaseClient["training"];
  }
  get salaryHistory() {
    return delegate(this.salaryHistories) as unknown as DatabaseClient["salaryHistory"];
  }
  get officerDocument() {
    return delegate(this.officerDocuments) as unknown as DatabaseClient["officerDocument"];
  }
  get skillCategory() {
    return delegate(this.skillCategories) as unknown as DatabaseClient["skillCategory"];
  }
  get skill() {
    return delegate(this.skills) as unknown as DatabaseClient["skill"];
  }
  get skillLevel() {
    return delegate(this.skillLevels) as unknown as DatabaseClient["skillLevel"];
  }
  get officerSkill() {
    return delegate(this.officerSkills) as unknown as DatabaseClient["officerSkill"];
  }

  // Phase DI-1: Drug Intelligence delegates.
  get drugCase() {
    return delegate(this.drugCases) as unknown as DatabaseClient["drugCase"];
  }
  get drugPerson() {
    return delegate(this.drugPersons) as unknown as DatabaseClient["drugPerson"];
  }
  get drugPersonIdentifier() {
    return delegate(this.drugPersonIdentifiers) as unknown as DatabaseClient["drugPersonIdentifier"];
  }
  get drugPersonAlias() {
    return delegate(this.drugPersonAliases) as unknown as DatabaseClient["drugPersonAlias"];
  }
  get drugCasePerson() {
    return delegate(this.drugCasePersons) as unknown as DatabaseClient["drugCasePerson"];
  }
  get drugPhoneNumber() {
    return delegate(this.drugPhoneNumbers) as unknown as DatabaseClient["drugPhoneNumber"];
  }
  get drugCasePhone() {
    return delegate(this.drugCasePhones) as unknown as DatabaseClient["drugCasePhone"];
  }
  get drugSim() {
    return delegate(this.drugSims) as unknown as DatabaseClient["drugSim"];
  }
  get drugCaseSim() {
    return delegate(this.drugCaseSims) as unknown as DatabaseClient["drugCaseSim"];
  }
  get drugDevice() {
    return delegate(this.drugDevices) as unknown as DatabaseClient["drugDevice"];
  }
  get drugPersonDevice() {
    return delegate(this.drugPersonDevices) as unknown as DatabaseClient["drugPersonDevice"];
  }
  get drugCaseDevice() {
    return delegate(this.drugCaseDevices) as unknown as DatabaseClient["drugCaseDevice"];
  }
  get drugVehicle() {
    return delegate(this.drugVehicles) as unknown as DatabaseClient["drugVehicle"];
  }
  get drugPersonVehicle() {
    return delegate(this.drugPersonVehicles) as unknown as DatabaseClient["drugPersonVehicle"];
  }
  get drugCaseVehicle() {
    return delegate(this.drugCaseVehicles) as unknown as DatabaseClient["drugCaseVehicle"];
  }
  get drugLocation() {
    return delegate(this.drugLocations) as unknown as DatabaseClient["drugLocation"];
  }
  get drugCaseLocation() {
    return delegate(this.drugCaseLocations) as unknown as DatabaseClient["drugCaseLocation"];
  }
  get drugSeizedItem() {
    return delegate(this.drugSeizedItems) as unknown as DatabaseClient["drugSeizedItem"];
  }
  get drugAuditLog() {
    return delegate(this.drugAuditLogs) as unknown as DatabaseClient["drugAuditLog"];
  }
  get drugPersonMatchReview() {
    return delegate(this.drugPersonMatchReviews) as unknown as DatabaseClient["drugPersonMatchReview"];
  }
  get drugPersonMerge() {
    return delegate(this.drugPersonMerges) as unknown as DatabaseClient["drugPersonMerge"];
  }
  get drugIntelligenceAlert() {
    return delegate(this.drugIntelligenceAlerts) as unknown as DatabaseClient["drugIntelligenceAlert"];
  }
  get drugNetworkGroup() {
    return delegate(this.drugNetworkGroups) as unknown as DatabaseClient["drugNetworkGroup"];
  }
  get drugPersonNetworkMembership() {
    return delegate(this.drugPersonNetworkMemberships) as unknown as DatabaseClient["drugPersonNetworkMembership"];
  }
  get drugPersonNetworkRole() {
    return delegate(this.drugPersonNetworkRoles) as unknown as DatabaseClient["drugPersonNetworkRole"];
  }

  /** Interactive transaction: snapshot all tables, run fn, restore all on throw (rollback). */
  async $transaction<T>(
    fn: (tx: DatabaseClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T> {
    void options;
    const snaps = {
      officers: this.officers.snapshot(),
      timelines: this.timelines.snapshot(),
      units: this.units.snapshot(),
      phones: this.phonesTable.snapshot(),
      educations: this.educations.snapshot(),
      trainings: this.trainings.snapshot(),
      salaryHistories: this.salaryHistories.snapshot(),
      officerDocuments: this.officerDocuments.snapshot(),
      skillCategories: this.skillCategories.snapshot(),
      skills: this.skills.snapshot(),
      skillLevels: this.skillLevels.snapshot(),
      officerSkills: this.officerSkills.snapshot(),
      drugCases: this.drugCases.snapshot(),
      drugPersons: this.drugPersons.snapshot(),
      drugPersonIdentifiers: this.drugPersonIdentifiers.snapshot(),
      drugPersonAliases: this.drugPersonAliases.snapshot(),
      drugCasePersons: this.drugCasePersons.snapshot(),
      drugPhoneNumbers: this.drugPhoneNumbers.snapshot(),
      drugCasePhones: this.drugCasePhones.snapshot(),
      drugSims: this.drugSims.snapshot(),
      drugCaseSims: this.drugCaseSims.snapshot(),
      drugDevices: this.drugDevices.snapshot(),
      drugPersonDevices: this.drugPersonDevices.snapshot(),
      drugCaseDevices: this.drugCaseDevices.snapshot(),
      drugVehicles: this.drugVehicles.snapshot(),
      drugPersonVehicles: this.drugPersonVehicles.snapshot(),
      drugCaseVehicles: this.drugCaseVehicles.snapshot(),
      drugLocations: this.drugLocations.snapshot(),
      drugCaseLocations: this.drugCaseLocations.snapshot(),
      drugSeizedItems: this.drugSeizedItems.snapshot(),
      drugAuditLogs: this.drugAuditLogs.snapshot(),
      drugPersonMatchReviews: this.drugPersonMatchReviews.snapshot(),
      drugPersonMerges: this.drugPersonMerges.snapshot(),
      drugIntelligenceAlerts: this.drugIntelligenceAlerts.snapshot(),
      drugNetworkGroups: this.drugNetworkGroups.snapshot(),
      drugPersonNetworkMemberships: this.drugPersonNetworkMemberships.snapshot(),
      drugPersonNetworkRoles: this.drugPersonNetworkRoles.snapshot(),
    };
    try {
      return await fn(this);
    } catch (error) {
      this.officers.restore(snaps.officers);
      this.timelines.restore(snaps.timelines);
      this.units.restore(snaps.units);
      this.phonesTable.restore(snaps.phones);
      this.educations.restore(snaps.educations);
      this.trainings.restore(snaps.trainings);
      this.salaryHistories.restore(snaps.salaryHistories);
      this.officerDocuments.restore(snaps.officerDocuments);
      this.skillCategories.restore(snaps.skillCategories);
      this.skills.restore(snaps.skills);
      this.skillLevels.restore(snaps.skillLevels);
      this.officerSkills.restore(snaps.officerSkills);
      this.drugCases.restore(snaps.drugCases);
      this.drugPersons.restore(snaps.drugPersons);
      this.drugPersonIdentifiers.restore(snaps.drugPersonIdentifiers);
      this.drugPersonAliases.restore(snaps.drugPersonAliases);
      this.drugCasePersons.restore(snaps.drugCasePersons);
      this.drugPhoneNumbers.restore(snaps.drugPhoneNumbers);
      this.drugCasePhones.restore(snaps.drugCasePhones);
      this.drugSims.restore(snaps.drugSims);
      this.drugCaseSims.restore(snaps.drugCaseSims);
      this.drugDevices.restore(snaps.drugDevices);
      this.drugPersonDevices.restore(snaps.drugPersonDevices);
      this.drugCaseDevices.restore(snaps.drugCaseDevices);
      this.drugVehicles.restore(snaps.drugVehicles);
      this.drugPersonVehicles.restore(snaps.drugPersonVehicles);
      this.drugCaseVehicles.restore(snaps.drugCaseVehicles);
      this.drugLocations.restore(snaps.drugLocations);
      this.drugCaseLocations.restore(snaps.drugCaseLocations);
      this.drugSeizedItems.restore(snaps.drugSeizedItems);
      this.drugAuditLogs.restore(snaps.drugAuditLogs);
      this.drugPersonMatchReviews.restore(snaps.drugPersonMatchReviews);
      this.drugPersonMerges.restore(snaps.drugPersonMerges);
      this.drugIntelligenceAlerts.restore(snaps.drugIntelligenceAlerts);
      this.drugNetworkGroups.restore(snaps.drugNetworkGroups);
      this.drugPersonNetworkMemberships.restore(snaps.drugPersonNetworkMemberships);
      this.drugPersonNetworkRoles.restore(snaps.drugPersonNetworkRoles);
      throw error;
    }
  }

  /** Test helper: current row counts per table. */
  counts() {
    return {
      officers: this.officers.rows.length,
      timelines: this.timelines.rows.length,
      units: this.units.rows.length,
      phones: this.phonesTable.rows.length,
      jobs: this.jobs.rows.length,
      logs: this.logs.rows.length,
      educations: this.educations.rows.length,
      trainings: this.trainings.rows.length,
      salaryHistories: this.salaryHistories.rows.length,
    };
  }

  officerRows() {
    return this.officers.rows.map((r) => ({ ...r }));
  }

  timelineRows() {
    return this.timelines.rows.map((r) => ({ ...r }));
  }

  logRows() {
    return this.logs.rows.map((r) => ({ ...r }));
  }
}
