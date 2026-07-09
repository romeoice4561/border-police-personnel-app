/**
 * In-memory fake MasterDataClient for Phase 24A tests.
 *
 * Models just enough of the Prisma V2 master-table delegate surface the
 * master-data repositories use (findUnique / findMany / create / update /
 * upsert / count) over plain arrays, honoring the `code` unique constraint and
 * the `is_deleted` / `is_active` filters and `display_order` ordering the
 * repositories rely on. Lets every master-data repository/seeder test run with
 * NO live database — the same fake-based convention as `in_memory_client.ts`.
 *
 * DB-managed columns (id, audit, soft-delete, version) are filled with sane
 * defaults on create so listings and idempotency behave like the real schema.
 */

import type { MasterDataClient, MasterModelDelegate } from "@/lib/database/master_data_types";

interface Row {
  id: string;
  // `code` is always present on real rows (supplied via create data), but is
  // typed optional here so the default-filled create object typechecks before
  // the caller's data (which carries `code`) is spread in.
  code?: string;
  [key: string]: unknown;
}

let uuidCounter = 0;
function fakeUuid(): string {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, "0")}`;
}

/** A single in-memory master table keyed on the unique `code`. */
class Table {
  rows: Row[] = [];

  find(where: Record<string, unknown>): Row | null {
    if (typeof where.code === "string") {
      return this.rows.find((r) => r.code === where.code) ?? null;
    }
    if (typeof where.id === "string") {
      return this.rows.find((r) => r.id === where.id) ?? null;
    }
    return null;
  }

  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  }): Row[] {
    let out = this.rows.slice();
    const where = args?.where;
    if (where) {
      out = out.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
    }
    const orderBy = args?.orderBy;
    if (orderBy) {
      const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
      out.sort((a, b) => {
        for (const clause of keys) {
          const [field, dir] = Object.entries(clause)[0];
          const av = a[field];
          const bv = b[field];
          if (av === bv) continue;
          const cmp = (av as number | string) < (bv as number | string) ? -1 : 1;
          return dir === "desc" ? -cmp : cmp;
        }
        return 0;
      });
    }
    return out.map((r) => ({ ...r }));
  }

  create(data: Record<string, unknown>): Row {
    const row: Row = {
      id: fakeUuid(),
      isActive: true,
      status: "ACTIVE",
      version: 1,
      isDeleted: false,
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    } as Row;
    this.rows.push(row);
    return { ...row };
  }

  update(where: Record<string, unknown>, data: Record<string, unknown>): Row {
    const row = this.find(where);
    if (!row) throw new Error("Record to update not found");
    Object.assign(row, data, { updatedAt: new Date() });
    return { ...row };
  }

  upsert(where: Record<string, unknown>, create: Record<string, unknown>, update: Record<string, unknown>): Row {
    const existing = this.find(where);
    if (existing) {
      Object.assign(existing, update, { updatedAt: new Date() });
      return { ...existing };
    }
    return this.create(create);
  }

  count(where?: Record<string, unknown>): number {
    if (!where) return this.rows.length;
    return this.rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)).length;
  }
}

function delegate(table: Table): MasterModelDelegate<Row> {
  return {
    async findUnique(args) {
      return table.find(args.where);
    },
    async findMany(args) {
      return table.findMany(args);
    },
    async create(args) {
      return table.create(args.data);
    },
    async update(args) {
      return table.update(args.where, args.data);
    },
    async upsert(args) {
      return table.upsert(args.where, args.create, args.update);
    },
    async count(args) {
      return table.count(args?.where);
    },
  };
}

export class InMemoryMasterDataClient implements MasterDataClient {
  private readonly regions = new Table();
  private readonly commands = new Table();
  private readonly subdivisions = new Table();
  private readonly companies = new Table();
  private readonly ranks = new Table();
  private readonly positions = new Table();
  private readonly timelineTypes = new Table();
  private readonly assetTypes = new Table();
  private readonly documentTypes = new Table();

  get masterRegion() {
    return delegate(this.regions) as unknown as MasterDataClient["masterRegion"];
  }
  get masterCommand() {
    return delegate(this.commands) as unknown as MasterDataClient["masterCommand"];
  }
  get masterSubdivision() {
    return delegate(this.subdivisions) as unknown as MasterDataClient["masterSubdivision"];
  }
  get masterCompany() {
    return delegate(this.companies) as unknown as MasterDataClient["masterCompany"];
  }
  get masterRank() {
    return delegate(this.ranks) as unknown as MasterDataClient["masterRank"];
  }
  get masterPosition() {
    return delegate(this.positions) as unknown as MasterDataClient["masterPosition"];
  }
  get masterTimelineType() {
    return delegate(this.timelineTypes) as unknown as MasterDataClient["masterTimelineType"];
  }
  get masterAssetType() {
    return delegate(this.assetTypes) as unknown as MasterDataClient["masterAssetType"];
  }
  get masterDocumentType() {
    return delegate(this.documentTypes) as unknown as MasterDataClient["masterDocumentType"];
  }
}
