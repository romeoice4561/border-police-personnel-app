/**
 * Officer portrait resolution (Phase 23B bug #2 fix; Phase 24B-1 upload
 * priority; Phase 24B-2 classification metadata + batch resolver; Phase
 * 24B-3 simplified priority + Drive-portrait baseline).
 *
 * Resolves the portrait to display for an officer. The legacy
 * `Officer.driveFileId`/`thumbnailUrl` linkage from the original OCR import is
 * SYSTEMATICALLY UNRELIABLE (Phase 23B finding) and is NEVER used.
 *
 * The ONLY portrait source is ProfilePhoto, resolved via a single
 * deterministic priority (Phase 24B-3 spec):
 *
 *   1. Manual Upload           — sourceType=UPLOAD, isProfile=true
 *   2. Verified Manual Match   — matchStatus=MANUAL_MATCHED (a human
 *                                 explicitly linked this photo to the officer)
 *   3. Google Drive Portrait   — matchedOfficerId set via the automated
 *                                 matcher (matchStatus=AUTO_MATCHED). The four
 *                                 "Profile รายบุคคล ภาค N" Drive folders are the
 *                                 authoritative, manually-curated portrait
 *                                 source (owner-confirmed clean of maps/org
 *                                 charts/documents/profile cards as of Phase
 *                                 24B-3) — every photo discovered there is
 *                                 shown immediately once matched.
 *   4. Placeholder              — no linked portrait; caller shows a placeholder
 *
 * `classification` (Phase 24B-2) is METADATA ONLY as of Phase 24B-3 — it is
 * still recorded and shown in the review/cleanup UI, but it NEVER gates
 * whether a photo is displayed as a portrait. (The prior hard-exclusion rule
 * is intentionally removed now that the source folders are confirmed clean;
 * classification remains available for the legacy-cleanup admin tool and
 * future re-verification.)
 *
 * This is the ONE portrait resolver in the codebase — `resolveOfficerPortrait`
 * for a single officer and `resolveOfficerPortraitsBatch` for many officers at
 * once (one query per tier for the whole batch, not N queries per officer).
 * No other module may implement this priority independently. Wired into the
 * Officer List / Dashboard / Search (via /api/officers, /api/search) as of
 * Phase 24B-3 — see lib/api/api_handlers.ts.
 *
 * Server-only (imports the Prisma-backed client). Lazy per-process client,
 * mirroring officer_service.ts.
 */

import { createDatabaseClient } from "@/lib/database/database";
import { MatchStatus } from "@/lib/profile_photo/profile_photo_types";

/** Which resolver tier produced the portrait — drives the UI's source badge. */
export type PortraitSource = "UPLOADED" | "MANUAL_MATCH" | "DRIVE_PORTRAIT" | "PLACEHOLDER";

/** The resolved portrait — a Drive/Storage image identity, or null when none is trusted. */
export interface ResolvedOfficerPortrait {
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  /** Which tier resolved this portrait — PLACEHOLDER when none was found. */
  source: PortraitSource;
}

const NO_PORTRAIT: ResolvedOfficerPortrait = {
  driveFileId: null,
  thumbnailUrl: null,
  webViewUrl: null,
  source: "PLACEHOLDER",
};

interface ProfilePhotoLite {
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  matchStatus: string;
  sourceType: string;
  isProfile: boolean;
  matchedOfficerId?: string | null;
  updatedAt?: string | Date;
}

export interface PortraitDbClient {
  profilePhoto: {
    findFirst(args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
      select?: Record<string, boolean>;
    }): Promise<ProfilePhotoLite | null>;
    findMany?(args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
      select?: Record<string, boolean>;
    }): Promise<ProfilePhotoLite[]>;
  };
}

let cachedClient: PortraitDbClient | undefined;

function client(): PortraitDbClient {
  if (!cachedClient) {
    cachedClient = createDatabaseClient() as unknown as PortraitDbClient;
  }
  return cachedClient;
}

const SELECT = {
  driveFileId: true,
  thumbnailUrl: true,
  webViewUrl: true,
  matchStatus: true,
  sourceType: true,
  isProfile: true,
};

const SELECT_BATCH = { ...SELECT, matchedOfficerId: true, updatedAt: true };

function toResolved(photo: ProfilePhotoLite, source: PortraitSource): ResolvedOfficerPortrait {
  return { driveFileId: photo.driveFileId, thumbnailUrl: photo.thumbnailUrl, webViewUrl: photo.webViewUrl, source };
}

