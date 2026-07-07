/**
 * In-memory fake AssetDbClient for Phase 19B tests — models the Prisma Asset
 * delegate (findUnique / findMany / upsert / count / groupBy) over a plain
 * array, honoring the unique `assetId`, the `where` filters the repository
 * generates (equality, `not`, insensitive contains/startsWith/equals, OR), and
 * groupBy with `_count._all`. No live database.
 */

import type { AssetDbClient, AssetDelegate, AssetRow } from "@/lib/gallery/prisma_asset_repository";

let nextId = 1;

function matchStringFilter(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== "object") return value === cond;
  const f = cond as Record<string, unknown>;
  const norm = (v: unknown) => (typeof v === "string" && f.mode === "insensitive" ? v.toLowerCase() : v);
  if ("not" in f) return value !== f.not;
  if ("equals" in f) return norm(value) === norm(f.equals);
  if ("contains" in f) return typeof value === "string" && String(norm(value)).includes(String(norm(f.contains)));
  if ("startsWith" in f) return typeof value === "string" && String(norm(value)).startsWith(String(norm(f.startsWith)));
  return false;
}

function matchesWhere(row: AssetRow, where?: Record<string, unknown>): boolean {
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

export class FakeAssetDbClient implements AssetDbClient {
  private rows: AssetRow[] = [];

  get asset(): AssetDelegate {
    // Capture the rows array (a stable reference — the class never reassigns it)
    // so the delegate closes over the data without aliasing `this`.
    const rows = this.rows;
    return {
      async findUnique(args) {
        return rows.find((r) => matchesWhere(r, args.where)) ?? null;
      },
      async findMany(args) {
        let result = rows.filter((r) => matchesWhere(r, args?.where));
        const orderBy = Array.isArray(args?.orderBy) ? args?.orderBy[0] : args?.orderBy;
        if (orderBy) {
          const [field, dir] = Object.entries(orderBy)[0] as [keyof AssetRow, "asc" | "desc"];
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
          Object.assign(existing, args.update);
          return { ...existing };
        }
        const row = { id: nextId++, ...(args.create as object) } as AssetRow;
        rows.push(row);
        return { ...row };
      },
      async update(args) {
        const row = rows.find((r) => matchesWhere(r, args.where));
        if (!row) throw new Error(`FakeAssetDbClient: record not found for update: ${JSON.stringify(args.where)}`);
        Object.assign(row, args.data);
        return { ...row };
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
