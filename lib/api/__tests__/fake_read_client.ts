/**
 * In-memory fake ReadDatabaseClient for Phase 13 API tests.
 *
 * Implements just enough of the read delegate surface the query repositories
 * use (findMany with where/orderBy/skip/take, findUnique with include, count,
 * groupBy, aggregate) over a plain officer array + related timeline/phone
 * rows. Honors the string filters (contains/startsWith/exact + insensitive)
 * and numeric gte the API generates, so every endpoint is testable with NO
 * live database — the same fake-based convention as the rest of the codebase.
 *
 * Not exhaustive Prisma semantics; only what the API exercises.
 */

import type {
  AggregateArgs,
  FindManyArgs,
  FindUniqueArgs,
  GroupByArgs,
  Officer,
  Phone,
  ReadDatabaseClient,
  Timeline,
} from "@/lib/database/query_types";

export interface FakeOfficerSeed extends Partial<Officer> {
  officerId: string;
  rank: string;
  firstName: string;
  lastName: string;
}

function officer(seed: FakeOfficerSeed, id: number): Officer {
  return {
    id,
    officerId: seed.officerId,
    rank: seed.rank,
    firstName: seed.firstName,
    lastName: seed.lastName,
    currentPosition: seed.currentPosition ?? null,
    currentUnit: seed.currentUnit ?? null,
    phone: seed.phone ?? null,
    careerYears: seed.careerYears ?? 0,
    qualityScore: seed.qualityScore ?? null,
    knowledgeScore: seed.knowledgeScore ?? null,
    region: seed.region ?? null,
    confidence: seed.confidence ?? null,
    createdAt: seed.createdAt ?? new Date(2026, 0, id),
    updatedAt: seed.updatedAt ?? new Date(2026, 0, id),
  } as Officer;
}

/** Applies a single Prisma-style field filter to a value. */
function matchesFilter(value: unknown, filter: unknown): boolean {
  if (filter === null || typeof filter !== "object") return value === filter;
  const f = filter as Record<string, unknown>;
  const insensitive = f.mode === "insensitive";
  const norm = (v: unknown) => (typeof v === "string" && insensitive ? v.toLowerCase() : v);

  if ("equals" in f) return norm(value) === norm(f.equals);
  if ("contains" in f) return typeof value === "string" && String(norm(value)).includes(String(norm(f.contains)));
  if ("startsWith" in f)
    return typeof value === "string" && String(norm(value)).startsWith(String(norm(f.startsWith)));
  if ("gte" in f) return typeof value === "number" && value >= (f.gte as number);
  if ("not" in f) return value !== f.not;
  return false;
}

function matchesWhere(row: Officer, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      const clauses = cond as Array<Record<string, unknown>>;
      if (!clauses.every((c) => matchesWhere(row, c))) return false;
    } else if (key === "OR") {
      const clauses = cond as Array<Record<string, unknown>>;
      if (!clauses.some((c) => matchesWhere(row, c))) return false;
    } else {
      if (!matchesFilter((row as unknown as Record<string, unknown>)[key], cond)) return false;
    }
  }
  return true;
}

export class FakeReadDatabaseClient implements ReadDatabaseClient {
  private readonly officers: Officer[];
  private readonly timelinesByOfficer: Map<number, Timeline[]>;
  private readonly phonesByOfficer: Map<number, Phone[]>;

  constructor(
    seeds: FakeOfficerSeed[],
    relations: { timeline?: Record<string, Timeline[]>; phones?: Record<string, string[]> } = {}
  ) {
    this.officers = seeds.map((s, i) => officer(s, i + 1));
    this.timelinesByOfficer = new Map();
    this.phonesByOfficer = new Map();

    const idByOfficerId = new Map(this.officers.map((o) => [o.officerId, o.id]));
    for (const [officerId, rows] of Object.entries(relations.timeline ?? {})) {
      const id = idByOfficerId.get(officerId);
      if (id) this.timelinesByOfficer.set(id, rows);
    }
    for (const [officerId, numbers] of Object.entries(relations.phones ?? {})) {
      const id = idByOfficerId.get(officerId);
      if (id) this.phonesByOfficer.set(id, numbers.map((number, i) => ({ id: i + 1, officerId: id, number })));
    }
  }