/** The 3 non-placeholder tiers, in priority order, as (where-clause, source-tag) pairs. */
function tierClauses(officerId: string): Array<{ where: Record<string, unknown>; source: PortraitSource }> {
  return [
    { where: { matchedOfficerId: officerId, isProfile: true, sourceType: "UPLOAD" }, source: "UPLOADED" },
    { where: { matchedOfficerId: officerId, matchStatus: MatchStatus.ManualMatched }, source: "MANUAL_MATCH" },
    { where: { matchedOfficerId: officerId, matchStatus: MatchStatus.AutoMatched }, source: "DRIVE_PORTRAIT" },
  ];
}

/**
 * Pure resolver over an injected client (testable). Returns the portrait for
 * `officerId` via the 4-tier priority above, or the placeholder result when
 * none exists. The legacy officer image is never consulted.
 */
export async function resolveOfficerPortraitWith(
  db: PortraitDbClient,
  officerId: string
): Promise<ResolvedOfficerPortrait> {
  for (const { where, source } of tierClauses(officerId)) {
    const match = await db.profilePhoto.findFirst({ where, orderBy: { updatedAt: "desc" }, select: SELECT });
    if (match) return toResolved(match, source);
  }
  return { ...NO_PORTRAIT };
}

/**
 * Resolves the portrait for `officerId` over the production client. Returns
 * the matched ProfilePhoto's image identity, or the placeholder result when
 * no portrait is linked (caller shows a placeholder — legacy officer images
 * are never returned).
 */
export function resolveOfficerPortrait(officerId: string): Promise<ResolvedOfficerPortrait> {
  return resolveOfficerPortraitWith(client(), officerId);
}

/**
 * Batch resolver: the SAME 4-tier priority as `resolveOfficerPortraitWith`,
 * for many officers at once — 3 queries total (one per non-placeholder tier,
 * scoped to `officerIds` via `matchedOfficerId IN (...)`), never N queries per
 * officer. This is the sanctioned building block for Officer List / Dashboard
 * / Search photo rendering (wired in via lib/api/api_handlers.ts, Phase
 * 24B-3); no caller may re-implement the priority independently.
 *
 * Returns a Map from officerId to its resolved portrait; every id in
 * `officerIds` is present in the result (placeholder when untrusted/missing).
 */
export async function resolveOfficerPortraitsBatchWith(
  db: PortraitDbClient,
  officerIds: readonly string[]
): Promise<Map<string, ResolvedOfficerPortrait>> {
  const result = new Map<string, ResolvedOfficerPortrait>();
  if (officerIds.length === 0) return result;

  const remaining = new Set(officerIds);
  const findMany = db.profilePhoto.findMany;
  if (!findMany) {
    // Fallback for a client that only implements findFirst (e.g. a minimal
    // test fake): resolve one officer at a time via the single-officer path.
    for (const id of officerIds) result.set(id, await resolveOfficerPortraitWith(db, id));
    return result;
  }

  const tiers: Array<{ source: PortraitSource; extraWhere: Record<string, unknown> }> = [
    { source: "UPLOADED", extraWhere: { isProfile: true, sourceType: "UPLOAD" } },
    { source: "MANUAL_MATCH", extraWhere: { matchStatus: MatchStatus.ManualMatched } },
    { source: "DRIVE_PORTRAIT", extraWhere: { matchStatus: MatchStatus.AutoMatched } },
  ];

  for (const { source, extraWhere } of tiers) {
    if (remaining.size === 0) break;

    const rows = await findMany({
      where: { matchedOfficerId: { in: [...remaining] }, ...extraWhere },
      orderBy: { updatedAt: "desc" },
      select: SELECT_BATCH,
    });

    // Rows are newest-first; keep only the first (most recent) row per officer.
    for (const row of rows) {
      const officerId = row.matchedOfficerId;
      if (!officerId || !remaining.has(officerId)) continue;
      result.set(officerId, toResolved(row, source));
      remaining.delete(officerId);
    }
  }

  for (const id of remaining) result.set(id, { ...NO_PORTRAIT });
  return result;
}

/** Resolves portraits for many officers over the production client. See `resolveOfficerPortraitsBatchWith`. */
export function resolveOfficerPortraitsBatch(officerIds: readonly string[]): Promise<Map<string, ResolvedOfficerPortrait>> {
  return resolveOfficerPortraitsBatchWith(client(), officerIds);
}
