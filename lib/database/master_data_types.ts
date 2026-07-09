/**
 * Master Data contracts (Phase 24A — Database V2 Foundation).
 *
 * Narrow, hand-written delegate interfaces over the subset of the Prisma V2
 * master-table API the master-data repositories use. Declared in a NEW file so
 * the Phase 12 `database_types.ts` and Phase 13 `query_types.ts` stay
 * byte-for-byte unchanged — this mirrors how each phase added its own
 * contracts file rather than editing the earlier ones.
 *
 * The real PrismaClient structurally satisfies `MasterDataClient`, and tests
 * inject an in-memory fake that does too (the codebase's fake-based testing
 * convention). Only the operations the repositories actually call are declared.
 *
 * These tables are the additive V2 foundation; nothing here touches the legacy
 * Phase 20A Region/Battalion/Company tables.
 */

import type {
  MasterRegion,
  MasterCommand,
  MasterSubdivision,
  MasterCompany,
  MasterRank,
  MasterPosition,
  MasterTimelineType,
  MasterAssetType,
  MasterDocumentType,
} from "@/lib/generated/prisma/client";

export type {
  MasterRegion,
  MasterCommand,
  MasterSubdivision,
  MasterCompany,
  MasterRank,
  MasterPosition,
  MasterTimelineType,
  MasterAssetType,
  MasterDocumentType,
};

/**
 * The subset of a Prisma model delegate the master-data repositories use.
 * `findMany` is included (master tables are small reference lists the UI reads
 * whole); `orderBy`/`where` mirror the Prisma options actually passed.
 */
export interface MasterModelDelegate<TRow> {
  findUnique(args: { where: Record<string, unknown> }): Promise<TRow | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  }): Promise<TRow[]>;
  create(args: { data: Record<string, unknown> }): Promise<TRow>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<TRow>;
  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<TRow>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
}

/** The master-table delegates the repositories operate through. */
export interface MasterDataClient {
  masterRegion: MasterModelDelegate<MasterRegion>;
  masterCommand: MasterModelDelegate<MasterCommand>;
  masterSubdivision: MasterModelDelegate<MasterSubdivision>;
  masterCompany: MasterModelDelegate<MasterCompany>;
  masterRank: MasterModelDelegate<MasterRank>;
  masterPosition: MasterModelDelegate<MasterPosition>;
  masterTimelineType: MasterModelDelegate<MasterTimelineType>;
  masterAssetType: MasterModelDelegate<MasterAssetType>;
  masterDocumentType: MasterModelDelegate<MasterDocumentType>;
}
