/**
 * ProfilePhoto domain types (Phase 21C — Universal Profile Photo Inbox).
 *
 * The ProfilePhoto entity is completely independent from Officer: every
 * discovered image under a "Profile รายบุคคล ..." Drive folder becomes
 * exactly one ProfilePhoto record, regardless of whether OCR succeeds, a
 * name can be found, or a matching officer exists. This guarantees the
 * phase's core invariant — NO PROFILE IMAGE IS EVER LOST — independent of
 * matching quality.
 *
 * Officer.driveFileId/thumbnailUrl/webViewUrl are UNCHANGED (Phase 17B) and
 * remain the source of truth for what the Officer page renders today;
 * ProfilePhoto.matchedOfficerId is an optional, additive link a future phase
 * may use to update them — never automatic, never required.
 *
 * Pure domain typing — no I/O, no OCR engine import, no Prisma import.
 */

/** Whether OCR was attempted/succeeded for this photo. Import always proceeds regardless of this status. */
export enum OcrStatus {
  /** OCR has not been attempted yet (e.g. imported before OCR ran, or OCR deferred). */
  Pending = "PENDING",
  /** OCR ran and produced text (however weak). */
  Completed = "COMPLETED",
  /** OCR was attempted and failed (download error, engine error, corrupt image, etc.). */
  Failed = "FAILED",
}

/**
 * The outcome of attempting to link a ProfilePhoto to an existing Officer.
 * The matcher NEVER decides whether the photo is imported (it always is) —
 * only whether/how it links to an officer.
 */
export enum MatchStatus {
  /** Not yet evaluated by the matcher. */
  Unassigned = "UNASSIGNED",
  /** The matcher found exactly one clear, high-confidence officer match. */
  AutoMatched = "AUTO_MATCHED",
  /** A human reviewer manually linked this photo to an officer (future action — Part 7). */
  ManualMatched = "MANUAL_MATCHED",
  /** Two or more officer candidates are ambiguous (too close to call automatically). */
  Conflict = "CONFLICT",
  /** Another ProfilePhoto already claims the same top-candidate officer at equal/higher confidence. */
  Duplicate = "DUPLICATE",
  /** The matcher ran but found no signal linking this photo to any officer. */
  Unknown = "UNKNOWN",
  /** Matched with some confidence, but below the safe-match threshold — needs a human to confirm. */
  ReviewRequired = "REVIEW_REQUIRED",
}

/** One imported Profile Photo. Independent of Officer — see module docstring. */
export interface ProfilePhoto {
  id: number;
  /** Google Drive file id — the deterministic idempotent upsert key. */
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  filename: string;
  /** Full relative path under the Drive scan root (e.g. "Profile รายบุคคล ภาค 1/38.png"). */
  folderPath: string;
  region: string | null;
  company: string | null;
  battalion: string | null;
  /** Raw OCR text extracted from the image, when OCR completed. Null if pending/failed. */
  ocrText: string | null;
  ocrStatus: OcrStatus;
  matchStatus: MatchStatus;
  /** The officer this photo is linked to, when matchStatus is AUTO_MATCHED or MANUAL_MATCHED. */
  matchedOfficerId: string | null;
  /** Confidence (0-100) of the match, when matchStatus indicates a candidate was found. Null otherwise. */
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Input to create/update one ProfilePhoto (everything except id/createdAt/updatedAt, which the repository owns). */
export type ProfilePhotoInput = Omit<ProfilePhoto, "id" | "createdAt" | "updatedAt">;

/** Filter/query parameters for listing ProfilePhotos (Part 6 — Review Queue architecture). */
export interface ProfilePhotoQuery {
  matchStatus?: MatchStatus;
  region?: string;
  company?: string;
  battalion?: string;
  /** Free-text match against filename / folderPath / matchedOfficerId. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProfilePhotos {
  data: ProfilePhoto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Count of ProfilePhotos per matchStatus — drives the future Inbox's filter chips (Part 6). */
export interface MatchStatusCount {
  matchStatus: MatchStatus;
  count: number;
}
