/**
 * In-memory fake ProfilePhotoDbClient for Phase 21C tests — models the Prisma
 * ProfilePhoto delegate (findUnique / findMany / upsert / count / groupBy)
 * over a plain array, honoring the unique `driveFileId`, the `where` filters
 * the repository generates (equality, insensitive contains, OR), and groupBy
 * with `_count._all`. No live database.
 */

import type { ProfilePhotoDbClient, ProfilePhotoDelegate, ProfilePhotoRow } from "@/lib/profile_photo/prisma_profile_photo_repository";

let nextId = 1;

function matchStringFilter(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== "object") return value === cond;
  const f = cond as Record<string, unknown>;
  const norm = (v: unknown) => (typeof v === "string" && f.mode === "insensitive" ? v.toLowerCase() : v);
  if ("equals" in f) return norm(value) === norm(f.equals);
  if ("contains" in f) return typeof value === "string" && String(norm(value)).includes(String(norm(f.contains)));
  return false;
}

function matchesWhere(row: ProfilePhotoRow, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      const clauses = cond as Array<Record<string, unknown>>;
      if (!clauses.some((c) => matchesWhere(row, c))) return false;
    } else if (matchStringFilter((row as unknown as Record<string, unknown>)[key], cond) === false) {
      return false;
    }
  }
  return true;
}

export class FakeProfilePhotoDbClient implements ProfilePhotoDbClient {
  private rows: ProfilePhotoRow[] = [];

  get profilePhoto(): ProfilePhotoDelegate {
    const rows = this.rows;
    return {
      async findUnique(args) {
        return rows.find((r) => matchesWhere(r, args.where)) ?? null;
      },
      async findMany(args) {
        let result = rows.filter((r) => matchesWhere(r, args?.where));
        const orderBy = Array.isArray(args?.orderBy) ? args?.orderBy[0] : args?.orderBy;
        if (orderBy) {
          const [field, dir] = Object.entries(orderBy)[0] as [keyof ProfilePhotoRow, "asc" | "desc"];
          result = [...result].sort((a, b) => {
            const av = (a[field] ?? "") as string;
            const bv = (b[field] ?? "") as string;
            if (av === bv) return 0;
            return (av > bv ? 1 : -1) * (dir === "asc" ? 1 : -1);
          });
        }
        const skip = args?.skip ?? 0;
        const take = args?.take ?? result.length;
        return result.slice(skip, skip + take);
      },
      async upsert(args) {
        const existing = rows.find((r) => matchesWhere(r, args.where));
        if (existing) {
          Object.assign(existing, args.update, { updatedAt: new Date() });
          return { ...existing };
        }
        const row = { id: nextId++, createdAt: new Date(), updatedAt: new Date(), ...(args.create as object) } as ProfilePhotoRow;
        rows.push(row);
        return { ...row };
      },
      async update(args) {
        const row = rows.find((r) => matchesWhere(r, args.where));
        if (!row) throw new Error("Record to update not found");
        Object.assign(row, args.data, { updatedAt: new Date() });
        return { ...row };
      },
      async updateMany(args) {
        let count = 0;
        for (const row of rows) {
          if (matchesWhere(row, args.where)) {
            Object.assign(row, args.data, { updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
      async count(args) {
        return rows.filter((r) => matchesWhere(r, args?.where)).length;
      },
      async groupBy(args) {
        const filtered = rows.filter((r) => matchesWhere(r, args.where));
        const groups = new Map<string, { key: Record<string, unknown>; count: number }>();
        for (const r of filtered) {
          const keyObj: Record<string, unknown> = {};
          for (const field of args.by) keyObj[field] = (r as unknown as Record<string, unknown>)[field];
          const k = JSON.stringify(keyObj);
          const g = groups.get(k) ?? { key: keyObj, count: 0 };
          g.count += 1;
          groups.set(k, g);
        }
        return Array.from(groups.values()).map((g) => ({ ...g.key, _count: { _all: g.count } }));
      },
    };
  }

  /** Test helper: current row count. */
  size(): number {
    return this.rows.length;
  }
}