  private officerDelegate() {
    const rows = this.officers;
    const timelines = this.timelinesByOfficer;
    const phones = this.phonesByOfficer;

    return {
      async findMany(args?: FindManyArgs): Promise<Officer[]> {
        let result = rows.filter((r) => matchesWhere(r, args?.where));
        const orderBy = Array.isArray(args?.orderBy) ? args?.orderBy[0] : args?.orderBy;
        if (orderBy) {
          const [field, dir] = Object.entries(orderBy)[0] as [keyof Officer, "asc" | "desc"];
          result = [...result].sort((a, b) => {
            const av = a[field] as unknown as number | string;
            const bv = b[field] as unknown as number | string;
            if (av === bv) return 0;
            const cmp = av > bv ? 1 : -1;
            return dir === "asc" ? cmp : -cmp;
          });
        }
        const skip = args?.skip ?? 0;
        const take = args?.take ?? result.length;
        return result.slice(skip, skip + take);
      },
      async findUnique(args: FindUniqueArgs): Promise<Officer | null> {
        const found = rows.find((r) => matchesWhere(r, args.where));
        if (!found) return null;
        if (args.include) {
          return {
            ...found,
            timeline: timelines.get(found.id) ?? [],
            phones: phones.get(found.id) ?? [],
          } as Officer;
        }
        return found;
      },
      async count(args?: { where?: Record<string, unknown> }): Promise<number> {
        return rows.filter((r) => matchesWhere(r, args?.where)).length;
      },
      async groupBy(args: GroupByArgs): Promise<Array<Record<string, unknown>>> {
        const filtered = rows.filter((r) => matchesWhere(r, args.where));
        const groups = new Map<string, { key: Record<string, unknown>; count: number }>();
        for (const r of filtered) {
          const keyObj: Record<string, unknown> = {};
          for (const field of args.by) keyObj[field] = (r as unknown as Record<string, unknown>)[field];
          const k = JSON.stringify(keyObj);
          const existing = groups.get(k);
          if (existing) existing.count += 1;
          else groups.set(k, { key: keyObj, count: 1 });
        }
        return Array.from(groups.values()).map((g) => ({ ...g.key, _count: { _all: g.count } }));
      },
      async aggregate(args: AggregateArgs): Promise<Record<string, unknown>> {
        const filtered = rows.filter((r) => matchesWhere(r, args.where));
        const avg: Record<string, number> = {};
        for (const field of Object.keys(args._avg ?? {})) {
          const values = filtered
            .map((r) => (r as unknown as Record<string, unknown>)[field])
            .filter((v): v is number => typeof v === "number");
          avg[field] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
        }
        return { _avg: avg };
      },
    };
  }

  get officer() {
    return this.officerDelegate() as unknown as ReadDatabaseClient["officer"];
  }
  get timeline() {
    const all = Array.from(this.timelinesByOfficer.values()).flat();
    return {
      async findMany() {
        return all;
      },
      async findUnique() {
        return null;
      },
      async count() {
        return all.length;
      },
      async groupBy() {
        return [];
      },
      async aggregate() {
        return {};
      },
    } as unknown as ReadDatabaseClient["timeline"];
  }
  get unit() {
    return this.emptyDelegate() as unknown as ReadDatabaseClient["unit"];
  }
  get phone() {
    return this.emptyDelegate() as unknown as ReadDatabaseClient["phone"];
  }

  private emptyDelegate() {
    return {
      async findMany() {
        return [];
      },
      async findUnique() {
        return null;
      },
      async count() {
        return 0;
      },
      async groupBy() {
        return [];
      },
      async aggregate() {
        return {};
      },
    };
  }
}
