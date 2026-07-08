/**
 * Officer portrait resolution (Phase 23B — bug #2 fix).
 *
 * Resolves the portrait to display for an officer. The legacy
 * `Officer.driveFileId`/`thumbnailUrl` linkage from the original OCR import is
 * SYSTEMATICALLY UNRELIABLE — visual inspection of production data showed that
 * even high-quality, fully-named officer records have a `driveFileId` pointing
 * at a deployment map / organizational chart / profile-card composite rather
 * than a portrait. So the legacy image is NEVER used as a portrait.
 *
 * The only trusted portrait source is a ProfilePhoto that has been explicitly
 * matched to this officer (matchStatus AUTO_MATCHED or MANUAL_MATCHED, with
 * matchedOfficerId set). When no such match exists, this returns null and the
 * UI shows a placeholder — never a legacy map image, never a guessed match.
 *
 * Server-only (imports the Prisma-backed client). Lazy per-process client,
 * mirroring officer_service.ts.
 */

import { createDatabaseClient } from "@/lib/database/database";
import { MatchStatus } from "@/lib/profile_photo/profile_photo_types";

/** The resolved portrait — a Drive image identity, or null when none is trusted. */
export interface ResolvedOfficerPortrait {
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
}

const NO_PORTRAIT: ResolvedOfficerPortrait = { driveFileId: null, thumbnailUrl: null, webViewUrl: null };

/** The match statuses whose ProfilePhoto is trusted as a real, human-or-confidently-linked portrait. */
const TRUSTED_MATCH_STATUSES: readonly string[] = [MatchStatus.AutoMatched, MatchStatus.ManualMatched];

interface ProfilePhotoLite {
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  matchStatus: string;
}

export interface PortraitDbClient {
  profilePhoto: {
    findFirst(args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
      select?: Record<string, boolean>;
    }): Promise<ProfilePhotoLite | null>;
  };
}

let cachedClient: PortraitDbClient | undefined;

function client(): PortraitDbClient {
  if (!cachedClient) {
    cachedClient = createDatabaseClient() as unknown as PortraitDbClient;
  }
  return cachedClient;
}

/**
 * Pure resolver over an injected client (testable). Returns the trusted
 * ProfilePhoto's image identity for `officerId`, or all-null when none exists.
 * The legacy officer image is never consulted.
 */
export async function resolveOfficerPortraitWith(
  db: PortraitDbClient,
  officerId: string
): Promise<ResolvedOfficerPortrait> {
  const match = await db.profilePhoto.findFirst({
    where: { matchedOfficerId: officerId, matchStatus: { in: TRUSTED_MATCH_STATUSES } },
    orderBy: { updatedAt: "desc" },
    select: { driveFileId: true, thumbnailUrl: true, webViewUrl: true, matchStatus: true },
  });

  if (!match) return { ...NO_PORTRAIT };
  return { driveFileId: match.driveFileId, thumbnailUrl: match.thumbnailUrl, webViewUrl: match.webViewUrl };
}

/**
 * Resolves the trusted portrait for `officerId` over the production client.
 * Returns the matched ProfilePhoto's image identity, or all-null when no
 * trusted match exists (caller shows a placeholder — legacy officer images
 * are never returned).
 */
export function resolveOfficerPortrait(officerId: string): Promise<ResolvedOfficerPortrait> {
  return resolveOfficerPortraitWith(client(), officerId);
}
