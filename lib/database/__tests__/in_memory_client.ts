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
    async findMany(args?: { where?: Record<string, unknown> }) {
      return table.findMany(args?.where);
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

  /** Interactive transaction: snapshot all tables, run fn, restore all on throw (rollback). */
  async $transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    const snaps = {
      officers: this.officers.snapshot(),
      timelines: this.timelines.snapshot(),
      units: this.units.snapshot(),
      phones: this.phonesTable.snapshot(),
      educations: this.educations.snapshot(),
      trainings: this.trainings.snapshot(),
      salaryHistories: this.salaryHistories.snapshot(),
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
