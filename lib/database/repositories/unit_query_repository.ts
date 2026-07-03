/**
 * UnitQueryRepository (Phase 13, read-only).
 *
 * Returns the unit list with per-unit officer counts. Officer counts are
 * derived from the officers' currentUnit via groupBy (the authoritative
 * association), rather than the denormalized Unit.officerCount, so the count
 * reflects live officer data. No SQL — Prisma delegate calls only. Injected
 * client; no globals.
 */

import type { ReadDatabaseClient } from "@/lib/database/query_types";

export interface UnitCount {
  unit: string;
  officerCount: number;
}

export class UnitQueryRepository {
  constructor(private readonly db: ReadDatabaseClient) {}

  /** Lists distinct current units with the number of officers currently in each, most populous first. */
  async listWithCounts(): Promise<UnitCount[]> {
    const groups = await this.db.officer.groupBy({
      by: ["currentUnit"],
      where: { currentUnit: { not: null } },
      _count: { _all: true },
    });

    return groups
      .map((g) => ({
        unit: String(g.currentUnit ?? ""),
        officerCount: countOf(g),
      }))
      .filter((u) => u.unit.length > 0)
      .sort((a, b) => b.officerCount - a.officerCount || a.unit.localeCompare(b.unit));
  }
}

/** Extracts the group count from Prisma's _count shape (number or { _all }). */
function countOf(group: Record<string, unknown>): number {
  const c = group._count;
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && "_all" in c) return Number((c as { _all: number })._all);
  return 0;
}
