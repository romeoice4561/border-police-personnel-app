/**
 * StatisticsQueryRepository (Phase 13, read-only).
 *
 * Computes the /statistics aggregate over the persisted tables via Prisma
 * aggregate/count/groupBy — no SQL. Duplicate phones/names are detected by
 * grouping and keeping groups with count > 1 (detection only, consistent with
 * the knowledge/quality layers). Injected client; no globals.
 */

import type { ReadDatabaseClient } from "@/lib/database/query_types";

export interface ApiStatistics {
  totalOfficers: number;
  averageCareerYears: number;
  averageQuality: number;
  regions: number;
  units: number;
  timelines: number;
  duplicatePhones: number;
  duplicateNames: number;
}

function countOf(group: Record<string, unknown>): number {
  const c = group._count;
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && "_all" in c) return Number((c as { _all: number })._all);
  return 0;
}

function round(value: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

export class StatisticsQueryRepository {
  constructor(private readonly db: ReadDatabaseClient) {}

  async compute(): Promise<ApiStatistics> {
    const [totalOfficers, timelines, agg, regionGroups, unitGroups, phoneGroups, nameGroups] = await Promise.all([
      this.db.officer.count(),
      this.db.timeline.count(),
      this.db.officer.aggregate({ _avg: { careerYears: true, qualityScore: true } }),
      this.db.officer.groupBy({ by: ["region"], where: { region: { not: null } }, _count: { _all: true } }),
      this.db.officer.groupBy({ by: ["currentUnit"], where: { currentUnit: { not: null } }, _count: { _all: true } }),
      this.db.officer.groupBy({ by: ["phone"], where: { phone: { not: null } }, _count: { _all: true } }),
      this.db.officer.groupBy({ by: ["rank", "firstName", "lastName"], _count: { _all: true } }),
    ]);

    const avg = (agg._avg ?? {}) as { careerYears?: number | null; qualityScore?: number | null };

    const duplicatePhones = phoneGroups.filter((g) => countOf(g) > 1).length;
    const duplicateNames = nameGroups.filter((g) => countOf(g) > 1).length;

    return {
      totalOfficers,
      averageCareerYears: round(avg.careerYears ?? 0),
      averageQuality: round(avg.qualityScore ?? 0),
      regions: regionGroups.length,
      units: unitGroups.length,
      timelines,
      duplicatePhones,
      duplicateNames,
    };
  }

  /** Lightweight liveness probe for /health — a trivial count that requires a working connection. */
  async ping(): Promise<boolean> {
    await this.db.officer.count();
    return true;
  }
}
