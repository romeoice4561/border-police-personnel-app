/**
 * Officer portrait resolution (Phase 23B bug #2 fix; Phase 24B-1 upload
 * priority; Phase 24B-2 classification-aware priority + batch resolver).
 *
 * Resolves the portrait to display for an officer. The legacy
 * `Officer.driveFileId`/`thumbnailUrl` linkage from the original OCR import is
 * SYSTEMATICALLY UNRELIABLE (Phase 23B finding: even high-quality, fully-named
 * officer records have a `driveFileId` pointing at a deployment map /
 * organizational chart / profile-card composite). It is NEVER used.
 *
 * The ONLY portrait source is ProfilePhoto, resolved via a single deterministic
 * priority (Phase 24B-2 spec):
 *
 *   1. Manual Upload          — sourceType=UPLOAD, isProfile=true
 *   2. Manual Match            — matchStatus=MANUAL_MATCHED
 *   3. AI Match                — matchStatus=AUTO_MATCHED
 *   4. Verified Drive Portrait — matched to this officer AND
 *                                classification=REAL_PERSON (a reviewer
 *                                confirmed the image content, independent of
 *                                matchStatus/who linked it)
 *   5. Placeholder             — no trusted portrait; caller shows a placeholder
 *
 * HARD RULE, enforced at every tier: a photo whose classification is
 * PROFILE_CARD / ORGANIZATION / MAP / DOCUMENT is EXCLUDED and can never
 * become the resolved portrait, no matter how it's matched. Only UNKNOWN
 * (unreviewed — trusted provisionally, matching Phase 23B's original
 * behavior) and REAL_PERSON pass.
 *
 * This is the ONE portrait resolver in the codebase — `resolveOfficerPortrait`
 * for a single officer (officer detail page) and `resolveOfficerPortraitsBatch`
 * for many officers at once (the sanctioned building block for any future
 * Officer List / Dashboard / Search / Gallery / Commander Dashboard photo
 * rendering — one query per tier for the whole batch, not N queries per
 * officer). No other module may implement this priority independently.
 *
 * Server-only (imports the Prisma-backed client). Lazy per-process client,
 * mirroring officer_service.ts.
 */

import { createDatabaseClient } from "@/lib/database/database";
import { MatchStatus, PortraitClassification, NON_PORTRAIT_CLASSIFICATIONS } from "@/lib/profile_photo/profile_photo_types";

/** Which resolver tier produced the portrait — drives the UI's source badge. */
export type PortraitSource = "UPLOADED" | "MANUAL_MATCH" | "AI_MATCH" | "VERIFIED_DRIVE" | "PLACEHOLDER";

/** The resolved portrait — a Drive/Storage image identity, or null when none is trusted. */
export interface ResolvedOfficerPortrait {
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  /** Which tier resolved this portrait (Phase 24B-2) — PLACEHOLDER when none was found. */
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
  classification: string;
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
  classification: true,
};

const SELECT_BATCH = { ...SELECT, matchedOfficerId: true, updatedAt: true };

/** A photo classified as something other than UNKNOWN/REAL_PERSON is never a valid portrait, at any tier. */
const EXCLUDED_CLASSIFICATIONS: readonly string[] = NON_PORTRAIT_CLASSIFICATIONS;
const EXCLUDE_BAD_CLASSIFICATIONS = { classification: { notIn: EXCLUDED_CLASSIFICATIONS } };

function toResolved(photo: ProfilePhotoLite, source: PortraitSource): ResolvedOfficerPortrait {
  return { driveFileId: photo.driveFileId, thumbnailUrl: photo.thumbnailUrl, webViewUrl: photo.webViewUrl, source };
}

/** The 4 non-placeholder tiers, in priority order, as (where-clause, source-tag) pairs. */
function tierClauses(officerId: string): Array<{ where: Record<string, unknown>; source: PortraitSource }> {
  return [
    {
      where: { matchedOfficerId: officerId, isProfile: true, sourceType: "UPLOAD", ...EXCLUDE_BAD_CLASSIFICATIONS },
      source: "UPLOADED",
    },
    {
      where: { matchedOfficerId: officerId, matchStatus: MatchStatus.ManualMatched, ...EXCLUDE_BAD_CLASSIFICATIONS },
      source: "MANUAL_MATCH",
    },
    {
      where: { matchedOfficerId: officerId, matchStatus: MatchStatus.AutoMatched, ...EXCLUDE_BAD_CLASSIFICATIONS },
      source: "AI_MATCH",
    },
    {
      where: { matchedOfficerId: officerId, classification: PortraitClassification.RealPerson },
      source: "VERIFIED_DRIVE",
    },
  ];
}

/**
 * Pure resolver over an injected client (testable). Returns the trusted
 * ProfilePhoto's image identity for `officerId` via the 5-tier priority above,
 * or the placeholder result when none exists. The legacy officer image is
 * never consulted.
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
 * Resolves the trusted portrait for `officerId` over the production client.
 * Returns the matched ProfilePhoto's image identity, or the placeholder
 * result when no trusted match exists (caller shows a placeholder — legacy
 * officer images are never returned).
 */
export function resolveOfficerPortrait(officerId: string): Promise<ResolvedOfficerPortrait> {
  return resolveOfficerPortraitWith(client(), officerId);
}

/**
 * Batch resolver: the SAME 5-tier priority as `resolveOfficerPortraitWith`,
 * for many officers at once — 4 queries total (one per non-placeholder tier,
 * scoped to `officerIds` via `matchedOfficerId IN (...)`), never N queries per
 * officer. This is the sanctioned building block for any future Officer List /
 * Dashboard / Search / Gallery photo rendering; no caller may re-implement the
 * priority independently.
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
    { source: "UPLOADED", extraWhere: { isProfile: true, sourceType: "UPLOAD", ...EXCLUDE_BAD_CLASSIFICATIONS } },
    { source: "MANUAL_MATCH", extraWhere: { matchStatus: MatchStatus.ManualMatched, ...EXCLUDE_BAD_CLASSIFICATIONS } },
    { source: "AI_MATCH", extraWhere: { matchStatus: MatchStatus.AutoMatched, ...EXCLUDE_BAD_CLASSIFICATIONS } },
    { source: "VERIFIED_DRIVE", extraWhere: { classification: PortraitClassification.RealPerson } },
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
