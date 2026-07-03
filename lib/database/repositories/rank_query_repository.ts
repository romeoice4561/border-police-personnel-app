/**
 * RankQueryRepository (Phase 13, read-only).
 *
 * Returns the rank list with per-rank officer counts, via groupBy over the
 * officers' rank. No SQL — Prisma delegate calls only. Injected client.
 */

import type { ReadDatabaseClient } from "@/lib/database/query_types";

export interface RankCount {
  rank: string;
  officerCount: number;
}

function countOf(group: Record<string, unknown>): number {
  const c = group._count;
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && "_all" in c) return Number((c as { _all: number })._all);
  return 0;
}

export class RankQueryRepository {
  constructor(private readonly db: ReadDatabaseClient) {}

  async listWithCounts(): Promise<RankCount[]> {
    const groups = await this.db.officer.groupBy({
      by: ["rank"],
      _count: { _all: true },
    });

    return groups
      .map((g) => ({ rank: String(g.rank ?? ""), officerCount: countOf(g) }))
      .filter((r) => r.rank.length > 0)
      .sort((a, b) => b.officerCount - a.officerCount || a.rank.localeCompare(b.rank));
  }
}
